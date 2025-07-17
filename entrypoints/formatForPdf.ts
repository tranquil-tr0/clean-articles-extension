// Utility to process Readability HTML for PDF export, applying reader-mode formatting (minus settings panel)

export interface ReaderModePreferences {
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

const FONT_FACE_CSS = `
@font-face {
  font-family: 'Inter';
  src: url('../assets/fonts/inter-v19-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Inter';
  src: url('../assets/fonts/inter-v19-latin-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/roboto-v48-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Roboto';
  src: url('../assets/fonts/roboto-v48-latin-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Merriweather';
  src: url('../assets/fonts/merriweather-v32-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Merriweather';
  src: url('../assets/fonts/merriweather-v32-latin-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Lora';
  src: url('../assets/fonts/lora-v36-latin-regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Lora';
  src: url('../assets/fonts/lora-v36-latin-700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
`;

function getBodyCss(preferences: ReaderModePreferences): string {
  return `
body {
  background-color: ${preferences.backgroundColor};
  font-family: ${preferences.fontFamily};
  font-size: ${preferences.fontSize}px;
  line-height: 1.6;
  color: ${preferences.textColor};
  text-align: ${preferences.textAlign};
  max-width: ${preferences.textWidth}px;
  margin: 20px auto;
  padding: 20px;
}
.hide-links a { pointer-events: none; text-decoration: none; color: inherit; cursor: default; }
.hide-buttons button { display: none; }
.hide-images img { display: none; }
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1em auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.hide-captions figcaption { display: none; }
`;
}

// Remove unwanted elements from a DOM node
function cleanDom(dom: Document | HTMLElement) {
  const killSelectors = [
    'script',
    'iframe',
    'object',
    'embed',
    'link[rel="import"]'
  ];
  killSelectors.forEach(sel => {
    dom.querySelectorAll(sel).forEach(el => el.remove());
  });
}

// Inline images as data URLs (async)
async function inlineImages(wrapper: HTMLElement): Promise<void> {
  const images = Array.from(wrapper.querySelectorAll('img'));
  await Promise.all(images.map(async img => {
    try {
      if (img.src && !img.src.startsWith('data:')) {
        const response = await fetch(img.src, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          const dataUrlPromise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const dataUrl = await dataUrlPromise;
          img.src = dataUrl;
        }
      }
    } catch {
      // Ignore image fetch errors
    }
  }));
}

// Main function: returns a Promise<string> of the formatted HTML
export async function formatArticleForPdf(
  article: { title: string; content: string },
  preferences: ReaderModePreferences
): Promise<string> {
  // Create a DOM to manipulate
  const dom = document.implementation.createHTMLDocument('');
  dom.body.innerHTML = `<div id="reader-mode-content">${article.content}</div>`;
  cleanDom(dom);

  // Apply hide classes
  const contentDiv = dom.getElementById('reader-mode-content');
  if (contentDiv) {
    if (preferences.hideLinks) contentDiv.classList.add('hide-links');
    if (preferences.hideButtons) contentDiv.classList.add('hide-buttons');
    if (preferences.hideImages) contentDiv.classList.add('hide-images');
    if (preferences.hideCaptions) contentDiv.classList.add('hide-captions');
    await inlineImages(contentDiv);
  }

  // Compose the HTML
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${article.title}</title>
  <style>
    ${FONT_FACE_CSS}
    ${getBodyCss(preferences)}
  </style>
</head>
<body>
  <h1 id="reader-mode-title">${article.title}</h1>
  ${contentDiv ? contentDiv.innerHTML : ''}
</body>
</html>
  `.trim();

  return html;
}