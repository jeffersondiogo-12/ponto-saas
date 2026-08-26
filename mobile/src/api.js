import AsyncStorage from '@react-native-async-storage/async-storage';
import { salvarCache, lerCache } from './storage';
import { enfileirar, obterFila, removerDaFila } from './filaOffline';

// Em desenvolvimento, aponte para o IP da sua maquina na rede local (nao
// "localhost" - no celular/emulador isso resolveria para o proprio
// dispositivo, nao para o computador rodando o backend). Em producao,
// aponte para o dominio real da API.
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.10:3000';

const CHAVE_TOKEN = '@ponto_saas_responsavel_token';
const CHAVE_SESSAO = '@ponto_saas_sessao';

export async function salvarToken(token) {
  await AsyncStorage.setItem(CHAVE_TOKEN, token);
}

export async function obterToken() {
  return AsyncStorage.getItem(CHAVE_TOKEN);
}

export async function limparToken() {
  await AsyncStorage.removeItem(CHAVE_TOKEN);
}

// Nao existe endpoint "/me" no backend - o unico jeito de saber quem esta
// logado (responsavel ou professor) ao reabrir o app e guardar aqui o
// mesmo objeto que o login devolveu, e reler no boot (ver AuthContext.js).
export async function salvarSessao(usuario) {
  await AsyncStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario));
}

export async function obterSessao() {
  const bruto = await AsyncStorage.getItem(CHAVE_SESSAO);
  return bruto ? JSON.parse(bruto) : null;
}

export async function limparSessao() {
  await AsyncStorage.removeItem(CHAVE_SESSAO);
}

// fetch no React Native so REJEITA (throw) por falha de rede de verdade -
// sem internet, DNS, timeout, servidor fora do ar. Erro vindo do backend
// (403, 404, 409...) chega como resposta normal, com resposta.ok = false, e
// isso NAO conta como "offline". E essa distincao que decide se a gente
// cai pro cache/fila ou se sobe o erro normalmente pra tela mostrar.
function ehFalhaDeRede(erro) {
  return erro instanceof TypeError || /network/i.test(erro?.message || '');
}

async function chamarServidor(caminho, { method, body }) {
  const headers = { 'Content-Type': 'application/json' };
  const token = await obterToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erro = new Error(dados.erro || `Erro ${resposta.status}`);
    erro.status = resposta.status;
    throw erro;
  }

  return dados;
}

let processandoFila = false;

// Tenta reenviar, em ordem, tudo que ficou pendente por falta de rede.
// Chamada automaticamente sempre que uma requisicao normal for bem
// sucedida (prova de que a conexao voltou) e no primeiro plano do app (ver
// App.js). Para na primeira falha de rede (ainda offline - tenta de novo
// depois); um erro "de verdade" do servidor descarta o item da fila, porque
// insistir nele não vai mudar o resultado.
export async function processarFilaOffline() {
  if (processandoFila) return;
  processandoFila = true;
  try {
    const fila = await obterFila();
    for (const item of fila) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await chamarServidor(item.caminho, { method: item.method, body: item.body });
        // eslint-disable-next-line no-await-in-loop
        await removerDaFila(item.id);
      } catch (err) {
        if (ehFalhaDeRede(err)) break;
        // eslint-disable-next-line no-await-in-loop
        await removerDaFila(item.id);
      }
    }
  } finally {
    processandoFila = false;
  }
}



/**
 * `rotulo`: texto curto pra fila offline mostrar pro usuario (ex: "Chamada
 * da turma 6ºA"). `permitirFila: false` em acoes que nao fazem sentido
 * enfileiradas (login/cadastro - se nao ha rede, a pessoa precisa saber na
 * hora, nao "depois que a conexao voltar").
 */
async function requisitar(caminho, { method = 'GET', body, rotulo, permitirFila = true } = {}) {
  try {
    const dados = await chamarServidor(caminho, { method, body });
    if (method === 'GET') salvarCache(caminho, dados);
    if (!processandoFila) processarFilaOffline();
    return dados;
  } catch (erro) {
    if (!ehFalhaDeRede(erro)) throw erro;

    if (method === 'GET') {
      const cache = await lerCache(caminho);
      if (cache) return { ...cache.dados, _offline: true, _cacheEm: cache.em };
      const semDados = new Error('Sem conexão e sem dados salvos ainda.');
      semDados.offline = true;
      throw semDados;
    }

    if (!permitirFila) {
      const semConexao = new Error('Sem conexão com a internet.');
      semConexao.offline = true;
      throw semConexao;
    }

    const item = await enfileirar({ rotulo: rotulo || 'Ação pendente', caminho, method, body });
    return { _fila: true, _tempId: item.id };
  }
}

export const api = {
  // --- Responsável ---
  login: (email, senha) =>
    requisitar('/api/responsaveis/login', { method: 'POST', body: { email, senha }, permitirFila: false }),
  cadastrar: (dados) =>
    requisitar('/api/responsaveis/cadastro', { method: 'POST', body: dados, permitirFila: false }),
  listarAlunos: () => requisitar('/api/responsaveis/alunos'),
  frequenciaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/frequencia`),
  notasDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/notas`),
  observacoesDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/observacoes`),
  presencaSalaDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/presenca-sala`),
  avisosDoAluno: (alunoId) => requisitar(`/api/responsaveis/alunos/${alunoId}/avisos`),
  vincularFilho: (dados) =>
    requisitar('/api/responsaveis/alunos/vincular', {
      method: 'POST',
      body: dados,
      rotulo: `Vincular ${dados?.nome_completo || 'filho'}`,
    }),
  registrarPushToken: (token, plataforma) =>
    requisitar('/api/responsaveis/push-token', { method: 'POST', body: { token, plataforma } }),

  // --- Professor (login de staff — exige a empresa/ambiente, igual ao web) ---
  loginProfessor: (email, senha, unidade) =>
    requisitar('/api/auth/login', { method: 'POST', body: { email, senha, unidade }, permitirFila: false }),
  listarMinhasTurmas: () => requisitar('/api/professores/minhas-turmas'),
  listarAlunosDaTurma: (turmaId) => requisitar(`/api/professores/turmas/${turmaId}/alunos`),
  listarHorariosTurma: (turmaId) => requisitar(`/api/turmas/${turmaId}/horarios`),
  registrarPresencasSala: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/presencas`, {
      method: 'POST',
      body: dados,
      rotulo: 'Chamada da turma',
    }),
  criarNotaProfessor: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/notas`, {
      method: 'POST',
      body: dados,
      rotulo: `Nota de ${dados?.disciplina || 'aluno'}`,
    }),
  criarObservacaoProfessor: (turmaId, dados) =>
    requisitar(`/api/professores/turmas/${turmaId}/observacoes`, {
      method: 'POST',
      body: dados,
      rotulo: 'Observação para o responsável',
    }),
  historicoDoAluno: (turmaId, alunoId) =>
    requisitar(`/api/professores/turmas/${turmaId}/alunos/${alunoId}/historico`),
};
