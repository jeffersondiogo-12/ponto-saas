import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { cores } from '../theme';

const hoje = new Date().toISOString().slice(0, 10);
const DIAS_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

function formatarDias(diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) return '';
  return diasSemana.map((dia) => DIAS_LABEL[dia] ?? dia).join(' ');
}

function formatarHora(hora) {
  return typeof hora === 'string' ? hora.slice(0, 5) : '';
}

function formatarDataCurta(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

export default function ProfessorScreen() {
  const { logout } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [alunoId, setAlunoId] = useState('');
  const [nota, setNota] = useState('');
  const [observacao, setObservacao] = useState('');
  const [historico, setHistorico] = useState({ notas: [], observacoes: [] });
  const [carregando, setCarregando] = useState(true);
  const [carregandoTurma, setCarregandoTurma] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [offline, setOffline] = useState(false);
  const [pendentes, setPendentes] = useState([]);

  useEffect(() => {
    obterFila().then(setPendentes);
    return ouvirFila(setPendentes);
  }, []);

  // Se o gestor atribuir (ou tirar) uma turma enquanto o professor esta com
  // o app aberto, a lista atualiza sozinha - sem isso so veria reabrindo.
  useEffect(() => {
    const assinatura = DeviceEventEmitter.addListener('ponto-saas:atualizado', (msg) => {
      if (msg?.tipo === 'turma.atribuida') carregarTurmas(turma?.atribuicao_id);
    });
    return () => assinatura.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma?.atribuicao_id]);

  // Sessao expirada (401) -> desloga direto em vez de mostrar um erro que o
  // professor nao vai saber resolver sozinho. Qualquer outro erro (403 "nao
  // atribuido", 404, rede) aparece na faixa vermelha do topo.
  function tratarErro(err) {
    if (err?.status === 401) {
      logout();
      return;
    }
    setErro(err?.message || 'Não foi possível completar a ação.');
  }

  async function carregarTurmas(manterSelecaoId) {
    try {
      const res = await api.listarMinhasTurmas();
      const lista = res.turmas || [];
      setTurmas(lista);
      setErro('');
      setOffline(Boolean(res._offline));
      if (lista.length === 0) {
        setTurma(null);
        setAlunos([]);
        return;
      }
      const alvo = (manterSelecaoId && lista.find((item) => item.atribuicao_id === manterSelecaoId)) || lista[0];
      await selecionarTurma(alvo);
    } catch (err) {
      tratarErro(err);
    }
  }

  useEffect(() => {
    carregarTurmas().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function aoAtualizar() {
    setAtualizando(true);
    await carregarTurmas(turma?.atribuicao_id);
    setAtualizando(false);
  }

  async function selecionarTurma(item) {
    setTurma(item);
    setCarregandoTurma(true);
    setMensagem('');
    try {
      const res = await api.listarAlunosDaTurma(item.turma_id);
      const listaAlunos = res.alunos || [];
      setAlunos(listaAlunos);
      const primeiroAlunoId = listaAlunos[0]?.id || '';
      setAlunoId(primeiroAlunoId);
      setPresencas(Object.fromEntries(listaAlunos.map((aluno) => [aluno.id, true])));
      if (primeiroAlunoId) await carregarHistorico(item.turma_id, primeiroAlunoId);
      else setHistorico({ notas: [], observacoes: [] });
    } catch (err) {
      tratarErro(err);
    } finally {
      setCarregandoTurma(false);
    }
  }

  async function carregarHistorico(turmaId, alunoIdAlvo) {
    try {
      const res = await api.historicoDoAluno(turmaId, alunoIdAlvo);
      setHistorico({ notas: res.notas || [], observacoes: res.observacoes || [] });
    } catch {
      // Historico e so contexto extra - se falhar (ex: backend ainda sem essa
      // rota publicada), a tela principal continua funcionando normalmente.
      setHistorico({ notas: [], observacoes: [] });
    }
  }

  async function selecionarAluno(aluno) {
    setAlunoId(aluno.id);
    await carregarHistorico(turma.turma_id, aluno.id);
  }

  async function salvarPresencas() {
    setEnviando(true);
    try {
      const resultado = await api.registrarPresencasSala(turma.turma_id, {
        data: hoje,
        presencas: alunos.map((aluno) => ({ aluno_id: aluno.id, presente: Boolean(presencas[aluno.id]) })),
      });
      setErro('');
      setMensagem(
        resultado._fila
          ? 'Sem conexão: chamada salva no aparelho e será enviada assim que a internet voltar.'
          : 'Chamada registrada para a turma.'
      );
    } catch (err) {
      tratarErro(err);
    } finally {
      setEnviando(false);
    }
  }

  async function salvarNota() {
    if (!alunoId) return Alert.alert('Nota', 'Selecione o aluno.');
    const valor = Number(String(nota).replace(',', '.'));
    if (!nota || Number.isNaN(valor) || valor < 0 || valor > 10) {
      return Alert.alert('Nota', 'Informe uma nota válida entre 0 e 10.');
    }
    setEnviando(true);
    try {
      const resultado = await api.criarNotaProfessor(turma.turma_id, {
        aluno_id: alunoId,
        disciplina: turma.materia,
        etapa: 'Atual',
        nota: valor,
      });
      setNota('');
      setErro('');
      if (resultado._fila) {
        setMensagem('Sem conexão: nota salva no aparelho e será enviada assim que a internet voltar.');
      } else {
        setMensagem('Nota enviada ao painel do aluno.');
        await carregarHistorico(turma.turma_id, alunoId);
      }
    } catch (err) {
      tratarErro(err);
    } finally {
      setEnviando(false);
    }
  }

  async function salvarObservacao() {
    if (!alunoId || !observacao.trim()) {
      return Alert.alert('Observação', 'Selecione o aluno e escreva a observação.');
    }
    setEnviando(true);
    try {
      const resultado = await api.criarObservacaoProfessor(turma.turma_id, {
        aluno_id: alunoId,
        titulo: `Observação de ${turma.materia}`,
        texto: observacao.trim(),
      });
      setObservacao('');
      setErro('');
      if (resultado._fila) {
        setMensagem('Sem conexão: observação salva no aparelho e será enviada assim que a internet voltar.');
      } else {
        setMensagem('Observação enviada ao responsável.');
        await carregarHistorico(turma.turma_id, alunoId);
      }
    } catch (err) {
      tratarErro(err);
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <View style={estilos.carregando}>
        <ActivityIndicator color={cores.brass} />
      </View>
    );
  }

  const alunoSelecionado = alunos.find((item) => item.id === alunoId);

  return (
    <ScrollView
      style={estilos.container}
      contentContainerStyle={estilos.conteudo}
      refreshControl={<RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.brass} />}
    >
      <View style={estilos.topo}>
        <View>
          <Text style={estilos.titulo}>Área do professor</Text>
          <Text style={estilos.subtitulo}>Chamada e acompanhamento</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={estilos.sair}>Sair</Text>
        </TouchableOpacity>
      </View>

      {offline ? (
        <Text style={estilos.offline}>Sem conexão — mostrando as turmas salvas no aparelho.</Text>
      ) : null}
      {pendentes.length > 0 ? (
        <Text style={estilos.pendente}>
          {pendentes.length === 1
            ? '1 ação aguardando conexão para ser enviada.'
            : `${pendentes.length} ações aguardando conexão para serem enviadas.`}
        </Text>
      ) : null}
      {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
      {mensagem ? <Text style={estilos.sucesso}>{mensagem}</Text> : null}

      {turmas.length === 0 ? (
        <Text style={estilos.vazio}>
          Nenhuma turma foi atribuída pelo gestor ainda.{'\n'}Puxe a tela para baixo para atualizar.
        </Text>
      ) : (
        <>
          <Text style={estilos.rotulo}>Minhas turmas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.turmas}>
            {turmas.map((item) => (
              <TouchableOpacity
                key={item.atribuicao_id}
                style={[estilos.turma, turma?.atribuicao_id === item.atribuicao_id && estilos.turmaAtiva]}
                onPress={() => selecionarTurma(item)}
              >
                <Text style={estilos.turmaNome}>{item.nome}</Text>
                <Text style={estilos.turmaDetalhe}>{item.materia}</Text>
                <Text style={estilos.turmaDetalhe}>
                  {formatarDias(item.dias_semana)} · {formatarHora(item.hora_inicio)}-{formatarHora(item.hora_fim)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {carregandoTurma ? (
            <ActivityIndicator color={cores.brass} style={estilos.carregandoTurma} />
          ) : (
            turma && (
              <>
                <Text style={estilos.secao}>Presença em sala · {hoje}</Text>
                <View style={estilos.card}>
                  {alunos.length === 0 ? (
                    <Text style={estilos.vazio}>Nenhum aluno ativo nesta turma.</Text>
                  ) : (
                    <>
                      {alunos.map((aluno) => (
                        <TouchableOpacity
                          key={aluno.id}
                          style={estilos.alunoLinha}
                          onPress={() => setPresencas({ ...presencas, [aluno.id]: !presencas[aluno.id] })}
                        >
                          <Text style={estilos.alunoNome}>{aluno.nome}</Text>
                          <Text style={presencas[aluno.id] ? estilos.presente : estilos.falta}>
                            {presencas[aluno.id] ? 'Presente' : 'Ausente'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity style={estilos.botao} onPress={salvarPresencas} disabled={enviando}>
                        {enviando ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={estilos.botaoTexto}>Salvar chamada</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {alunos.length > 0 && (
                  <>
                    <Text style={estilos.secao}>Lançar nota ou observação</Text>
                    <View style={estilos.card}>
                      <Text style={estilos.rotulo}>Aluno</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {alunos.map((aluno) => (
                          <TouchableOpacity
                            key={aluno.id}
                            style={[estilos.alunoChip, aluno.id === alunoId && estilos.alunoChipAtivo]}
                            onPress={() => selecionarAluno(aluno)}
                          >
                            <Text style={aluno.id === alunoId ? estilos.alunoChipTextoAtivo : estilos.alunoChipTexto}>
                              {aluno.nome}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {(historico.notas.length > 0 || historico.observacoes.length > 0) && (
                        <View style={estilos.historico}>
                          <Text style={estilos.historicoTitulo}>
                            Já lançado para {alunoSelecionado?.nome} em {turma.materia}
                          </Text>
                          {historico.notas.map((item) => (
                            <Text key={item.id} style={estilos.historicoLinha}>
                              • Nota {Number(item.nota).toFixed(1)} — {item.etapa} ({formatarDataCurta(item.created_at)})
                            </Text>
                          ))}
                          {historico.observacoes.map((item) => (
                            <Text key={item.id} style={estilos.historicoLinha}>
                              • {item.titulo} ({formatarDataCurta(item.created_at)})
                            </Text>
                          ))}
                        </View>
                      )}

                      <TextInput
                        style={estilos.input}
                        placeholder="Nota de 0 a 10"
                        placeholderTextColor={cores.inkSoft}
                        keyboardType="decimal-pad"
                        value={nota}
                        onChangeText={setNota}
                      />
                      <TouchableOpacity style={estilos.botao} onPress={salvarNota} disabled={enviando}>
                        <Text style={estilos.botaoTexto}>Enviar nota</Text>
                      </TouchableOpacity>

                      <TextInput
                        style={[estilos.input, estilos.multilinha]}
                        placeholder="Observação para o responsável"
                        placeholderTextColor={cores.inkSoft}
                        multiline
                        value={observacao}
                        onChangeText={setObservacao}
                      />
                      <TouchableOpacity style={estilos.botaoSecundario} onPress={salvarObservacao} disabled={enviando}>
                        <Text style={estilos.botaoSecundarioTexto}>Enviar observação</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )
          )}
        </>
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper },
  carregandoTurma: { marginTop: 28 },
  container: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingTop: 58, paddingBottom: 40 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: 23, fontWeight: '700', color: cores.ink },
  subtitulo: { color: cores.inkSoft, marginTop: 4 },
  sair: { color: cores.inkSoft, textDecorationLine: 'underline' },
  rotulo: { color: cores.inkSoft, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  turmas: { marginBottom: 12 },
  turma: {
    backgroundColor: cores.surface,
    borderRadius: 10,
    padding: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: cores.linha,
    minWidth: 152,
  },
  turmaAtiva: { borderColor: cores.brass, backgroundColor: cores.brassSoft },
  turmaNome: { fontWeight: '700', color: cores.ink, marginBottom: 4 },
  turmaDetalhe: { color: cores.inkSoft, fontSize: 12.5 },
  secao: { color: cores.ink, fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 8 },
  card: { backgroundColor: cores.surface, borderRadius: 12, padding: 14 },
  alunoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
  alunoNome: { color: cores.ink, flex: 1 },
  presente: { color: cores.sinalVerde, fontWeight: '700' },
  falta: { color: cores.sinalVermelho, fontWeight: '700' },
  alunoChip: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 8,
    padding: 9,
    marginRight: 6,
    marginBottom: 12,
  },
  alunoChipAtivo: { borderColor: cores.brass, backgroundColor: cores.brassSoft },
  alunoChipTexto: { color: cores.ink },
  alunoChipTextoAtivo: { color: cores.ink, fontWeight: '700' },
  historico: { backgroundColor: cores.paper, borderRadius: 9, padding: 10, marginBottom: 12 },
  historicoTitulo: { color: cores.inkSoft, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  historicoLinha: { color: cores.inkSoft, fontSize: 12.5, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: 9,
    padding: 12,
    marginBottom: 10,
    backgroundColor: cores.paper,
    color: cores.ink,
  },
  multilinha: { minHeight: 80, textAlignVertical: 'top' },
  botao: { backgroundColor: cores.ink, padding: 14, borderRadius: 9, alignItems: 'center', marginTop: 4 },
  botaoTexto: { color: '#fff', fontWeight: '700' },
  botaoSecundario: { borderWidth: 1, borderColor: cores.brass, padding: 13, borderRadius: 9, alignItems: 'center' },
  botaoSecundarioTexto: { color: cores.brass, fontWeight: '700' },
  erro: { color: cores.sinalVermelho, marginVertical: 12 },
  sucesso: { color: cores.sinalVerde, marginVertical: 12 },
  offline: {
    color: cores.inkSoft,
    backgroundColor: cores.brassSoft,
    padding: 10,
    borderRadius: 8,
    fontSize: 12.5,
    marginTop: 14,
  },
  pendente: {
    color: cores.brass,
    backgroundColor: cores.brassSoft,
    padding: 10,
    borderRadius: 8,
    fontSize: 12.5,
    marginTop: 8,
    fontWeight: '600',
  },
  vazio: { color: cores.inkSoft, marginTop: 35, textAlign: 'center', lineHeight: 20 },
});
