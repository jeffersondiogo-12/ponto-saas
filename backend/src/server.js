const app = require('./app');
const { iniciarServidorEvoFacial } = require('./modules/dispositivos/evoFacialServidor');

const PORT = process.env.PORT || 3000;

const servidorHttp = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Ponto SaaS rodando em http://localhost:${PORT}`);
});

/**
 * Servidor WebSocket do protocolo Evo Facial, compartilhando a MESMA porta
 * HTTP do resto da API (nao uma porta separada). Isso e obrigatorio para
 * rodar em qualquer PaaS que so exponha uma porta publica por servico (ex:
 * Render - "Render forwards inbound traffic to only one HTTP port per web
 * service", conforme a documentacao deles) - uma porta extra simplesmente
 * nao seria alcancavel de fora nesses ambientes.
 *
 * Tecnicamente: toda conexao HTTP normal (a API REST) e toda conexao
 * WebSocket (o equipamento) chegam na MESMA porta; o Node so trata como
 * upgrade de WebSocket as requisicoes que pedem isso explicitamente
 * (cabecalho "Upgrade: websocket", mandado pelo firmware do equipamento,
 * nunca por um cliente HTTP normal) - por isso nao ha ambiguidade nem
 * necessidade de rotear por caminho (path) especifico. Equipamentos com
 * modo_conexao='server' e protocolo='evo_ws' devem ser configurados (no
 * proprio menu do equipamento) para apontar para o MESMO host/porta que a
 * API usa - em producao, isso e o dominio publico do servico (porta 443
 * por HTTPS/WSS, se o equipamento suportar; senao a porta 80 do dominio);
 * em desenvolvimento local, e o IP da maquina na rede local + PORT (padrao
 * 3000). Ver README secao 6.
 */
iniciarServidorEvoFacial(servidorHttp);
