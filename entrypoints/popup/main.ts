import './style.css';
import readerModeIcon from '../../assets/file-text.svg';
import printIcon from '../../assets/printer.svg';
import savePdfIcon from '../../assets/file-type-pdf.svg';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Add UI for entering reader mode
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="container">
    <h1>Clean Articles</h1>
    <button id="reader-mode-btn" type="button">
      <img src="${readerModeIcon}" alt="Reader Mode" />
      <span id="reader-mode-btn-label">Enter Reader Mode</span>
    </button>
    <button id="print-btn" type="button">
      <img src="${printIcon}" alt="Print Article" />
      Print Article
    </button>
    <button id="save-pdf-btn" type="button">
      <img src="${savePdfIcon}" alt="Save as PDF" />
      Save as PDF
    </button>
  </div>
`;

// Add event listener for the reader mode button
const readerModeBtn = document.getElementById('reader-mode-btn')!;
const readerModeBtnLabel = document.getElementById('reader-mode-btn-label')!;

let isReaderModeActive = false;

// Query content script for Reader Mode state on popup load
(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  try {
    const response = await browser.tabs.sendMessage(tab.id, { action: 'is-reader-mode-active' });
    if (response && response.active) {
      isReaderModeActive = true;
      readerModeBtnLabel.textContent = 'Exit Reader Mode';
    } else {
      isReaderModeActive = false;
      readerModeBtnLabel.textContent = 'Enter Reader Mode';
    }
  } catch {
    // If no response, assume not active
    isReaderModeActive = false;
    readerModeBtnLabel.textContent = 'Enter Reader Mode';
  }
})();

readerModeBtn.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;

  try {
    if (isReaderModeActive) {
      await browser.tabs.sendMessage(tab.id, { action: 'exit-reader-mode' });
    } else {
      await browser.tabs.sendMessage(tab.id, { action: 'extract-article-text' });
    }
    window.close();
  } catch (err) {
    console.error('Error sending message to content script:', err);
  }
});

// Add event listener for the print button
const printBtn = document.getElementById('print-btn')!;
printBtn.addEventListener('click', () => {
  window.print();
});

// Add event listener for the save as PDF button
const savePdfBtn = document.getElementById('save-pdf-btn')!;
savePdfBtn.addEventListener('click', async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) return;
  try {
    const response = await browser.tabs.sendMessage(tab.id, { action: 'save-reader-pdf' });
    if (!response) {
      alert('Failed to communicate with the content script. Please ensure the extension is allowed on this page and try again.');
      return;
    }
    if (response.error) {
      console.error('PDF export failed, response:', response);
      alert('Failed to extract article for PDF.' + (response.error ? '\n' + response.error : ''));
      return;
    }

    // Convert HTML content to plain text and preserve paragraphs
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = response.content;
    const paragraphs = Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote'))
      .map(el => (el as HTMLElement).innerText.trim())
      .filter(Boolean);

    // Use reader mode preferences for styling
    const prefs = response.preferences || {};
    // Font mapping
    let fontRef = StandardFonts.Helvetica;
    if (prefs.fontFamily?.includes('serif') && !prefs.fontFamily?.includes('sans')) {
      fontRef = StandardFonts.TimesRoman;
    } else if (prefs.fontFamily?.includes('monospace')) {
      fontRef = StandardFonts.Courier;
    }
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(fontRef);
    const fontSize = prefs.fontSize || 16;
    const titleFontSize = Math.round(fontSize * 1.5);
    const lineHeight = fontSize * 1.6;
    const margin = 48;
    const maxTextWidth = Math.min(prefs.textWidth || 700, width - margin * 2);

    // Parse color hex to rgb
    function hexToRgb(hex: string, fallback: [number, number, number]) {
      if (!hex || typeof hex !== 'string') return fallback;
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      if (c.length !== 6) return fallback;
      const num = parseInt(c, 16);
      return [
        ((num >> 16) & 255) / 255,
        ((num >> 8) & 255) / 255,
        (num & 255) / 255,
      ] as [number, number, number];
    }
    const bgColor = hexToRgb(prefs.backgroundColor, [0.965, 0.96, 0.949]);
    const textColor = hexToRgb(prefs.textColor, [0.13, 0.13, 0.13]);

    // Simulate reader mode background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(...bgColor),
    });

    let y = height - margin;
    let currentPage = page;

    // Draw title
    currentPage.drawText(response.title, {
      x: margin,
      y: y,
      size: titleFontSize,
      font,
      color: rgb(...textColor),
      maxWidth: maxTextWidth,
    });
    y -= titleFontSize + 18;

    // Text alignment
    let align = (prefs.textAlign || 'left') as 'left' | 'center' | 'justify';

    for (const para of paragraphs) {
      // Word wrap each paragraph
      let words = para.split(/\s+/);
      let line = '';
      for (const word of words) {
        const testLine = line ? line + ' ' + word : word;
        const size = font.widthOfTextAtSize(testLine, fontSize);
        if (size > maxTextWidth && line) {
          if (y < margin + lineHeight) {
            currentPage = pdfDoc.addPage();
            currentPage.drawRectangle({
              x: 0,
              y: 0,
              width,
              height,
              color: rgb(...bgColor),
            });
            y = height - margin;
          }
          let x = margin;
          if (align === 'center') {
            x = margin + (maxTextWidth - font.widthOfTextAtSize(line, fontSize)) / 2;
          }
          currentPage.drawText(line, {
            x,
            y: y,
            size: fontSize,
            font,
            color: rgb(...textColor),
            maxWidth: maxTextWidth,
          });
          y -= lineHeight;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        if (y < margin + lineHeight) {
          currentPage = pdfDoc.addPage();
          currentPage.drawRectangle({
            x: 0,
            y: 0,
            width,
            height,
            color: rgb(...bgColor),
          });
          y = height - margin;
        }
        let x = margin;
        if (align === 'center') {
          x = margin + (maxTextWidth - font.widthOfTextAtSize(line, fontSize)) / 2;
        }
        currentPage.drawText(line, {
          x,
          y: y,
          size: fontSize,
          font,
          color: rgb(...textColor),
          maxWidth: maxTextWidth,
        });
        y -= lineHeight;
      }
      y -= lineHeight * 0.5; // Extra space between paragraphs
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = (response.title || 'article') + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);

    window.close();
  } catch (err) {
    alert('Error saving PDF: ' + err);
  }
});
