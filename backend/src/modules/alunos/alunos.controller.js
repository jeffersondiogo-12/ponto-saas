const alunosService = require('./alunos.service');

async function listar(req, res, next) {
  try {
    const { turma_id, ativo } = req.query;
    const alunos = await alunosService.listar(req.empresaId, {
      turmaId: turma_id,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
    res.json({ alunos });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const aluno = await alunosService.buscarPorId(req.empresaId, req.params.id);
    res.json({ aluno });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const resultado = await alunosService.criar(req.empresaId, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const aluno = await alunosService.atualizar(req.empresaId, req.params.id, req.body);
    res.json({ aluno });
  } catch (err) {
    next(err);
  }
}

async function vincularDispositivo(req, res, next) {
  try {
    const { dispositivo_id, id_no_dispositivo } = req.body;
    const vinculo = await alunosService.vincularDispositivo(req.empresaId, req.params.id, dispositivo_id, id_no_dispositivo);
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

async function frequencia(req, res, next) {
  try {
    const { de, ate } = req.query;
    const registros = await alunosService.frequencia(req.empresaId, req.params.id, { de, ate });
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, criar, atualizar, vincularDispositivo, frequencia };
