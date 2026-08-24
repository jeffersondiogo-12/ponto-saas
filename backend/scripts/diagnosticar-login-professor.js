/**
 * Diagnostico de login de professor/staff - mesma ideia do
 * diagnosticar-login-responsavel.js, mas cobre a etapa extra que so o
 * login de staff tem: resolver a "unidade" (nome ou CNPJ da empresa) e
 * confirmar que ela bate com a empresa do usuario. Um erro nessa etapa
 * ("Unidade nao encontrada" / "Unidade nao corresponde ao usuario") e
 * FACIL de confundir com "senha errada" na hora de descrever o problema,
 * mas e uma causa totalmente diferente.
 *
 * Uso:
 *   node scripts/diagnosticar-login-professor.js "email@escola.com" "senha" "nome ou cnpj da unidade"
 */
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function main() {
  const [, , emailArg, senhaArg, unidadeArg] = process.argv;

  if (!emailArg || !senhaArg) {
    console.log('Uso: node scripts/diagnosticar-login-professor.js "email@escola.com" "senha" "nome ou cnpj da unidade"');
    process.exit(1);
  }

  const conn = db.client.config.connection;
  console.log('--- Banco que este script (e o servidor) estao usando ---');
  if (typeof conn === 'string' || conn.connectionString) {
    console.log('connectionString:', (conn.connectionString || conn).replace(/:[^:@]*@/, ':****@'));
  } else {
    console.log(`host=${conn.host} port=${conn.port} database=${conn.database} user=${conn.user}`);
  }
  console.log('');

  const emailNormalizado = emailArg.toLowerCase().trim();
  console.log(`--- Procurando usuario (staff) com email = "${emailNormalizado}" ---`);

  const usuario = await db('usuarios').where({ email: emailNormalizado }).first();
  const comEspacoOuMaiuscula = await db('usuarios').whereRaw('LOWER(TRIM(email)) = ?', [emailNormalizado]);

  if (!usuario) {
    console.log('❌ NENHUM usuario encontrado com esse email neste banco.');
    if (comEspacoOuMaiuscula.length > 0) {
      console.log('   Mas encontrei', comEspacoOuMaiuscula.length, 'linha(s) parecida(s), com espaco/maiuscula diferente:');
      comEspacoOuMaiuscula.forEach((u) => console.log('   -> email salvo como:', JSON.stringify(u.email)));
    } else {
      console.log('   Causas mais comuns: conta criada em outro banco (confira o .env / a connection string acima),');
      console.log('   ou o email tem um typo.');
    }
    await db.destroy();
    process.exit(0);
  }

  console.log('✅ Usuario encontrado. id =', usuario.id, '| papel =', usuario.papel, '| ativo =', usuario.ativo, '| empresa_id =', usuario.empresa_id);

  if (!usuario.ativo) {
    console.log('❌ Conta existe mas ativo=false - login rejeita antes de checar a senha.');
    await db.destroy();
    process.exit(0);
  }

  const pareceHashBcryptValido = /^\$2[aby]\$\d{2}\$/.test(usuario.senha_hash || '');
  if (!pareceHashBcryptValido) {
    console.log('❌ senha_hash NAO parece um hash bcrypt valido:', JSON.stringify(usuario.senha_hash));
    console.log('   Isso por si so explica um "senha invalida" que nunca bate, independente da senha digitada.');
    await db.destroy();
    process.exit(0);
  }

  const senhaBate = await bcrypt.compare(senhaArg, usuario.senha_hash);
  console.log(senhaBate ? '✅ A senha informada BATE com o hash salvo.' : '❌ A senha informada NAO bate com o hash salvo.');

  if (!senhaBate) {
    await db.destroy();
    process.exit(0);
  }

  // --- Etapa extra, exclusiva do login de staff: resolver a "unidade" ---
  if (!unidadeArg) {
    console.log('');
    console.log('ℹ️  Senha OK. Para checar tambem a etapa de "unidade" (obrigatoria no login de professor),');
    console.log('   rode novamente passando o nome ou CNPJ da empresa como 3o argumento.');
    await db.destroy();
    process.exit(0);
  }

  console.log('');
  console.log(`--- Resolvendo unidade = "${unidadeArg}" ---`);
  const termoMinusculo = unidadeArg.toLowerCase().trim();
  const cnpjLimpo = unidadeArg.replace(/\D/g, '');
  const termoLike = `%${termoMinusculo}%`;

  const empresaEncontrada = await db('empresas')
    .where(function () {
      this.whereRaw('lower(razao_social) like ?', [termoLike])
        .orWhereRaw('lower(nome_fantasia) like ?', [termoLike])
        .orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
      if (cnpjLimpo) this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
    })
    .first();

  const filialEncontrada = !empresaEncontrada
    ? await db('filiais')
        .where(function () {
          this.whereRaw('lower(nome) like ?', [termoLike]).orWhereRaw('lower(cnpj) = ?', [termoMinusculo]);
          if (cnpjLimpo) this.orWhereRaw("translate(cnpj, '.-/ ', '') = ?", [cnpjLimpo]);
        })
        .andWhere({ ativo: true })
        .first()
    : null;

  if (!empresaEncontrada && !filialEncontrada) {
    console.log('❌ Nenhuma empresa/filial corresponde a esse termo. E ISSO que vai aparecer como erro no login');
    console.log('   ("Unidade nao encontrada..."), mesmo com email/senha 100% corretos.');
    await db.destroy();
    process.exit(0);
  }

  const empresaIdDaUnidade = empresaEncontrada ? empresaEncontrada.id : filialEncontrada.empresa_id;
  console.log('✅ Unidade resolvida, empresa_id =', empresaIdDaUnidade);

  if (usuario.papel !== 'super_admin' && usuario.empresa_id !== empresaIdDaUnidade) {
    console.log('❌ A empresa dessa unidade (' + empresaIdDaUnidade + ') e DIFERENTE da empresa do usuario (' + usuario.empresa_id + ').');
    console.log('   E ISSO que vai aparecer como "Unidade nao corresponde ao usuario", mesmo com senha certa.');
    await db.destroy();
    process.exit(0);
  }

  console.log('✅ Tudo bate: email, senha e unidade. Esse login deveria funcionar (200 OK) no servidor que usa este mesmo banco.');
  await db.destroy();
}

main().catch(async (err) => {
  console.error('Erro ao rodar diagnostico:', err.message);
  await db.destroy().catch(() => {});
  process.exit(1);
});
