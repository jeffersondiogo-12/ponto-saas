/**
 * Diagnostico de login de responsavel (pai/mae) - roda FORA do servidor,
 * mas usa a MESMA config de banco (src/config/db.js -> knexfile.js) que o
 * servidor real usa. Isso e importante: se este script nao achar a conta,
 * o problema nao e a senha - e que o servidor esta olhando pra um banco
 * diferente daquele onde a conta foi criada.
 *
 * Uso:
 *   node scripts/diagnosticar-login-responsavel.js "email@exemplo.com" "senhaDigitada123"
 */
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function main() {
  const [, , emailArg, senhaArg] = process.argv;

  if (!emailArg || !senhaArg) {
    console.log('Uso: node scripts/diagnosticar-login-responsavel.js "email@exemplo.com" "senha"');
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
  console.log(`--- Procurando responsavel com email = "${emailNormalizado}" ---`);

  const todosComEsseEmailBruto = await db('responsaveis').whereRaw('LOWER(TRIM(email)) = ?', [emailNormalizado]);
  const responsavel = await db('responsaveis').where({ email: emailNormalizado }).first();

  if (!responsavel) {
    console.log('❌ NENHUMA linha encontrada com email exatamente igual a', JSON.stringify(emailNormalizado));
    if (todosComEsseEmailBruto.length > 0) {
      console.log('   Porem encontrei', todosComEsseEmailBruto.length, 'linha(s) com esse email ignorando espacos/maiusculas:');
      todosComEsseEmailBruto.forEach((r) => console.log('   -> email salvo como:', JSON.stringify(r.email)));
      console.log('   Isso indica que o email foi salvo com espaco(s) extra ou maiusculas, e a comparacao exata do login esta falhando por causa disso.');
    } else {
      console.log('   Ou seja: essa conta NAO EXISTE neste banco.');
      console.log('   Causas mais comuns:');
      console.log('   1) A conta foi criada em outro banco (ex: Supabase) diferente do que o .env deste backend aponta agora.');
      console.log('   2) O app mobile nunca chamou POST /api/responsaveis/cadastro de fato (nao existe tela de cadastro no app hoje - ver src/screens - so LoginScreen).');
      console.log('   3) A conta foi inserida manualmente com um typo no email.');
    }
    await db.destroy();
    process.exit(0);
  }

  console.log('✅ Conta encontrada. id =', responsavel.id, '| ativo =', responsavel.ativo, '| empresa_id =', responsavel.empresa_id);

  if (!responsavel.ativo) {
    console.log('❌ A conta existe mas esta com ativo=false - o login rejeita antes mesmo de checar a senha.');
    await db.destroy();
    process.exit(0);
  }

  const pareceHashBcryptValido = /^\$2[aby]\$\d{2}\$/.test(responsavel.senha_hash || '');
  if (!pareceHashBcryptValido) {
    console.log('❌ O campo senha_hash NAO parece ser um hash bcrypt valido:');
    console.log('   valor salvo:', JSON.stringify(responsavel.senha_hash));
    console.log('   Um hash bcrypt de verdade sempre comeca com $2a$, $2b$ ou $2y$ seguido de 2 digitos (ex: $2b$12$...).');
    console.log('   Isso confirma o bug: a senha foi salva em texto puro (ou de outro jeito) em vez de passar por bcrypt.hash().');
    console.log('   bcrypt.compare() contra um valor que nao e hash bcrypt SEMPRE retorna false - por isso da "senha invalida" mesmo com a senha certa.');
    await db.destroy();
    process.exit(0);
  }

  const senhaBate = await bcrypt.compare(senhaArg, responsavel.senha_hash);
  console.log(senhaBate ? '✅ A senha informada BATE com o hash salvo.' : '❌ A senha informada NAO bate com o hash salvo (senha realmente diferente da que foi cadastrada).');

  await db.destroy();
}

main().catch(async (err) => {
  console.error('Erro ao rodar diagnostico:', err.message);
  await db.destroy().catch(() => {});
  process.exit(1);
});
