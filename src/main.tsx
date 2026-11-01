import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ConfigProvider as AntdConfigProvider, App as AntdApp } from 'antd'
import { googleMuiTheme } from './theme/googleTheme'
import './i18n'
import './index.css'
import App from './App.tsx'

// Configure Ant Design static methods (message, modal, notification) to consume dynamic theme without warning
AntdConfigProvider.config({
  holderRender: (children) => children,
});

// Handle stale chunk or dynamic import failure gracefully across browser sessions
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    if (
      error instanceof TypeError &&
      (error.message?.includes('dynamically imported module') ||
        error.message?.includes('Failed to fetch'))
    ) {
      console.warn('[Global] Intercepted dynamic import failure:', error.message);
      const retryKey = 'dynamic_import_reload_stamp';
      const last = sessionStorage.getItem(retryKey);
      const now = Date.now();
      if (!last || now - Number(last) > 10000) {
        sessionStorage.setItem(retryKey, String(now));
        window.location.reload();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={googleMuiTheme}>
      <CssBaseline />
      <AntdConfigProvider
        theme={{
          token: {
            colorPrimary: '#1a73e8',
            colorSuccess: '#34a853',
            colorWarning: '#fbbc04',
            colorError: '#ea4335',
            colorInfo: '#1a73e8',
            borderRadius: 8,
            fontFamily: 'Google Sans, Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
          },
        }}
      >
        <AntdApp>
          <App />
        </AntdApp>
      </AntdConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)

