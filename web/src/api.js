import { enfileirar, limparFila, marcarFalhaNaFila, obterFila, removerDaFila } from './app/filaOffline';
import { lerCache, limparCache, salvarCache } from './app/cacheOffline';

export const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
const CHAVE_TOKEN = 'ponto_saas_token';
const CHAVE_EMPRESA_ID = 'ponto_saas_empresa_id';
const CHAVE_EMPRESA_NOME = 'ponto_saas_empresa_nome';
const CHAVE_FILIAL_ID = 'ponto_saas_filial_id';
const CHAVE_FILIAL_NOME = 'ponto_saas_filial_nome';
const CHAVE_FILIAL_TIPO = 'ponto_saas_filial_tipo';

/**
 * "Manter login salvo" desligado (cara do app) guarda a sessao no
 * `sessionStorage`: ela some quando o app fecha, como no APK. O web do
 * computador sempre persiste, como antes.
 */
export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN) || sessionStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token, persistir = true) {
  limparToken();
  (persistir ? localStorage : sessionStorage).setItem(CHAVE_TOKEN, token);
}

export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_TOKEN);
}

/** A sessao atual sobrevive ao fechar o app? */
export function sessaoPersistente() {
  return !sessionStorage.getItem(CHAVE_TOKEN);
}

const CHAVE_USUARIO = 'ponto_saas_usuario';

export function lerUsuarioSalvo() {
  const bruto = localStorage.getItem(CHAVE_USUARIO) || sessionStorage.getItem(CHAVE_USUARIO);
  return bruto ? JSON.parse(bruto) : null;
}

/**
 * Grava no mesmo lugar do token: uma sessao que nao persiste (o "Manter login
 * salvo" desligado na cara do app) nao pode virar persistente por uma
 * atualizacao do usuario.
 */
export function gravarUsuario(usuario) {
  (sessaoPersistente() ? localStorage : sessionStorage).setItem(CHAVE_USUARIO, JSON.stringify(usuario));
}

export function limparUsuario() {
  localStorage.removeItem(CHAVE_USUARIO);
  sessionStorage.removeItem(CHAVE_USUARIO);
}

export function obterEmpresaSelecionada() {
  const id = localStorage.getItem(CHAVE_EMPRESA_ID);
  const nome = localStorage.getItem(CHAVE_EMPRESA_NOME);
  return id ? { id, nome: nome || '' } : null;
}

export function salvarEmpresaSelecionada({ id, nome }) {
  localStorage.setItem(CHAVE_EMPRESA_ID, id);
  localStorage.setItem(CHAVE_EMPRESA_NOME, nome || '');
}

export function limparEmpresaSelecionada() {
  localStorage.removeItem(CHAVE_EMPRESA_ID);
  localStorage.removeItem(CHAVE_EMPRESA_NOME);
}

export function obterFilialSelecionada() {
  const id = localStorage.getItem(CHAVE_FILIAL_ID);
  const nome = localStorage.getItem(CHAVE_FILIAL_NOME);
  const tipo = localStorage.getItem(CHAVE_FILIAL_TIPO);
  return id ? { id, nome: nome || '', tipo: tipo || 'empresa' } : null;
}

export function salvarFilialSelecionada({ id, nome, tipo }) {
  localStorage.setItem(CHAVE_FILIAL_ID, id);
  localStorage.setItem(CHAVE_FILIAL_NOME, nome || '');
  localStorage.setItem(CHAVE_FILIAL_TIPO, tipo || 'empresa');
}

export function limparFilialSelecionada() {
  localStorage.removeItem(CHAVE_FILIAL_ID);
  localStorage.removeItem(CHAVE_FILIAL_NOME);
  localStorage.removeItem(CHAVE_FILIAL_TIPO);
}

