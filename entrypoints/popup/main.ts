import './style.css';
import readerModeIcon from '../../assets/file-text.svg';
import printIcon from '../../assets/printer.svg';
import savePdfIcon from '../../assets/file-type-pdf.svg';
import fontkit from '@pdf-lib/fontkit';
import interRegularTtf from '../../assets/fonts/inter-v19-latin-regular.ttf';
import interRegular from '../../assets/fonts/inter-v19-latin-regular.woff2';
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
    console.log('[POPUP DEBUG] PDF export handler triggered');
    console.log('interRegularTtf import:', typeof interRegularTtf, interRegularTtf);
  if (!tab.id) return;
  try {
    console.log('[POPUP DEBUG] Sending save-reader-pdf message to tab', tab.id);
    const response = await browser.tabs.sendMessage(tab.id, { action: 'save-reader-pdf' });
    console.log('[POPUP DEBUG] Received response from content script:', response);
    if (!response) {
      alert('Failed to communicate with the content script. Please ensure the extension is allowed on this page and try again.');
      return;
    }
    if (response.error) {
      console.error('PDF export failed, response:', response);
      alert('Failed to extract article for PDF.' + (response.error ? '\n' + response.error : ''));
      return;
    }

    // Extract preferences for formatting
    const preferences = response.preferences || {};
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = response.content;
    const text = tempDiv.innerText || '';
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();

    // Font mapping
    let font;
    let fontFamily = (preferences.fontFamily || '').toLowerCase();
    if (fontFamily.includes('inter')) {
      // interRegularTtf is a URL string, fetch as ArrayBuffer
      const fontBytes = await fetch(interRegularTtf).then(r => r.arrayBuffer());
      console.log('Inter TTF fetched byteLength:', fontBytes.byteLength);
      font = await pdfDoc.embedFont(fontBytes);
    } else if (fontFamily.includes('serif') && !fontFamily.includes('sans')) {
      font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    } else if (fontFamily.includes('mono')) {
      font = await pdfDoc.embedFont(StandardFonts.Courier);
    } else {
      font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const fontSize = preferences.fontSize || 16;
    const margin = 40;
    const maxWidth = Math.min(width - margin * 2, preferences.textWidth || 800);

    // Color parsing helper
    function hexToRgb(hex: string, fallback: ReturnType<typeof rgb>): ReturnType<typeof rgb> {
      if (!hex) return fallback;
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map((x: string) => x + x).join('');
      if (c.length !== 6) return fallback;
      const num = parseInt(c, 16);
      return rgb(
        ((num >> 16) & 255) / 255,
        ((num >> 8) & 255) / 255,
        (num & 255) / 255
      );
    }
    const textColor = hexToRgb(preferences.textColor, rgb(0.15, 0.15, 0.15));
    const titleColor = hexToRgb(preferences.textColor, rgb(0.1, 0.1, 0.1));
    const bgColor = hexToRgb(preferences.backgroundColor, rgb(0.97, 0.96, 0.95));

    // Draw background
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: bgColor,
    });

    // Use new recursive HTML-to-PDF renderer
    let y = height - margin;
    await renderHtmlToPdf(tempDiv, pdfDoc, page, font, fontSize, margin, maxWidth, y);

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


import { degrees } from 'pdf-lib'; // For image rotation if needed

async function fetchImageAsBytes(src: string): Promise<Uint8Array | null> {
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

// Minimal recursive HTML-to-PDF renderer for <p>, <h1>, <img>
async function renderHtmlToPdf(
  root: HTMLElement,
  pdfDoc: PDFDocument,
  page: any,
  font: any,
  fontSize: number,
  margin: number,
  maxWidth: number,
  y: number,
  options: any = {}
) {
  let currentY = y;
  for (const el of Array.from(root.children)) {
    if (el.tagName === 'P') {
      const text = el.textContent || '';
      const lines = [];
      let currentLine = '';
      for (const word of text.split(/\s+/)) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const size = font.widthOfTextAtSize(testLine, fontSize);
        if (size > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      for (const line of lines) {
        if (currentY < margin) {
          page = pdfDoc.addPage();
          currentY = page.getSize().height - margin;
        }
        page.drawText(line, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
        });
        currentY -= fontSize + 4;
      }
      currentY -= 4;
    } else if (el.tagName === 'H1') {
      const text = el.textContent || '';
      const h1Size = fontSize + 8;
      if (currentY < margin + h1Size) {
        page = pdfDoc.addPage();
        currentY = page.getSize().height - margin;
      }
      page.drawText(text, {
        x: margin,
        y: currentY,
        size: h1Size,
        font,
      });
      currentY -= h1Size + 8;
    } else if (el.tagName === 'IMG') {
      const src = (el as HTMLImageElement).src;
      const imgBytes = await fetchImageAsBytes(src);
      if (imgBytes) {
        let pdfImg;
        if (src.endsWith('.png')) {
          pdfImg = await pdfDoc.embedPng(imgBytes);
        } else {
          pdfImg = await pdfDoc.embedJpg(imgBytes);
        }
        const imgWidth = Math.min(pdfImg.width, maxWidth);
        const imgHeight = (pdfImg.height / pdfImg.width) * imgWidth;
        if (currentY - imgHeight < margin) {
          page = pdfDoc.addPage();
          currentY = page.getSize().height - margin;
        }
        page.drawImage(pdfImg, {
          x: margin,
          y: currentY - imgHeight,
          width: imgWidth,
          height: imgHeight,
        });
        currentY -= imgHeight + 12;
      }
    } else {
      // Recursively handle children of other elements
      currentY = await renderHtmlToPdf(el as HTMLElement, pdfDoc, page, font, fontSize, margin, maxWidth, currentY, options);
    }
  }
  return currentY;
}
