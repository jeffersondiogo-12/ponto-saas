import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useRecarregarAoVivo } from '../../context/RealtimeContext';
import { Aviso, BotaoGrande, CabecalhoHome, Carregando, Cartao, FaixaEstado, Ficha } from '../Ui';
import { useFilaOffline } from '../useFilaOffline';
import { dataHoje, rotuloDoDia, saudacaoDoDia } from '../datas';

/** Inicio do professor: espelho da InicioScreen do APK. */
export default function InicioProfessor({ onSair }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const pendentes = useFilaOffline().length;
  const [turmas, setTurmas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [offline, setOffline] = useState(false);
  const [cacheEm, setCacheEm] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [respostaTurmas, respostaResumo] = await Promise.all([
        api.professor.listarMinhasTurmas(),
        api.professor.resumoProfessor().catch(() => ({ resumo: [] })),
      ]);
      setTurmas(respostaTurmas.turmas || []);
      setResumo(respostaResumo.resumo || []);
      setOffline(Boolean(respostaTurmas._offline));
      setCacheEm(respostaTurmas._offline ? respostaTurmas._cacheEm || null : null);
      setErro('');
    } catch (err) {
      setErro(err?.message || 'Não foi possível carregar seus dados agora.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  // O gestor pode atribuir ou tirar uma turma com o app aberto no Inicio.
  useRecarregarAoVivo(['turma.atribuida'], carregar);

  const presentes = resumo.reduce((total, linha) => total + (Number(linha.presentes_facial) || 0), 0);
  const alunos = resumo.reduce((total, linha) => total + (Number(linha.total_alunos) || 0), 0);
  const primeiroNome = usuario?.nome?.trim().split(/\s+/)[0];

  if (carregando) return <main className="app-tela"><Carregando /></main>;

  return (
    <main className="app-tela">
      <CabecalhoHome
        papel="PROFESSOR"
        titulo={`${saudacaoDoDia()}, ${primeiroNome || 'professor'}`}
        subtitulo={rotuloDoDia(dataHoje())}
        nome={usuario?.nome}
        onSair={onSair}
      />

      <FaixaEstado offlineEm={cacheEm} offline={offline} pendentes={pendentes} onSincronizar={() => navigate('/sincronizar')} />
      <Aviso tipo="erro" texto={erro} />

      <div className="app-fichas">
        <Ficha rotulo="Turmas" valor={turmas.length} onClick={() => navigate('/agenda')} />
        <Ficha rotulo="Presentes hoje" valor={`${presentes}/${alunos}`} atraso={70} destaque onClick={() => navigate('/relatorios')} />
        <Ficha rotulo="Pendências" valor={pendentes} atraso={140} onClick={() => navigate('/sincronizar')} />
      </div>

      <BotaoGrande texto="Fazer chamada" onClick={() => navigate('/chamada')} />

      <div className="app-atalhos">
        <button type="button" className="app-atalho app-pressao" onClick={() => navigate('/notas')}>
          <span className="app-atalho-titulo">Notas</span>
          <span className="app-atalho-texto">Lançar avaliações</span>
        </button>
        <button type="button" className="app-atalho app-pressao" onClick={() => navigate('/observacoes')}>
          <span className="app-atalho-titulo">Observações</span>
          <span className="app-atalho-texto">Recados ao responsável</span>
        </button>
      </div>

      <h2 className="app-secao">Chamada do dia</h2>
      {turmas.length === 0 ? (
        <Cartao><p className="app-vazio-cartao">Nenhuma turma atribuída pelo gestor ainda.</p></Cartao>
      ) : (
        turmas.slice(0, 4).map((item, indice) => {
          const linha = resumo.find((dado) => dado.atribuicao_id === item.atribuicao_id);
          return (
            <button
              key={item.atribuicao_id}
              type="button"
              className="app-linha-turma app-pressao app-aparecer"
              style={{ '--app-atraso': `${indice * 60}ms`, '--app-deslocamento': '10px' }}
              onClick={() => navigate('/chamada')}
            >
              <span className="app-linha-turma-textos">
                <span className="app-linha-turma-nome">{item.nome}</span>
                <span className="app-linha-turma-detalhe">{item.materia}</span>
              </span>
              <span className="app-linha-turma-selo">{linha ? `${linha.presentes_facial}/${linha.total_alunos}` : 'Abrir'}</span>
            </button>
          );
        })
      )}
    </main>
  );
}
