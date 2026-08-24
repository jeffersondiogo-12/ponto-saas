import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';

export default function DispositivosLista() {
  const [dispositivos, setDispositivos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.listarDispositivos().then((r) => {
      setDispositivos(r.dispositivos);
      setCarregando(false);
    });
  }, []);

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h1 className="titulo-pagina" style={{ marginBottom: 0 }}>Dispositivos</h1>
        <Link to="/dispositivos/novo" className="btn btn-brass">+ Novo dispositivo</Link>
      </div>

      <div className="card">
        <div className="eyebrow">Relógios de ponto cadastrados</div>
        <div className="card-corpo">
          {carregando ? (
            <p className="texto-apoio">Carregando...</p>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Modelo</th>
                  <th>IP : Porta</th>
                  <th>Número de série</th>
                  <th>Protocolo</th>
                  <th>Situação</th>
                  <th>Conexão</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {dispositivos.map((d) => (
                  <tr key={d.id}>
                    <td>{d.descricao}</td>
                    <td>{d.modelo}</td>
                    <td className="mono">{d.ip || '—'}:{d.porta}</td>
                    <td className="mono">{d.numero_serie}</td>
                    <td><span className="chip-dado">{d.protocolo === 'desconhecido' ? 'a confirmar' : d.protocolo}</span></td>
                    <td><span className={`badge badge-${d.situacao}`}>{d.situacao === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      {d.conectado_agora !== null && (
                        <span className={`badge badge-${d.conectado_agora ? 'ativo' : 'inativo'}`}>
                          {d.conectado_agora ? 'Conectado' : 'Offline'}
                        </span>
                      )}
                    </td>
                    <td>
                      <Link to={`/dispositivos/${d.id}/editar`} className="btn btn-secundario" style={{ padding: '6px 12px', fontSize: 12.5 }}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
                {dispositivos.length === 0 && (
                  <tr><td colSpan={8} className="texto-apoio">Nenhum dispositivo cadastrado ainda.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