async function chamarServidor(caminho, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const empresaSelecionada = obterEmpresaSelecionada();
  if (empresaSelecionada) {
    headers['X-Empresa-Id'] = empresaSelecionada.id;
  }

  const filialSelecionada = obterFilialSelecionada();
  if (filialSelecionada) {
    headers['X-Filial-Id'] = filialSelecionada.id;
  }

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    /**
     * 401 COM token = a sessao morreu. Antes so acontecia quando o token
     * expirava; desde que o servidor passou a reconferir a conta no banco a
     * cada requisicao, tambem acontece na hora em que alguem e desativado.
     * Sem tratar, a pessoa fica presa numa tela com faixa vermelha, o menu
     * ainda montado e nenhum caminho de volta.
     *
     * A checagem e "tinha token", nao a rota: 401 SEM token e o login
     * recusando email ou senha, e ali a tela precisa mostrar o erro no lugar
     * de recarregar tudo. Regra unica, vale para qualquer login futuro.
     */
    if (resposta.status === 401 && token) {
      window.dispatchEvent(new CustomEvent('sessao-encerrada'));
    }

    /**
     * 403 significa que o servidor discorda do que esta tela ofereceu — ou a
     * permissao mudou, ou o cargo mudou. A matriz daqui e cache; sem isso o
     * menu continua oferecendo o mesmo botao ate a pessoa sair e entrar.
     *
     * So avisa: quem exibe a mensagem continua sendo a tela, que sabe o que a
     * pessoa estava tentando fazer.
     */
    if (resposta.status === 403 && token) {
      window.dispatchEvent(new CustomEvent('permissao-negada'));
    }
    // Carrega o status no erro: quem chama precisa distinguir "rota nao existe"
    // (404) de "o servidor recusou" sem depender do texto da mensagem.
    const erro = new Error(dados.erro || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

/*
 * --- Sem internet (cara do app) ---------------------------------------------
 *
 * Porte do que o APK faz em mobile/src/api.js, so para quem pede:
 * - `fila: 'Rotulo'` numa escrita: sem rede, a acao fica guardada e sobe
 *   quando a conexao voltar;
 * - `cache: true` numa leitura: sem rede, volta a ultima resposta boa, com
 *   `_offline` e `_cacheEm` para a tela dizer de quando e.
 * Sem essas opcoes, tudo segue como antes — o web do computador nao usa nenhuma.
 */

const CHAVE_ULTIMA_SINCRONIZACAO = 'ponto_saas_ultima_sincronizacao';

/**
 * `fetch` so REJEITA por falha de rede de verdade (sem internet, DNS, servidor
 * fora do ar). Erro do backend chega como resposta, com `status` — e nao conta
 * como "sem internet".
 */
export function ehFalhaDeRede(erro) {
  return !erro?.status && erro instanceof TypeError;
}

/** Uma fila e um cache por conta: tipo, id, ambiente e unidade. */
export function namespaceOffline() {
  const usuario = lerUsuarioSalvo();
  if (!usuario) return null;
  const id = usuario.tipo === 'responsavel'
    ? usuario.responsavelId || usuario.id
    : usuario.usuario_id || usuario.id;
  if (!id) return null;
  return [usuario.tipo, id, usuario.empresa_id || 'global', usuario.filial_id || 'global']
    .map((valor) => encodeURIComponent(String(valor)))
    .join(':');
}

export function obterUltimaSincronizacao() {
  return localStorage.getItem(CHAVE_ULTIMA_SINCRONIZACAO);
}

/**
 * Ao sair da conta, o cache desta conta sai junto. A fila so sai quando a
 * pessoa escolhe sair: se a sessao expirou, ela fica guardada e sobe quando a
 * mesma conta entrar de novo — como no APK. Sem isso, a chamada feita sem sinal
 * se perderia porque o token venceu no caminho.
 */
export function limparDadosOffline({ preservarFila = false } = {}) {
  const namespace = namespaceOffline();
  if (!preservarFila) limparFila(namespace);
  limparCache(namespace);
}

let processandoFila = false;

/**
 * Reenvia, em ordem, o que ficou guardado. Roda depois de cada requisicao que
 * deu certo (prova de que a conexao voltou), no evento `online` e quando o
 * app volta a aparecer. Para na primeira falha de rede; erro "de verdade" do
 * servidor marca o item, que fica visivel para a pessoa decidir.
 */
export async function processarFila() {
  const namespace = namespaceOffline();
  const token = obterToken();
  if (processandoFila || !namespace || !token) return;
  processandoFila = true;
  try {
    for (const item of obterFila(namespace)) {
      // Uma conta nova nunca empresta o token para a pendencia de outra.
      if (namespaceOffline() !== namespace || obterToken() !== token) break;
      if (item.falhaDefinitiva) continue;
      try {
        await chamarServidor(item.caminho, { method: item.method, body: item.body });
        removerDaFila(namespace, item.id);
        localStorage.setItem(CHAVE_ULTIMA_SINCRONIZACAO, new Date().toISOString());
      } catch (erro) {
        if (ehFalhaDeRede(erro) || erro?.status === 401) break;
        marcarFalhaNaFila(namespace, item.id, erro.message || 'O servidor recusou a ação.');
      }
    }
  } finally {
    processandoFila = false;
  }
}

async function requisitar(caminho, { method = 'GET', body, fila, cache } = {}) {
  let dados;
  try {
    dados = await chamarServidor(caminho, { method, body });
  } catch (erro) {
    if (!ehFalhaDeRede(erro) || (!fila && !cache)) throw erro;

    const namespace = namespaceOffline();
    if (method === 'GET') {
      const salvo = lerCache(namespace, caminho);
      if (salvo) return { ...salvo.dados, _offline: true, _cacheEm: salvo.em };
      const semDados = new Error('Sem conexão e sem dados salvos neste aparelho ainda.');
      semDados.offline = true;
      throw semDados;
    }
    const item = enfileirar(namespace, { rotulo: fila, caminho, method, body });
    return { _fila: true, _tempId: item.id };
  }

  if (cache && method === 'GET') salvarCache(namespaceOffline(), caminho, dados);
  if (obterFila(namespaceOffline()).length) processarFila();
  return dados;
}

/** Escrita do professor sem atribuicao_id: o backend recusaria (igual ao APK). */
function exigirAtribuicao(dados) {
  if (dados?.atribuicao_id) return;
  const erro = new Error('Aula sem atribuicao_id. Atualize as turmas antes de registrar esta acao.');
  erro.status = 409;
  throw erro;
}

/**
 * Foto da ultima batida facial. A rota e autenticada e o <img> nao manda
 * cabecalho, entao a foto vem por aqui e vira um endereco local (blob).
 * Quem chama libera com `URL.revokeObjectURL`. Sem foto ou sem rede: null.
 */
export async function urlDaFotoDoRegistro(registroId) {
  try {
    const resposta = await fetch(`${BASE_URL}/api/ponto/registros/${registroId}/foto`, {
      headers: { Authorization: `Bearer ${obterToken()}` },
    });
    return resposta.ok ? URL.createObjectURL(await resposta.blob()) : null;
  } catch {
    return null;
  }
}

/** Monta a query string ignorando filtro vazio, que a API trataria como valor. */
function consulta(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
}

export const api = {
  login: (email, senha, unidade) => requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade } }),
  loginResponsavel: (email, senha) => requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha } }),

  /**
   * Responsavel, so pela cara do app. Mesmos nomes do mobile/src/api.js.
   * Sem `cache`: dado de crianca nao fica guardado para o responsavel. As
   * duas escritas usam a fila offline, como no APK.
   */
  responsavel: {
    listarAlunos: () => requisitar('/api/responsaveis/alunos'),
    frequenciaDoAluno: (alunoId, filtros = {}) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia?${consulta(filtros)}`),
    notasDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/notas`),
    observacoesDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/observacoes`),
    presencaSalaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/presenca-sala`),
    avisosDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/avisos`),
    registrarLeituraAviso: (avisoId) => requisitar(`/api/responsaveis/avisos/${avisoId}/lido`, {
      method: 'POST', fila: 'Confirmar leitura de aviso',
    }),
    vincularFilho: (dados) => requisitar('/api/responsaveis/alunos/vincular', {
      method: 'POST', body: dados, fila: `Vincular ${dados?.nome_completo || 'filho'}`,
    }),
    // A inscricao vai inteira no corpo: { endpoint, keys: { p256dh, auth } }.
    registrarPushWeb: (inscricao) => requisitar('/api/responsaveis/push-web', { method: 'POST', body: inscricao }),
    removerPushWeb: (endpoint) => requisitar('/api/responsaveis/push-web', { method: 'DELETE', body: { endpoint } }),
  },

  /**
   * Professor, pela cara do app. Mesmos nomes do mobile/src/api.js.
   * `cache` so no que a chamada precisa para abrir sem internet — turmas,
   * resumo e alunos da turma (excecao aberta pelo Samuel em 2026-09-26). A
   * ficha do aluno nao fica guardada: tem contato do responsavel. As tres
   * escritas usam a fila offline, como no APK.
   */
  professor: {
    listarMinhasTurmas: () => requisitar('/api/professores/minhas-turmas', { cache: true }),
    resumoProfessor: () => requisitar('/api/professores/minhas-turmas/resumo', { cache: true }),
    listarAlunosDaTurma: async (turmaId, atribuicaoId) => {
      if (!atribuicaoId) {
        const erro = new Error('Aula legada sem atribuicao_id. Atualize as turmas antes de registrar a chamada.');
        erro.status = 409;
        throw erro;
      }
      return requisitar(`/api/professores/turmas/${turmaId}/alunos?${consulta({ atribuicao_id: atribuicaoId })}`, { cache: true });
    },
    fichaAlunoProfessor: async (turmaId, alunoId, atribuicaoId) => {
      if (!atribuicaoId) {
        const erro = new Error('atribuicao_id e obrigatorio para abrir a ficha do professor.');
        erro.status = 409;
        throw erro;
      }
      return requisitar(`/api/professores/turmas/${turmaId}/alunos/${alunoId}/ficha?${consulta({ atribuicao_id: atribuicaoId })}`);
    },
    historicoDoAluno: async (turmaId, alunoId, atribuicaoId) => {
      if (!atribuicaoId) throw new Error('Historico indisponivel para aula legada sem atribuicao_id.');
      return requisitar(`/api/professores/turmas/${turmaId}/alunos/${alunoId}/historico?${consulta({ atribuicao_id: atribuicaoId })}`);
    },
    registrarPresencasSala: async (turmaId, dados) => {
      exigirAtribuicao(dados);
      return requisitar(`/api/professores/turmas/${turmaId}/presencas`, { method: 'POST', body: dados, fila: 'Chamada da turma' });
    },
    criarNotaProfessor: async (turmaId, dados) => {
      exigirAtribuicao(dados);
      return requisitar(`/api/professores/turmas/${turmaId}/notas`, {
        method: 'POST', body: dados, fila: `Nota de ${dados?.disciplina || 'aluno'}`,
      });
    },
    criarObservacaoProfessor: async (turmaId, dados) => {
      exigirAtribuicao(dados);
      return requisitar(`/api/professores/turmas/${turmaId}/observacoes`, {
        method: 'POST', body: dados, fila: 'Observação para o responsável',
      });
    },
  },

  /**
   * Conta atual, relida do banco pelo middleware `autenticar`. Serve para o
   * papel: o do login e uma fotografia que envelhece, e desde que o servidor
   * passou a reconferir a conta a cada requisicao, quem e promovido ou
   * rebaixado passa a valer no servidor na hora — mas o menu daqui continuava
   * com o papel antigo ate a pessoa sair e entrar.
   *
   * NAO passa por `resolverTenant`, entao funciona antes de o super_admin
   * escolher a empresa.
   */
  obterUsuarioAtual: () => requisitar('/api/auth/me'),
  listarEmpresas: () => requisitar('/api/empresas'),

  listarDispositivos: () => requisitar('/api/dispositivos'),
  buscarDispositivo: (id) => requisitar(`/api/dispositivos/${id}`),
  criarDispositivo: (dados) => requisitar('/api/dispositivos', { method: 'POST', body: dados }),
  atualizarDispositivo: (id, dados) => requisitar(`/api/dispositivos/${id}`, { method: 'PUT', body: dados }),
  testarConexaoDispositivo: (id) => requisitar(`/api/dispositivos/${id}/testar-conexao`, { method: 'POST' }),
  forcarColeta: (id) => requisitar(`/api/dispositivos/${id}/forcar-coleta`, { method: 'POST' }),
  usuariosNoEquipamento: (id) => requisitar(`/api/dispositivos/${id}/usuarios-no-equipamento`),
  cadastrarFaceDispositivo: (id, dados) => requisitar(`/api/dispositivos/${id}/cadastrar-face`, { method: 'POST', body: dados }),
  removerFaceDispositivo: (id, dados) => requisitar(`/api/dispositivos/${id}/remover-face`, { method: 'POST', body: dados }),

  listarUnidades: () => requisitar('/api/filiais'),
  buscarUnidade: (id) => requisitar(`/api/filiais/${id}`),
  criarUnidade: (dados) => requisitar('/api/filiais', { method: 'POST', body: dados }),
  atualizarUnidade: (id, dados) => requisitar(`/api/filiais/${id}`, { method: 'PUT', body: dados }),
  listarTurmas: () => requisitar('/api/turmas'),
  buscarTurma: (id) => requisitar(`/api/turmas/${id}`),
  criarTurma: (dados) => requisitar('/api/turmas', { method: 'POST', body: dados }),
  atualizarTurma: (id, dados) => requisitar(`/api/turmas/${id}`, { method: 'PUT', body: dados }),
  // Nao existe DELETE de turma, por decisao de produto: turma e referenciada
  // por alunos e por registros de ponto ja gravados. "Excluir" e desativar.
  desativarTurma: (turma) => requisitar(`/api/turmas/${turma.id}`, {
    method: 'PUT',
    // O PUT reescreve todos os campos; mandar so `ativo` deixaria nome e turno
    // como undefined e o Knex do backend estouraria.
    body: { nome: turma.nome, turno: turma.turno, ano_letivo: turma.ano_letivo, ativo: false },
  }),
  reativarTurma: (turma) => requisitar(`/api/turmas/${turma.id}`, {
    method: 'PUT',
    body: { nome: turma.nome, turno: turma.turno, ano_letivo: turma.ano_letivo, ativo: true },
  }),
  // Janela de funcionamento da turma (entrada/saida). O backend guarda uma
  // por turma e faz upsert, entao salvar duas vezes atualiza a mesma linha.
  listarHorariosTurma: (id) => requisitar(`/api/turmas/${id}/horarios`),
  salvarHorarioTurma: (id, dados) => requisitar(`/api/turmas/${id}/horarios`, { method: 'PUT', body: dados }),
  removerHorarioTurma: (id, horarioId) => requisitar(`/api/turmas/${id}/horarios/${horarioId}`, { method: 'DELETE' }),
  listarMinhasTurmas: () => requisitar('/api/professores/minhas-turmas'),
  // atribuicao_id identifica QUAL aula (professor + materia + horario) esta
  // sendo consultada; sem ele o backend nao sabe validar a janela da aula.
  listarAlunosDaTurma: (turmaId, atribuicaoId) =>
    requisitar(`/api/professores/turmas/${turmaId}/alunos?${consulta({ atribuicao_id: atribuicaoId })}`),
  gradeDaTurma: (turmaId) => requisitar(`/api/professores/turmas/${turmaId}/grade`),
  historicoDoAluno: (turmaId, alunoId, atribuicaoId) =>
    requisitar(`/api/professores/turmas/${turmaId}/alunos/${alunoId}/historico?${consulta({ atribuicao_id: atribuicaoId })}`),
  registrarPresencasSala: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/presencas`, { method: 'POST', body: dados }),
  criarNotaProfessor: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/notas`, { method: 'POST', body: dados }),
  criarObservacaoProfessor: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/observacoes`, { method: 'POST', body: dados }),
  listarProfessoresTurma: (turmaId) => requisitar(`/api/professores/turmas/${turmaId}/professores`),
  atribuirProfessor: (turmaId, dados) => requisitar(`/api/professores/turmas/${turmaId}/professores`, { method: 'POST', body: dados }),

  listarFuncionarios: () => requisitar('/api/funcionarios'),
  listarAlunos: (params = {}) => {
    const q = consulta(params);
    return requisitar(`/api/alunos${q ? `?${q}` : ''}`);
  },
  buscarAluno: (id) => requisitar(`/api/alunos/${id}`),
  criarAluno: (dados) => requisitar('/api/alunos', { method: 'POST', body: dados }),
  atualizarAluno: (id, dados) => requisitar(`/api/alunos/${id}`, { method: 'PUT', body: dados }),
  excluirAluno: (id) => requisitar(`/api/alunos/${id}`, { method: 'DELETE' }),
  listarUsuarios: () => requisitar('/api/auth/usuarios'),
  criarUsuario: (dados) => requisitar('/api/auth/usuarios', { method: 'POST', body: dados }),
  listarRegistrosNaoResolvidos: () => requisitar('/api/ponto/registros/nao-resolvidos'),
  /**
   * Batidas ja vinculadas a aluno. Os filtros valem no BANCO, antes do teto de
   * `limite` (padrao 100, maximo 500) - por isso sempre mande `turma_id` ou
   * `filial_id`: sem recorte, o teto pode ser preenchido por outra unidade da
   * mesma empresa e a turma pedida aparece vazia.
   * Aceita: aluno_id, filial_id, turma_id, de, ate, limite.
   */
  listarRegistrosAlunos: (params = {}) =>
    requisitar(`/api/ponto/registros/alunos?${consulta(params)}`),

  resumoPeriodo: (de, ate) => requisitar(`/api/relatorios/resumo-periodo?de=${de}&ate=${ate}`),
  espelhoPonto: (funcionarioId, de, ate) =>
    requisitar(`/api/relatorios/espelho-ponto/${funcionarioId}?${consulta({ de, ate })}`),
  frequenciaAluno: (alunoId, de, ate) =>
    requisitar(`/api/alunos/${alunoId}/frequencia?${consulta({ de, ate })}`),
  listarAuditoria: (params = {}) => requisitar(`/api/auditoria?${consulta(params)}`),

  /**
   * A matriz de permissoes do papel de quem esta logado:
   * `{ permissoes: [{ recurso, acoes: ['ver', ...] }] }`.
   *
   * Passa por `resolverTenant`, entao exige `X-Empresa-Id` — para super_admin
   * isso significa 400 antes de ele escolher a empresa. Quem chama precisa
   * respeitar essa ordem (ver AuthContext).
   */
  listarPermissoes: () => requisitar('/api/permissoes'),

  /**
   * Administracao da matriz — tudo restrito a super_admin.
   *
   * Duas camadas, e a ordem importa: a REGRA DO CARGO vale para todo mundo
   * daquele papel; a EXCECAO PESSOAL sobrepoe a regra para uma pessoa so.
   * O servidor consulta a excecao primeiro (`middlewares/permissions.js`).
   */
  listarMatrizPapeis: () => requisitar('/api/permissoes/papeis'),
  definirPermissaoPapel: (papel, dados) =>
    requisitar(`/api/permissoes/papeis/${papel}`, { method: 'PUT', body: dados }),

  /** Efetivo de uma pessoa: cargo + excecoes, com `origem` em cada linha. */
  listarPermissoesDoUsuario: (usuarioId) =>
    requisitar(`/api/permissoes/usuarios/${usuarioId}`),
  definirOverrideUsuario: (usuarioId, dados) =>
    requisitar(`/api/permissoes/usuarios/${usuarioId}`, { method: 'PUT', body: dados }),
  // Remove a excecao: a pessoa volta a seguir a regra do cargo.
  removerOverrideUsuario: (usuarioId, dados) =>
    requisitar(`/api/permissoes/usuarios/${usuarioId}`, { method: 'DELETE', body: dados }),

  /**
   * Avisos da escola. O backend devolve, por aviso, um `status` ja derivado
   * (`aguardando_data` | `lancado` | `desativado`) e as contagens
   * `total_leram` / `total_destinatarios` — nao recalcule nada disso aqui.
   *
   * `alvos` e uma lista de `{ filial_id, turma_id, filial_nome, turma_nome }`.
   * Lista vazia = o aviso vale para a empresa inteira.
   */
  listarAvisos: () => requisitar('/api/avisos'),
  buscarAviso: (id) => requisitar(`/api/avisos/${id}`),
  criarAviso: (dados) => requisitar('/api/avisos', { method: 'POST', body: dados }),
  // 409 se o aviso ja foi enviado: depois de sair, o texto nao muda mais.
  atualizarAviso: (id, dados) => requisitar(`/api/avisos/${id}`, { method: 'PUT', body: dados }),
  // 409 se o aviso foi enviado e ainda esta ativo — desative antes.
  excluirAviso: (id) => requisitar(`/api/avisos/${id}`, { method: 'DELETE' }),
  ativarAviso: (id) => requisitar(`/api/avisos/${id}/ativar`, { method: 'PATCH' }),
  desativarAviso: (id) => requisitar(`/api/avisos/${id}/desativar`, { method: 'PATCH' }),
  /**
   * "Enviar de novo": cria um aviso NOVO copiando titulo, mensagem e alvos.
   * Nao e reativar — aqui o push sai outra vez e a contagem de leitura comeca
   * do zero, porque `aviso_leituras` tem unique(aviso_id, responsavel_id) e
   * reaproveitar o mesmo registro nasceria com a contagem da rodada anterior.
   */
  reenviarAviso: (id, publicado_em) =>
    requisitar(`/api/avisos/${id}/duplicar`, { method: 'POST', body: { publicado_em } }),
};
