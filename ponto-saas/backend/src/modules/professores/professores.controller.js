const professoresService = require('./professores.service');

async function listar(req, res, next) {
  try {
    const { filial_id, ativo } = req.query;
    const professores = await professoresService.listar(req.empresaId, {
      filialId: filial_id,
      ativo: ativo === undefined ? undefined : ativo === 'true',
    });
    res.json({ professores });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const professor = await professoresService.buscarPorId(req.empresaId, req.params.id);
    res.json({ professor });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    const resposta = await professoresService.login(email, senha);
    res.json(resposta);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const professor = await professoresService.criar(req.empresaId, req.body);
    res.status(201).json({ professor });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const professor = await professoresService.atualizar(req.empresaId, req.params.id, req.body);
    res.json({ professor });
  } catch (err) {
    next(err);
  }
}

async function listarTurmas(req, res, next) {
  try {
    const turmas = await professoresService.listarTurmasDoProfessor(req.empresaId, req.params.id);
    res.json({ turmas });
  } catch (err) {
    next(err);
  }
}

async function listarMinhasTurmas(req, res, next) {
  try {
    const turmas = await professoresService.listarTurmasDoProfessor(req.empresaId, req.usuario.professorId || req.usuario.id);
    res.json({ turmas });
  } catch (err) {
    next(err);
  }
}

async function vincularTurma(req, res, next) {
  try {
    const { turma_id } = req.body;
    const vinculo = await professoresService.vincularTurma(req.empresaId, req.params.id, turma_id);
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, login, criar, atualizar, listarTurmas, listarMinhasTurmas, vincularTurma };
