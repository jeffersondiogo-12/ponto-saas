import { useEffect, useRef, useState } from 'react';

/**
 * Confirmacao das acoes de aviso que mudam o que os responsaveis veem.
 *
 * As duas acoes parecem vizinhas e fazem coisas bem diferentes — e a diferenca
 * so aparece no celular de quem recebe:
 *
 *   reativar  -> o MESMO aviso volta ao mural. Nenhum push e disparado
 *                (`definirAtivo` so troca a coluna `ativo`), entao quem nao
 *                abrir o app nao fica sabendo. A contagem de leitura continua
 *                sendo a do envio original.
 *   reenviar  -> nasce um aviso NOVO (`POST /:id/duplicar`). O push sai outra
 *                vez e a contagem comeca do zero. Nao reaproveita o registro
 *                porque `aviso_leituras` tem unique(aviso_id, responsavel_id):
 *                quem ja leu nunca contaria de novo, e a segunda rodada
 *                nasceria mentindo.
 *
 * Confundir as duas custa caro nos dois sentidos: reativar quando se queria
 * avisar de novo deixa os pais sem saber; reenviar quando se queria so
 * desfazer uma desativacao notifica todo mundo sem motivo.
 */
const TEXTOS = {
  reativar: {
    titulo: (a) => `Reativar “${a.titulo}”?`,
    resumo: 'O aviso volta a aparecer no mural do aplicativo.',
    aviso: {
      tom: 'atencao',
      cabecalho: 'Ninguém será notificado',
      corpo: 'Reativar não dispara notificação. Quem não abrir o aplicativo não vai saber que o aviso voltou. Para notificar de novo, use “Enviar de novo”.',
    },
    botao: 'Reativar',
    carregando: 'Reativando...',
  },
  reenviar: {
    titulo: (a) => `Enviar “${a.titulo}” de novo?`,
    resumo: 'Cria um aviso novo com o mesmo título, mensagem e destinatários.',
    aviso: {
      tom: 'alerta',
      cabecalho: 'Todos recebem notificação outra vez',
      corpo: 'Inclusive quem já tinha lido o aviso original. O aviso antigo continua no histórico, e o novo começa a contagem de leitura do zero.',
    },
    botao: 'Enviar de novo',
    carregando: 'Enviando...',
  },
};

const agoraLocal = () => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export default function ConfirmarAcaoAviso({ acao, aviso, aoFechar, aoConfirmar }) {
  const caixa = useRef(null);
  const [quando, setQuando] = useState(agoraLocal);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const texto = TEXTOS[acao];

  useEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const focaveis = el.querySelectorAll('a,button,input,[tabindex]:not([tabindex="-1"])');
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (primeiro) primeiro.focus();

    const aoTeclar = (e) => {
      if (e.key === 'Escape') { aoFechar(); return; }
      if (e.key !== 'Tab' || focaveis.length === 0) return;
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    };
    document.addEventListener('keydown', aoTeclar);
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagem;
    };
  }, [aoFechar]);

  async function confirmar() {
    setErro(null);
    setOcupado(true);
    try {
      // O reenvio aceita data: da para reagendar em vez de mandar agora.
      await aoConfirmar(acao === 'reenviar' ? new Date(quando).toISOString() : undefined);
    } catch (err) {
      setErro(err.message || 'Não foi possível concluir a ação.');
      setOcupado(false);
    }
  }

  if (!texto) return null;

  return (
    <div className="modal-overlay" role="presentation" onClick={aoFechar}>
      <div
        ref={caixa}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="acao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="acao-titulo">{texto.titulo(aviso)}</h2>
        <p className="texto-apoio" style={{ marginTop: 0 }}>{texto.resumo}</p>

        {erro && <div className="erro">{erro}</div>}

        <div className={`risco risco-${texto.aviso.tom === 'alerta' ? 'apaga' : 'orfao'}`}>
          <h3>{texto.aviso.cabecalho}</h3>
          <p>{texto.aviso.corpo}</p>
        </div>

        {acao === 'reenviar' && (
          <>
            <div className="campo" style={{ marginTop: 14 }}>
              <label htmlFor="acao-quando">Quando enviar</label>
              <input
                id="acao-quando"
                className="entrada mono"
                type="datetime-local"
                value={quando}
                onChange={(e) => setQuando(e.target.value)}
              />
              <span className="ajuda">Deixe como está para enviar agora.</span>
            </div>
            <div className="risco risco-bloqueia">
              <h3>Alcance deste envio</h3>
              <p>
                {aviso.alvos?.length
                  ? <>Vai para {aviso.alvos.map((a) => a.turma_nome || a.filial_nome).filter(Boolean).join(', ')}.</>
                  : <>Vai para <strong>o ambiente inteiro</strong>.</>}
                {' '}
                {typeof aviso.total_destinatarios === 'number' && (
                  <><strong className="mono">{aviso.total_destinatarios}</strong>{' '}
                  {aviso.total_destinatarios === 1 ? 'responsável' : 'responsáveis'} {aviso.total_destinatarios === 1 ? 'recebe' : 'recebem'}.</>
                )}
              </p>
            </div>
          </>
        )}

        <div className="acoes-form">
          <button type="button" className="btn btn-secundario" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className={acao === 'reenviar' ? 'btn btn-primario' : 'btn btn-verde'}
            disabled={ocupado}
            onClick={confirmar}
          >
            {ocupado ? texto.carregando : texto.botao}
          </button>
        </div>
      </div>
    </div>
  );
}
