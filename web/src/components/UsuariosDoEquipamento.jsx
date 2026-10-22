/**
 * Usuarios que o equipamento devolveu em "Receber usuarios", conferidos contra
 * o cadastro do site (`GET /api/dispositivos/:id/usuarios-no-equipamento`).
 * Usado na tela do dispositivo e em "Enviar e receber dados".
 */
export default function UsuariosDoEquipamento({ usuarios }) {
  if (!usuarios.length) {
    return <p className="texto-apoio">O equipamento não retornou usuários cadastrados.</p>;
  }
  return (
    <table className="tabela">
      <thead>
        <tr>
          <th>ID / matrícula</th>
          <th>Nome correspondente</th>
          <th>Resultado</th>
        </tr>
      </thead>
      <tbody>
        {usuarios.map((usuario) => (
          <tr key={usuario.idNoDispositivo}>
            <td className="mono">{usuario.idNoDispositivo}</td>
            <td>{usuario.sincronizacao?.nome || usuario.nome || '—'}</td>
            <td>
              {usuario.sincronizacao?.estado === 'vinculado'
                ? 'Vinculado ao cadastro do site'
                : usuario.sincronizacao?.estado === 'conflito'
                  ? `Conflito: ${usuario.sincronizacao.motivo}`
                  : usuario.sincronizacao?.estado === 'sem_correspondencia'
                    ? 'Sem aluno/funcionário com esta matrícula'
                    : 'Recebido'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
