import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { PAPEIS, rotuloPapel } from '../utils/dominio';

/** Papel define o que a pessoa enxerga; por isso ganha cor propria na lista. */
const CLASSE_PAPEL = {
  super_admin: 'badge-info',
  admin: 'badge-info',
  rh: '',
  gestor: '',
  professor: 'badge-ativo',
};

export default function UsuariosLista() {
  const { usuario } = useAuth();
  const podeCadastrar = usuario?.papel === 'admin' || usuario?.papel === 'super_admin';

  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [papel, setPapel] = useState('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api.listarUsuarios()
      .then((r) => setUsuarios(r.usuarios || []))
      .catch((e) => setErro(e.message || 'Não foi possível carregar os usuários.'))
      .finally(() => setCarregando(false));
  }, []);

  const porPapel = useMemo(() => {
    const mapa = new Map();
    usuarios.forEach((u) => mapa.set(u.papel, (mapa.get(u.papel) || 0) + 1));
    return mapa;
  }, [usuarios]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (papel && u.papel !== papel) return false;
      if (!termo) return true;
      return [u.nome, u.email, u.filial_nome].filter(Boolean)
        .some((c) => String(c).toLowerCase().includes(termo));
    });
  }, [usuarios, papel, busca]);

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <div className="barra-acoes">
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0 }}>Usuários</h1>
          <p className="subtitulo-pagina" style={{ margin: '3px 0 0' }}>
            Quem tem acesso ao sistema e o que cada perfil enxerga.
          </p>
        </div>
        {podeCadastrar && <Link to="/usuarios/novo" className="btn btn-azul">+ Cadastrar usuário</Link>}
      </div>

      {erro && <div className="erro">{erro}</div>}

      <section className="secao">
        <div className="numeros">
          {PAPEIS.map((p) => (
            <div key={p.valor} className="numero">
              <div className="valor">{porPapel.get(p.valor) || 0}</div>
              <div className="label">{p.rotulo}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="filtros">
        <div className="campo">
          <label htmlFor="us-papel">Papel</label>
          <Selecao
            id="us-papel"
            rotuloAria="Papel"
            valor={papel}
            aoMudar={setPapel}
            opcoes={[
              { valor: '', rotulo: 'Todos os papéis' },
              ...PAPEIS.map((p) => ({ valor: p.valor, rotulo: `${p.rotulo} (${porPapel.get(p.valor) || 0})` })),
            ]}
          />
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="us-busca">Buscar</label>
          <input id="us-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail ou unidade" />
        </div>
      </div>

      <section className="secao">
        <h2>
          {papel ? rotuloPapel(papel) : 'Todos os usuários'}
          <span className="nota">
            {filtrados.length === 1 ? '1 usuário' : `${filtrados.length} usuários`}
          </span>
        </h2>

        <div className="painel">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Unidade</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                <tr key={u.id}>
                  <td>{u.nome}</td>
                  <td className="mono">{u.email}</td>
                  <td><span className={`badge ${CLASSE_PAPEL[u.papel] ?? ''}`}>{rotuloPapel(u.papel)}</span></td>
                  <td>{u.filial_nome || <span className="texto-apoio">todas as unidades</span>}</td>
                  <td>
                    <span className={`badge badge-${u.ativo ? 'ativo' : 'inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="vazio">
                      {usuarios.length ? 'Nenhum usuário com esses filtros.' : 'Nenhum usuário cadastrado ainda.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="secao">
        <h2>O que cada perfil enxerga</h2>
        <div className="painel">
          <table className="tabela">
            <thead>
              <tr><th>Perfil</th><th>Acesso</th></tr>
            </thead>
            <tbody>
              <tr><td><span className="badge badge-info">Super admin</span></td><td>Todas as empresas. Escolhe a empresa a operar e cria unidades de qualquer tipo.</td></tr>
              <tr><td><span className="badge badge-info">Admin</span></td><td>A própria empresa. Cria escolas, turmas, alunos, usuários e dispositivos.</td></tr>
              <tr><td><span className="badge">RH</span></td><td>Funcionários, ponto, relatórios e auditoria da empresa.</td></tr>
              <tr><td><span className="badge">Gestor</span></td><td>Consulta de ponto e relatórios da unidade, sem alterar cadastros.</td></tr>
              <tr><td><span className="badge badge-ativo">Professor</span></td><td>Apenas as próprias turmas: chamada, notas e observações.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}
