const authService = require('./auth.service');

function usuarioPublico(usuario = {}) {
  const campos = [
    'id',
    'usuario_id',
    'responsavelId',
    'tipo',
    'nome',
    'email',
    'papel',
    'empresa_id',
    'filial_id',
    'alunoIds',
  ];
  return Object.fromEntries(campos.filter((campo) => usuario[campo] !== undefined).map((campo) => [campo, usuario[campo]]));
}

function atual(req, res) {
  res.json({ usuario: usuarioPublico(req.usuario) });
}

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
    const usuarios = await authService.listarUsuarios(req.empresaId, req.filialId);
    res.json({ usuarios });
  } catch (err) {
    next(err);
  }
}

async function criarUsuario(req, res, next) {
  try {
    const usuario = await authService.criarUsuario({
      ...req.body,
      empresa_id: req.empresaId,
      criador: req.usuario,
    });
    res.status(201).json({ usuario });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, listarUsuarios, criarUsuario, atual };
