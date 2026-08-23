const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

function normalizarTexto(texto) {
  return String(texto || '').trim();
}

function normalizarCnpj(texto) {
  return String(texto || '').replace(/\D/g, '');
}

async function localizarUnidade(unidade, empresaId = null) {
  const termo = normalizarTexto(unidade);
  if (!termo) {
    throw new AppError('Unidade é obrigatória.', 400);
  }

  const termoMinusculo = termo.toLowerCase();
  const cnpjLimpo = normalizarCnpj(termo);
  const termoLike = `%${termoMinusculo}%`;

  // Se um empresaId foi fornecido (usuario nao é super_admin), limitamos
  // a busca a essa empresa: primeiro tentamos encontrar uma filial DESSA
  // empresa que corresponda ao termo; se nao encontrada, verificamos se o
  // proprio termo corresponde à propria empresa (por nome/cnpj).
  if (empresaId) {
    const filial = await db('filiais')
      .where(function () {
        this.whereRaw('lower(nome) like ?', [termoLike])
          .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
        if (cnpjLimpo) {
          this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
        }
      })
      .andWhere({ ativo: true, empresa_id: empresaId })
      .first();

    if (filial) return { tipo: 'filial', registro: filial };

    // tenta casar o proprio nome/cnpj da empresa apenas dentro do contexto
    const empresa = await db('empresas')
      .where({ id: empresaId })
.andWhere(function () {
        this.whereRaw('lower(razao_social) like ?', [termoLike])
          .orWhereRaw('lower(nome_fantasia) like ?', [termoLike])
          .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
        if (cnpjLimpo) {
          this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
        }
      })
      .first();

    if (empresa) return { tipo: 'empresa', registro: empresa };
  } else {
    // busca global (super_admin ou escolha de ambiente antes de conhecer o usuario)
    const empresa = await db('empresas')
      .where(function () {
        this.whereRaw('lower(razao_social) like ?', [termoLike])
          .orWhereRaw('lower(nome_fantasia) like ?', [termoLike])
          .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
        if (cnpjLimpo) {
          this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
        }
      })
      .first();

    if (empresa) {
      return { tipo: 'empresa', registro: empresa };
    }

    const filial = await db('filiais')
      .where(function () {
        this.whereRaw('lower(nome) like ?', [termoLike])
          .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
        if (cnpjLimpo) {
          this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
        }
      })
      .andWhere({ ativo: true })
      .first();

    if (filial) {
      return { tipo: 'filial', registro: filial };
    }
  }

  throw new AppError('Unidade não encontrada. Verifique o nome ou CNPJ e tente novamente.', 404);
}

async function localizarEmpresa(unidade) {
  const termo = normalizarTexto(unidade);
  if (!termo) throw new AppError('Ambiente é obrigatório.', 400);

  const termoMinusculo = termo.toLowerCase();
  const cnpjLimpo = normalizarCnpj(termo);
  const termoLike = `%${termoMinusculo}%`;

  const empresa = await db('empresas')
    .where(function () {
      this.whereRaw('lower(razao_social) like ?', [termoLike])
        .orWhereRaw('lower(nome_fantasia) like ?', [termoLike])
        .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
      if (cnpjLimpo) {
        this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
      }
    })
    .first();

  if (!empresa) throw new AppError('Ambiente não encontrado. Verifique o nome ou CNPJ e tente novamente.', 404);

  return { tipo: 'empresa', registro: empresa };
}

function montarEmpresaSelecionada(unidadeEncontrada) {
  const registro = unidadeEncontrada.registro;
  return {
    id: unidadeEncontrada.tipo === 'filial' ? registro.empresa_id : registro.id,
    nome:
      unidadeEncontrada.tipo === 'filial'
        ? registro.nome || registro.cnpj
        : registro.razao_social || registro.nome_fantasia || registro.cnpj,
    tipo: 'empresa',
  };
}

function montarFilialSelecionada(unidadeEncontrada) {
  if (unidadeEncontrada.tipo !== 'filial') {
    return null;
  }

  const registro = unidadeEncontrada.registro;
  return {
    id: registro.id,
    nome: registro.nome || registro.cnpj || 'Unidade',
    tipo: registro.tipo || 'empresa',
  };
}

async function login(email, senha, unidade) {
  const usuario = await db('usuarios').where({ email: email.toLowerCase().trim() }).first();

  if (!usuario || !usuario.ativo) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaOk) {
    throw new AppError('Email ou senha invalidos.', 401);
  }

  // Login deve selecionar um AMBIENTE (empresa) — nao uma filial. Procuramos
  // explicitamente pela empresa correspondente ao termo fornecido.
  const unidadeEncontrada = await localizarEmpresa(unidade);

  let empresaIdUnidade = unidadeEncontrada.registro.id;
  const selectedFilialId = null;

  if (usuario.papel !== 'super_admin') {
    const empresaIdUsuario = usuario.empresa_id;
    empresaIdUnidade = unidadeEncontrada.tipo === 'filial' ? unidadeEncontrada.registro.empresa_id : unidadeEncontrada.registro.id;
    if (!empresaIdUsuario || empresaIdUsuario !== empresaIdUnidade) {
      throw new AppError('Unidade não corresponde ao usuário.', 403);
    }
  }

  await db('usuarios').where({ id: usuario.id }).update({ ultimo_login_em: db.fn.now() });

  const payload = {
    tipo: 'staff',
    id: usuario.id,
    empresa_id: empresaIdUnidade,
    filial_id: selectedFilialId,
    papel: usuario.papel,
    nome: usuario.nome,
    email: usuario.email,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  return {
    token,
    usuario: payload,
    empresaSelecionada: montarEmpresaSelecionada(unidadeEncontrada),
    filialSelecionada: montarFilialSelecionada(unidadeEncontrada),
  };
}

async function criarUsuario({ empresa_id, filial_id, nome, email, senha, papel = 'admin' }) {
  const existente = await db('usuarios').where({ email: email.toLowerCase().trim() }).first();
  if (existente) {
    throw new AppError('Ja existe um usuario com este email.', 409);
  }

  const senha_hash = await bcrypt.hash(senha, 12);

  const [usuario] = await db('usuarios')
    .insert({
      empresa_id,
      filial_id: filial_id || null,
      nome,
      email: email.toLowerCase().trim(),
      senha_hash,
      papel,
    })
    .returning(['id', 'nome', 'email', 'papel', 'empresa_id', 'filial_id']);

  return usuario;
}

async function listarUsuarios(empresaId) {
  return db('usuarios as u')
    .select('u.id', 'u.nome', 'u.email', 'u.papel', 'u.filial_id', 'u.ativo', 'f.nome as filial_nome')
    .leftJoin('filiais as f', 'f.id', 'u.filial_id')
    .where('u.empresa_id', empresaId)
    .orderBy('u.nome');
}

module.exports = { login, criarUsuario, listarUsuarios };
