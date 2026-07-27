import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import Layout from '../components/Layout';

export default function SelecionarEmpresa() {
  const navigate = useNavigate();
  const { usuario, selecionarEmpresa } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    async function carregarEmpresas() {
      try {
        const resp = await api.listarEmpresas();
        setEmpresas(resp.empresas || []);
      } catch (err) {
        setErro(err.message || 'Não foi possível carregar empresas.');
      } finally {
        setCarregando(false);
      }
    }
    carregarEmpresas();
  }, []);

  function selecionar(id, nome) {
    selecionarEmpresa({ id, nome });
    navigate('/dashboard');
  }

  if (carregando) return <Layout><p className="texto-apoio">Carregando empresas...</p></Layout>;

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 className="titulo-pagina">Selecione a unidade</h1>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="card">
        <div className="eyebrow">Empresas disponíveis</div>
        <div className="card-corpo">
          {empresas.length === 0 ? (
            <p className="texto-apoio">Nenhuma empresa disponível. Crie uma empresa no backend primeiro.</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CNPJ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((empresa) => (
                  <tr key={empresa.id}>
                    <td>{empresa.razao_social}</td>
                    <td className="mono">{empresa.cnpj}</td>
                    <td>
                      <button className="btn btn-primario" type="button" onClick={() => selecionar(empresa.id, empresa.razao_social)}>
                        Entrar nesta unidade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
