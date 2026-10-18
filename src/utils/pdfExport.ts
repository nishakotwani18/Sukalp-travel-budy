import jsPDF from 'jspdf';
import { SavedItinerary } from '../types.ts';

/**
 * Cleanly strips markdown symbols (*, #, _, `) for PDF text layout
 */
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[\*\-]\s*/gm, '• ')
    .trim();
}

/**
 * Exports a saved itinerary into a beautifully styled PDF document for offline travel access
 */
export function exportItineraryToPdf(itinerary: SavedItinerary): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Helper for automatic page break
  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 18) {
      doc.addPage();
      y = margin;
      drawFooter();
    }
  };

  const drawFooter = () => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      'SUKALP AI Buddy • Plan less. Experience more. • Estimates are approximate for offline reference.',
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  };

  // 1. Top Header Banner
  doc.setFillColor(30, 64, 175); // Deep Blue
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('SUKALP AI Buddy', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);
  doc.text('Plan less. Experience more. — Offline Travel Plan', margin + 6, y + 16);

  y += 28;

  // 2. Trip Title & Inquiry Box
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Destination Inquiry:', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const titleLines = doc.splitTextToSize(`"${itinerary.request_text}"`, contentWidth - 8);
  doc.text(titleLines, margin + 4, y + 12);

  y += 30;

  // 3. Metadata Badges (Status & Date)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  const formattedDate = new Date(itinerary.created_at).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const isApproved = itinerary.review_status === 'Auto-checked (no flags)' || itinerary.review_status === 'Auto-approved (no flags)';
  
  // Status pill
  if (isApproved) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.setTextColor(4, 120, 87);
  } else {
    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(253, 230, 138);
    doc.setTextColor(180, 83, 9);
  }
  doc.roundedRect(margin, y, 48, 6, 1.5, 1.5, 'FD');
  doc.text(isApproved ? '✓ Verified Stays' : '⚠ Pending Review', margin + 3, y + 4.2);

  // Date info
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Saved on: ${formattedDate}`, margin + 54, y + 4.2);

  if (itinerary.destination_ids) {
    doc.text(`Locations: ${itinerary.destination_ids}`, margin + 110, y + 4.2);
  }

  y += 12;

  // 4. Parse Sections / Evidence Cards
  const lines = itinerary.response_text.split('\n');
  const sections: { title: string; content: string[] }[] = [];
  let currentSection: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,4}\s*(?:\d+[\.\)]\s*)?([a-zA-Z\s\-&]+)/i);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: headingMatch[1].trim(),
        content: []
      };
    } else if (currentSection) {
      if (line.trim()) {
        currentSection.content.push(line);
      }
    } else if (line.trim()) {
      if (!sections.length && !currentSection) {
        currentSection = {
          title: 'Overview',
          content: [line]
        };
      }
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  // 5. Render Each Section into PDF
  sections.forEach((sec, index) => {
    checkPageBreak(25);

    // Section Header Bar
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(29, 78, 216); // Blue-700
    doc.text(`${index + 1}. ${sec.title.toUpperCase()}`, margin + 4, y + 4.8);

    y += 10;

    // Section Content lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    sec.content.forEach((line) => {
      const isBullet = line.trim().startsWith('*') || line.trim().startsWith('-');
      const cleaned = cleanMarkdown(line);
      const splitText = doc.splitTextToSize(cleaned, contentWidth - 6);
      
      const lineHeight = 4.2;
      checkPageBreak(splitText.length * lineHeight + 2);

      if (isBullet) {
        doc.text(splitText, margin + 4, y);
      } else {
        doc.text(splitText, margin + 2, y);
      }

      y += splitText.length * lineHeight + 1;
    });

    y += 4; // Spacing after section
  });

  // Final draw footer on all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter();
  }

  // Clean filename
  const cleanTitle = (itinerary.request_text || 'Trip_Plan')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .slice(0, 25);
  const filename = `SUKALP_Itinerary_${cleanTitle}.pdf`;

  // Trigger browser download
  doc.save(filename);
}
