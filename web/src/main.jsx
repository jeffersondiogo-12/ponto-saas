import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * Service worker so no site publicado.
 *
 * Em desenvolvimento ele atrapalha mais do que ajuda: passa a servir o casco
 * do cache e as mudancas param de aparecer no F5, o que da horas de depuracao
 * atras de um bug que nao existe.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sem service worker o sistema funciona igual, so nao abre sem rede.
      // Nao vale incomodar quem esta usando com um aviso sobre isso.
    });
  });
}
