import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function UnidadesLista() {
  const { usuario, empresaSelecionada, selecionarEmpresa, limparEmpresa } = useAuth();
  const ehSuperAdmin = usuario?.papel === 'super_admin';

  const [empresas, setEmpresas] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Só o super_admin escolhe empresa; os demais ficam presos à sua, pelo token.
  useEffect(() => {
    if (!ehSuperAdmin) return;
    api.listarEmpresas()
      .then((r) => setEmpresas(r.empresas || []))
      .catch(() => setErro('Não foi possível carregar as empresas.'));
  }, [ehSuperAdmin]);

  const carregarUnidades = useCallback(async () => {
    if (!empresaSelecionada) { setUnidades([]); setCarregando(false); return; }
    setCarregando(true);
    try {
      const r = await api.listarUnidades();
      setUnidades(r.filiais || []);
      setErro(null);
    } catch (err) {
      setErro(err.message || 'Não foi possível carregar as unidades.');
      setUnidades([]);
    } finally {
      setCarregando(false);
    }
  }, [empresaSelecionada]);

  useEffect(() => { carregarUnidades(); }, [carregarUnidades]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return unidades.filter((u) => {
      if (tipo && u.tipo !== tipo) return false;
      if (!termo) return true;
      return [u.nome, u.cnpj, u.endereco].filter(Boolean)
        .some((c) => String(c).toLowerCase().includes(termo));
    });
  }, [unidades, busca, tipo]);

  const contagem = useMemo(() => ({
    empresa: unidades.filter((u) => u.tipo === 'empresa').length,
    escola: unidades.filter((u) => u.tipo === 'escola').length,
  }), [unidades]);

  const empresasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empresas;
    return empresas.filter((e) =>
      [e.razao_social, e.nome_fantasia, e.cnpj].filter(Boolean).some((c) => String(c).toLowerCase().includes(termo)));
  }, [empresas, busca]);

  const nomeEmpresa = (e) => e.nome_fantasia || e.razao_social;

  /* Super admin sem empresa escolhida: primeiro escolhe a empresa, depois vê
     as filiais dela. Sem isso a API recusa (X-Empresa-Id e obrigatorio). */
  if (ehSuperAdmin && !empresaSelecionada) {
    return (
      <Layout>
        <h1 className="titulo-pagina">Unidades</h1>
        <p className="subtitulo-pagina">Escolha a empresa para ver as unidades cadastradas nela.</p>

        {erro && <div className="erro">{erro}</div>}

        <div className="filtros">
          <div className="campo" style={{ flex: 1, minWidth: 240 }}>
            <label htmlFor="u-busca">Buscar empresa</label>
            <input id="u-busca" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CNPJ" />
          </div>
        </div>

        <section className="secao">
          <h2>
            Empresas
            <span className="nota">
              {empresasFiltradas.length === 1 ? '1 empresa' : `${empresasFiltradas.length} empresas`}
            </span>
          </h2>
          <div className="atalhos">
            {empresasFiltradas.map((e) => (
              <button
                key={e.id}
                type="button"
                className="atalho"
                style={{ textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
                onClick={() => selecionarEmpresa({ id: e.id, nome: nomeEmpresa(e) })}
              >
                <span className="atalho-titulo">{nomeEmpresa(e)}</span>
                <span className="atalho-desc">{e.cnpj || 'sem CNPJ'}</span>
              </button>
            ))}
          </div>
          {empresasFiltradas.length === 0 && (
            <div className="painel"><div className="painel-corpo">
              <p className="vazio">Nenhuma empresa encontrada.</p>
            </div></div>
          )}
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="barra-acoes">
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0 }}>Unidades</h1>
          <p className="subtitulo-pagina" style={{ margin: '3px 0 0' }}>
            {empresaSelecionada?.nome || 'Empresa atual'}
            {ehSuperAdmin && (
              <>
                {' · '}
                <button
                  type="button"
                  className="link-troca"
                  onClick={limparEmpresa}
                >
                  trocar de empresa
                </button>
              </>
            )}
          </p>
        </div>
        <Link to="/unidades/nova" className="btn btn-azul">+ Nova unidade</Link>
      </div>

      {erro && <div className="erro">{erro}</div>}

      <div className="filtros">
        <div className="campo" style={{ minWidth: 210 }}>
          <label htmlFor="u-tipo">Exibir</label>
          <Selecao
            id="u-tipo"
            rotuloAria="Tipo de unidade"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: '', rotulo: `Todas as unidades (${unidades.length})` },
              { valor: 'empresa', rotulo: `Somente empresa (${contagem.empresa})` },
              { valor: 'escola', rotulo: `Somente escolas (${contagem.escola})` },
            ]}
          />
        </div>
        <div className="campo" style={{ flex: 1, minWidth: 240 }}>
          <label htmlFor="u-filtro">Buscar unidade</label>
          <input id="u-filtro" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CNPJ ou endereço" />
        </div>
      </div>

      <section className="secao">
        <h2>
          {tipo === 'empresa' ? 'Unidades do tipo empresa'
            : tipo === 'escola' ? 'Escolas'
              : 'Unidades da empresa'}
          <span className="nota">
            {filtradas.length === 1 ? '1 unidade' : `${filtradas.length} unidades`}
          </span>
        </h2>

        <div className="painel">
          {carregando ? (
            <div className="painel-corpo"><p className="vazio">Carregando...</p></div>
          ) : (
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>CNPJ</th>
                  <th>Fuso horário</th>
                  <th>Situação</th>
                  <th style={{ width: 1 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>
                      <span className={`badge ${u.tipo === 'escola' ? 'badge-info' : ''}`}>
                        {u.tipo === 'escola' ? 'Escola' : 'Empresa'}
                      </span>
                    </td>
                    <td className="mono">{u.cnpj || '—'}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{u.fuso_horario}</td>
                    <td>
                      <span className={`badge badge-${u.ativo ? 'ativo' : 'inativo'}`}>
                        {u.ativo ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td>
                      <Link to={`/unidades/${u.id}/editar`} className="btn btn-secundario btn-pequeno">Editar</Link>
                    </td>
                  </tr>
                ))}
                {filtradas.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="vazio">
                        {!unidades.length
                          ? 'Nenhuma unidade cadastrada ainda — crie a primeira para escolher entre empresa ou escola.'
                          : tipo === 'escola'
                            ? 'Nenhuma escola cadastrada nesta empresa.'
                            : tipo === 'empresa'
                              ? 'Nenhuma unidade do tipo empresa nesta empresa.'
                              : 'Nenhuma unidade corresponde à busca.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Layout>
  );
}
