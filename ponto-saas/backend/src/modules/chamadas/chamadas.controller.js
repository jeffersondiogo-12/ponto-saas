const chamadasService = require('./chamadas.service');

async function listar(req, res, next) {
  try {
    const { turma_id, data } = req.query;
    const chamadas = await chamadasService.listar(req.empresaId, { turmaId: turma_id, data });
    res.json({ chamadas });
  } catch (err) {
    next(err);
  }
}

async function listarAlunos(req, res, next) {
  try {
    const { turma_id, data } = req.query;
    const alunos = await chamadasService.listarAlunosDaChamada(req.empresaId, req.usuario.professorId || req.usuario.id, turma_id, data || new Date().toISOString().slice(0, 10));
    res.json({ alunos });
  } catch (err) {
    next(err);
  }
}

async function marcarPresenca(req, res, next) {
  try {
    const { turma_id, data, aluno_id, status, observacao } = req.body;
    const presenca = await chamadasService.marcarPresenca(req.empresaId, req.usuario.professorId || req.usuario.id, turma_id, data, aluno_id, status, observacao);
    res.status(201).json({ presenca });
  } catch (err) {
    next(err);
  }
}

async function salvarChamada(req, res, next) {
  try {
    const { turma_id, data, presencas } = req.body;
    const resultado = await chamadasService.salvarChamada(req.empresaId, req.usuario.professorId || req.usuario.id, turma_id, data, presencas);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, listarAlunos, marcarPresenca, salvarChamada };
