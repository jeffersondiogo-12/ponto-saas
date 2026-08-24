/**
 * Reseta a senha de um responsavel (pai/mae) ja existente, gerando um hash
 * bcrypt de verdade - usa o MESMO db.js/knexfile.js do servidor, entao
 * sempre mexe no banco certo (o mesmo que o `npm run dev` do backend usa).
 *
 * Uso:
 *   node scripts/resetar-senha-responsavel.js "email@exemplo.com" "novaSenha123"
 */
const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function main() {
  const [, , emailArg, novaSenha] = process.argv;

  if (!emailArg || !novaSenha) {
    console.log('Uso: node scripts/resetar-senha-responsavel.js "email@exemplo.com" "novaSenha123"');
    process.exit(1);
  }

  if (novaSenha.length < 6) {
    console.log('Escolha uma senha com pelo menos 6 caracteres.');
    process.exit(1);
  }

  const emailNormalizado = emailArg.toLowerCase().trim();
  const responsavel = await db('responsaveis').where({ email: emailNormalizado }).first();

  if (!responsavel) {
    console.log('❌ Nao existe responsavel com esse email neste banco. Rode antes:');
    console.log('   node scripts/diagnosticar-login-responsavel.js "' + emailArg + '" "qualquerCoisa"');
    console.log('   para confirmar se a conta esta em outro banco.');
    await db.destroy();
    process.exit(1);
  }

  const senha_hash = await bcrypt.hash(novaSenha, 12);
  await db('responsaveis').where({ id: responsavel.id }).update({ senha_hash, ativo: true });

  console.log('✅ Senha atualizada para o responsavel', responsavel.nome, `(${responsavel.email}).`);
  console.log('   Teste agora no app com email:', responsavel.email, 'e a nova senha que voce escolheu.');

  await db.destroy();
}

main().catch(async (err) => {
  console.error('Erro ao resetar senha:', err.message);
  await db.destroy().catch(() => {});
  process.exit(1);
});
