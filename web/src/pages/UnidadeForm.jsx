import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';

const PADRAO = { tipo: 'empresa', nome: '', cnpj: '', fuso_horario: 'America/Sao_Paulo', endereco: '', ativo: true };

export default function UnidadeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dados, setDados] = useState(PADRAO);

  useEffect(() => {
    if (!id) return;
    api.buscarUnidade(id).then((r) => setDados({ ...PADRAO, ...r.filial }));
  }, [id]);

  function set(campo, valor) {
    setDados((d) => ({ ...d, [campo]: valor }));
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (id) await api.atualizarUnidade(id, dados);
      else await api.criarUnidade(dados);
      navigate('/unidades');
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Layout>
      <Link to="/unidades" className="link-topo">&larr; Unidades</Link>
      <h1 className="titulo-pagina">{id ? dados.nome : 'Nova unidade'}</h1>

      <form onSubmit={salvar}>
        <div className="card">
          <div className="eyebrow">Tipo de unidade</div>
          <div className="card-corpo">
            <p className="texto-apoio" style={{ marginTop: 0 }}>
              Define quais telas e funcionalidades esta unidade usa daqui pra frente — <strong>empresa</strong> libera
              funcionários e banco de horas; <strong>escola</strong> libera turmas e alunos.
              {id && ' Não é possível trocar o tipo depois de criada, para não misturar cadastros de naturezas diferentes.'}
            </p>
            <div className="grid-form">
              <div className="campo">
                <label>Tipo</label>
                <Selecao
                  rotuloAria="Tipo de unidade"
                  valor={dados.tipo}
                  aoMudar={(v) => set('tipo', v)}
                  desabilitado={Boolean(id)}
                  opcoes={[
                    { valor: 'empresa', rotulo: 'Empresa' },
                    { valor: 'escola', rotulo: 'Escola' },
                  ]}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="eyebrow">Dados da unidade</div>
          <div className="card-corpo">
            <div className="grid-form">
              <div className="campo">
                <label>Nome</label>
                <input value={dados.nome} onChange={(e) => set('nome', e.target.value)} placeholder="ex: Unidade Centro" required />
              </div>
              <div className="campo">
                <label>CNPJ (opcional)</label>
                <input
                  className="mono"
                  value={dados.cnpj || ''}
                  onChange={(e) => set('cnpj', e.target.value)}
                  maxLength={18}
                />
              </div>
              <div className="campo">
                <label>Fuso horário</label>
                <input value={dados.fuso_horario} onChange={(e) => set('fuso_horario', e.target.value)} />
              </div>
              <div className="campo">
                <label>Endereço</label>
                <input value={dados.endereco || ''} onChange={(e) => set('endereco', e.target.value)} />
              </div>
              {id && (
                <div className="campo">
                  <label>Situação</label>
                  <Selecao
                    rotuloAria="Situação"
                    valor={dados.ativo ? 'ativa' : 'inativa'}
                    aoMudar={(v) => set('ativo', v === 'ativa')}
                    opcoes={[
                      { valor: 'ativa', rotulo: 'Ativa' },
                      { valor: 'inativa', rotulo: 'Inativa' },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="acoes-form">
          <Link to="/unidades" className="btn btn-secundario">Cancelar</Link>
          <button type="submit" className="btn btn-primario">Salvar</button>
        </div>
      </form>
    </Layout>
  );
}
