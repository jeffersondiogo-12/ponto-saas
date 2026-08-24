/**
 * Exportacao de relatorios em .csv e .pdf, compartilhada entre o Dashboard e a
 * tela de Relatorios.
 */

/** Celulas que o Excel/Sheets interpretariam como formula. */
const COMECO_PERIGOSO = /^[=+\-@\t\r]/;

/**
 * Escapa uma celula de CSV.
 *
 * Alem das aspas, neutraliza CSV Injection: uma celula que comeca com = + - @
 * (ou tab/CR) e tratada como FORMULA pelo Excel e pelo Google Planilhas. Como
 * os dados vem do cadastro (nome de aluno, matricula, descricao de
 * dispositivo), alguem poderia gravar `=HYPERLINK(...)` e o codigo rodaria na
 * maquina de quem abrisse a planilha. O apostrofo a frente forca texto.
 */
export function celulaCsv(v) {
  const s = v === null || v === undefined ? '' : String(v);
  const seguro = COMECO_PERIGOSO.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
}

export function linhasParaCsv(linhas) {
  return linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n');
}

function baixarArquivo(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Gera e baixa um .csv. O BOM no inicio e obrigatorio: sem ele o Excel em
 * pt-BR abre a acentuacao trocada.
 */
export function baixarCsv(nomeArquivo, linhas) {
  baixarArquivo(nomeArquivo, `﻿${linhasParaCsv(linhas)}`, 'text/csv;charset=utf-8');
}

/**
 * "Exportar em PDF" = dialogo de impressao do navegador, onde a pessoa escolhe
 * "Salvar como PDF". O @media print do index.css esconde dock, topo e tudo que
 * tiver a classe .nao-imprimir.
 */
export function exportarPdf() {
  window.print();
}

/** Formata minutos como "8h30" / "-1h15". */
export function minutosParaHoras(min) {
  const m = Number(min) || 0;
  const sinal = m < 0 ? '-' : '';
  const abs = Math.abs(m);
  return `${sinal}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
}

/** Primeiro e ultimo dia do mes em 'YYYY-MM-DD'. */
export function limitesDoMes(ano, mes) {
  const dois = (n) => String(n).padStart(2, '0');
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  return { de: `${ano}-${dois(mes + 1)}-01`, ate: `${ano}-${dois(mes + 1)}-${dois(ultimo)}` };
}

export const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
