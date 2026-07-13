import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App.tsx';
import './index.css';

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.deferredPrompt = event as BeforeInstallPromptEvent;
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root was not found.');
}

try {
  createRoot(rootElement).render(
    <StrictMode>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </StrictMode>,
  );
} catch (error) {
  console.error('[Fatal] App failed to mount:', error);
  rootElement.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,-apple-system,sans-serif;background:#f8f9fa;">
      <div style="text-align:center;max-width:400px;padding:2rem;">
        <h1 style="font-size:1.5rem;font-weight:bold;color:#191c1d;margin-bottom:1rem;">Lỗi khởi tạo ứng dụng</h1>
        <p style="color:#4d616c;margin-bottom:1.5rem;line-height:1.6;">Ứng dụng không thể khởi động. Hãy thử tải lại trang hoặc xoá cache trình duyệt.</p>
        <button onclick="sessionStorage.clear();location.reload()" style="padding:0.75rem 1.5rem;background:#00515f;color:white;border:none;border-radius:12px;font-weight:bold;cursor:pointer;font-size:0.95rem;">Tải lại trang</button>
      </div>
    </div>
  `;
}
