const db = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listar(empresaId) {
  return db('filiais').where({ empresa_id: empresaId }).orderBy('nome');
}

async function buscarPorId(empresaId, filialId) {
  const filial = await db('filiais').where({ id: filialId, empresa_id: empresaId }).first();
  if (!filial) throw new AppError('Unidade nao encontrada.', 404);
  return filial;
}

async function criar(empresaId, dados) {
  if (!empresaId) {
    throw new AppError('Empresa nao informada.', 400);
  }

  if (!dados || !String(dados.nome || '').trim()) {
    throw new AppError('Nome da filial eh obrigatorio.', 400);
  }

  if (dados.cnpj && String(dados.cnpj).length > 18) {
    throw new AppError('CNPJ deve ter no maximo 18 caracteres.', 400);
  }

  const tipo = ['empresa', 'escola'].includes(String(dados.tipo || 'empresa').trim())
    ? String(dados.tipo || 'empresa').trim()
    : 'empresa';

  const [filial] = await db('filiais')
    .insert({
      empresa_id: empresaId,
      nome: String(dados.nome).trim(),
      cnpj: dados.cnpj ? String(dados.cnpj).trim() : null,
      endereco: dados.endereco ? String(dados.endereco).trim() : null,
      fuso_horario: dados.fuso_horario ? String(dados.fuso_horario).trim() : 'America/Sao_Paulo',
      tipo,
    })
    .returning('*');

  return filial;
}

async function atualizar(empresaId, filialId, dados) {
  await buscarPorId(empresaId, filialId);

  if (dados.cnpj && String(dados.cnpj).length > 18) {
    throw new AppError('CNPJ deve ter no maximo 18 caracteres.', 400);
  }

  // O tipo (empresa/escola) e imutavel apos a criacao: turmas e alunos ja
  // podem existir amarrados a esta unidade, e trocar o tipo deixaria o dado
  // orfao de tela (ex: turmas continuariam no banco mas sumiriam do menu).
  // O formulario ja desabilita esse campo, mas a garantia real e aqui.
  const [filial] = await db('filiais')
    .where({ id: filialId, empresa_id: empresaId })
    .update({
      nome: dados.nome,
      cnpj: dados.cnpj ? String(dados.cnpj).trim() : null,
      endereco: dados.endereco ? String(dados.endereco).trim() : null,
      fuso_horario: dados.fuso_horario,
      ativo: dados.ativo !== undefined ? dados.ativo : true,
    })
    .returning('*');

  return filial;
}

/**
 * Tipos de unidade presentes para um usuario: se o usuario esta vinculado a
 * UMA unidade especifica, so o tipo dela; se nao (usuario "geral" - suporte,
 * admin cross-unidade), a uniao dos tipos de todas as unidades da empresa.
 * Sem nenhuma unidade cadastrada ainda, assume 'empresa' (comportamento
 * anterior a esta funcionalidade, para nao quebrar contas ja existentes).
 */
async function obterTiposDisponiveis(empresaId, filialIdDoUsuario) {
  if (filialIdDoUsuario) {
    const filial = await db('filiais').where({ id: filialIdDoUsuario }).first();
    return filial ? [filial.tipo] : ['empresa'];
  }

  const filiais = await db('filiais').where({ empresa_id: empresaId, ativo: true });
  if (filiais.length === 0) return ['empresa'];
  return [...new Set(filiais.map((f) => f.tipo))];
}

module.exports = { listar, buscarPorId, criar, atualizar, obterTiposDisponiveis };
