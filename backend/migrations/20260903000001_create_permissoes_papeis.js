const RECURSOS = {
  usuarios: { admin: ['ver', 'adicionar'], super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'] },
  empresas: { super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'] },
  filiais: { admin: ['ver', 'adicionar', 'atualizar', 'deletar'], super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'] },
  funcionarios: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    rh: ['ver', 'adicionar', 'atualizar', 'deletar'],
    gestor: ['ver'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  alunos: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    rh: ['ver', 'adicionar', 'atualizar', 'deletar'],
    gestor: ['ver'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  responsaveis: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    rh: ['ver', 'deletar'],
    gestor: ['ver', 'adicionar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  turmas: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    rh: ['ver', 'adicionar', 'atualizar', 'deletar'],
    gestor: ['ver', 'atualizar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  dispositivos: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    rh: ['ver', 'atualizar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  avisos: {
    admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
    gestor: ['ver', 'adicionar', 'atualizar', 'deletar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  auditoria: {
    admin: ['ver'],
    gestor: ['ver'],
    super_admin: ['ver'],
  },
  ponto: {
    admin: ['ver', 'adicionar', 'atualizar'],
    rh: ['ver', 'adicionar', 'atualizar'],
    gestor: ['ver'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  relatorios: {
    admin: ['ver'],
    rh: ['ver'],
    gestor: ['ver'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  afd: {
    admin: ['ver', 'adicionar'],
    rh: ['ver', 'adicionar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
  professores: {
    professor: ['ver', 'adicionar', 'atualizar'],
    gestor: ['ver', 'adicionar', 'atualizar'],
    admin: ['ver', 'adicionar', 'atualizar'],
    super_admin: ['ver', 'adicionar', 'atualizar', 'deletar'],
  },
};

exports.up = async function up(knex) {
  await knex.schema.createTable('permissoes_papeis', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.enu('papel', ['super_admin', 'admin', 'rh', 'gestor', 'professor'], {
      useNative: false,
    }).notNullable();
    table.string('recurso', 80).notNullable();
    table.enu('acao', ['ver', 'adicionar', 'atualizar', 'deletar'], { useNative: false }).notNullable();
    table.boolean('permitido').notNullable().defaultTo(true);
    table.unique(['papel', 'recurso', 'acao']);
  });

  const linhas = [];
  for (const [recurso, papeis] of Object.entries(RECURSOS)) {
    for (const [papel, acoes] of Object.entries(papeis)) {
      for (const acao of acoes) linhas.push({ papel, recurso, acao, permitido: true });
    }
  }
  await knex('permissoes_papeis').insert(linhas);
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('permissoes_papeis');
};
