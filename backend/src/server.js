const app = require('./app');
const { iniciarServidorEvoFacial } = require('./modules/dispositivos/evoFacialServidor');

const PORT = process.env.PORT || 3000;
const EVO_FACIAL_WS_PORT = Number(process.env.EVO_FACIAL_WS_PORT) || 9998;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ponto SaaS rodando em http://localhost:${PORT}`);
});

/**
 * Servidor WebSocket do protocolo Evo Facial, na MESMA instancia do
 * processo web (nao um worker separado - ver o comentario extenso no topo
 * de evoFacialServidor.js sobre o porque). Equipamentos com
 * modo_conexao='server' e protocolo='evo_ws' devem ser configurados (no
 * proprio menu do equipamento) para apontar para o IP deste servidor,
 * nesta porta.
 */
iniciarServidorEvoFacial(EVO_FACIAL_WS_PORT);
