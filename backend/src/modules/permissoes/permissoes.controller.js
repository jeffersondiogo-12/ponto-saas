const permissoesService = require('./permissoes.service');

async function listar(req, res, next) {
  try {
    // super_admin bypassa toda checagem de permissao (ve tudo, sempre) e nao
    // tem empresa fixa - continua pelo caminho antigo, so por papel.
    const permissoes = req.usuario.papel === 'super_admin'
      ? await permissoesService.listarPorPapel(req.usuario.papel, req.empresaId)
      : await permissoesService.listarEfetivoAgrupado(req.usuario.usuario_id, req.empresaId, req.filialId);

    res.json({ permissoes, alcance: permissoesService.listarAlcanceRecursos() });
  } catch (err) {
    next(err);
  }
}

async function listarMatrizPapeis(req, res, next) {
  try {
    const matriz = await permissoesService.listarMatrizPapeis(req.empresaId);
    res.json({ permissoes: matriz, alcance: permissoesService.listarAlcanceRecursos() });
  } catch (err) {
    next(err);
  }
}

async function definirPermissaoPapel(req, res, next) {
  try {
    const { papel } = req.params;
    const { recurso, acao, permitido } = req.body;
    await permissoesService.definirPermissaoPapel({
      empresaId: req.empresaId,
      filialId: req.body.filial_id,
      atribuicaoId: req.body.atribuicao_id,
      papel,
      recurso,
      acao,
      permitido,
      auditoria: { usuarioId: req.usuario.usuario_id, ip: req.ip },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function listarEfetivoPorUsuario(req, res, next) {
  try {
    const { usuarioId } = req.params;
    const permissoes = await permissoesService.listarEfetivoPorUsuario(usuarioId, req.empresaId, req.filialId);
    res.json({ permissoes });
  } catch (err) {
    next(err);
  }
}

async function definirOverrideUsuario(req, res, next) {
  try {
    const { usuarioId } = req.params;
    const { recurso, acao, permitido } = req.body;
    await permissoesService.definirOverrideUsuario({
      usuarioId,
      empresaId: req.empresaId,
      filialId: req.body.filial_id,
      atribuicaoId: req.body.atribuicao_id,
      recurso,
      acao,
      permitido,
      auditoria: { usuarioId: req.usuario.usuario_id, ip: req.ip },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function removerOverrideUsuario(req, res, next) {
  try {
    const { usuarioId } = req.params;
    const { recurso, acao } = req.body;
    await permissoesService.removerOverrideUsuario({
      usuarioId,
      empresaId: req.empresaId,
      filialId: req.body.filial_id,
      atribuicaoId: req.body.atribuicao_id,
      recurso,
      acao,
      auditoria: { usuarioId: req.usuario.usuario_id, ip: req.ip },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  listarMatrizPapeis,
  definirPermissaoPapel,
  listarEfetivoPorUsuario,
  definirOverrideUsuario,
  removerOverrideUsuario,
};
