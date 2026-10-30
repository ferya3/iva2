import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?url';
import { App } from './App';
import './styles.css';

// Bundled font (offline-first; instructions must render identically everywhere).
const font = new FontFace('Vazirmatn', `url("${fontUrl}")`, { weight: '100 900' });
document.fonts.add(font);
void font.load().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
