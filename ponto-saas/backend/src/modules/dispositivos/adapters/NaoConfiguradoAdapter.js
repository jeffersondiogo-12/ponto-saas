const DeviceAdapter = require('./DeviceAdapter');

/**
 * Usado quando `dispositivos.protocolo = 'desconhecido'`. Em vez de assumir
 * silenciosamente um protocolo (o que poderia corromper dados de ponto -
 * grave para um sistema que sera usado em fiscalizacao trabalhista), este
 * adapter falha de forma explicita e orienta o proximo passo.
 */
class NaoConfiguradoAdapter extends DeviceAdapter {
  async _erro() {
    throw new Error(
      `O dispositivo "${this.dispositivo.descricao}" ainda nao tem um protocolo de comunicacao confirmado. ` +
        'Defina o campo "protocolo" (zk_tcp ou http_rest) apos validar contra o hardware real ou obter o SDK ' +
        'oficial da Evo Sistemas Inteligentes (contato@evosistemasinteligentes.com.br).'
    );
  }

  async conectar() { return this._erro(); }
  async desconectar() {} // no-op, sempre seguro chamar
  async testarConexao() { return this._erro(); }
  async obterInfo() { return this._erro(); }
  async listarUsuarios() { return this._erro(); }
  async buscarRegistros() { return this._erro(); }
}

module.exports = NaoConfiguradoAdapter;
