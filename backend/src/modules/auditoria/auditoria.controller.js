const auditoriaService = require('./auditoria.service');

async function listar(req, res, next) {
  try {
    const resultado = await auditoriaService.listar(req.empresaId, {
      usuarioId: req.query.usuario_id,
      acao: req.query.acao,
      entidade: req.query.entidade,
      entidadeId: req.query.entidade_id,
      de: req.query.de,
      ate: req.query.ate,
      pagina: req.query.pagina,
      limite: req.query.limite,
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const log = await auditoriaService.buscarPorId(req.empresaId, req.params.id);
    res.json({ log });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar };
