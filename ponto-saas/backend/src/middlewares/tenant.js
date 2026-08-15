/**
 * Isolamento multi-tenant: toda rota autenticada (exceto super_admin) so pode
 * enxergar dados da PROPRIA empresa. O empresa_id nunca vem do corpo da
 * requisicao ou de query params - sempre do token JWT ja validado.
 *
 * Isso e deliberadamente simples: cada controller usa req.empresaId no WHERE
 * de toda query. Nao existe consulta "global" por acidente.
 */
function resolverTenant(req, res, next) {
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
  } else {
    req.empresaId = req.usuario.empresa_id;
    req.filialId = req.usuario.filial_id || null;
    if (!req.empresaId) {
      return res.status(403).json({ erro: 'Usuario sem empresa associada.' });
    }
  }

  return next();
}

module.exports = { resolverTenant };
