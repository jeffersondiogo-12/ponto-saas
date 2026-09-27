import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Carregando } from '../Ui';
import { FUSO_BRASILIA } from '../datas';

/** Agenda de aulas: espelho da AgendaScreen do APK. */
const DIAS = { 0: 'Domingo', 1: 'Segunda', 2: 'Terça', 3: 'Quarta', 4: 'Quinta', 5: 'Sexta', 6: 'Sábado' };
const MAPA_DIA = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function ordenarTurmas(turmas) {
  return [...turmas].sort((a, b) => {
    const diaA = [...(Array.isArray(a.dias_semana) ? a.dias_semana : [])].sort()[0] ?? 7;
    const diaB = [...(Array.isArray(b.dias_semana) ? b.dias_semana : [])].sort()[0] ?? 7;
    return diaA - diaB || String(a.hora_inicio).localeCompare(String(b.hora_inicio));
  });
}

export default function AgendaProfessor() {
  const [turmas, setTurmas] = useState([]);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.professor.listarMinhasTurmas();
      setTurmas(ordenarTurmas(resposta.turmas || []));
      setOffline(Boolean(resposta._offline));
    } catch {
      // Sem rede e sem nada salvo: a lista fica vazia, como no APK.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const diaAtual = MAPA_DIA[new Date().toLocaleDateString('en-US', { timeZone: FUSO_BRASILIA, weekday: 'short' })] ?? 0;

  return (
    <main className="app-tela-pilha">
      <header className="app-cabecalho-escuro">
        <p className="app-sinc-rotulo">PLANEJAMENTO</p>
        <h1 className="app-sinc-titulo">Agenda de aulas</h1>
        <p className="app-sinc-subtitulo">Sua semana organizada pelo horário de Brasília.</p>
      </header>
      {offline ? <p className="app-offline-caixa" role="status">Sem conexão — mostrando sua agenda salva.</p> : null}
      <div className="app-lista app-lista-aba">
        {carregando ? <Carregando /> : !turmas.length ? <p className="app-vazio">Nenhuma aula atribuída.</p> : turmas.map((item, indice) => {
          const dias = Array.isArray(item.dias_semana) ? item.dias_semana : [];
          const hoje = dias.includes(diaAtual);
          return (
            <div key={item.atribuicao_id} className={`app-agenda-item app-aparecer${hoje ? ' hoje' : ''}`} style={{ '--app-atraso': `${indice * 55}ms` }}>
              <span className="app-agenda-hora">
                <span className="app-agenda-inicio">{String(item.hora_inicio).slice(0, 5)}</span>
                <span className="app-agenda-fim">{String(item.hora_fim).slice(0, 5)}</span>
              </span>
              <span className="app-agenda-texto">
                <span className="app-agenda-turma">{item.nome}</span>
                <span className="app-agenda-materia">{item.materia}</span>
                <span className="app-agenda-dias">{dias.map((dia) => DIAS[dia] || dia).join(' · ')}</span>
              </span>
              {hoje ? <span className="app-selo app-selo-novo">Hoje</span> : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
