/**
 * O processo do servidor roda no fuso do sistema operacional (normalmente
 * UTC em containers/produção). As regras de jornada (dia da semana, horário
 * de entrada previsto, janela de adicional noturno) precisam ser calculadas
 * no fuso da EMPRESA/FILIAL (ex: America/Sao_Paulo), nunca no fuso do
 * servidor - por isso este utilitario, ao inves de usar
 * Date.prototype.getHours()/getDay()/setHours() (que sempre usam o fuso do
 * processo).
 */

function partesNoFuso(data, timeZone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const partes = {};
  for (const { type, value } of dtf.formatToParts(data)) {
    if (type !== 'literal') partes[type] = Number(value);
  }
  if (partes.hour === 24) partes.hour = 0; // alguns runtimes retornam 24 na meia-noite
  return partes; // { year, month, day, hour, minute, second }
}

function diaDaSemanaNoFuso(data, timeZone) {
  const { year, month, day } = partesNoFuso(data, timeZone);
  // Meio-dia UTC evita qualquer ambiguidade de fuso ao calcular o dia da semana.
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

/**
 * Converte um horario "de parede" (ano/mes/dia/hora/minuto), num fuso
 * especifico, para o instante UTC correspondente. Duas iteracoes de ajuste
 * de offset - suficiente mesmo em trocas de horario de verao, caso voltem a
 * existir no Brasil no futuro.
 */
function horaLocalParaUTC({ ano, mes, dia, hora = 0, minuto = 0, segundo = 0 }, timeZone) {
  let palpite = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);

  for (let i = 0; i < 2; i += 1) {
    const partes = partesNoFuso(new Date(palpite), timeZone);
    const comoUtcSeFosseLocal = Date.UTC(
      partes.year,
      partes.month - 1,
      partes.day,
      partes.hour,
      partes.minute,
      partes.second
    );
    const alvoUtcSeFosseLocal = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
    palpite += alvoUtcSeFosseLocal - comoUtcSeFosseLocal;
  }

  return new Date(palpite);
}

/** Meia-noite (00:00) do dia calendario que contem `data`, no fuso informado. */
function inicioDoDiaNoFuso(data, timeZone) {
  const { year, month, day } = partesNoFuso(data, timeZone);
  return horaLocalParaUTC({ ano: year, mes: month, dia: day, hora: 0, minuto: 0 }, timeZone);
}

/** Fim do dia (23:59:59.999) do dia calendario que contem `data`, no fuso informado. */
function fimDoDiaNoFuso(data, timeZone) {
  const inicio = inicioDoDiaNoFuso(data, timeZone);
  return new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
}

module.exports = {
  partesNoFuso,
  diaDaSemanaNoFuso,
  horaLocalParaUTC,
  inicioDoDiaNoFuso,
  fimDoDiaNoFuso,
};
