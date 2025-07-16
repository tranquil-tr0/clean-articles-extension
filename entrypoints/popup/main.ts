import './style.css';

// Add UI for entering reader mode
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div>
    <h1>Clean Articles</h1>
    <div class="card">
      <button id="reader-mode-btn" type="button">Enter Reader Mode</button>
    </div>
    <div class="card">
      <button id="print-btn" type="button">Print Article</button>
    </div>
    <div class="card">
      <button id="save-pdf-btn" type="button">Save as PDF</button>
    </div>
  </div>
`;

// Add event listener for the reader mode button
const readerModeBtn = document.getElementById('reader-mode-btn')!;
readerModeBtn.addEventListener('click', async () => {
  // Query the active tab
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    return;
  }

  // Send message to content script to activate reader mode
  try {
    await browser.tabs.sendMessage(tab.id, { action: 'extract-article-text' });
    window.close(); // Close the popup
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
savePdfBtn.addEventListener('click', () => {
  window.print(); // The browser's print dialog should have a "Save as PDF" option
});
