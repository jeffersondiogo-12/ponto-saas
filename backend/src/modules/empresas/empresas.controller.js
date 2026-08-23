const empresasService = require('./empresas.service');

async function listar(req, res, next) {
  try {
    const empresas = await empresasService.listar();
    res.json({ empresas });
  } catch (err) {
    next(err);
  }
}

function podeAcessarEmpresa(req, empresaId) {
  return req.usuario.papel === 'super_admin' || req.usuario.empresa_id === empresaId;
}

async function buscar(req, res, next) {
  try {
    if (!podeAcessarEmpresa(req, req.params.id)) {
      return res.status(403).json({ erro: 'Voce nao tem acesso a esta empresa.' });
    }
    const empresa = await empresasService.buscarPorId(req.params.id);
    res.json({ empresa });
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    const empresa = await empresasService.criar(req.body);
    res.status(201).json({ empresa });
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    if (!podeAcessarEmpresa(req, req.params.id)) {
      return res.status(403).json({ erro: 'Voce nao tem acesso a esta empresa.' });
    }
    const empresa = await empresasService.atualizar(req.params.id, req.body);
    res.json({ empresa });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscar, criar, atualizar };
