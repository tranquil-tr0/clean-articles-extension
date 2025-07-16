import interRegularUrl from '../assets/fonts/inter-v19-latin-regular.woff2';
import interBoldUrl from '../assets/fonts/inter-v19-latin-700.woff2';
import robotoRegularUrl from '../assets/fonts/roboto-v48-latin-regular.woff2';
import robotoBoldUrl from '../assets/fonts/roboto-v48-latin-700.woff2';
import merriweatherRegularUrl from '../assets/fonts/merriweather-v32-latin-regular.woff2';
import merriweatherBoldUrl from '../assets/fonts/merriweather-v32-latin-700.woff2';
import loraRegularUrl from '../assets/fonts/lora-v36-latin-regular.woff2';
import loraBoldUrl from '../assets/fonts/lora-v36-latin-700.woff2';
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
      backgroundColor: '#f6f5f2',
      fontFamily: 'Inter, sans-serif',
      fontSize: 16,
      textWidth: 800,
      textAlign: 'left',
      textColor: '#222222',
    },
  },
);

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    // Helper: check if Reader Mode is active (marker on <html>)
    function isReaderModeActive() {
      return document.documentElement.hasAttribute('data-reader-mode');
    }

    // Listen for message to enter reader mode for PDF
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.action === 'enter-reader-mode-for-pdf') {
        // This triggers the extract-article-text logic
        const documentClone = document.cloneNode(true) as Document;
        const article = new Readability(documentClone).parse();

        if (article) {
          const preferences = await preferencesStorage.getValue();

          // Remove all <script>, <iframe>, <object>, <embed>, <link rel="import"> elements
          const killSelectors = [
            'script',
            'iframe',
            'object',
            'embed',
            'link[rel="import"]'
          ];
          killSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
          });

          // Clear all intervals and timeouts
          for (let i = 1; i < 99999; i++) {
            window.clearInterval(i);
            window.clearTimeout(i);
          }

          // Remove all children from <html> (documentElement)
          while (document.documentElement.firstChild) {
            document.documentElement.removeChild(document.documentElement.firstChild);
          }

          // Create new <head> and <body>
          const newHead = document.createElement('head');
          const newBody = document.createElement('body');
          document.documentElement.appendChild(newHead);
          document.documentElement.appendChild(newBody);
          // Mark Reader Mode as active
          document.documentElement.setAttribute('data-reader-mode', 'true');

          // Insert style into new head
          const style = document.createElement('style');
          // Use imported font URLs for @font-face rules
          style.textContent = `
    /* Local bundled fonts */
    @font-face {
      font-family: 'Inter';
      src: url('${interRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter';
      src: url('${interBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Roboto';
      src: url('${robotoRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Roboto';
      src: url('${robotoBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Merriweather';
      src: url('${merriweatherRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Merriweather';
      src: url('${merriweatherBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Lora';
      src: url('${loraRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Lora';
      src: url('${loraBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    `;
          newHead.appendChild(style);

          // ... (rest of the extract-article-text logic, including rendering the article and controls)
          // After entering reader mode, the rest of the script will run as normal
        }
      }
    });

    // On load, if in reader mode and saveReaderPdfAfterReaderMode is set, export PDF and clear flag
    if (
      isReaderModeActive() &&
      localStorage.getItem('saveReaderPdfAfterReaderMode') === 'true'
    ) {
      localStorage.removeItem('saveReaderPdfAfterReaderMode');
      // TODO: Implement save to PDF functionality here
    }

    browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message.action === 'is-reader-mode-active') {
        sendResponse({ active: isReaderModeActive() });
        return true;
      }
      if (message.action === 'exit-reader-mode') {
        if (isReaderModeActive()) {
          window.location.reload();
        }
        sendResponse({ exited: true });
        return true;
      }
      if (message.action === 'save-reader-pdf') {
        const documentClone = document.cloneNode(true) as Document;
        const article = new Readability(documentClone).parse();
        const preferences = await preferencesStorage.getValue();
        if (article) {
          sendResponse({ title: article.title, content: article.content, preferences });
        } else {
          sendResponse({ title: document.title, content: '', preferences });
        }
        return true;
      }
      if (message.action === 'extract-article-text') {
        const documentClone = document.cloneNode(true) as Document;
        const article = new Readability(documentClone).parse();

        if (article) {
          const preferences = await preferencesStorage.getValue();

          // Remove all <script>, <iframe>, <object>, <embed>, <link rel="import"> elements
          const killSelectors = [
            'script',
            'iframe',
            'object',
            'embed',
            'link[rel="import"]'
          ];
          killSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
          });

          // Clear all intervals and timeouts
          for (let i = 1; i < 99999; i++) {
            window.clearInterval(i);
            window.clearTimeout(i);
          }

          // Remove all children from <html> (documentElement)
          while (document.documentElement.firstChild) {
            document.documentElement.removeChild(document.documentElement.firstChild);
          }

          // Create new <head> and <body>
          const newHead = document.createElement('head');
          const newBody = document.createElement('body');
          document.documentElement.appendChild(newHead);
          document.documentElement.appendChild(newBody);
          // Mark Reader Mode as active
          document.documentElement.setAttribute('data-reader-mode', 'true');

          // Insert style into new head
          const style = document.createElement('style');
          // Use imported font URLs for @font-face rules
          style.textContent = `
    /* Local bundled fonts */
    @font-face {
      font-family: 'Inter';
      src: url('${interRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Inter';
      src: url('${interBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Roboto';
      src: url('${robotoRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Roboto';
      src: url('${robotoBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Merriweather';
      src: url('${merriweatherRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Merriweather';
      src: url('${merriweatherBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Lora';
      src: url('${loraRegularUrl}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'Lora';
      src: url('${loraBoldUrl}') format('woff2');
      font-weight: 700;
      font-style: normal;
      font-display: swap;
    }
    body {
      background-color: var(--reader-bg-color, #f6f5f2);
      font-family: var(--reader-font-family, sans-serif);
      font-size: var(--reader-font-size, 16px);
      line-height: 1.6;
      color: var(--reader-text-color, #222222);
      text-align: var(--reader-text-align, left);
      max-width: var(--reader-text-width, 800px);
      margin: 20px auto;
      padding: 20px;
    }
    #reader-mode-controls {
      position: fixed;
      top: 70px;
      right: 20px;
      background: #f6f5f2;
      padding: 18px 18px 12px 18px;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.13);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 240px;
      max-width: 320px;
      font-family: sans-serif;
      font-size: 1em;
      letter-spacing: 0.01em;
      color: #222222;
    }
    #reader-mode-controls.collapsed {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-20px) scale(0.98);
    }
    #reader-mode-controls.expanded {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    #reader-mode-toggle-panel {
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      background: #f6f5f2;
      color: #333333;
      border: none;
      outline: none;
      transition: background 0.2s;
    }
    #reader-mode-toggle-panel:hover {
      background: #ecebe6;
    }
    #reader-mode-hide-panel {
      color: #888888;
      background: none;
      border: none;
      outline: none;
      transition: color 0.2s;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    #reader-mode-hide-panel:hover {
      color: #d00d00;
    }
    #reader-mode-hide-panel svg {
      width: 18px;
      height: 18px;
      display: block;
    }
    #reader-mode-controls label {
      font-family: inherit;
      font-size: 1em;
      color: #333333;
      margin-bottom: 2px;
      gap: 0.5em;
      display: flex;
      align-items: center;
      font-weight: 500;
    }
    #reader-mode-controls hr {
      border: none;
      border-top: 1px solid #eeeeee;
      margin: 8px 0;
    }
    #reader-mode-controls input[type="range"] {
      width: 100px;
      margin-left: 8px;
    }
    #reader-mode-controls input[type="color"] {
      margin-left: 8px;
      border: none;
      background: none;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.07);
      cursor: pointer;
    }
    #reader-mode-controls select {
      margin-left: 8px;
      border-radius: 4px;
      border: 1px solid #ddd;
      padding: 2px 6px;
      font-size: 1em;
      font-family: inherit;
    }
    .hide-links a { pointer-events: none; text-decoration: none; color: inherit; cursor: default; }
    .hide-buttons button { display: none; }
    .hide-images img {
      display: none;
    }
    img {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 1em auto;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .hide-captions figcaption {
      display: none;
    }
    `;
