const permissoesService = require('../modules/permissoes/permissoes.service');

const ACOES = new Set(['ver', 'adicionar', 'atualizar', 'deletar']);

function exigirPermissao(recurso, acao) {
  if (!recurso || !ACOES.has(acao)) {
    throw new Error(`Permissao invalida: ${recurso}:${acao}`);
  }

  return async (req, res, next) => {
    if (req.usuario?.papel === 'super_admin') return next();
    try {
      const permitido = await permissoesService.usuarioTemPermissao(
        req.usuario?.usuario_id,
        req.empresaId || req.usuario?.empresa_id,
        recurso,
        acao,
        req.filialId,
      );
      if (!permitido) {
        return res.status(403).json({ erro: 'Voce nao tem permissao para esta acao.' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

function exigirPermissaoAmbiente(recurso, acao) {
  if (!recurso || !ACOES.has(acao)) {
    throw new Error(`Permissao invalida: ${recurso}:${acao}`);
  }

  return async (req, res, next) => {
    if (req.filialId) {
      return res.status(403).json({ erro: 'Esta acao exige alcance de ambiente.' });
    }
    if (req.usuario?.papel === 'super_admin') return next();
    try {
      const permitido = await permissoesService.usuarioTemPermissaoAmbiente(
        req.usuario?.usuario_id,
        req.empresaId,
        recurso,
        acao,
      );
      if (!permitido) {
        return res.status(403).json({ erro: 'Esta acao exige permissao com alcance de ambiente.' });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { exigirPermissao, exigirPermissaoAmbiente };
