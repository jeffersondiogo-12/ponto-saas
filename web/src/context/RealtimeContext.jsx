import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BASE_URL, obterToken } from '../api';
import { useAuth } from './AuthContext';

/**
 * Conexao unica com o /ws do backend, compartilhada por todas as telas.
 *
 * O contrato esta em `backend/src/realtime.js` e e fechado:
 * - o token vai na QUERY (`/ws?token=`), nao em header - o handshake de
 *   WebSocket no navegador nao aceita header customizado;
 * - token invalido fecha com 1008 "Sessao invalida";
 * - ao abrir, o servidor manda `{ tipo: 'conectado', em }`;
 * - a string literal "ping" e respondida com `{ tipo: 'pong' }`;
 * - o filtro por empresa e do servidor: so chega evento da mesma empresa_id.
 *
 * Portado de `mobile/src/realtime.js`, que fala o mesmo contrato e ja levou os
 * mesmos tombos (ver 5.2 no CLAUDE.md). O que muda aqui: no lugar do
 * DeviceEventEmitter do React Native, a entrega e por assinatura de React.
 */
const RealtimeContext = createContext(null);

const INTERVALO_PING = 25000;
const ESPERA_MAXIMA = 30000;
/** Duas mensagens identicas dentro dessa janela contam como uma so. */
const JANELA_REPETIDO = 5000;
const VALIDADE_REPETIDO = 10000;
/**
 * Token recusado fecha a conexao antes de qualquer `conectado`. O codigo 1008
 * do backend NAO chega ao navegador atraves do proxy do Render - o que se ve e
 * 1006 (fechamento anormal), igual a uma queda de rede. Sem um limite, sessao
 * expirada viraria reconexao eterna contra um token que nunca vai valer.
 */
const TENTATIVAS_SEM_ABRIR = 5;

/**
 * `BASE_URL` tem tres formas possiveis, e as tres precisam virar um endereco
 * absoluto de socket:
 *   ''                       web servido pelo MESMO servico do backend (producao)
 *   'http://localhost:3000'  backend local
 *   'https://...onrender...' API hospedada
 *
 * `new URL(caminho, origem)` resolve as tres: base absoluta vence a origem,
 * base vazia cai na origem da propria pagina. O protocolo e trocado pelo valor
 * real, nao por prefixo de texto - trocar 'http' por 'ws' numa string vazia
 * nao troca nada, e a funcao sairia devolvendo um caminho relativo.
 */
