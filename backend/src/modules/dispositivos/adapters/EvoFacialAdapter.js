const DeviceAdapter = require('./DeviceAdapter');
const db = require('../../../config/db');
const { horaLocalParaUTC } = require('../../../utils/tempo');
const evoFacialServidor = require('../evoFacialServidor');

/**
 * Adapter para o protocolo real do Evo Facial (WebSocket + JSON), conforme
 * o PDF "Protocolo WebSocket EVO FACIAL - Revisao 5" fornecido pelo
 * fabricante (Evo Sistemas Inteligentes). Ao contrario do ZkProtocolAdapter,
 * este protocolo e CONFIRMADO por documentacao oficial - nao e uma hipotese.
 *
 * PARTICULARIDADE ESTRUTURAL: todo o `DeviceAdapter` foi desenhado supondo
 * que o SERVIDOR abre a conexao (por isso conectar()/desconectar() existem
 * como par simetrico). Aqui e o oposto - quem abre a conexao e o
 * equipamento, contra o servidor WebSocket compartilhado (ver
 * evoFacialServidor.js). Entao:
 *   - conectar() nao abre nada; so confirma que ja existe uma sessao ativa
 *     (lanca erro claro se nao existir, para caber no mesmo fluxo que
 *     dispositivos.service.js -> forcarColeta/testarConexao ja usam).
 *   - desconectar() e deliberadamente um no-op: a sessao WebSocket e
 *     compartilhada e de longa duracao (o equipamento fica conectado o
 *     tempo todo, nao so durante uma "coleta") - encerra-la aqui derrubaria
 *     a conexao de verdade do equipamento so porque um ciclo de coleta sob
 *     demanda terminou.
 */
class EvoFacialAdapter extends DeviceAdapter {
  get numeroSerie() {
    return this.dispositivo.numero_serie;
  }

  async conectar() {
    if (!evoFacialServidor.estaConectado(this.numeroSerie)) {
      throw new Error(
        `O dispositivo "${this.dispositivo.descricao}" nao esta conectado ao servidor agora. ` +
          'Ele se registra automaticamente a cada 20s quando ligado e apontando para este servidor - verifique se esta ligado, ' +
          'na rede certa, e configurado com o IP/porta deste backend.'
      );
    }
  }

  async desconectar() {
    // Ver comentario da classe - nao fecha a conexao real de proposito.
  }

  async testarConexao() {
    const conectado = evoFacialServidor.estaConectado(this.numeroSerie);
    if (!conectado) {
      return {
        ok: false,
        erro: 'Dispositivo nao esta conectado no momento (aguardando proximo registro automatico, a cada 20s).',
      };
    }
    const info = await this.obterInfo();
    return { ok: true, info };
  }

  /**
   * Diferente do ZkProtocolAdapter (que so tinha contadores brutos), o
   * protocolo Evo Facial manda um bloco `devinfo` bem completo no registro -
   * cacheamos a ultima versao recebida na tabela `dispositivos`
   * (ultimo_devinfo) para conseguir responder isso mesmo quando o
   * equipamento esta offline no momento da consulta (mostra o ULTIMO estado
   * conhecido, nao um estado ao vivo).
   */
  async obterInfo() {
    const linha = await db('dispositivos').where({ id: this.dispositivo.id }).first();
    const devinfo = linha?.ultimo_devinfo || null;

    return {
      numeroSerie: linha?.numero_serie || this.numeroSerie,
      firmware: devinfo?.firmware || null,
      capacidadeUsuarios: devinfo?.usersize ?? null,
      usuariosCadastrados: devinfo?.useduser ?? null,
      facesCadastradas: devinfo?.usedface ?? null,
      horaDispositivo: devinfo?.time || null,
      conectadoAgora: evoFacialServidor.estaConectado(this.numeroSerie),
      ultimaConexaoEm: linha?.ultima_conexao_ws_em || null,
    };
  }

