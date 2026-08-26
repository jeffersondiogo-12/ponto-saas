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

async function listarHorarios(req, res, next) {
  try { res.json({ horarios: await turmasService.listarHorarios(req.empresaId, req.params.id) }); } catch (err) { next(err); }
}

async function salvarHorario(req, res, next) {
  try { res.json({ horario: await turmasService.salvarHorario(req.empresaId, req.params.id, req.body) }); } catch (err) { next(err); }
}

async function removerHorario(req, res, next) {
  try { await turmasService.removerHorario(req.empresaId, req.params.id, req.params.horarioId); res.status(204).end(); } catch (err) { next(err); }
}

module.exports = { listar, buscar, criar, atualizar, listarHorarios, salvarHorario, removerHorario };
