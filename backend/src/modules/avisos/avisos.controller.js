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

async function buscar(req, res, next) {
  try {
    res.json({ aviso: await service.buscar(req.empresaId, req.params.id) });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    res.json({ aviso: await service.atualizar(req.empresaId, req.params.id, req.body) });
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await service.remover(req.empresaId, req.params.id);
    res.status(204).send();
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

module.exports = { criar, listar, buscar, atualizar, remover, ativar, desativar };
