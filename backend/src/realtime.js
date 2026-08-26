const { WebSocketServer, WebSocket } = require('ws');
const jwt = require('jsonwebtoken');

const clientes = new Set();

function iniciarRealtime(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    if (pathname !== '/ws') return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, url);
    });
  });

  wss.on('connection', (ws, request, url) => {
    const token = url.searchParams.get('token');
    try {
      ws.usuario = jwt.verify(token, process.env.JWT_SECRET);
      clientes.add(ws);
      ws.send(JSON.stringify({ tipo: 'conectado', em: new Date().toISOString() }));
    } catch (err) {
      ws.close(1008, 'Sessao invalida');
      return;
    }

    ws.on('close', () => clientes.delete(ws));
    ws.on('error', () => clientes.delete(ws));
    ws.on('message', (mensagem) => {
      if (mensagem.toString() === 'ping') ws.send(JSON.stringify({ tipo: 'pong' }));
    });

    console.log(`[realtime] cliente conectado: ${request.socket.remoteAddress}`);
  });

  console.log('[realtime] WebSocket ouvindo em /ws');
  return wss;
}

function publicarEvento(tipo, dados) {
  const mensagem = JSON.stringify({ tipo, dados, em: new Date().toISOString() });
  for (const cliente of clientes) {
    if (cliente.readyState !== WebSocket.OPEN) continue;
    const usuario = cliente.usuario || {};
    if (usuario.empresa_id !== dados.empresaId) continue;
    if (usuario.tipo === 'responsavel' && dados.alunoId && !usuario.alunoIds?.includes(dados.alunoId)) continue;
    if (usuario.tipo === 'staff' && dados.professorId && usuario.id !== dados.professorId && !['gestor', 'admin', 'super_admin'].includes(usuario.papel)) continue;
    cliente.send(mensagem);
  }
}

module.exports = { iniciarRealtime, publicarEvento };
