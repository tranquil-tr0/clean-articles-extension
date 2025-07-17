import './style.css';
import readerModeIcon from '../../assets/file-text.svg';
import printIcon from '../../assets/printer.svg';
import savePdfIcon from '../../assets/file-type-pdf.svg';
import html2pdf from 'html2pdf.js';
import { formatArticleForPdf, ReaderModePreferences } from '../formatForPdf';

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
      alert('Failed to extract article for PDF.' + (response.error ? '\n' + response.error : ''));
      return;
    }

    // Format the article HTML for PDF export
    const formattedHtml = await formatArticleForPdf(
      { title: response.title, content: response.content },
      response.preferences as ReaderModePreferences
    );

    // Create an invisible iframe to isolate styles
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    document.body.appendChild(iframe);

    // Write the formatted HTML into the iframe
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      alert('Failed to create iframe for PDF export.');
      document.body.removeChild(iframe);
      return;
    }
    iframeDoc.open();
    iframeDoc.write(formattedHtml);
    iframeDoc.close();

    // Wait for fonts/images to load
    await new Promise(resolve => setTimeout(resolve, 300));

    // Use html2pdf.js to export the HTML to PDF
    await html2pdf()
      .set({
        margin: 0.5,
        filename: (response.title || 'article') + '.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      })
      .from(iframeDoc.body)
      .save();

    document.body.removeChild(iframe);
    window.close();
  } catch (err) {
    alert('Error saving PDF: ' + err);
  }
});