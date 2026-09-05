const permissoesService = require('./permissoes.service');

async function listar(req, res, next) {
  try {
    const permissoes = await permissoesService.listarPorPapel(req.usuario.papel);
    res.json({ permissoes });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar };
