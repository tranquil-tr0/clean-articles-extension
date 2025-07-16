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
    if (!response || !response.content) {
      alert('Failed to extract article for PDF.');
      return;
    }

    // Convert HTML content to plain text (basic, for MVP)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = response.content;
    const text = tempDiv.innerText || '';

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 14;
    const margin = 40;
    const maxWidth = width - margin * 2;

    // Simple line wrapping
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

    let y = height - margin;
    let currentPage = page;

    // Draw title on first page
    currentPage.drawText(response.title, {
      x: margin,
      y: y,
      size: fontSize + 4,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= fontSize + 12;

    for (const line of lines) {
      if (y < margin) {
        currentPage = pdfDoc.addPage();
        y = height - margin;
      }
      currentPage.drawText(line, {
        x: margin,
        y: y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });
      y -= fontSize + 4;
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
