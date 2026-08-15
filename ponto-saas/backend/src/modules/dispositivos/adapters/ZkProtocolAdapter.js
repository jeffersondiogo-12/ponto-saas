const DeviceAdapter = require('./DeviceAdapter');

/**
 * ================================================================
 * ATENCAO — ADAPTER EXPERIMENTAL, PROTOCOLO NAO CONFIRMADO
 * ================================================================
 * A maioria dos terminais biometricos chineses revendidos no Brasil (o que
 * inclui provavelmente o hardware por tras do Evo Facial AI-5) fala o
 * protocolo conhecido como "protocolo ZK", originado da ZKTeco e usado por
 * uma industria inteira de fabricantes OEM. Este adapter usa a biblioteca
 * `node-zklib` para tentar essa hipotese.
 *
 * O QUE NAO ESTA CONFIRMADO:
 *   - Se o Evo Facial AI-5 realmente fala este protocolo (a porta 7788 vista
 *     na tela de configuracao e customizavel pelo instalador, entao nao prova
 *     nem descarta nada — o padrao ZK usa porta 4370 por padrao).
 *   - Se os campos de NSR retornados aqui batem com o NSR que o firmware do
 *     proprio equipamento usa internamente para fins de REP-P/AFD. Por isso,
 *     abaixo, geramos um NSR INTERNO (sequencial por dispositivo) em vez de
 *     tentar adivinhar um campo do protocolo generico ZK. Se o SDK oficial da
 *     Evo Sistemas Inteligentes expuser o NSR real do equipamento, o adapter
 *     que implementa esse SDK deve substituir esta geracao interna pelo NSR
 *     genuino do dispositivo.
 *
 * COMO VALIDAR:
 *   1. `npm install node-zklib`
 *   2. Ajuste IP/porta do dispositivo em config de teste.
 *   3. Rode `testarConexao()` e `obterInfo()` primeiro — se o dispositivo
 *      responder com numero de serie/capacidade coerentes, o protocolo bate.
 *      Se der timeout/erro, o dispositivo provavelmente fala outra coisa e
 *      este adapter deve ser trocado por um HttpRestAdapter ou pelo SDK
 *      oficial assim que a Evo Sistemas Inteligentes fornecer.
 */
class ZkProtocolAdapter extends DeviceAdapter {
  constructor(dispositivo) {
    super(dispositivo);
    this.zk = null;
  }

  async _getLib() {
    // Import tardio: assim o resto do sistema nao quebra se node-zklib nao
    // estiver instalado (ex: ambiente que ja trocou para outro adapter).
    // eslint-disable-next-line global-require
    const ZKLib = require('node-zklib');
    return ZKLib;
  }

  async conectar() {
    const ZKLib = await this._getLib();
    this.zk = new ZKLib(this.dispositivo.ip, this.dispositivo.porta, 10000, 4000);
    try {
      await this.zk.createSocket();
    } catch (err) {
      throw new Error(
        `Falha ao conectar no dispositivo ${this.dispositivo.descricao} (${this.dispositivo.ip}:${this.dispositivo.porta}) via protocolo ZK: ${err.message}. ` +
          'Isso pode significar apenas que o protocolo do equipamento nao e o ZK padrao — considere validar com o SDK oficial da Evo Sistemas Inteligentes.'
      );
    }
  }

  async desconectar() {
    if (this.zk) {
      try {
        await this.zk.disconnect();
      } catch (err) {
        // Desconexao "falhando" nao deve derrubar o restante do fluxo de coleta.
      }
    }
  }

  async testarConexao() {
    await this.conectar();
    try {
      const info = await this.obterInfo();
      return { ok: true, info };
    } finally {
      await this.desconectar();
    }
  }

  /**
   * IMPORTANTE: a versao 1.3.0 do node-zklib (a que existe publicada no
   * npm hoje) so decodifica { userCounts, logCounts, logCapacity } no
   * comando de "free sizes" - NAO retorna numero de serie, firmware ou
   * hora do equipamento (confirmado lendo o codigo-fonte da lib, nao e
   * suposicao). Por isso devolvemos o numero de serie que TEMOS no nosso
   * cadastro (`this.dispositivo.numero_serie`), nao um valor lido do
   * equipamento - use estes contadores so para confirmar que a conexao
   * realmente fala com um equipamento (numeros coerentes = bom sinal).
   */
  async obterInfo() {
    const infoBruta = await this.zk.getInfo();
    return {
      numeroSerieCadastrado: this.dispositivo.numero_serie,
      usuariosCadastradosNoEquipamento: infoBruta.userCounts ?? null,
      totalBatidasNoEquipamento: infoBruta.logCounts ?? null,
      capacidadeBatidas: infoBruta.logCapacity ?? null,
    };
  }

  async listarUsuarios() {
    const resultado = await this.zk.getUsers();
    const usuarios = resultado?.data || resultado || [];
    return usuarios.map((u) => ({
      idNoDispositivo: String(u.userId || u.uid),
      nome: u.name || null,
    }));
  }

  /**
   * IMPORTANTE: os registros de ponto decodificados por esta versao da lib
   * trazem apenas { userSn, deviceUserId, recordTime } - NAO ha um campo de
   * "tipo de verificacao" (entrada/saida) nesta biblioteca. Por isso
   * tipoVerificacaoBruto sempre volta null aqui, e quem decide
   * entrada/saida/intervalo e o pareamento cronologico feito em
   * calculoJornada.js (par 1=entrada, par 2=saida, alternando) - o que,
   * felizmente, é como a maioria dos relogios de ponto brasileiros
   * realmente opera no dia a dia.
   */
  async buscarRegistros(ultimoNsr) {
    const resultado = await this.zk.getAttendances();
    const registrosBrutos = resultado?.data || resultado || [];

    const ordenados = [...registrosBrutos].sort(
      (a, b) => new Date(a.recordTime).getTime() - new Date(b.recordTime).getTime()
    );

    const baseNsr = Number(ultimoNsr) || 0;

    return ordenados.map((registro, indice) => ({
      nsr: baseNsr + indice + 1,
      nsrOrigem: 'gerado_internamente', // ver aviso: nao e o NSR nativo do firmware
      idNoDispositivo: String(registro.deviceUserId ?? registro.userSn),
      dataHora: new Date(registro.recordTime),
      tipoVerificacaoBruto: null,
    }));
  }
}

module.exports = ZkProtocolAdapter;
