import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase.ts';
import { UserProfile } from '../types.ts';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  saveProfile: (profileData: Omit<UserProfile, 'user_id'>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitor Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Monitor and load user profile from Firestore whenever user is authenticated
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileDocRef = doc(db, 'users_profile', user.uid);
    const path = `users_profile/${user.uid}`;

    const unsubscribeProfile = onSnapshot(
      profileDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Default initial profile
          const defaultProfile: UserProfile = {
            user_id: user.uid,
            traveller_type: '',
            budget_inr: 'Moderate (~₹4,000/day)',
            food_preference: 'Local / Any',
            accessibility_need: 'None',
            consent_status: 'accepted',
            updated_at: new Date().toISOString()
          };
          setProfile(defaultProfile);
        }
      },
      (error) => {
        console.warn('Profile snapshot listener error:', error);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsubscribeProfile();
  }, [user]);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      // If popup was blocked or failed due to environment, fallback or throw
      throw error;
    }
  };

  const signOutUser = async () => {
    try {
      // Requirement 11: delete every chat key in localStorage and sessionStorage, including sukalp_chat_session_active and per-uid keys
      if (typeof window !== 'undefined') {
        const localKeysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.includes('chat') || k.startsWith('sukalp_') || k === 'sukalp_chat_session_active')) {
            localKeysToRemove.push(k);
          }
        }
        localKeysToRemove.forEach(k => localStorage.removeItem(k));

        const sessionKeysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.includes('chat') || k.startsWith('sukalp_') || k === 'sukalp_chat_session_active')) {
            sessionKeysToRemove.push(k);
          }
        }
        sessionKeysToRemove.forEach(k => sessionStorage.removeItem(k));

        window.dispatchEvent(new Event('sukalp_chat_signout'));
      }
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const saveProfile = async (profileData: Omit<UserProfile, 'user_id'>) => {
    if (!user) throw new Error('User not logged in');

    const path = `users_profile/${user.uid}`;
    const payload: UserProfile = {
      user_id: user.uid,
      ...profileData,
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users_profile', user.uid), payload, { merge: true });
      setProfile(payload);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithGoogle,
        signOutUser,
        saveProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
