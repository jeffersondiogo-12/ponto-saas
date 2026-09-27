import { useEffect, useRef, useState } from 'react';
import Icone from './Icone';
import { ehIos, instalado } from './instalacao';

/**
 * No Safari do iPhone nao existe botao "instalar": a pessoa faz na mao,
 * Compartilhar → Adicionar a Tela de Inicio. Sem ensinar isso na tela, o PWA
 * nao acontece — e sem instalar, o iPhone tambem nao recebe notificacao.
 *
 * Aparece uma vez, so no iPhone e iPad fora do modo app. "Entendi" guarda a
 * escolha neste aparelho.
 */
const CHAVE = 'ponto_saas_dica_instalar_vista';

function jaViu() {
  try {
    return localStorage.getItem(CHAVE) === '1';
  } catch {
    return false;
  }
}

export default function DicaInstalar() {
  const [aberta, setAberta] = useState(false);
  const botaoRef = useRef(null);

  useEffect(() => {
    if (!ehIos() || instalado() || jaViu()) return undefined;
    // Depois da entrada da tela, para nao disputar atencao com ela.
    const timer = setTimeout(() => setAberta(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (aberta) botaoRef.current?.focus();
  }, [aberta]);

  function fechar() {
    try { localStorage.setItem(CHAVE, '1'); } catch { /* sem armazenamento, volta na proxima visita */ }
    setAberta(false);
  }

  if (!aberta) return null;
  return (
    <div className="app-dica-fundo" onClick={fechar}>
      <section
        className="app-dica"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dica-instalar-titulo"
        onClick={(evento) => evento.stopPropagation()}
        onKeyDown={(evento) => { if (evento.key === 'Escape') fechar(); }}
      >
        <img src="/icone-192.png" alt="" className="app-dica-icone" />
        <h2 id="dica-instalar-titulo" className="app-dica-titulo">Instale o Ponte Escolar no iPhone</h2>
        <p className="app-dica-texto">Ele abre como um app e pode receber as notificações da escola.</p>
        <ol className="app-dica-passos">
          <li>
            Toque em <strong>Compartilhar</strong>
            <span className="app-dica-simbolo" aria-hidden="true"><Icone nome="share-outline" tamanho={18} /></span>
            na barra do Safari.
          </li>
          <li>Escolha <strong>Adicionar à Tela de Início</strong>.</li>
          <li>Abra o Ponte Escolar pelo ícone que apareceu.</li>
        </ol>
        <button ref={botaoRef} type="button" className="app-botao app-pressao" onClick={fechar}>Entendi</button>
      </section>
    </div>
  );
}
