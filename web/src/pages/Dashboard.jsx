import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

export default function Dashboard() {
  const [dispositivos, setDispositivos] = useState([]);
  const [totalFuncionarios, setTotalFuncionarios] = useState(0);
  const [totalNaoResolvidos, setTotalNaoResolvidos] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const [dispResp, funcResp, naoResolvResp] = await Promise.all([
        api.listarDispositivos(),
        api.listarFuncionarios(),
        api.listarRegistrosNaoResolvidos(),
      ]);
      setDispositivos(dispResp.dispositivos);
      setTotalFuncionarios(funcResp.funcionarios.length);
      setTotalNaoResolvidos(naoResolvResp.registros.length);
      setCarregando(false);
    }
    carregar();
  }, []);

  if (carregando) return <Layout><p className="texto-apoio">Carregando...</p></Layout>;

  return (
    <Layout>
      <h1 className="titulo-pagina">Visão geral</h1>

      <div className="metricas">
        <div className="metrica">
          <div className="valor mono">{totalFuncionarios}</div>
          <div className="label">Funcionários ativos</div>
        </div>
        <div className="metrica">
          <div className="valor mono">{dispositivos.length}</div>
          <div className="label">Dispositivos cadastrados</div>
        </div>
        <div className={`metrica ${totalNaoResolvidos > 0 ? 'alerta' : ''}`}>
          <div className="valor mono">{totalNaoResolvidos}</div>
          <div className="label">Batidas sem funcionário/aluno vinculado</div>
        </div>
      </div>

      <div className="card">
        <div className="eyebrow">Dispositivos</div>
        <div className="card-corpo">
          <table className="tabela">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>IP : Porta</th>
                <th>Último NSR</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {dispositivos.map((d) => (
                <tr key={d.id}>
                  <td><Link to={`/dispositivos/${d.id}/editar`}>{d.descricao}</Link></td>
                  <td className="mono">{d.ip}:{d.porta}</td>
                  <td><span className="chip-dado">{d.ultimo_nsr}</span></td>
                  <td>
                    <span className={`badge badge-${d.situacao}`}>{d.situacao === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                  </td>
                </tr>
              ))}
              {dispositivos.length === 0 && (
                <tr><td colSpan={4} className="texto-apoio">Nenhum dispositivo cadastrado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
