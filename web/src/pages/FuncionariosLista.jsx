import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';

export default function FuncionariosLista() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.listarFuncionarios().then((r) => {
      setFuncionarios(r.funcionarios || []);
      setCarregando(false);
    });
  }, []);

  return (
    <Layout>
      <h1 className="titulo-pagina">Funcionários</h1>
      <div className="card">
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Matrícula</th><th>Filial</th></tr>
              </thead>
              <tbody>
                {funcionarios.map((f) => (
                  <tr key={f.id}><td>{f.nome}</td><td className="mono">{f.matricula}</td><td>{f.filial_nome || ''}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
