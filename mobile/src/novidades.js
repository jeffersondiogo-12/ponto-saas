import AsyncStorage from '@react-native-async-storage/async-storage';

// O que o card de cada filho mostra na Home do responsavel (#56): ultima
// passagem, avisos pendentes e o que o professor lancou de novo. Espelho do
// web/src/app/novidades.js do PWA - mudou la, muda aqui.
//
// "Lido" e "visto" ficam gravados NESTE APARELHO, por conta: a API ainda nao
// diz se o responsavel ja leu um aviso. Quando o backend devolver o `lido_em`
// (tarefa #58), ele passa a valer sozinho - ver `ehLido`.
export const ROTULOS_ALCANCE = { rede: 'Aviso da rede', escola: 'Aviso da escola', turma: 'Aviso da turma' };

const PREFIXO_LIDOS = '@ponto_saas_avisos_lidos:v1:';
const PREFIXO_VISTA = '@ponto_saas_ficha_vista:v1:';

async function ler(chave, padrao) {
  try {
    return JSON.parse(await AsyncStorage.getItem(chave)) ?? padrao;
  } catch {
    return padrao;
  }
}

export async function avisosLidos(namespace) {
  return new Set(namespace ? await ler(`${PREFIXO_LIDOS}${namespace}`, []) : []);
}

// As duas gravacoes engolem falha do AsyncStorage (aparelho sem espaco): o
// selo e conveniencia, e a leitura confirmada ja vai ao servidor pela api.
export async function marcarAvisoLido(namespace, avisoId) {
  if (!namespace) return;
  try {
    const lidos = await avisosLidos(namespace);
    lidos.add(avisoId);
    await AsyncStorage.setItem(`${PREFIXO_LIDOS}${namespace}`, JSON.stringify([...lidos]));
  } catch {
    // Fica como nao lido neste aparelho; o servidor ja recebeu a leitura.
  }
}

export function ehLido(aviso, lidos) {
  return Boolean(aviso.lido_em) || lidos.has(aviso.id);
}

/** Um aviso da escola chega a todos os filhos dela: conta uma vez so. */
export function contarAvisosNaoLidos(avisosPorFilho, lidos) {
  return new Set(
    avisosPorFilho.flatMap((avisos) => avisos.filter((aviso) => !ehLido(aviso, lidos)).map((aviso) => aviso.id))
  ).size;
}

/** Quando a ficha deste filho foi aberta pela ultima vez, ou null. */
export function fichaVistaEm(namespace, alunoId) {
  return namespace ? ler(`${PREFIXO_VISTA}${namespace}:${alunoId}`, null) : Promise.resolve(null);
}

export async function marcarFichaVista(namespace, alunoId, em = Date.now()) {
  if (!namespace) return;
  try {
    await AsyncStorage.setItem(`${PREFIXO_VISTA}${namespace}:${alunoId}`, JSON.stringify(em));
  } catch {
    // Sem gravar, o selo de "novo" volta na proxima abertura. Nada se perde.
  }
}

/**
 * `registros` ja vem de `prepararRegistros` (mais recente primeiro).
 * Sem `vistaEm` - a ficha nunca foi aberta neste aparelho -, nada conta como
 * novo: o marco zero e a primeira vez que a Home carrega.
 */
export function resumoDoFilho({ registros = [], avisos = [], notas = [], observacoes = [], lidos, vistaEm }) {
  const depoisDaVisita = (lista) => vistaEm != null
    && lista.some((item) => new Date(item.created_at).getTime() > vistaEm);
  return {
    ultima: registros[0] || null,
    avisosPendentes: avisos.filter((aviso) => !ehLido(aviso, lidos)).length,
    notaNova: depoisDaVisita(notas),
    observacaoNova: depoisDaVisita(observacoes),
  };
}

/** "Chegada registrada", "Saída registrada" ou, sem tipo, "Passagem registrada". */
export function rotuloDaPassagem(registro) {
  if (registro?.tipoExibicao === 'Chegada') return 'Chegada registrada';
  if (registro?.tipoExibicao === 'Saída') return 'Saída registrada';
  return 'Passagem registrada';
}
