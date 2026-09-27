import { useState } from 'react';
import { namespaceOffline, obterUltimaSincronizacao, processarFila } from '../api';
import { reabrirNaFila, removerDaFila } from './filaOffline';
import { useFilaOffline } from './useFilaOffline';
import { BarraTopo } from './Ui';

/**
 * As acoes guardadas sem internet: espelho da SincronizacaoScreen do APK, a
 * mesma para responsavel (tela de pilha) e professor (aba, `comoAba`). Sem a parte de "fila antiga" do APK — o
 * PWA nasceu com a fila ja separada por conta.
 */
function formatarData(valor) {
  if (!valor) return 'Ainda não sincronizado';
  return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Sincronizacao({ comoAba }) {
  const fila = useFilaOffline();
  const [processando, setProcessando] = useState(false);
  // Muda depois de cada sincronizacao, para reler a data da ultima.
  const [, setRodada] = useState(0);

  async function sincronizar() {
    setProcessando(true);
    try {
      await processarFila();
    } finally {
      setProcessando(false);
      setRodada((n) => n + 1);
    }
  }

  function excluir(item) {
    if (window.confirm(`Remover ação\n\nExcluir "${item.rotulo}" da fila?`)) removerDaFila(namespaceOffline(), item.id);
  }

  async function tentarNovamente(item) {
    reabrirNaFila(namespaceOffline(), item.id);
    await sincronizar();
  }

  return (
    <main className="app-tela-pilha">
      <header className="app-cabecalho-escuro">
        {/* Aba do professor: sem seta, como no APK. Responsavel: tela de pilha. */}
        {comoAba ? null : <BarraTopo escuro />}
        <p className="app-sinc-rotulo">CONEXÃO E DADOS</p>
        <h1 className="app-sinc-titulo">Sincronização</h1>
        <p className="app-sinc-subtitulo">Acompanhe ações que aguardam internet ou precisam de revisão.</p>
      </header>

      <section className="app-sinc-resumo">
        <p className="app-sinc-resumo-titulo">Última sincronização</p>
        <p className="app-sinc-resumo-valor">{formatarData(obterUltimaSincronizacao())}</p>
        <p className="app-sinc-resumo-detalhe">
          {fila.length ? `${fila.length} ${fila.length === 1 ? 'ação' : 'ações'} na fila` : 'Tudo sincronizado'}
        </p>
      </section>

      <div className="app-sinc-acao">
        <button type="button" className="app-login-botao botao-responsavel app-pressao" onClick={sincronizar} disabled={processando}>
          {processando ? <span className="app-login-carregando" aria-label="Sincronizando" /> : 'Sincronizar agora'}
        </button>
      </div>

      <div className={`app-lista app-sinc-lista${comoAba ? ' app-lista-aba' : ''}`}>
        {!fila.length ? <p className="app-vazio">Nenhuma ação pendente.</p> : fila.map((item, indice) => (
          <div key={item.id} className="app-sinc-item app-aparecer" style={{ '--app-atraso': `${indice * 45}ms` }}>
            <div className="app-sinc-item-texto">
              <p className="app-sinc-item-titulo">{item.rotulo}</p>
              <p className="app-sinc-item-data">Criada em {formatarData(item.criadoEm)}</p>
              {item.falhaDefinitiva
                ? <p className="app-sinc-falha">Falha: {item.erro}</p>
                : <p className="app-sinc-pendente">Aguardando conexão</p>}
            </div>
            <div className="app-sinc-item-acoes">
              {item.falhaDefinitiva ? (
                <button type="button" className="app-sinc-tentar" onClick={() => tentarNovamente(item)}>Tentar</button>
              ) : null}
              <button type="button" className="app-sinc-remover" onClick={() => excluir(item)}>Remover</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
