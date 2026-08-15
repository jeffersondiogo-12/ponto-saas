import { useEffect, useState } from 'react';

export default function ErrorOverlay() {
  const [erro, setErro] = useState(null);

  useEffect(() => {
    function onError(message, source, lineno, colno, error) {
      setErro({ message: message?.toString(), source, lineno, colno, stack: error?.stack });
      return false;
    }

    function onRejection(e) {
      setErro({ message: e?.reason?.message || String(e), stack: e?.reason?.stack });
    }

    window.addEventListener('error', (e) => onError(e.message, e.filename, e.lineno, e.colno, e.error));
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', (e) => onError(e.message, e.filename, e.lineno, e.colno, e.error));
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!erro) return null;

  return (
    <div style={{ position: 'fixed', inset: 12, zIndex: 99999 }}>
      <div style={{ background: 'rgba(255,255,255,0.98)', border: '1px solid #c00', padding: 14, borderRadius: 8, color: '#600' }}>
        <strong>Erro de execução detectado</strong>
        <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13 }}>
          {erro.message}
        </div>
        {erro.stack && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 12 }}>{erro.stack}</pre>}
      </div>
    </div>
  );
}
