const db = require('../config/db');

const ACOES = new Set(['ver', 'adicionar', 'atualizar', 'deletar']);

function exigirPermissao(recurso, acao) {
  if (!recurso || !ACOES.has(acao)) {
    throw new Error(`Permissao invalida: ${recurso}:${acao}`);
  }

  return async (req, res, next) => {
    if (req.usuario?.papel === 'super_admin') return next();
    try {
      const permitido = await db('permissoes_papeis')
        .where({ papel: req.usuario?.papel, recurso, acao, permitido: true })
        .first();

      if (!permitido) {
        return res.status(403).json({ erro: 'Voce nao tem permissao para esta acao.' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { exigirPermissao };
