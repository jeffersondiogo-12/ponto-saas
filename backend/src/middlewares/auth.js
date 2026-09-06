const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Exige um token JWT valido via header Authorization: Bearer <token>.
 * So Bearer - sem cookie - porque agora o backend e uma API pura consumida
 * tanto pelo site (web/) quanto pelo app (mobile/), e um app mobile nao tem
 * "cookie do navegador" da mesma forma que um browser.
 * Preenche req.usuario com o payload do token (formato varia por `tipo`:
 * 'staff' tem empresa_id/papel/filial_id; 'responsavel' tem alunoIds).
 */
async function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Nao autenticado.' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ erro: 'Sessao invalida ou expirada.' });
  }

  try {
    if (payload.tipo === 'staff') {
      const usuario = await db('usuarios')
        .select('id', 'ativo', 'empresa_id', 'filial_id', 'papel', 'nome', 'email')
        .where({ id: payload.usuario_id || payload.id })
        .first();

      if (!usuario || !usuario.ativo) {
        return res.status(401).json({ erro: 'Usuario inativo ou inexistente.' });
      }

      req.usuario = {
        ...payload,
        id: usuario.id,
        usuario_id: usuario.id,
        papel: usuario.papel,
        nome: usuario.nome,
        email: usuario.email,
        ...(usuario.papel === 'super_admin'
          ? {}
          : { empresa_id: usuario.empresa_id, filial_id: usuario.filial_id }),
      };
    } else if (payload.tipo === 'responsavel') {
      const responsavel = await db('responsaveis')
        .select('id', 'ativo', 'empresa_id', 'nome', 'email')
        .where({ id: payload.responsavelId || payload.id })
        .first();

      if (!responsavel || !responsavel.ativo) {
        return res.status(401).json({ erro: 'Conta inativa ou inexistente.' });
      }

      const vinculos = await db('responsavel_alunos')
        .select('aluno_id')
        .where({ responsavel_id: responsavel.id });

      req.usuario = {
        ...payload,
        id: responsavel.id,
        responsavelId: responsavel.id,
        empresa_id: responsavel.empresa_id,
        nome: responsavel.nome,
        email: responsavel.email,
        alunoIds: vinculos.map((vinculo) => vinculo.aluno_id),
      };
    } else {
      req.usuario = payload;
    }

    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Restringe o acesso a papeis especificos de staff. Ex: exigirPapel('admin', 'super_admin').
 * Deve ser usado sempre depois de `autenticar`.
 */
function exigirPapel(...papeisPermitidos) {
  return (req, res, next) => {
    if (req.usuario?.papel === 'super_admin') return next();
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
