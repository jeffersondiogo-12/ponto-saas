const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar() {
  return db('empresas').orderBy('razao_social');
}

async function buscarPorId(empresaId) {
  const empresa = await db('empresas').where({ id: empresaId }).first();
  if (!empresa) throw new AppError('Empresa nao encontrada.', 404);
  return empresa;
}

async function criar(dados) {
  const cnpjExistente = await db('empresas').where({ cnpj: dados.cnpj }).first();
  if (cnpjExistente) throw new AppError('Ja existe uma empresa cadastrada com este CNPJ.', 409);

  const [empresa] = await db('empresas')
    .insert({
      razao_social: dados.razao_social,
      nome_fantasia: dados.nome_fantasia || null,
      cnpj: dados.cnpj,
      email: dados.email || null,
      telefone: dados.telefone || null,
      endereco: dados.endereco || null,
      quantidade_funcionarios_estimada: dados.quantidade_funcionarios_estimada || 0,
      plano: dados.plano || 'basico',
    })
    .returning('*');

  return empresa;
}

async function atualizar(empresaId, dados) {
  await buscarPorId(empresaId);

  const [empresa] = await db('empresas')
    .where({ id: empresaId })
    .update({
      razao_social: dados.razao_social,
      nome_fantasia: dados.nome_fantasia || null,
      email: dados.email || null,
      telefone: dados.telefone || null,
      endereco: dados.endereco || null,
      quantidade_funcionarios_estimada: dados.quantidade_funcionarios_estimada || 0,
      plano: dados.plano,
      ativo: dados.ativo,
    })
    .returning('*');

  return empresa;
}

module.exports = { listar, buscarPorId, criar, atualizar };
