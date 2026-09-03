const funcionariosService = require('./funcionarios.service');

async function listar(req, res, next) {
  try {
    const { ativo } = req.query;
    const funcionarios = await funcionariosService.listar(req.empresaId, {
      ativo: ativo === undefined ? undefined : ativo === 'true',
      filialId: req.filialId,
    });
    res.json({ funcionarios });
  } catch (err) {
    next(err);
  }
}

async function buscar(req, res, next) {
  try {
    const funcionario = await funcionariosService.buscarPorId(req.empresaId, req.params.id, req.filialId);
    res.json({ funcionario });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const funcionario = await funcionariosService.criar(req.empresaId, req.body, req.filialId);
    res.status(201).json({ funcionario });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const funcionario = await funcionariosService.atualizar(req.empresaId, req.params.id, req.body, req.filialId);
    res.json({ funcionario });
  } catch (err) {
    next(err);
  }
}

async function vincularDispositivo(req, res, next) {
  try {
    const { dispositivo_id, id_no_dispositivo } = req.body;
    const vinculo = await funcionariosService.vincularDispositivo(
      req.empresaId,
      req.params.id,
      dispositivo_id,
      id_no_dispositivo,
      req.filialId
    );
    res.status(201).json({ vinculo });
  } catch (err) {
    next(err);
  }
}

async function excluir(req, res, next) {
  try {
    await funcionariosService.excluir(req.empresaId, req.params.id, req.filialId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, criar, atualizar, vincularDispositivo, excluir };
