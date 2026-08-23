const http = require('http');
const app = require('./app');
const { iniciarServidorEvoFacial } = require('./modules/dispositivos/evoFacialServidor');
const { iniciarRealtime } = require('./realtime');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ponto SaaS rodando em http://localhost:${PORT}`);
});

iniciarRealtime(server);

/**
 * Servidor WebSocket do protocolo Evo Facial, na MESMA instancia e porta
 * publica do processo web. O Render encaminha wss://dominio/evo para esta
 * porta; o equipamento deve apontar para esse dominio e caminho.
 */
iniciarServidorEvoFacial(server);
