const turmasService = require('./turmas.service');

async function listar(req, res, next) {
  try {
    const turmas = await turmasService.listar(req.empresaId, { filialId: req.query.filial_id });
    res.json({ turmas });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const turma = await turmasService.buscarPorId(req.empresaId, req.params.id);
    res.json({ turma });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const turma = await turmasService.criar(req.empresaId, req.body);
    res.status(201).json({ turma });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const turma = await turmasService.atualizar(req.empresaId, req.params.id, req.body);
    res.json({ turma });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, criar, atualizar };
