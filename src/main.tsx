import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// dev では Vite の HMR と衝突するので本番ビルドだけ登録する
if (import.meta.env.PROD) {
  void registerServiceWorker(navigator.serviceWorker, `${import.meta.env.BASE_URL}sw.js`);
}
