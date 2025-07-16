import { Readability } from '@mozilla/readability';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener((message) => {
      if (message.action === 'extract-article-text') {
        const documentClone = document.cloneNode(true) as Document;
        const article = new Readability(documentClone).parse();

        if (article) {
          const style = document.createElement('style');
          style.textContent = `
            body {
              background-color: #fff;
            }
            #reader-mode-container {
              max-width: 800px;
              margin: 20px auto;
              padding: 20px;
              font-family: sans-serif;
              line-height: 1.6;
              color: #333;
            }
            #reader-mode-controls {
              position: fixed;
              top: 20px;
              right: 20px;
              background: #f8f8f8;
              padding: 15px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              z-index: 10000;
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            #reader-mode-content.hide-links a { pointer-events: none; text-decoration: none; color: inherit; cursor: default; }
            #reader-mode-content.hide-buttons button { display: none; }
            #reader-mode-content.hide-images img {
              display: none;
            }
            #reader-mode-content img {
              display: block;
              max-width: 100%;
              height: auto;
              margin: 1em auto;
            }
            #reader-mode-content.hide-captions figcaption {
              display: none;
            }
          `;

          document.head.innerHTML = '';
          document.head.appendChild(style);

          document.body.innerHTML = `
            <div id="reader-mode-controls">
              <label><input type="checkbox" id="toggle-links"> Hide Links</label>
              <label><input type="checkbox" id="toggle-buttons" checked> Hide Buttons</label>
              <label><input type="checkbox" id="toggle-images"> Hide Images</label>
              <label><input type="checkbox" id="toggle-captions"> Hide Image Captions</label>
            </div>
            <div id="reader-mode-container">
              <h1>${article.title}</h1>
              <div id="reader-mode-content">${article.content}</div>
            </div>
          `;

          const contentDiv = document.getElementById('reader-mode-content')!;
          const toggleLinks = document.getElementById('toggle-links') as HTMLInputElement;
          const toggleButtons = document.getElementById('toggle-buttons') as HTMLInputElement;
          const toggleImages = document.getElementById('toggle-images') as HTMLInputElement;
          const toggleCaptions = document.getElementById('toggle-captions') as HTMLInputElement;

          // Initial state
          contentDiv.classList.add('hide-buttons');

          toggleLinks.addEventListener('change', () => {
            contentDiv.classList.toggle('hide-links', toggleLinks.checked);
          });

          toggleButtons.addEventListener('change', () => {
            contentDiv.classList.toggle('hide-buttons', toggleButtons.checked);
          });

          toggleImages.addEventListener('change', () => {
            contentDiv.classList.toggle('hide-images', toggleImages.checked);
          });

          toggleCaptions.addEventListener('change', () => {
            contentDiv.classList.toggle('hide-captions', toggleCaptions.checked);
          });
        }
      }
    });
  },
});