const { diaDaSemanaNoFuso, horaLocalParaUTC, partesNoFuso } = require('../../utils/tempo');

const MINUTO_MS = 60 * 1000;

/**
 * Agrupa horarios de batida (ja ordenados, Date[]) em pares entrada/saida.
 * Regra: alternando IN/OUT/IN/OUT..., cada par (indice par -> indice impar)
 * conta como tempo trabalhado; o intervalo ENTRE pares (ex: almoco) fica de
 * fora automaticamente, sem precisar rotular cada batida.
 *
 * Se o total de batidas for impar, a ultima fica sem par (jornada em aberto -
 * ex: esqueceu de bater a saida) e o dia e sinalizado para revisao humana,
 * nunca "resolvido" adivinhando um horario.
 */
function parearBatidas(horariosOrdenados) {
  const pares = [];
  let aberta = false;

  for (let i = 0; i + 1 < horariosOrdenados.length; i += 2) {
    pares.push({ entrada: horariosOrdenados[i], saida: horariosOrdenados[i + 1] });
  }

  if (horariosOrdenados.length % 2 === 1) {
    aberta = true;
  }

  return { pares, jornadaAberta: aberta };
}

function minutosEntre(inicio, fim) {
  return Math.round((fim.getTime() - inicio.getTime()) / MINUTO_MS);
}

function somarMinutosTrabalhados(pares) {
  return pares.reduce((total, par) => total + Math.max(0, minutosEntre(par.entrada, par.saida)), 0);
}

/**
 * Adicional noturno (CLT art.73): 22h as 5h do dia seguinte, NO FUSO DA
 * EMPRESA/FILIAL (nao no fuso do servidor). Calcula quantos minutos de um
 * intervalo [inicio, fim) caem dentro dessa janela, cobrindo o caso do
 * intervalo cruzar a meia-noite.
 */
function minutosNoturnos(inicio, fim, timeZone) {
  let total = 0;
  let cursorPartes = partesNoFuso(inicio, timeZone);
  let cursorInicioDia = horaLocalParaUTC(
    { ano: cursorPartes.year, mes: cursorPartes.month, dia: cursorPartes.day, hora: 0, minuto: 0 },
    timeZone
  );

  // Percorre dia a dia (no maximo poucas iteracoes mesmo em jornadas longas).
  while (cursorInicioDia < fim) {
    const janelaInicio = horaLocalParaUTC(
      { ano: cursorPartes.year, mes: cursorPartes.month, dia: cursorPartes.day, hora: 22, minuto: 0 },
      timeZone
    );

    const proximoDiaAprox = new Date(cursorInicioDia.getTime() + 24 * 60 * 60 * 1000);
    const partesProximoDia = partesNoFuso(proximoDiaAprox, timeZone);
    const janelaFim = horaLocalParaUTC(
      { ano: partesProximoDia.year, mes: partesProximoDia.month, dia: partesProximoDia.day, hora: 5, minuto: 0 },
      timeZone
    );

    const overlapInicio = new Date(Math.max(inicio.getTime(), janelaInicio.getTime()));
    const overlapFim = new Date(Math.min(fim.getTime(), janelaFim.getTime()));

    if (overlapFim > overlapInicio) {
      total += minutosEntre(overlapInicio, overlapFim);
    }

    cursorPartes = partesProximoDia;
    cursorInicioDia = horaLocalParaUTC(
      { ano: partesProximoDia.year, mes: partesProximoDia.month, dia: partesProximoDia.day, hora: 0, minuto: 0 },
      timeZone
    );
  }

  return Math.max(0, total);
}

/**
 * Le a expectativa de jornada de um dia especifico a partir do horario de
 * trabalho configurado. Suporta tipo "fixo_semanal" com granularidade total;
 * "escala_12x36" usa uma aproximacao fixa de 12h documentada abaixo.
 * `dataReferencia` e um Date (qualquer instante daquele dia calendario);
 * o dia da semana e calculado NO FUSO informado, nao no fuso do servidor.
 */
