import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { Carregando } from '../Ui';

/** Resumo das turmas: espelho da RelatoriosScreen do APK. */
export default function RelatoriosProfessor() {
  const [linhas, setLinhas] = useState([]);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const resposta = await api.professor.resumoProfessor();
      setLinhas(resposta.resumo || []);
      setOffline(Boolean(resposta._offline));
    } catch {
      // Sem rede e sem nada salvo: a lista fica vazia, como no APK.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <main className="app-tela-pilha">
      <header className="app-cabecalho-escuro">
        <p className="app-sinc-rotulo">VISÃO RÁPIDA</p>
        <h1 className="app-sinc-titulo">Resumo das turmas</h1>
        <p className="app-sinc-subtitulo">Alunos, presença facial e aulas atribuídas.</p>
      </header>
      {offline ? <p className="app-offline-caixa" role="status">Sem conexão — mostrando o último resumo salvo.</p> : null}
      <div className="app-lista app-lista-aba">
        {carregando ? <Carregando /> : !linhas.length ? <p className="app-vazio">Nenhuma turma atribuída.</p> : linhas.map((item, indice) => (
          <div key={item.atribuicao_id} className="app-relatorio app-aparecer" style={{ '--app-atraso': `${indice * 55}ms` }}>
            <div className="app-relatorio-topo">
              <span className="app-relatorio-textos">
                <span className="app-relatorio-turma">{item.turma_nome}</span>
                <span className="app-relatorio-materia">{item.materia} · {item.horario}</span>
              </span>
              <span className="app-relatorio-total">{item.total_alunos}</span>
            </div>
            <p className="app-relatorio-linha"><span>Alunos</span><strong>{item.total_alunos}</strong></p>
            <p className="app-relatorio-linha"><span>Com batida facial hoje</span><strong>{item.presentes_facial}</strong></p>
            <p className="app-relatorio-linha"><span>Sem batida facial</span><strong>{item.total_alunos - item.presentes_facial}</strong></p>
          </div>
        ))}
      </div>
    </main>
  );
}
