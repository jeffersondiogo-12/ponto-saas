const ZkProtocolAdapter = require('./ZkProtocolAdapter');
const NaoConfiguradoAdapter = require('./NaoConfiguradoAdapter');

/**
 * Unico ponto do sistema que decide QUAL protocolo falar com um dispositivo.
 * Adicionar suporte a um novo protocolo (ex: SDK oficial da Evo, ou um HTTP
 * REST descoberto no equipamento) significa: criar o arquivo do adapter,
 * importar aqui, e adicionar uma entrada no mapa abaixo. Nada mais muda.
 */
const ADAPTERS = {
  zk_tcp: ZkProtocolAdapter,
  desconhecido: NaoConfiguradoAdapter,
  // http_rest: HttpRestAdapter, // implementar quando o formato for confirmado
};

function criarAdapter(dispositivo) {
  const Adapter = ADAPTERS[dispositivo.protocolo] || NaoConfiguradoAdapter;
  return new Adapter(dispositivo);
}

module.exports = { criarAdapter };
