const service = require('./professores.service');

async function minhasTurmas(req, res, next) {
  try { res.json({ turmas: await service.listarMinhasTurmas(req.empresaId, req.usuario.id) }); } catch (err) { next(err); }
}

async function alunosDaTurma(req, res, next) {
  try { res.json({ alunos: await service.listarAlunos(req.empresaId, req.usuario.id, req.params.turmaId) }); } catch (err) { next(err); }
}

async function registrarPresencas(req, res, next) {
  try {
    const { data, presencas } = req.body;
    res.status(201).json({ presencas: await service.registrarPresencas(req.empresaId, req.usuario.id, req.params.turmaId, data, presencas) });
  } catch (err) { next(err); }
}

async function criarNota(req, res, next) {
  try { res.status(201).json({ nota: await service.criarNota(req.empresaId, req.usuario.id, req.params.turmaId, req.body) }); } catch (err) { next(err); }
}

async function criarObservacao(req, res, next) {
  try { res.status(201).json({ observacao: await service.criarObservacao(req.empresaId, req.usuario.id, req.params.turmaId, req.body) }); } catch (err) { next(err); }
}

async function historicoDoAluno(req, res, next) {
  try {
    const dados = await service.historicoDoAluno(req.empresaId, req.usuario.id, req.params.turmaId, req.params.alunoId);
    res.json(dados);
  } catch (err) { next(err); }
}

async function atribuirProfessor(req, res, next) {
  try { res.status(201).json({ atribuicao: await service.atribuirProfessor(req.empresaId, req.params.turmaId, req.body) }); } catch (err) { next(err); }
}

async function listarProfessores(req, res, next) {
  try { res.json({ professores: await service.listarProfessoresDaTurma(req.empresaId, req.params.turmaId) }); } catch (err) { next(err); }
}

module.exports = { minhasTurmas, alunosDaTurma, registrarPresencas, criarNota, criarObservacao, historicoDoAluno, atribuirProfessor, listarProfessores };
