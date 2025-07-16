import { Readability } from '@mozilla/readability';
import { storage } from '#imports';

interface ReaderModePreferences {
  hideLinks: boolean;
  hideButtons: boolean;
  hideImages: boolean;
  hideCaptions: boolean;
}

const preferencesStorage = storage.defineItem<ReaderModePreferences>(
  'local:readerModePreferences',
  {
    defaultValue: {
      hideLinks: false,
      hideButtons: true,
      hideImages: false,
      hideCaptions: false,
    },
  },
);

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    browser.runtime.onMessage.addListener(async (message) => {
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

          const preferences = await preferencesStorage.getValue();

          document.body.innerHTML = `
            <div id="reader-mode-controls">
              <label><input type="checkbox" id="toggle-links" ${preferences.hideLinks ? 'checked' : ''}> Hide Links</label>
              <label><input type="checkbox" id="toggle-buttons" ${preferences.hideButtons ? 'checked' : ''}> Hide Buttons</label>
              <label><input type="checkbox" id="toggle-images" ${preferences.hideImages ? 'checked' : ''}> Hide Images</label>
              <label><input type="checkbox" id="toggle-captions" ${preferences.hideCaptions ? 'checked' : ''}> Hide Image Captions</label>
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
          contentDiv.classList.toggle('hide-links', toggleLinks.checked);
          contentDiv.classList.toggle('hide-buttons', toggleButtons.checked);
          contentDiv.classList.toggle('hide-images', toggleImages.checked);
          contentDiv.classList.toggle('hide-captions', toggleCaptions.checked);

          toggleLinks.addEventListener('change', async () => {
            contentDiv.classList.toggle('hide-links', toggleLinks.checked);
            await preferencesStorage.setValue({ ...await preferencesStorage.getValue(), hideLinks: toggleLinks.checked });
          });

          toggleButtons.addEventListener('change', async () => {
            contentDiv.classList.toggle('hide-buttons', toggleButtons.checked);
            await preferencesStorage.setValue({ ...await preferencesStorage.getValue(), hideButtons: toggleButtons.checked });
          });

          toggleImages.addEventListener('change', async () => {
            contentDiv.classList.toggle('hide-images', toggleImages.checked);
            await preferencesStorage.setValue({ ...await preferencesStorage.getValue(), hideImages: toggleImages.checked });
          });

          toggleCaptions.addEventListener('change', async () => {
            contentDiv.classList.toggle('hide-captions', toggleCaptions.checked);
            await preferencesStorage.setValue({ ...await preferencesStorage.getValue(), hideCaptions: toggleCaptions.checked });
          });
        }
      }
    });
  },
});