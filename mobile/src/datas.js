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

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Hoje no fuso da escola, como `AAAA-MM-DD`. */
export function dataHoje() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BRASILIA }).format(new Date());
}

/**
 * Dia da semana e data, sem preposicao. Ex.: "Quinta, 14/09".
 *
 * Recebe `AAAA-MM-DD`. A data e montada com os numeros soltos, e nao pelo
 * parser de ISO, que leria a string como UTC e devolveria o dia anterior.
 */
export function rotuloDoDia(dia) {
  const dataTexto = String(dia || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTexto)) return '';
  const [ano, mes, diaMes] = dataTexto.split('-').map(Number);
  const data = new Date(ano, mes - 1, diaMes);
  if (Number.isNaN(data.getTime())) return '';
  return `${DIAS_SEMANA[data.getDay()]}, ${dataTexto.slice(8, 10)}/${dataTexto.slice(5, 7)}`;
}

/** "Bom dia" / "Boa tarde" / "Boa noite", pelo relogio de Brasilia. */
export function saudacaoDoDia() {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASILIA, hour: '2-digit', hour12: false }).format(new Date())
  );
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}
