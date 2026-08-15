const fs = require('fs');
const path = require('path');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { crc16KermitHex } = require('../../utils/crc16');
const { partesNoFuso, horaLocalParaUTC } = require('../../utils/tempo');

/**
 * ================================================================
 * IMPORTANTE - VALIDAR ANTES DE USO EM FISCALIZACAO REAL
 * ================================================================
 * Este gerador segue a ESTRUTURA documentada publicamente da Portaria
 * 671/2021 (Art. 81, Anexo V) para o AFD de REP-A/REP-P: arquivo texto,
 * codificacao ASCII/ISO-8859-1, um registro por linha separado por pipe (|),
 * terminado em CR+LF, NSR sequencial sem lacunas, CRC-16/KERMIT
 * (CCITT-TRUE) por registro.
 *
 * O QUE NAO ESTA CONFIRMADO BYTE-A-BYTE: a ordem exata e o tamanho fixo de
 * cada campo dentro da linha. Antes de entregar este arquivo a um
 * auditor-fiscal, valide o layout gerado aqui contra o PDF oficial:
 * https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/
 * fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf
 * (o link pode mudar - buscar "leiaute AFD portaria 671" no gov.br).
 */

const VERSAO_LEIAUTE = '002';
const FUSO_PADRAO = 'America/Sao_Paulo';
const DIRETORIO_SAIDA = path.join(__dirname, '..', '..', '..', 'storage', 'afd');

// Todo horario no AFD e a hora LOCAL do estabelecimento (nao a hora do
// servidor) - por isso passamos sempre pelo fuso da empresa via partesNoFuso.
// Uso: instantes de verdade (data_hora de uma batida, momento da geracao do
// arquivo) - NUNCA para strings "YYYY-MM-DD" de periodo (ver extrairAnoMesDia
// abaixo e o motivo no comentario de ponto.service.js).
function formatarDataHoraAFD(data, timeZone = FUSO_PADRAO) {
  const { year, month, day, hour, minute, second } = partesNoFuso(new Date(data), timeZone);
  const pad = (n) => String(n).padStart(2, '0');
  return `${year}${pad(month)}${pad(day)}${pad(hour)}${pad(minute)}${pad(second)}`;
}

// periodo_inicio/periodo_fim chegam como "YYYY-MM-DD" (um dia calendario, ja
// no fuso da empresa) - extrai os componentes direto da string, sem passar
// por um Date intermediario, pelo mesmo motivo documentado em
// ponto.service.js#extrairAnoMesDia: evitar o duplo deslocamento de fuso.
function extrairAnoMesDia(dataString) {
  const [ano, mes, dia] = String(dataString).split('-').map(Number);
  return { ano, mes, dia };
}

function formatarAnoMesDiaCompacto({ ano, mes, dia }) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${ano}${pad(mes)}${pad(dia)}`;
}

function montarLinhaComCrc(campos) {
  const semCrc = campos.join('|');
  const crc = crc16KermitHex(semCrc).toUpperCase();
  return `${semCrc}|${crc}`;
}

function montarHeader({ cnpjEmpregador, razaoSocial, periodoInicioAnoMesDia, periodoFimAnoMesDia }) {
  return montarLinhaComCrc([
    '1',
    cnpjEmpregador.replace(/\D/g, ''),
    razaoSocial,
    formatarAnoMesDiaCompacto(periodoInicioAnoMesDia),
    formatarAnoMesDiaCompacto(periodoFimAnoMesDia),
    formatarDataHoraAFD(new Date()),
    VERSAO_LEIAUTE,
  ]);
}

function montarLinhaRegistro(registro) {
  const cpfOuPis = (registro.cpf || registro.pis || '').replace(/\D/g, '');
  return montarLinhaComCrc([
    String(registro.nsr).padStart(9, '0'),
    '3', // tipo de registro 3 = marcacao de ponto
    formatarDataHoraAFD(registro.data_hora),
    cpfOuPis,
  ]);
}

async function gerarAFD(empresaId, { periodoInicio, periodoFim, geradoPorUsuarioId }) {
  const empresa = await db('empresas').where({ id: empresaId }).first();
  if (!empresa) throw new AppError('Empresa nao encontrada.', 404);

  const inicioAnoMesDia = extrairAnoMesDia(periodoInicio);
  const fimAnoMesDia = extrairAnoMesDia(periodoFim);

  // Limites reais do periodo, como instantes UTC, calculados a partir do
  // fuso da empresa - nao pela string reinterpretada (ver comentario acima).
  const inicioUtc = horaLocalParaUTC({ ...inicioAnoMesDia, hora: 0, minuto: 0 }, FUSO_PADRAO);
  const fimUtc = new Date(
    horaLocalParaUTC({ ...fimAnoMesDia, hora: 0, minuto: 0 }, FUSO_PADRAO).getTime() + 24 * 60 * 60 * 1000 - 1
  );

  const registros = await db('registros_ponto as r')
    .select('r.nsr', 'r.data_hora', 'f.cpf', 'f.pis')
    .join('funcionarios as f', 'f.id', 'r.funcionario_id')
    .where('r.empresa_id', empresaId)
    .whereNotNull('r.nsr')
    .whereBetween('r.data_hora', [inicioUtc, fimUtc])
    .orderBy('r.nsr', 'asc');

  if (registros.length === 0) {
    throw new AppError('Nenhum registro de ponto com NSR no periodo informado.', 404);
  }

  const linhas = [
    montarHeader({
      cnpjEmpregador: empresa.cnpj,
      razaoSocial: empresa.razao_social,
      periodoInicioAnoMesDia: inicioAnoMesDia,
      periodoFimAnoMesDia: fimAnoMesDia,
    }),
    ...registros.map(montarLinhaRegistro),
  ];

  const conteudo = linhas.join('\r\n') + '\r\n';

  fs.mkdirSync(DIRETORIO_SAIDA, { recursive: true });
  const nomeArquivo = `AFD_${empresa.cnpj.replace(/\D/g, '')}_${formatarAnoMesDiaCompacto(
    inicioAnoMesDia
  )}_${formatarAnoMesDiaCompacto(fimAnoMesDia)}.txt`;
  const caminhoCompleto = path.join(DIRETORIO_SAIDA, nomeArquivo);
  fs.writeFileSync(caminhoCompleto, conteudo, { encoding: 'latin1' });

  const [exportacao] = await db('afd_exports')
    .insert({
      empresa_id: empresaId,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      nsr_inicial: registros[0].nsr,
      nsr_final: registros[registros.length - 1].nsr,
      quantidade_registros: registros.length,
      arquivo_path: caminhoCompleto,
      gerado_por: geradoPorUsuarioId,
    })
    .returning('*');

  return { exportacao, caminhoArquivo: caminhoCompleto };
}

async function listarExportacoes(empresaId) {
  return db('afd_exports').where({ empresa_id: empresaId }).orderBy('gerado_em', 'desc');
}

module.exports = { gerarAFD, listarExportacoes };
