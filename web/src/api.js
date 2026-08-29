export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const CHAVE_TOKEN = 'ponto_saas_token';
const CHAVE_EMPRESA_ID = 'ponto_saas_empresa_id';
const CHAVE_EMPRESA_NOME = 'ponto_saas_empresa_nome';
const CHAVE_FILIAL_ID = 'ponto_saas_filial_id';
const CHAVE_FILIAL_NOME = 'ponto_saas_filial_nome';
const CHAVE_FILIAL_TIPO = 'ponto_saas_filial_tipo';

export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token) {
  localStorage.setItem(CHAVE_TOKEN, token);
}

export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
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

async function requisitar(caminho, { method = 'GET', body } = {}) {
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
    // Carrega o status no erro: quem chama precisa distinguir "rota nao existe"
    // (404) de "o servidor recusou" sem depender do texto da mensagem.
    const erro = new Error(dados.erro || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

/** Monta a query string ignorando filtro vazio, que a API trataria como valor. */
function consulta(params) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();
}

export const api = {
  login: (email, senha, unidade) => requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade } }),
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

  resumoPeriodo: (de, ate) => requisitar(`/api/relatorios/resumo-periodo?de=${de}&ate=${ate}`),
  espelhoPonto: (funcionarioId, de, ate) =>
    requisitar(`/api/relatorios/espelho-ponto/${funcionarioId}?${consulta({ de, ate })}`),
  frequenciaAluno: (alunoId, de, ate) =>
    requisitar(`/api/alunos/${alunoId}/frequencia?${consulta({ de, ate })}`),
  listarAuditoria: (params = {}) => requisitar(`/api/auditoria?${consulta(params)}`),
};
