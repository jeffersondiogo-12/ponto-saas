import { obterToken } from './api';
import { DeviceEventEmitter } from 'react-native';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

export async function conectarRealtime(onEvento) {
  const token = await obterToken();
  if (!token) return () => {};

  const url = `${BASE_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`;
  let socket;
  let encerrado = false;
  let timer;
  let tentativa = 0;
  const eventosRecentes = new Map();

  function limparTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function conectar() {
    if (encerrado) return;

    socket = new WebSocket(url);
    socket.onopen = () => {
      tentativa = 0;
      socket.send('ping');
      limparTimer();
      timer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send('ping');
      }, 25000);
    };
    socket.onmessage = (evento) => {
      try {
        const mensagem = JSON.parse(evento.data);
        if (mensagem.tipo !== 'pong' && mensagem.tipo !== 'conectado') {
          const dados = mensagem.dados || {};
          const chave = [mensagem.tipo, dados.alunoId, dados.atribuicaoId, dados.data, dados.dataHora].join(':');
          const agora = Date.now();
          if (eventosRecentes.has(chave) && agora - eventosRecentes.get(chave) < 5000) return;
          eventosRecentes.set(chave, agora);
          for (const [eventoChave, quando] of eventosRecentes) {
            if (agora - quando >= 10000) eventosRecentes.delete(eventoChave);
          }
          DeviceEventEmitter.emit('ponto-saas:atualizado', mensagem);
          onEvento?.(mensagem);
        }
      } catch (err) {
        // Ignora mensagem inválida sem derrubar a conexão.
      }
    };
    socket.onclose = () => {
      limparTimer();
      if (!encerrado) {
        tentativa += 1;
        const atraso = Math.min(5000, 1000 * tentativa);
        setTimeout(conectar, atraso);
      }
    };
    socket.onerror = () => {
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
    };
  }

  conectar();
  return () => {
    encerrado = true;
    limparTimer();
    if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  };
}
