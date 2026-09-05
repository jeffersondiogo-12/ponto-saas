const db = require('../config/db');

const ACOES = new Set(['ver', 'adicionar', 'atualizar', 'deletar']);

function exigirPermissao(recurso, acao) {
  if (!recurso || !ACOES.has(acao)) {
    throw new Error(`Permissao invalida: ${recurso}:${acao}`);
  }

  return async (req, res, next) => {
    if (req.usuario?.papel === 'super_admin') return next();
    try {
      // 1) Ficha pessoal primeiro: se o usuario tem uma excecao gravada pra
      //    este recurso+acao, ela decide sozinha (libera ou nega), nao
      //    importa o que a regra do cargo diz.
      const override = await db('permissoes_usuarios')
        .where({ usuario_id: req.usuario?.usuario_id, recurso, acao })
        .first();

      if (override) {
        if (!override.permitido) {
          return res.status(403).json({ erro: 'Voce nao tem permissao para esta acao.' });
        }
        return next();
      }

      // 2) Sem excecao pessoal: cai na regra padrao do cargo, como sempre foi.
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
