import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import Selecao from '../components/Selecao';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AlunoForm() {
  const { filialSelecionada, empresaSelecionada, usuario } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [filialId, setFilialId] = useState('');
  const [filiais, setFiliais] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function carregarFiliais() {
      if (!empresaSelecionada) return;
      try {
        const res = await api.listarUnidades();
        if (!mounted) return;
        const items = res.filiais || res.unidades || [];
        const encontrados = items.filter((f) => String(f.empresa_id) === String(empresaSelecionada.id) && f.ativo && f.tipo === 'escola');
        setFiliais(encontrados);
        if (usuario?.papel !== 'admin' && filialSelecionada) {
          setFilialId(filialSelecionada.id);
        }
      } catch (e) {
        // ignore
      }
    }
    carregarFiliais();
    return () => { mounted = false; };
  }, [empresaSelecionada, filialSelecionada, usuario]);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);

    // Se for admin, permite escolher filial via select
    if (usuario?.papel === 'admin' || usuario?.papel === 'super_admin') {
      if (!filialId) {
        setErro('Selecione a filial (escola) para cadastrar o aluno.');
        return;
      }
    } else {
      if (!filialSelecionada || filialSelecionada.tipo !== 'escola') {
        setErro('Selecione uma filial do tipo escola para cadastrar alunos.');
        return;
      }
    }

    setCarregando(true);
    try {
      const payload = { nome, matricula, filial_id: usuario?.papel === 'admin' || usuario?.papel === 'super_admin' ? filialId : filialSelecionada.id };
      await api.criarAluno(payload);
      navigate('/alunos');
    } catch (err) {
      setErro(err.message || 'Erro ao criar aluno');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Layout>
      <h1 className="titulo-pagina">Cadastrar Aluno</h1>
      <div className="card">
        <div className="card-corpo">
          {erro && <div className="erro">{erro}</div>}
          <form onSubmit={aoEnviar}>
            <div className="campo">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required />
            </div>
            <div className="campo">
              <label>Matrícula</label>
              <input value={matricula} onChange={(e) => setMatricula(e.target.value)} />
            </div>
            {(usuario?.papel === 'admin' || usuario?.papel === 'super_admin') && (
              <div className="campo">
                <label>Filial (escola)</label>
                <Selecao
                  rotuloAria="Filial (escola)"
                  valor={filialId}
                  aoMudar={setFilialId}
                  vazio="Selecione a escola"
                  opcoes={filiais.map((f) => ({ valor: f.id, rotulo: f.nome || f.cnpj }))}
                />
              </div>
            )}
            <button type="submit" className="btn btn-primario" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
