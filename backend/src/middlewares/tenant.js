const db = require('../config/db');

/**
 * Isolamento multi-tenant: toda rota autenticada (exceto super_admin) so pode
 * enxergar dados da PROPRIA empresa. O empresa_id nunca vem do corpo da
 * requisicao ou de query params - sempre do token JWT ja validado.
 *
 * Isso e deliberadamente simples: cada controller usa req.empresaId no WHERE
 * de toda query. Nao existe consulta "global" por acidente.
 */
async function resolverTenant(req, res, next) {
  try {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Nao autenticado.' });
    }

  if (req.usuario.papel === 'super_admin') {
    // super_admin pode operar sobre uma empresa especifica via header, para telas
    // de suporte/operacao - nunca implicito, sempre explicito na requisicao.
    req.empresaId = req.headers['x-empresa-id'] || null;
    req.filialId = req.headers['x-filial-id'] || null;
    if (!req.empresaId) {
      return res.status(400).json({ erro: 'X-Empresa-Id e obrigatorio para super_admin.' });
    }
    if (req.filialId && !req.headers['x-empresa-id']) {
      return res.status(400).json({ erro: 'X-Empresa-Id e obrigatorio ao selecionar uma filial.' });
    }
  } else {
    req.empresaId = req.usuario.empresa_id;
    req.filialId = req.usuario.filial_id || req.headers['x-filial-id'] || null;
    if (!req.empresaId) {
      return res.status(403).json({ erro: 'Usuario sem empresa associada.' });
    }
  }

  if (req.filialId) {
    const filial = await db('filiais').where({ id: req.filialId, empresa_id: req.empresaId }).first('id');
    if (!filial) return res.status(403).json({ erro: 'Filial nao pertence a empresa selecionada.' });
  }

  req.usuarioId = req.usuario.id;

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { resolverTenant };