  /** 2.1 Obter Lista de Usuarios - reconciliacao: quem o equipamento acha que tem cadastrado. */
  async listarUsuarios() {
    const resposta = await evoFacialServidor.enviarComando(this.numeroSerie, { cmd: 'getuserlist', stn: true });
    if (!resposta.result) {
      throw new Error(`Equipamento recusou getuserlist: ${resposta.reason || 'motivo nao informado'}`);
    }
    return (resposta.record || []).map((u) => ({
      idNoDispositivo: String(u.enrollid),
      nome: null, // getuserlist nao devolve nome (so enrollid/admin/backupnum - ver PDF 2.1)
    }));
  }

  /**
   * 2.10 Obter Logs Novos - normalmente as marcacoes chegam sozinhas via
   * sendlog (push), mas expor buscarRegistros() por getnewlog mantem o
   * botao "Forcar coleta" da tela util tambem para este protocolo (ex: para
   * reconciliar um equipamento que ficou muito tempo offline). So funciona
   * enquanto o equipamento estiver conectado agora - dai o conectar() no
   * inicio do fluxo em dispositivos.service.js.forcarColeta ja cobrir isso.
   */
  async buscarRegistros(ultimoNsr) {
    const resposta = await evoFacialServidor.enviarComando(this.numeroSerie, { cmd: 'getnewlog', stn: true });
    if (!resposta.result) {
      throw new Error(`Equipamento recusou getnewlog: ${resposta.reason || 'motivo nao informado'}`);
    }

    const timeZone = this.dispositivo.fuso_horario || 'America/Sao_Paulo';
    const registrosBrutos = (resposta.record || []).filter((r) => r && r.enrollid != null && r.time);
    const baseNsr = Number(ultimoNsr) || 0;

    return registrosBrutos.map((registro, indice) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(String(registro.time).trim());
      const dataHora = m
        ? horaLocalParaUTC(
            {
              ano: Number(m[1]),
              mes: Number(m[2]),
              dia: Number(m[3]),
              hora: Number(m[4]),
              minuto: Number(m[5]),
              segundo: Number(m[6]),
            },
            timeZone
          )
        : new Date(registro.time);

      return {
        nsr: baseNsr + indice + 1,
        idNoDispositivo: String(registro.enrollid),
        dataHora,
        tipoVerificacaoBruto: typeof registro.inout === 'number' ? registro.inout : null,
      };
    });
  }

  /**
   * 2.3 Definir/Enviar Informacoes de Usuario, com backupnum 50 (Foto/Base64
   * - ver legenda de "Valores de backupnum" no PDF). Usado para cadastro
   * remoto de face pelo painel, sem precisar tocar fisicamente no
   * equipamento.
   */
  async cadastrarFace({ enrollId, nome, fotoBase64 }) {
    if (!enrollId) throw new Error('enrollId e obrigatorio para cadastrar face no equipamento.');
    if (!fotoBase64) throw new Error('fotoBase64 e obrigatorio para cadastrar face no equipamento.');

    const resposta = await evoFacialServidor.enviarComando(this.numeroSerie, {
      cmd: 'setuserinfo',
      enrollid: Number(enrollId),
      name: nome || '',
      backupnum: 50, // 50 = Foto (Base64), ver PDF "Valores de backupnum"
      record: fotoBase64,
    });

    if (!resposta.result) {
      throw new Error(`Equipamento recusou o cadastro da face (reason=${resposta.reason ?? 'nao informado'}).`);
    }
    return { enrollId: String(enrollId) };
  }

  /** 2.4 Deletar Usuarios, com backupnum 12 (remove o usuario inteiro, nao so um campo). */
  async removerFace(enrollId) {
    const resposta = await evoFacialServidor.enviarComando(this.numeroSerie, {
      cmd: 'deleteuser',
      enrollid: Number(enrollId),
      backupnum: 12,
    });

    if (!resposta.result) {
      throw new Error(`Equipamento recusou a remocao (reason=${resposta.reason ?? 'nao informado'}).`);
    }
  }
}

module.exports = EvoFacialAdapter;
