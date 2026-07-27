const jwt = require('jsonwebtoken');

/**
 * Exige um token JWT valido via header Authorization: Bearer <token>.
 * So Bearer - sem cookie - porque agora o backend e uma API pura consumida
 * tanto pelo site (web/) quanto pelo app (mobile/), e um app mobile nao tem
 * "cookie do navegador" da mesma forma que um browser.
 * Preenche req.usuario com o payload do token (formato varia por `tipo`:
 * 'staff' tem empresa_id/papel/filial_id; 'responsavel' tem alunoIds).
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada.' });
  }
}

/**
 * Restringe o acesso a papeis especificos de staff. Ex: exigirPapel('admin', 'super_admin').
 * Deve ser usado sempre depois de `autenticar`.
 */
function exigirPapel(...papeisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !papeisPermitidos.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Voce nao tem permissao para esta acao.' });
    }
    return next();
  };
}

/**
 * Distingue token de staff (usuarios da empresa) de token de responsavel
 * (pai/mae acompanhando o filho pelo app). As duas rotas de login emitem
 * tokens com formato diferente; isso impede um token de responsavel de
 * acessar rotas de staff e vice-versa.
 */
function exigirTipo(tipoEsperado) {
  return (req, res, next) => {
    if (!req.usuario || req.usuario.tipo !== tipoEsperado) {
      return res.status(403).json({ erro: 'Token nao autorizado para este tipo de acesso.' });
    }
    return next();
  };
}

module.exports = { autenticar, exigirPapel, exigirTipo };
