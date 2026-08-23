import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

export default function UnidadesLista() {
  const [unidades, setUnidades] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.listarUnidades().then((r) => {
      setUnidades(r.filiais);
      setCarregando(false);
    });
  }, []);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 className="titulo-pagina" style={{ marginBottom: 0 }}>Unidades</h1>
        <Link to="/unidades/nova" className="btn btn-azul">+ Nova unidade</Link>
      </div>

      <div className="card">
        <div className="eyebrow">Unidades da empresa</div>
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Fuso horário</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {unidades.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td><span className="chip-dado">{u.tipo === 'escola' ? 'Escola' : 'Empresa'}</span></td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{u.fuso_horario}</td>
                    <td><span className={`badge badge-${u.ativo ? 'ativo' : 'inativo'}`}>{u.ativo ? 'Ativa' : 'Inativa'}</span></td>
                    <td>
                      <Link to={`/unidades/${u.id}/editar`} className="btn btn-secundario" style={{ padding: '6px 12px', fontSize: 12.5 }}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
                {unidades.length === 0 && (
                  <tr><td colSpan={5} className="texto-apoio">Nenhuma unidade cadastrada ainda — crie a primeira para escolher entre empresa ou escola.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