newHead.appendChild(style);

          newBody.innerHTML = `
<button id="reader-mode-toggle-panel" aria-label="Show/hide reader options" style="position:fixed;top:20px;right:20px;z-index:10001;background:#fff;border:none;border-radius:50%;width:40px;height:40px;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background 0.2s;"><span id="reader-mode-toggle-icon" style="font-size:1.5em;display:flex;align-items:center;justify-content:center;width:24px;height:24px;line-height:1;">&#9776;</span></button>
<div id="reader-mode-controls" class="collapsed">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <strong style="font-size:1.1em;font-family:inherit;">Reader Options</strong>
    <button id="reader-mode-hide-panel" aria-label="Hide options"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="5" x2="15" y2="15"/><line x1="15" y1="5" x2="5" y2="15"/></svg></button>
  </div>
  <hr>
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
      <option value="Inter, sans-serif">Inter</option>
      <option value="Roboto, sans-serif">Roboto</option>
      <option value="Merriweather, serif">Merriweather</option>
      <option value="Lora, serif">Lora</option>
    </select>
  </label>
  <label>Font Size: <input type="range" id="font-size" min="12" max="24" step="1"></label>
  <label>Text Width: <input type="range" id="text-width" min="400" max="1200" step="50"></label>
  <hr>
  <button id="reader-mode-exit" style="background:#d00d00;color:#fff;border:none;border-radius:6px;padding:8px 0;font-size:1em;font-family:inherit;cursor:pointer;">Exit Reader Mode</button>
</div>
<h1 id="reader-mode-title">${article.title}</h1>
<div id="reader-mode-content">${article.content}</div>
`;

          // Update selectors to use the body/content directly
          const contentDiv = document.getElementById('reader-mode-content')!;
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

          const controlsPanel = document.getElementById('reader-mode-controls')!;
          const togglePanelBtn = document.getElementById('reader-mode-toggle-panel')!;
          const hidePanelBtn = document.getElementById('reader-mode-hide-panel')!;
          const exitBtn = document.getElementById('reader-mode-exit')!;

          // Panel show/hide logic
          const showPanel = () => {
            controlsPanel.classList.remove('collapsed');
            controlsPanel.classList.add('expanded');
            controlsPanel.style.pointerEvents = 'auto';
          };
          const hidePanel = () => {
            controlsPanel.classList.remove('expanded');
            controlsPanel.classList.add('collapsed');
            controlsPanel.style.pointerEvents = 'none';
          };

          const applyPreferences = (prefs: ReaderModePreferences) => {
            // Apply styles via CSS variables
            document.body.style.setProperty('--reader-bg-color', prefs.backgroundColor);
            document.body.style.setProperty('--reader-font-family', prefs.fontFamily);
            document.body.style.setProperty('--reader-font-size', `${prefs.fontSize}px`);
            document.body.style.setProperty('--reader-text-width', `${prefs.textWidth}px`);
            document.body.style.setProperty('--reader-text-align', prefs.textAlign);
            document.body.style.setProperty('--reader-text-color', prefs.textColor);

            document.body.style.setProperty('--reader-bg-color', prefs.backgroundColor);
            document.body.style.setProperty('--reader-font-family', prefs.fontFamily);
            document.body.style.setProperty('--reader-font-size', `${prefs.fontSize}px`);
            document.body.style.setProperty('--reader-text-width', `${prefs.textWidth}px`);
            document.body.style.setProperty('--reader-text-align', prefs.textAlign);
            document.body.style.setProperty('--reader-text-color', prefs.textColor);

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
          fontFamilySelector.addEventListener('change', () => {
            makePreferenceUpdater('fontFamily')(fontFamilySelector.value);
          });
          fontSizeSlider.addEventListener('input', () => makePreferenceUpdater('fontSize')(parseInt(fontSizeSlider.value, 10)));
          textWidthSlider.addEventListener('input', () => makePreferenceUpdater('textWidth')(parseInt(textWidthSlider.value, 10)));

          togglePanelBtn.addEventListener('click', () => {
            if (controlsPanel.classList.contains('collapsed')) {
              showPanel();
            } else {
              hidePanel();
            }
          });
          hidePanelBtn.addEventListener('click', hidePanel);
          exitBtn.addEventListener('click', () => {
            window.location.reload();
          });
        }
      }
    });
  },
});

