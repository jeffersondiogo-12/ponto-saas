const service = require('./avisos.service');

async function criar(req, res, next) {
  try {
    const aviso = await service.criar(req.empresaId, req.body);
    res.status(201).json({ aviso });
  } catch (err) {
    next(err);
  }
}

async function listar(req, res, next) {
  try {
    const avisos = await service.listar(req.empresaId);
    res.json({ avisos });
  } catch (err) {
    next(err);
  }
}

async function ativar(req, res, next) {
  try {
    const aviso = await service.definirAtivo(req.empresaId, req.params.id, true);
    res.json({ aviso });
  } catch (err) {
    next(err);
  }
}

async function desativar(req, res, next) {
  try {
    const aviso = await service.definirAtivo(req.empresaId, req.params.id, false);
    res.json({ aviso });
  } catch (err) {
    next(err);
  }
}

module.exports = { criar, listar, ativar, desativar };