function obterExpectativaDia(horarioTrabalho, dataReferencia, timeZone) {
  if (!horarioTrabalho) {
    return { minutosPrevistos: 0, entradaPrevistaStr: null, tolerancia: 0 };
  }

  if (horarioTrabalho.tipo === 'escala_12x36') {
    // Simplificacao deliberada: assume 12h previstas em todo dia de trabalho
    // da escala. O calculo de QUAL dia e trabalho vs folga, dentro do ciclo
    // 12x36, depende da data de referencia do ciclo e fica para refinamento
    // futuro (ver README) - por ora, todo apontamento deste tipo de horario
    // e gerado com previsao de 12h e fica sinalizado como 'ajustado' para
    // revisao humana confirmar se era dia de trabalho ou de folga.
    return {
      minutosPrevistos: 12 * 60,
      entradaPrevistaStr: null,
      tolerancia: horarioTrabalho.tolerancia_minutos || 0,
      aproximado: true,
    };
  }

  const diaSemana = String(diaDaSemanaNoFuso(dataReferencia, timeZone)); // 0=domingo .. 6=sabado
  const configDia = (horarioTrabalho.config_semana || {})[diaSemana];

  if (!configDia) {
    return { minutosPrevistos: 0, entradaPrevistaStr: null, tolerancia: horarioTrabalho.tolerancia_minutos || 0 };
  }

  const [horaEntrada, minEntrada] = (configDia.entrada || '00:00').split(':').map(Number);
  const [horaSaida, minSaida] = (configDia.saida || '00:00').split(':').map(Number);

  let minutosBrutos = horaSaida * 60 + minSaida - (horaEntrada * 60 + minEntrada);
  const minutosIntervalos = (configDia.intervalos || []).reduce((total, intervalo) => {
    const [hi, mi] = intervalo.inicio.split(':').map(Number);
    const [hf, mf] = intervalo.fim.split(':').map(Number);
    return total + (hf * 60 + mf - (hi * 60 + mi));
  }, 0);

  minutosBrutos -= minutosIntervalos;

  return {
    minutosPrevistos: Math.max(0, minutosBrutos),
    entradaPrevistaStr: configDia.entrada || null,
    tolerancia: horarioTrabalho.tolerancia_minutos || 0,
  };
}

/**
 * Monta o apontamento do dia a partir das batidas ja ordenadas e da
 * expectativa de jornada. `timeZone` (ex: "America/Sao_Paulo") e obrigatorio
 * e determina em que fuso o dia da semana, o horario de entrada previsto e a
 * janela de adicional noturno sao calculados - nunca o fuso do servidor.
 */
function calcularApontamentoDoDia({ horariosOrdenados, horarioTrabalho, data, ehFeriado, timeZone }) {
  const { pares, jornadaAberta } = parearBatidas(horariosOrdenados);
  const horasTrabalhadasMinutos = somarMinutosTrabalhados(pares);
  const adicionalNoturnoMinutos = pares.reduce(
    (total, par) => total + minutosNoturnos(par.entrada, par.saida, timeZone),
    0
  );

  const expectativa = obterExpectativaDia(horarioTrabalho, data, timeZone);
  const minutosPrevistos = ehFeriado ? 0 : expectativa.minutosPrevistos;

  const saldoMinutos = horasTrabalhadasMinutos - minutosPrevistos;

  let atrasoMinutos = 0;
  if (pares.length > 0 && expectativa.entradaPrevistaStr) {
    const { year, month, day } = partesNoFuso(data, timeZone);
    const [he, mi] = expectativa.entradaPrevistaStr.split(':').map(Number);
    const previstaEntrada = horaLocalParaUTC({ ano: year, mes: month, dia: day, hora: he, minuto: mi }, timeZone);
    const diffEntrada = minutosEntre(previstaEntrada, pares[0].entrada);
    if (diffEntrada > expectativa.tolerancia) {
      atrasoMinutos = diffEntrada;
    }
  }

  // Domingo (0) ou feriado -> horas excedentes contam a 100% (CF art.7 XVI c/c
  // Sumula 146 TST); dia normal -> 50%. Limite diario de horas extras (CLT
  // art.59) e usado so como sinalizacao para o RH revisar, nunca para
  // bloquear a marcacao (isso e proibido pela Portaria 671 para REP-A/REP-P).
  const diaSemanaNumero = diaDaSemanaNoFuso(data, timeZone);
  const ehDescansoRemunerado = ehFeriado || diaSemanaNumero === 0;
  const extrasPositivas = Math.max(0, saldoMinutos);

  const falta = pares.length === 0 && minutosPrevistos > 0;

  return {
    batidas: horariosOrdenados.map((h) => ({ hora: h.toISOString() })),
    horasPrevistasMinutos: minutosPrevistos,
    horasTrabalhadasMinutos,
    saldoMinutos,
    extras50Minutos: ehDescansoRemunerado ? 0 : extrasPositivas,
    extras100Minutos: ehDescansoRemunerado ? extrasPositivas : 0,
    adicionalNoturnoMinutos,
    atrasoMinutos,
    falta,
    jornadaAberta,
    aproximado: Boolean(expectativa.aproximado),
  };
}

module.exports = {
  parearBatidas,
  minutosEntre,
  somarMinutosTrabalhados,
  minutosNoturnos,
  obterExpectativaDia,
  calcularApontamentoDoDia,
};