function urlDoSocket(token) {
  const url = new URL(`${String(BASE_URL).replace(/\/+$/, '')}/ws`, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.toString();
}

/** Identifica a mensagem pelo conteudo, para descartar repetido. */
function chaveDoEvento(mensagem) {
  const d = mensagem.dados || {};
  return [mensagem.tipo, d.alunoId, d.funcionarioId, d.atribuicaoId, d.data, d.dataHora].join(':');
}

export function RealtimeProvider({ children }) {
  const { usuario } = useAuth();
  const [conectado, setConectado] = useState(false);
  const [sessaoRecusada, setSessaoRecusada] = useState(false);

  const ouvintes = useRef(new Map());
  const recentes = useRef(new Map());

  /**
   * Assina um tipo de evento, ou '*' para todos. Devolve a funcao que
   * cancela a assinatura - use direto no return do useEffect.
   */
  const assinar = useCallback((tipo, aoReceber) => {
    if (!ouvintes.current.has(tipo)) ouvintes.current.set(tipo, new Set());
    ouvintes.current.get(tipo).add(aoReceber);
    return () => {
      const conjunto = ouvintes.current.get(tipo);
      if (!conjunto) return;
      conjunto.delete(aoReceber);
      if (conjunto.size === 0) ouvintes.current.delete(tipo);
    };
  }, []);

  useEffect(() => {
    const token = usuario ? obterToken() : null;
    setSessaoRecusada(false);
    if (!token) {
      setConectado(false);
      return undefined;
    }

    // `encerrado` distingue "o servidor caiu" de "a tela desmontou": no
    // segundo caso nao pode haver reconexao. StrictMode monta duas vezes em
    // desenvolvimento, entao o cleanup precisa mesmo cortar tudo.
    let encerrado = false;
    let socket = null;
    let tentativa = 0;
    let semAbrir = 0;
    let abriu = false;
    let timerPing = null;
    let timerReconexao = null;

    function limparTimers() {
      if (timerPing) { clearInterval(timerPing); timerPing = null; }
      if (timerReconexao) { clearTimeout(timerReconexao); timerReconexao = null; }
    }

    function entregar(mensagem) {
      const agora = Date.now();
      const chave = chaveDoEvento(mensagem);
      if (recentes.current.has(chave) && agora - recentes.current.get(chave) < JANELA_REPETIDO) return;
      recentes.current.set(chave, agora);
      for (const [outra, quando] of recentes.current) {
        if (agora - quando >= VALIDADE_REPETIDO) recentes.current.delete(outra);
      }

      for (const aoReceber of ouvintes.current.get(mensagem.tipo) || []) aoReceber(mensagem);
      for (const aoReceber of ouvintes.current.get('*') || []) aoReceber(mensagem);
    }

    function conectar() {
      if (encerrado) return;
      socket = new WebSocket(urlDoSocket(token));

      socket.onopen = () => {
        // Handshake aceito ainda nao e sessao valida: o servidor so verifica o
        // token depois. `conectado` e quem confirma - e quem liga o estado.
        abriu = false;
        socket.send('ping');
        limparTimers();
        // Sem esse keep-alive o Render derruba a conexao ociosa.
        timerPing = setInterval(() => {
          if (socket && socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, INTERVALO_PING);
      };

      socket.onmessage = (evento) => {
        try {
          const mensagem = JSON.parse(evento.data);
          if (mensagem.tipo === 'conectado') {
            // Prova de que o token passou pelo jwt.verify do servidor.
            abriu = true;
            tentativa = 0;
            semAbrir = 0;
            setConectado(true);
            return;
          }
          if (mensagem.tipo === 'pong') return;
          entregar(mensagem);
        } catch {
          // Mensagem invalida nao pode derrubar a conexao.
        }
      };

      socket.onclose = () => {
        setConectado(false);
        limparTimers();
        if (encerrado) return;

        semAbrir = abriu ? 0 : semAbrir + 1;
        if (semAbrir >= TENTATIVAS_SEM_ABRIR) {
          setSessaoRecusada(true);
          return;
        }

        tentativa += 1;
        const espera = Math.min(ESPERA_MAXIMA, 1000 * 2 ** (tentativa - 1));
        timerReconexao = setTimeout(conectar, espera);
      };

      socket.onerror = () => {
        // O onclose e quem agenda a reconexao; aqui so forcamos o fechamento.
        if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
      };
    }

    conectar();

    return () => {
      encerrado = true;
      limparTimers();
      setConectado(false);
      if (!socket) return;
      // Fechar um socket ainda em CONNECTING dispara erro no console; o
      // caminho limpo e desarmar os callbacks antes.
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close();
    };
  }, [usuario]);

  return (
    <RealtimeContext.Provider value={{ conectado, sessaoRecusada, assinar }}>
      {children}
    </RealtimeContext.Provider>
  );
}

/**
 * Recarrega dados quando o servidor avisa que algo mudou - por evento, nunca
 * por relogio: o WebSocket ja diz QUANDO mudou.
 *
 * O agrupamento nao e enfeite. Uma coleta traz varias batidas de uma vez e o
 * backend publica `ponto.criado` uma vez por batida; `presenca.sala` sai uma
 * vez por aluno. Sem juntar, uma chamada de 30 alunos viraria 30 recargas do
 * painel. Cada evento novo reinicia a espera, entao a rajada inteira termina
 * em UMA requisicao.
 */
export function useRecarregarAoVivo(tipos, recarregar, atraso = 1500) {
  const { assinar } = useRealtime();

  // A funcao de recarga costuma ser recriada a cada render; guardar em ref
  // evita refazer a assinatura toda vez.
  const maisRecente = useRef(recarregar);
  maisRecente.current = recarregar;

  const chave = tipos.join(',');

  useEffect(() => {
    let timer = null;
    const cancelar = chave.split(',').map((tipo) => assinar(tipo, () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; maisRecente.current(); }, atraso);
    }));
    return () => {
      if (timer) clearTimeout(timer);
      cancelar.forEach((fn) => fn());
    };
  }, [assinar, chave, atraso]);
}

export function useRealtime() {
  const contexto = useContext(RealtimeContext);
  if (!contexto) throw new Error('useRealtime precisa estar dentro de um RealtimeProvider');
  return contexto;
}
