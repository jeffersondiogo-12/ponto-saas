/**
 * Contrato que qualquer adapter de comunicacao com relogio de ponto precisa
 * implementar. A ideia central deste arquivo: NADA no resto do sistema
 * (rotas, service de ingestao, job de coleta) conhece o protocolo real do
 * equipamento. Ele so fala com esta interface.
 *
 * Isso existe porque, no momento em que este sistema foi desenhado, o
 * protocolo exato do Evo Facial AI-5 nao estava confirmado (ver README.md).
 * Quando o SDK oficial da Evo Sistemas Inteligentes chegar, ou quando o
 * protocolo for validado empiricamente, cria-se um novo arquivo
 * "EvoOficialAdapter.js" implementando este mesmo contrato — nenhuma outra
 * parte do sistema muda.
 */
class DeviceAdapter {
  /**
   * @param {object} dispositivo - linha da tabela `dispositivos` (com a senha
   *   ja DESCRIPTOGRAFADA em memoria, nunca persista isso em log ou disco).
   */
  constructor(dispositivo) {
    if (new.target === DeviceAdapter) {
      throw new Error('DeviceAdapter e abstrata, use uma implementacao concreta.');
    }
    this.dispositivo = dispositivo;
  }

  /** Abre a conexao. Deve lancar erro claro se falhar (timeout, auth, etc). */
  async conectar() {
    throw new Error('conectar() nao implementado');
  }

  /** Fecha a conexao de forma segura. Deve ser idempotente. */
  async desconectar() {
    throw new Error('desconectar() nao implementado');
  }

  /** Testa se o dispositivo esta acessivel, sem baixar dados. */
  async testarConexao() {
    throw new Error('testarConexao() nao implementado');
  }

  /**
   * Retorna { numeroSerie, firmware, capacidadeUsuarios, usuariosCadastrados, horaDispositivo }.
   */
  async obterInfo() {
    throw new Error('obterInfo() nao implementado');
  }

  /**
   * Busca marcacoes novas. `ultimoNsr` e o maior NSR ja coletado anteriormente
   * (para coleta incremental). Deve retornar um array de:
   * { nsr, idNoDispositivo, dataHora (Date), tipoVerificacaoBruto }
   * ordenado por nsr crescente. Se o protocolo do dispositivo nao suportar
   * filtrar por NSR nativamente, o adapter busca tudo e filtra aqui dentro -
   * quem chama este metodo nunca precisa saber a diferenca.
   */
  async buscarRegistros(ultimoNsr) {
    throw new Error('buscarRegistros() nao implementado');
  }

  /** Lista os usuarios/faces cadastrados fisicamente no equipamento. */
  async listarUsuarios() {
    throw new Error('listarUsuarios() nao implementado');
  }

  /**
   * Envia um rosto (e opcionalmente nome) para o equipamento cadastrar
   * localmente, permitindo reconhecimento facial. So faz sentido para
   * protocolos que suportam comando remoto de cadastro (ex: evo_ws) - por
   * isso o comportamento padrao e falhar com uma mensagem clara, em vez de
   * fingir sucesso. Implementacoes concretas devem retornar
   * { enrollId } com o identificador que o equipamento passa a usar para
   * essa pessoa.
   * @param {{ enrollId: string, nome: string, fotoBase64: string }} dados
   */
  async cadastrarFace(dados) {
    throw new Error(
      `Este dispositivo (protocolo "${this.dispositivo.protocolo}") nao suporta cadastro remoto de face - cadastre fisicamente no equipamento e vincule o ID pela tela de funcionario/aluno.`
    );
  }

  /** Remove um usuario/rosto do equipamento pelo ID que ele usa internamente. */
  async removerFace(enrollId) {
    throw new Error(
      `Este dispositivo (protocolo "${this.dispositivo.protocolo}") nao suporta remocao remota de face.`
    );
  }
}

module.exports = DeviceAdapter;
