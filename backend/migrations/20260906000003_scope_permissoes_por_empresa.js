exports.up = async function up(knex) {
  const [{ count: empresas }] = await knex('empresas').count('* as count');
  const [{ count: papeisSemEmpresa }] = await knex('permissoes_papeis').count('* as count');
  const [{ count: usuariosSemEmpresa }] = await knex('permissoes_usuarios').count('* as count');
  if (Number(empresas) === 0 && (Number(papeisSemEmpresa) > 0 || Number(usuariosSemEmpresa) > 0)) {
    throw new Error(
      'Nao foi possivel escopar permissoes: existem permissoes antigas, mas nenhuma empresa cadastrada. Cadastre/importe as empresas antes de executar esta migration.'
    );
  }

  await knex.schema.alterTable('permissoes_papeis', (table) => {
    table.uuid('empresa_id').nullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').nullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.uuid('atribuicao_id').nullable().references('id').inTable('turma_professores').onDelete('CASCADE');
  });

  await knex.schema.alterTable('permissoes_usuarios', (table) => {
    table.uuid('empresa_id').nullable().references('id').inTable('empresas').onDelete('CASCADE');
    table.uuid('filial_id').nullable().references('id').inTable('filiais').onDelete('CASCADE');
    table.uuid('atribuicao_id').nullable().references('id').inTable('turma_professores').onDelete('CASCADE');
  });

  await knex.raw(`
    ALTER TABLE permissoes_papeis
      DROP CONSTRAINT IF EXISTS permissoes_papeis_papel_recurso_acao_unique
  `);
  await knex.raw(`
    ALTER TABLE permissoes_usuarios
      DROP CONSTRAINT IF EXISTS permissoes_usuarios_usuario_id_recurso_acao_unique
  `);

  await knex.raw(`
    INSERT INTO permissoes_papeis (papel, recurso, acao, permitido, empresa_id)
    SELECT pp.papel, pp.recurso, pp.acao, pp.permitido, e.id
    FROM empresas e
    CROSS JOIN permissoes_papeis pp
    WHERE pp.empresa_id IS NULL
  `);

  await knex.raw(`
    DELETE FROM permissoes_papeis
    WHERE empresa_id IS NULL
  `);

  await knex.raw(`
    UPDATE permissoes_usuarios pu
    SET empresa_id = u.empresa_id
    FROM usuarios u
    WHERE u.id = pu.usuario_id
      AND pu.empresa_id IS NULL
  `);

  await knex.raw(`
    ALTER TABLE permissoes_papeis
      ALTER COLUMN empresa_id SET NOT NULL
  `);

  await knex.raw(`
    ALTER TABLE permissoes_usuarios
      ALTER COLUMN empresa_id SET NOT NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX permissoes_papeis_escopo_unique
    ON permissoes_papeis (
      empresa_id,
      papel,
      recurso,
      acao,
      COALESCE(filial_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(atribuicao_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX permissoes_usuarios_escopo_unique
    ON permissoes_usuarios (
      empresa_id,
      usuario_id,
      recurso,
      acao,
      COALESCE(filial_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(atribuicao_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
  `);

  await knex.raw(`
    CREATE INDEX permissoes_papeis_busca_escopo
    ON permissoes_papeis (empresa_id, papel, recurso, acao)
  `);
  await knex.raw(`
    CREATE INDEX permissoes_usuarios_busca_escopo
    ON permissoes_usuarios (empresa_id, usuario_id, recurso, acao)
  `);
};

exports.down = async function down(knex) {
  const [{ count: empresasPapeis }] = await knex('permissoes_papeis').countDistinct('empresa_id as count');
  const [{ count: empresasUsuarios }] = await knex('permissoes_usuarios').countDistinct('empresa_id as count');
  const regraPapelEscopada = await knex('permissoes_papeis')
    .whereNotNull('filial_id')
    .orWhereNotNull('atribuicao_id')
    .first('id');
  const regraUsuarioEscopada = await knex('permissoes_usuarios')
    .whereNotNull('filial_id')
    .orWhereNotNull('atribuicao_id')
    .first('id');

  if (Number(empresasPapeis) > 1 || Number(empresasUsuarios) > 1 || regraPapelEscopada || regraUsuarioEscopada) {
    throw new Error(
      'Rollback bloqueado: existem permissoes por empresa, filial ou atribuicao que nao podem ser representadas com seguranca no modelo global antigo.'
    );
  }

  await knex.raw('DROP INDEX IF EXISTS permissoes_papeis_busca_escopo');
  await knex.raw('DROP INDEX IF EXISTS permissoes_usuarios_busca_escopo');
  await knex.raw('DROP INDEX IF EXISTS permissoes_papeis_escopo_unique');
  await knex.raw('DROP INDEX IF EXISTS permissoes_usuarios_escopo_unique');

  await knex.schema.alterTable('permissoes_papeis', (table) => {
    table.dropColumn('empresa_id');
    table.dropColumn('filial_id');
    table.dropColumn('atribuicao_id');
  });
  await knex.schema.alterTable('permissoes_usuarios', (table) => {
    table.dropColumn('empresa_id');
    table.dropColumn('filial_id');
    table.dropColumn('atribuicao_id');
  });

  await knex.raw(`
    ALTER TABLE permissoes_papeis
      ADD CONSTRAINT permissoes_papeis_papel_recurso_acao_unique UNIQUE (papel, recurso, acao)
  `);
  await knex.raw(`
    ALTER TABLE permissoes_usuarios
      ADD CONSTRAINT permissoes_usuarios_usuario_id_recurso_acao_unique UNIQUE (usuario_id, recurso, acao)
  `);
};
