const { partesNoFuso, inicioDoDiaNoFuso, fimDoDiaNoFuso } = require('../../utils/tempo');

const FUSO_PADRAO = 'America/Sao_Paulo';

/**
 * REGRA UNICA de entrada/saida das batidas de ALUNO.
 *
 * Por que existe
 * --------------
 * O equipamento de leitura facial em uso (AiFace Evo I.A.) NAO informa o
 * sentido da passagem: manda `inout: 0` em toda leitura. Em
 * `ponto.service.js`, `normalizarTipoBatida` traduzia esse 0 para `entrada`
 * como se fosse tipo oficial - e a alternancia de fallback so rodava "quando
 * nenhuma batida do dia tem tipo oficial", condicao que nunca era satisfeita.
 * Resultado: toda batida aparecia como chegada, em todas as telas.
 * (Diagnostico de 17/09/2026.)
 *
 * Como o equipamento nao sabe dizer, QUEM DECIDE E O SISTEMA: dentro de um
 * mesmo dia, a 1a passagem do aluno e chegada, a 2a e saida, a 3a chegada, e
 * assim por diante. Para aluno, o `tipo_batida` gravado no banco e IGNORADO.
 *
 * Isto substitui a decisao da MOB-011 ("sem tipo oficial, mostrar 'Registro'
 * sem classificar"): ela partia de que o aparelho as vezes informaria o
 * sentido. Ele nunca informa.
 *
 * Por que na leitura e nao na gravacao
 * ------------------------------------
 * Classificar ao ler faz o historico ja gravado como `entrada` sair certo sem
 * backfill, e reprocessar passa a ser so consultar de novo. Gravar exigiria
 * migrar a tabela inteira e recalcular o dia a cada batida que chegasse fora
 * de ordem (o equipamento reenvia lotes ate receber confirmacao).
 *
 * ATENCAO A QUEM FOR CONSULTAR
 * ----------------------------
 * A alternancia precisa enxergar o DIA INTEIRO para acertar a fase. Nunca use
 * `limit` no SQL sobre uma serie de batidas: um corte no meio do dia desloca
 * todas as batidas daquele dia. Busque por intervalo de datas com
 * `janelaDeDiasCompletos()` e corte DEPOIS de classificar.
 */

/** O atomo da regra. Tudo que classifica batida de aluno passa por aqui. */
function tipoPelaPosicao(indice) {
  return indice % 2 === 0 ? 'entrada' : 'saida';
}

function chaveDoDia(dataHora, timeZone) {
  const { year, month, day } = partesNoFuso(new Date(dataHora), timeZone);
  return `${year}-${month}-${day}`;
}

function compararCronologico(a, b) {
  const diferenca = new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
  if (diferenca) return diferenca;
  // `id` e bigint: o driver pg devolve como string, entao comparar como
  // numero e o unico jeito de "10" nao vir antes de "9".
  return Number(a.id || 0) - Number(b.id || 0);
}

/**
 * Expande um intervalo para dias fechados no fuso informado. `de` volta para
 * 00:00 do seu dia e `ate` avanca para o fim do dia - sem isso um recorte no
 * meio do dia faria a 3a batida do aluno parecer a 1a.
 */
function janelaDeDiasCompletos(de, ate, timeZone = FUSO_PADRAO) {
  return {
    de: de ? inicioDoDiaNoFuso(new Date(de), timeZone) : null,
    ate: ate ? fimDoDiaNoFuso(new Date(ate), timeZone) : null,
  };
}

/**
 * Classifica registros de aluno NO LUGAR e tambem os devolve.
 *
 * Agrupa por aluno e por dia calendario (no fuso da filial, nunca no do
 * servidor), ordena e alterna. Cada registro recebe:
 *   - `tipo_batida`: 'entrada' ou 'saida', decidido aqui
 *   - `tipo_definido_pelo_sistema`: true, para a tela poder dizer de onde veio
 *
 * `registros` pode conter varios alunos: o agrupamento separa.
 */
function classificarBatidasDeAluno(registros, { fusoPadrao = FUSO_PADRAO } = {}) {
  const lista = registros || [];
  const grupos = new Map();

  lista.forEach((registro) => {
    if (!registro || !registro.data_hora) return;
    const timeZone = registro.filial_fuso_horario || fusoPadrao;
    const chave = `${registro.aluno_id ?? 'aluno'}:${chaveDoDia(registro.data_hora, timeZone)}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(registro);
  });

  grupos.forEach((grupo) => {
    grupo.sort(compararCronologico);
    grupo.forEach((registro, indice) => {
      registro.tipo_batida = tipoPelaPosicao(indice);
      registro.tipo_definido_pelo_sistema = true;
    });
  });

  return lista;
}

/**
 * A MESMA regra, para uma batida so - usada pela notificacao, que precisa do
 * tipo no instante em que a batida entra e nao tem a lista do dia em maos.
 * `quantidadeAnteriorNoDia` e quantas batidas daquele aluno ja existem antes
 * desta, no mesmo dia.
 */
function tipoDaBatidaNoDia(quantidadeAnteriorNoDia) {
  return tipoPelaPosicao(Number(quantidadeAnteriorNoDia) || 0);
}

module.exports = {
  FUSO_PADRAO,
  tipoPelaPosicao,
  tipoDaBatidaNoDia,
  classificarBatidasDeAluno,
  janelaDeDiasCompletos,
};
