import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api } from '../api';

export default function TurmasLista() {
  const [turmas, setTurmas] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.listarTurmas?.().then((r) => {
      setTurmas((r && r.turmas) || []);
      setCarregando(false);
    }).catch(() => setCarregando(false));
  }, []);

  return (
    <Layout>
      <h1 className="titulo-pagina">Turmas</h1>
      <div className="card">
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Vagas</th></tr>
              </thead>
              <tbody>
                {turmas.map((t) => (
                  <tr key={t.id}><td>{t.nome}</td><td>{t.vagas || ''}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
