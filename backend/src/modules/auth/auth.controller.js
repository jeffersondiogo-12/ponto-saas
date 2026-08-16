const authService = require('./auth.service');

async function login(req, res, next) {
  try {
    const { email, senha, unidade } = req.body;
    const resposta = await authService.login(email, senha, unidade);
    res.json(resposta);
  } catch (err) {
    next(err);
  }
}

async function listarUsuarios(req, res, next) {
  try {
    const usuarios = await authService.listarUsuarios(req.empresaId);
    res.json({ usuarios });
  } catch (err) {
    next(err);
  }
}

async function criarUsuario(req, res, next) {
  try {
    const usuario = await authService.criarUsuario({ ...req.body, empresa_id: req.empresaId });
    res.status(201).json({ usuario });
  } catch (err) {
    next(err);
  }
}

async function atualizarUsuario(req, res, next) {
  try {
    const usuario = await authService.atualizarUsuarios(req.empresaId, req.params.id, req.body);
    res.json({ usuario });
  } catch (err) {
    next(err);
  }
}


async function excluirUsuario(req, res, next) {
  try {
    await authService.excluirUsuarios(req.empresaId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { login, listarUsuarios, criarUsuario, atualizarUsuario, excluirUsuario };