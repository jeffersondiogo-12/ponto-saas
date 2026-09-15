// Classificacao das batidas faciais, compartilhada pela ficha do responsavel e
// pela ficha do professor. As duas telas mostram o mesmo registro: a regra de
// quando dizer "Chegada" e quando nao dizer nada precisa ser uma so.

const ROTULOS_BATIDA = {
  entrada: 'Chegada',
  saida: 'Saída',
  entrada_intervalo: 'Entrada de intervalo',
  saida_intervalo: 'Saída para intervalo',
};

/** Rotulo do tipo oficial da batida, ou `null` quando o aparelho nao informou. */
export function rotuloDaBatida(registro) {
  return ROTULOS_BATIDA[registro?.tipo_batida || registro?.tipo] || null;
}

/**
 * Ordena as batidas da mais recente para a mais antiga e marca cada uma com o
 * tipo oficial.
 *
 * Sem tipo oficial nao da para saber se foi chegada ou saida. Adivinhar pela
 * ordem classifica errado batida duplicada ou fora de sequencia, entao o
 * registro aparece sem classificacao.
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
