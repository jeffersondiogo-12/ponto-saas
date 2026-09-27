/**
 * Para onde a pessoa vai na cara do app — decide o papel da conta, nao a aba
 * escolhida no login:
 * - responsavel → telas do responsavel;
 * - professor → telas do professor;
 * - admin, gestor e super_admin → as telas do web que o celular libera
 *   (`TELAS_CELULAR`), com a casca e as cores do app;
 * - rh e qualquer outro papel → null (aviso de que o acesso e pelo computador).
 */
const PAPEIS_GESTAO = ['admin', 'gestor', 'super_admin'];

export function perfilDaConta(usuario) {
  if (!usuario) return null;
  if (usuario.tipo === 'responsavel') return 'responsavel';
  if (usuario.papel === 'professor') return 'professor';
  if (PAPEIS_GESTAO.includes(usuario.papel)) return 'gestao';
  return null;
}
