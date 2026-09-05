const db = require('../../config/db');

const ACOES = ['ver', 'adicionar', 'atualizar', 'deletar'];

async function listarPorPapel(papel) {
  const consulta = db('permissoes_papeis')
    .select('recurso', 'acao')
    .where({ permitido: true });

  if (papel !== 'super_admin') consulta.where({ papel });

  const linhas = await consulta.orderBy('recurso');

  const agrupadas = new Map();
  for (const linha of linhas) {
    if (!agrupadas.has(linha.recurso)) agrupadas.set(linha.recurso, []);
    if (ACOES.includes(linha.acao) && !agrupadas.get(linha.recurso).includes(linha.acao)) {
      agrupadas.get(linha.recurso).push(linha.acao);
    }
  }

  return [...agrupadas.entries()]
    .map(([recurso, acoes]) => ({
      recurso,
      acoes: ACOES.filter((acao) => acoes.includes(acao)),
    }))
    .filter((item) => item.acoes.length > 0);
}

module.exports = { listarPorPapel };
