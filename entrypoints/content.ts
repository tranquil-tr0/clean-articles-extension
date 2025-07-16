import { Readability } from '@mozilla/readability';
import { storage } from '#imports';

interface ReaderModePreferences {
  hideLinks: boolean;
  hideButtons: boolean;
  hideImages: boolean;
  hideCaptions: boolean;
  backgroundColor: string;
  fontFamily: string;
  fontSize: number;
  textWidth: number;
  textAlign: 'left' | 'center' | 'justify';
  textColor: string;
}

const preferencesStorage = storage.defineItem<ReaderModePreferences>(
  'local:readerModePreferences',
  {
    defaultValue: {
      hideLinks: false,
      hideButtons: true,
      hideImages: false,
      hideCaptions: false,
      backgroundColor: '#fff',
      fontFamily: 'sans-serif',
      fontSize: 16,
      textWidth: 800,
      textAlign: 'left',
      textColor: '#333',
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
          const preferences = await preferencesStorage.getValue();

          const style = document.createElement('style');
          style.textContent = `
            body {
              background-color: var(--reader-bg-color, #fff);
            }
            #reader-mode-container {
              max-width: var(--reader-text-width, 800px);
              margin: 20px auto;
              padding: 20px;
              font-family: var(--reader-font-family, sans-serif);
              font-size: var(--reader-font-size, 16px);
              line-height: 1.6;
              color: var(--reader-text-color, #333);
              text-align: var(--reader-text-align, left);
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
              <label><input type="checkbox" id="toggle-buttons"> Hide Buttons</label>
              <label><input type="checkbox" id="toggle-images"> Hide Images</label>
              <label><input type="checkbox" id="toggle-captions"> Hide Image Captions</label>
              <hr>
              <label>Text Align: 
                <select id="text-align">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="justify">Justify</option>
                </select>
              </label>
              <label>Background: <input type="color" id="bg-color"></label>
              <label>Text Color: <input type="color" id="text-color"></label>
              <label>Font: 
                <select id="font-family">
                  <option value="sans-serif">Sans Serif</option>
                  <option value="serif">Serif</option>
                  <option value="monospace">Monospace</option>
                </select>
              </label>
              <label>Font Size: <input type="range" id="font-size" min="12" max="24" step="1"></label>
              <label>Text Width: <input type="range" id="text-width" min="400" max="1200" step="50"></label>
            </div>
            <div id="reader-mode-container">
              <h1>${article.title}</h1>
              <div id="reader-mode-content">${article.content}</div>
            </div>
          `;

          const contentDiv = document.getElementById('reader-mode-content')!;
          const container = document.getElementById('reader-mode-container')!;

          const toggleLinks = document.getElementById('toggle-links') as HTMLInputElement;
          const toggleButtons = document.getElementById('toggle-buttons') as HTMLInputElement;
          const toggleImages = document.getElementById('toggle-images') as HTMLInputElement;
          const toggleCaptions = document.getElementById('toggle-captions') as HTMLInputElement;
          const textAlignSelector = document.getElementById('text-align') as HTMLSelectElement;
          const bgColorPicker = document.getElementById('bg-color') as HTMLInputElement;
          const textColorPicker = document.getElementById('text-color') as HTMLInputElement;
          const fontFamilySelector = document.getElementById('font-family') as HTMLSelectElement;
          const fontSizeSlider = document.getElementById('font-size') as HTMLInputElement;
          const textWidthSlider = document.getElementById('text-width') as HTMLInputElement;

          const applyPreferences = (prefs: ReaderModePreferences) => {
            // Apply styles via CSS variables
            document.body.style.setProperty('--reader-bg-color', prefs.backgroundColor);
            container.style.setProperty('--reader-font-family', prefs.fontFamily);
            container.style.setProperty('--reader-font-size', `${prefs.fontSize}px`);
            container.style.setProperty('--reader-text-width', `${prefs.textWidth}px`);
            container.style.setProperty('--reader-text-align', prefs.textAlign);
            container.style.setProperty('--reader-text-color', prefs.textColor);

            // Update control values to match preferences
            toggleLinks.checked = prefs.hideLinks;
            toggleButtons.checked = prefs.hideButtons;
            toggleImages.checked = prefs.hideImages;
            toggleCaptions.checked = prefs.hideCaptions;
            textAlignSelector.value = prefs.textAlign;
            bgColorPicker.value = prefs.backgroundColor;
            textColorPicker.value = prefs.textColor;
            fontFamilySelector.value = prefs.fontFamily;
            fontSizeSlider.value = String(prefs.fontSize);
            textWidthSlider.value = String(prefs.textWidth);

            // Toggle content classes
            contentDiv.classList.toggle('hide-links', prefs.hideLinks);
            contentDiv.classList.toggle('hide-buttons', prefs.hideButtons);
            contentDiv.classList.toggle('hide-images', prefs.hideImages);
            contentDiv.classList.toggle('hide-captions', prefs.hideCaptions);
          };

          // Initial setup
          let currentPrefs = { ...preferences };
          applyPreferences(currentPrefs);

          const makePreferenceUpdater = <K extends keyof ReaderModePreferences>(key: K) => {
            return async (value: ReaderModePreferences[K]) => {
              currentPrefs[key] = value;
              applyPreferences(currentPrefs);
              await preferencesStorage.setValue(currentPrefs);
            };
          };

          toggleLinks.addEventListener('change', () => makePreferenceUpdater('hideLinks')(toggleLinks.checked));
          toggleButtons.addEventListener('change', () => makePreferenceUpdater('hideButtons')(toggleButtons.checked));
          toggleImages.addEventListener('change', () => makePreferenceUpdater('hideImages')(toggleImages.checked));
          toggleCaptions.addEventListener('change', () => makePreferenceUpdater('hideCaptions')(toggleCaptions.checked));
          textAlignSelector.addEventListener('change', () => makePreferenceUpdater('textAlign')(textAlignSelector.value as 'left' | 'center' | 'justify'));
          bgColorPicker.addEventListener('input', () => makePreferenceUpdater('backgroundColor')(bgColorPicker.value));
          textColorPicker.addEventListener('input', () => makePreferenceUpdater('textColor')(textColorPicker.value));
          fontFamilySelector.addEventListener('change', () => makePreferenceUpdater('fontFamily')(fontFamilySelector.value));
          fontSizeSlider.addEventListener('input', () => makePreferenceUpdater('fontSize')(parseInt(fontSizeSlider.value, 10)));
          textWidthSlider.addEventListener('input', () => makePreferenceUpdater('textWidth')(parseInt(textWidthSlider.value, 10)));
        }
      }
    });
  },
});

