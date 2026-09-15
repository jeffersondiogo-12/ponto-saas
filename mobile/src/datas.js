// Formatacao de data e hora das telas. Tudo no fuso da escola: o aparelho do
// professor pode estar em outro fuso, mas a batida e a aula sao de Brasilia.

export const FUSO_BRASILIA = 'America/Sao_Paulo';

/** Valor vazio ou data invalida viram texto vazio, nunca "Invalid Date". */
function dataValida(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Dia e hora de um instante (coluna `timestamp`). Ex.: 13/09, 08:30 */
export function formatarDataHora(iso) {
  const data = dataValida(iso);
  if (!data) return '';
  return data.toLocaleString('pt-BR', {
    timeZone: FUSO_BRASILIA,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Dia de um instante (coluna `timestamp`). Ex.: 13/09/2026 */
export function formatarData(iso) {
  const data = dataValida(iso);
  if (!data) return '';
  return data.toLocaleDateString('pt-BR', {
    timeZone: FUSO_BRASILIA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// A coluna `date` do banco nao carrega hora: o dia ja vem pronto e converter o
// fuso aqui jogaria a data para o dia anterior. Por isso so reordenamos o texto.
/** Dia de uma coluna `date`. Ex.: 13/09/2026 */
export function formatarDataSemHora(valor) {
  const dia = String(valor || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return formatarData(valor);
  return dia.split('-').reverse().join('/');
}
