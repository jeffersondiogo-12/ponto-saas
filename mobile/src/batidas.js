// Classificacao das batidas faciais, compartilhada pela ficha do responsavel e
// pela ficha do professor. As duas telas mostram o mesmo registro: a regra de
// quando dizer "Chegada" e quando dizer "Saida" precisa ser uma so.
//
// Quem decide chegada ou saida e o BACKEND, em
// `backend/src/modules/ponto/classificacaoBatidas.js`, pela ordem das
// passagens do aluno no dia. O equipamento (AiFace Evo) nao informa o sentido:
// manda `inout: 0` em toda leitura, e por isso toda batida aparecia como
// chegada ate 17/09/2026. O app so exibe o que veio classificado - nao
// reclassifica nada, senao as duas pontas divergem de novo.

const ROTULOS_BATIDA = {
  entrada: 'Chegada',
  saida: 'Saída',
  entrada_intervalo: 'Entrada de intervalo',
  saida_intervalo: 'Saída para intervalo',
};

/** Rotulo do tipo da batida, ou `null` se o registro vier sem tipo. */
export function rotuloDaBatida(registro) {
  return ROTULOS_BATIDA[registro?.tipo_batida || registro?.tipo] || null;
}

/**
 * Ordena as batidas da mais recente para a mais antiga e anexa o rotulo.
 *
 * `tipoConfirmado: false` so acontece se um registro chegar sem tipo - hoje o
 * backend sempre classifica, entao e rede de seguranca para resposta antiga
 * em cache offline, nao caso normal.
 */
export function prepararRegistros(registros) {
  const ordenados = [...(registros || [])].sort((a, b) => {
    const diferenca = new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
    return diferenca || String(a.id || '').localeCompare(String(b.id || ''));
  });
  const classificados = ordenados.map((registro) => {
    const rotuloOficial = rotuloDaBatida(registro);
    return {
      ...registro,
      tipoExibicao: rotuloOficial || 'Registro',
      tipoConfirmado: Boolean(rotuloOficial),
    };
  });
  return classificados.reverse();
}
