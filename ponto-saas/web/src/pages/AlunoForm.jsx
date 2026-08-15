import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AlunoForm() {
  const { filialSelecionada, empresaSelecionada, usuario } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cpf, setCpf] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [horarioEntrada, setHorarioEntrada] = useState('');
  const [horarioSaida, setHorarioSaida] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [filiais, setFiliais] = useState([]);
  const [turmas, setTurmas] = useState([]);
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

    async function carregarTurmas() {
      try {
        const res = await api.listarTurmas();
        if (!mounted) return;
        setTurmas((res.turmas || res.lista || []).filter((t) => String(t.empresa_id) === String(empresaSelecionada?.id)));
      } catch (e) {
        // ignore
      }
    }

    carregarFiliais();
    carregarTurmas();
    return () => { mounted = false; };
  }, [empresaSelecionada, filialSelecionada, usuario]);

  async function aoEnviar(e) {
    e.preventDefault();
    setErro(null);

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
      const payload = {
        nome,
        matricula,
        cpf,
        data_nascimento: dataNascimento || null,
        foto_url: fotoUrl || null,
        horario_entrada: horarioEntrada || null,
        horario_saida: horarioSaida || null,
        turma_id: turmaId || null,
        filial_id: usuario?.papel === 'admin' || usuario?.papel === 'super_admin' ? filialId : filialSelecionada.id,
      };
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
            <div className="campo">
              <label>CPF</label>
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} />
            </div>
            <div className="campo">
              <label>Data de nascimento</label>
              <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </div>
            <div className="campo">
              <label>URL da foto</label>
              <input value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="campo">
              <label>Horário de entrada</label>
              <input value={horarioEntrada} onChange={(e) => setHorarioEntrada(e.target.value)} placeholder="07:30" />
            </div>
            <div className="campo">
              <label>Horário de saída</label>
              <input value={horarioSaida} onChange={(e) => setHorarioSaida(e.target.value)} placeholder="12:00" />
            </div>
            <div className="campo">
              <label>Turma</label>
              <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
                <option value="">-- sem turma --</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </div>
            {(usuario?.papel === 'admin' || usuario?.papel === 'super_admin') && (
              <div className="campo">
                <label>Filial (escola)</label>
                <select value={filialId} onChange={(e) => setFilialId(e.target.value)} required>
                  <option value="">-- selecione --</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome || f.cnpj}</option>
                  ))}
                </select>
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
