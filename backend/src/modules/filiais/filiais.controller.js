const filiaisService = require('./filiais.service');

async function listar(req, res, next) {
  try {
    const filiais = await filiaisService.listar(req.empresaId);
    res.json({ filiais });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const filial = await filiaisService.buscarPorId(req.empresaId, req.params.id);
    res.json({ filial });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const filial = await filiaisService.criar(req.empresaId, req.body);
    res.status(201).json({ filial });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const filial = await filiaisService.atualizar(req.empresaId, req.params.id, req.body);
    res.json({ filial });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await filiaisService.excluir(req.empresaId, req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, criar, atualizar, excluir };
