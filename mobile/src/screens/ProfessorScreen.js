import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const DIAS_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

function formatarDias(diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) return '';
  return diasSemana.map((dia) => DIAS_LABEL[dia] ?? dia).join(' ');
}

function formatarHora(hora) {
  return typeof hora === 'string' ? hora.slice(0, 5) : '';
}

function resumoHorarioTurma(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) return 'Sem horario de entrada configurado';
  return horarios.map((horario) => `${DIAS_LABEL[horario.dia_semana] || horario.dia_semana} ${formatarHora(horario.hora_entrada)}-${formatarHora(horario.hora_saida)}`).join(' · ');
}

function formatarDataCurta(iso) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

/** Chave de presenca com transicao suave entre verde (presente) e cinza (ausente). */
function LinhaAluno({ aluno, presente, faltaJustificada, justificativa, onToggle, onJustificativa, atraso }) {
  const valor = useRef(new Animated.Value(presente ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(valor, { toValue: presente ? 1 : 0, duration: 220, useNativeDriver: false }).start();
  }, [presente, valor]);

  return (
    <AparecerEm atraso={atraso} deslocamento={8}>
      <PressaoAnimada style={estilos.alunoLinha} onPress={onToggle} escala={0.985}>
        <Text style={estilos.alunoNome}>{aluno.nome}</Text>
        <Text style={estilos.turmaDetalhe}>{aluno.presenca_facial ? 'Chegou ao colegio' : 'Sem registro de entrada'}</Text>
        <Animated.View
          style={[
            estilos.chave,
            {
              backgroundColor: valor.interpolate({
                inputRange: [0, 1],
                outputRange: [cores.paper, cores.verdeSoft],
              }),
              borderColor: valor.interpolate({
                inputRange: [0, 1],
                outputRange: [cores.linha, cores.verde],
              }),
            },
          ]}
        >
          <Text style={presente ? estilos.presente : estilos.falta}>
            {presente ? 'Presente em sala' : faltaJustificada ? 'Falta justificada' : 'Ausente em sala'}
          </Text>
        </Animated.View>
      </PressaoAnimada>
      {faltaJustificada ? (
        <TextInput
          style={estilos.justificativa}
          placeholder="Motivo da falta justificada"
          placeholderTextColor={cores.inkSoft}
          value={justificativa}
          onChangeText={onJustificativa}
        />
      ) : null}
    </AparecerEm>
  );
}

export default function ProfessorScreen() {
  const { logout } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [turma, setTurma] = useState(null);
  const [alunos, setAlunos] = useState([]);
  const [presencas, setPresencas] = useState({});
  const [faltasJustificadas, setFaltasJustificadas] = useState({});
  const [justificativas, setJustificativas] = useState({});
  const [alunoId, setAlunoId] = useState('');
  const [nota, setNota] = useState('');
  const [bimestre, setBimestre] = useState('1');
  const [tipoAvaliacao, setTipoAvaliacao] = useState('atividade');
  const [atividade, setAtividade] = useState('');
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
  // professor nao vai saber resolver sozinho.
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
      const alvo =
        (manterSelecaoId && lista.find((item) => item.atribuicao_id === manterSelecaoId)) || lista[0];
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
      setPresencas(Object.fromEntries(listaAlunos.map((aluno) => [aluno.id, Boolean(aluno.presenca_facial)])));
      setFaltasJustificadas({});
      setJustificativas({});
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
      // Historico e so contexto extra - se falhar, a tela continua funcionando.
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
        presencas: alunos.map((aluno) => ({
          aluno_id: aluno.id,
          presente: Boolean(presencas[aluno.id]),
          falta_justificada: Boolean(faltasJustificadas[aluno.id]),
          justificativa: justificativas[aluno.id] || '',
        })),
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

  function alternarPresenca(aluno) {
    const atualPresente = Boolean(presencas[aluno.id]);
    const atualJustificada = Boolean(faltasJustificadas[aluno.id]);
    if (atualPresente) {
      setPresencas({ ...presencas, [aluno.id]: false });
    } else if (!atualJustificada) {
      setFaltasJustificadas({ ...faltasJustificadas, [aluno.id]: true });
    } else {
      setPresencas({ ...presencas, [aluno.id]: true });
      setFaltasJustificadas({ ...faltasJustificadas, [aluno.id]: false });
    }
  }

  async function salvarNota() {
    if (!alunoId) return Alert.alert('Nota', 'Selecione o aluno.');
    const valor = Number(String(nota).replace(',', '.'));
    if (!nota || Number.isNaN(valor) || valor < 0 || valor > 10 || !atividade.trim()) {
      return Alert.alert('Nota', 'Informe bimestre, atividade e uma nota válida entre 0 e 10.');
    }
    setEnviando(true);
    try {
      const resultado = await api.criarNotaProfessor(turma.turma_id, {
        aluno_id: alunoId,
        disciplina: turma.materia,
        bimestre: Number(bimestre),
        tipo_avaliacao: tipoAvaliacao,
        atividade: atividade.trim(),
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
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  const alunoSelecionado = alunos.find((item) => item.id === alunoId);
  const totalPresentes = alunos.filter((aluno) => presencas[aluno.id]).length;

  return (
    <ScrollView
      style={estilos.container}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={aoAtualizar}
          tintColor={cores.azul}
          colors={[cores.azul, cores.verde]}
        />
      }
    >
      <AparecerEm style={estilos.topo}>
        <View>
          <Text style={estilos.rotuloTopo}>Ponte·Escolar</Text>
          <Text style={estilos.titulo}>Área do professor</Text>
          <Text style={estilos.subtitulo}>Chamada e acompanhamento</Text>
        </View>
        <PressaoAnimada style={estilos.botaoSair} onPress={logout}>
          <Text style={estilos.sair}>Sair</Text>
        </PressaoAnimada>
      </AparecerEm>

      {offline ? (
        <Pulsar style={estilos.faixaOffline}>
          <Text style={estilos.faixaOfflineTexto}>
            Sem conexão — mostrando as turmas salvas no aparelho.
          </Text>
        </Pulsar>
      ) : null}
      {pendentes.length > 0 ? (
        <Pulsar style={estilos.faixaPendente}>
          <Text style={estilos.faixaPendenteTexto}>
            {pendentes.length === 1
              ? '1 ação aguardando conexão para ser enviada.'
              : `${pendentes.length} ações aguardando conexão para serem enviadas.`}
          </Text>
        </Pulsar>
      ) : null}
      {erro ? (
        <AparecerEm style={estilos.faixaErro} deslocamento={8}>
          <Text style={estilos.faixaErroTexto}>{erro}</Text>
        </AparecerEm>
      ) : null}
      {mensagem ? (
        <AparecerEm style={estilos.faixaSucesso} deslocamento={8}>
          <Text style={estilos.faixaSucessoTexto}>{mensagem}</Text>
        </AparecerEm>
      ) : null}

      {turmas.length === 0 ? (
        <AparecerEm>
          <Text style={estilos.vazio}>
            Nenhuma turma foi atribuída pelo gestor ainda.{'\n'}Puxe a tela para baixo para atualizar.
          </Text>
        </AparecerEm>
      ) : (
        <>
          <Text style={estilos.rotulo}>Minhas turmas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.turmas}>
            {turmas.map((item, indice) => {
              const ativa = turma?.atribuicao_id === item.atribuicao_id;
              return (
                <AparecerEm key={item.atribuicao_id} atraso={indice * 60} deslocamento={10}>
                  <PressaoAnimada
                    style={[estilos.turma, ativa && estilos.turmaAtiva]}
                    onPress={() => selecionarTurma(item)}
                  >
                    <Text style={[estilos.turmaNome, ativa && estilos.turmaNomeAtiva]}>{item.nome}</Text>
                    <Text style={[estilos.turmaDetalhe, ativa && estilos.turmaDetalheAtiva]}>
                      {item.materia}
                    </Text>
                    <Text style={[estilos.turmaDetalhe, ativa && estilos.turmaDetalheAtiva]}>
                      {formatarDias(item.dias_semana)} · {formatarHora(item.hora_inicio)}-
                      {formatarHora(item.hora_fim)}
                    </Text>
                    <Text style={[estilos.turmaDetalhe, ativa && estilos.turmaDetalheAtiva]}>
                      Colegio: {resumoHorarioTurma(item.horarios_turma)}
                    </Text>
                  </PressaoAnimada>
                </AparecerEm>
              );
            })}
          </ScrollView>

          {carregandoTurma ? (
            <ActivityIndicator color={cores.azul} style={estilos.carregandoTurma} />
          ) : (
            turma && (
              <>
                <View style={estilos.secaoLinha}>
                  <Text style={estilos.secao}>Presença em sala</Text>
                  <View style={estilos.selo}>
                    <Text style={estilos.seloTexto}>{hoje}</Text>
                  </View>
                </View>
                <AparecerEm style={estilos.card}>
                  {alunos.length === 0 ? (
                    <Text style={estilos.vazio}>Nenhum aluno ativo nesta turma.</Text>
                  ) : (
                    <>
                      <View style={estilos.resumo}>
                        <Text style={estilos.resumoTexto}>
                          {totalPresentes} de {alunos.length} presentes
                        </Text>
                        <View style={estilos.barraFundo}>
                          <View
                            style={[
                              estilos.barraProgresso,
                              { width: `${alunos.length ? (totalPresentes / alunos.length) * 100 : 0}%` },
                            ]}
                          />
                        </View>
                      </View>

                      {alunos.map((aluno, indice) => (
                        <LinhaAluno
                          key={aluno.id}
                          aluno={aluno}
                          atraso={indice * 45}
                          presente={Boolean(presencas[aluno.id])}
                          faltaJustificada={Boolean(faltasJustificadas[aluno.id])}
                          justificativa={justificativas[aluno.id] || ''}
                          onToggle={() => alternarPresenca(aluno)}
                          onJustificativa={(valor) => setJustificativas({ ...justificativas, [aluno.id]: valor })}
                        />
                      ))}

                      <PressaoAnimada style={estilos.botao} onPress={salvarPresencas} disabled={enviando}>
                        {enviando ? (
                          <ActivityIndicator color={cores.claro} />
                        ) : (
                          <Text style={estilos.botaoTexto}>Salvar chamada</Text>
                        )}
                      </PressaoAnimada>
                    </>
                  )}
                </AparecerEm>

                {alunos.length > 0 && (
                  <>
                    <Text style={estilos.secao}>Lançar nota ou observação</Text>
                    <AparecerEm style={estilos.card}>
                      <Text style={estilos.rotulo}>Aluno</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {alunos.map((aluno) => {
                          const ativo = aluno.id === alunoId;
                          return (
                            <PressaoAnimada
                              key={aluno.id}
                              style={[estilos.alunoChip, ativo && estilos.alunoChipAtivo]}
                              onPress={() => selecionarAluno(aluno)}
                              escala={0.94}
                            >
                              <Text style={ativo ? estilos.alunoChipTextoAtivo : estilos.alunoChipTexto}>
                                {aluno.nome}
                              </Text>
                            </PressaoAnimada>
                          );
                        })}
                      </ScrollView>

                      {(historico.notas.length > 0 || historico.observacoes.length > 0) && (
                        <AparecerEm style={estilos.historico} deslocamento={8}>
                          <Text style={estilos.historicoTitulo}>
                            Já lançado para {alunoSelecionado?.nome} em {turma.materia}
                          </Text>
                          {historico.notas.map((item) => (
                            <Text key={item.id} style={estilos.historicoLinha}>
                              • Nota {Number(item.nota).toFixed(1)} — {item.etapa} (
                              {formatarDataCurta(item.created_at)})
                            </Text>
                          ))}
                          {historico.observacoes.map((item) => (
                            <Text key={item.id} style={estilos.historicoLinha}>
                              • {item.titulo} ({formatarDataCurta(item.created_at)})
                            </Text>
                          ))}
                        </AparecerEm>
                      )}

                      <TextInput
                        style={estilos.input}
                        placeholder="Bimestre (1 a 4)"
                        placeholderTextColor={cores.inkSoft}
                        keyboardType="number-pad"
                        value={bimestre}
                        onChangeText={setBimestre}
                      />
                      <TextInput
                        style={estilos.input}
                        placeholder="Tipo: atividade, prova ou média"
                        placeholderTextColor={cores.inkSoft}
                        value={tipoAvaliacao}
                        onChangeText={setTipoAvaliacao}
                      />
                      <TextInput
                        style={estilos.input}
                        placeholder="Nome da atividade"
                        placeholderTextColor={cores.inkSoft}
                        value={atividade}
                        onChangeText={setAtividade}
                      />
                      <TextInput
                        style={estilos.input}
                        placeholder="Nota de 0 a 10"
                        placeholderTextColor={cores.inkSoft}
                        keyboardType="decimal-pad"
                        value={nota}
                        onChangeText={setNota}
                      />
                      <PressaoAnimada style={estilos.botao} onPress={salvarNota} disabled={enviando}>
                        <Text style={estilos.botaoTexto}>Enviar nota</Text>
                      </PressaoAnimada>

                      <TextInput
                        style={[estilos.input, estilos.multilinha]}
                        placeholder="Observação para o responsável"
                        placeholderTextColor={cores.inkSoft}
                        multiline
                        value={observacao}
                        onChangeText={setObservacao}
                      />
                      <PressaoAnimada
                        style={estilos.botaoSecundario}
                        onPress={salvarObservacao}
                        disabled={enviando}
                      >
                        <Text style={estilos.botaoSecundarioTexto}>Enviar observação</Text>
                      </PressaoAnimada>
                    </AparecerEm>
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
  conteudo: { padding: 20, paddingTop: 58, paddingBottom: 44 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rotuloTopo: { color: cores.azul, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 },
  titulo: { fontSize: 25, fontWeight: '800', color: cores.ink, marginTop: 4, letterSpacing: -0.5 },
  subtitulo: { color: cores.inkSoft, marginTop: 4, fontSize: 13.5 },
  botaoSair: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: raio.pill, backgroundColor: cores.surface, borderWidth: 1, borderColor: cores.linha },
  sair: { color: cores.inkSoft, fontWeight: '700', fontSize: 12.5 },
  rotulo: { color: cores.inkSoft, fontSize: 12.5, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  turmas: { marginBottom: 6 },
  turma: {
    backgroundColor: cores.surface,
    borderRadius: raio.md,
    padding: 14,
    marginRight: 9,
    borderWidth: 1,
    borderColor: cores.linha,
    minWidth: 158,
    ...sombra.cartao,
  },
  turmaAtiva: { backgroundColor: cores.azul, borderColor: cores.azul },
  turmaNome: { fontWeight: '800', color: cores.ink, marginBottom: 4 },
  turmaNomeAtiva: { color: cores.claro },
  turmaDetalhe: { color: cores.inkSoft, fontSize: 12.5 },
  turmaDetalheAtiva: { color: cores.claroSuave },
  secaoLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 10 },
  secao: { color: cores.ink, fontSize: 17, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  selo: { backgroundColor: cores.verdeSoft, borderRadius: raio.pill, paddingHorizontal: 11, paddingVertical: 5, marginTop: 20, marginBottom: 10 },
  seloTexto: { color: cores.verdeEscuro, fontSize: 11.5, fontWeight: '800' },
  card: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: cores.linha,
    ...sombra.cartao,
  },
  resumo: { marginBottom: 12 },
  resumoTexto: { color: cores.inkSoft, fontSize: 12.5, fontWeight: '700', marginBottom: 7 },
  barraFundo: { height: 6, borderRadius: raio.pill, backgroundColor: cores.paper, overflow: 'hidden' },
  barraProgresso: { height: 6, borderRadius: raio.pill, backgroundColor: cores.verde },
  alunoLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: cores.linha,
  },
  alunoBloqueado: { opacity: 0.62 },
  alunoNome: { color: cores.ink, flex: 1, fontSize: 14.5 },
  chave: { borderRadius: raio.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  presente: { color: cores.verdeEscuro, fontWeight: '800', fontSize: 12.5 },
  falta: { color: cores.inkSoft, fontWeight: '800', fontSize: 12.5 },
  alunoChip: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 7,
    marginBottom: 12,
    backgroundColor: cores.surfaceAlt,
  },
  alunoChipAtivo: { borderColor: cores.verde, backgroundColor: cores.verdeSoft },
  alunoChipTexto: { color: cores.inkSoft, fontSize: 13 },
  alunoChipTextoAtivo: { color: cores.verdeEscuro, fontWeight: '800', fontSize: 13 },
  historico: { backgroundColor: cores.surfaceAlt, borderRadius: raio.sm, padding: 12, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: cores.azul },
  historicoTitulo: { color: cores.ink, fontSize: 12, fontWeight: '800', marginBottom: 5 },
  historicoLinha: { color: cores.inkSoft, fontSize: 12.5, marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: cores.linha,
    borderRadius: raio.sm,
    padding: 13,
    marginBottom: 10,
    backgroundColor: cores.surfaceAlt,
    color: cores.ink,
    fontSize: 14.5,
  },
  multilinha: { minHeight: 84, textAlignVertical: 'top' },
  justificativa: {
    borderWidth: 1,
    borderColor: cores.verde,
    borderRadius: raio.sm,
    padding: 11,
    marginTop: 6,
    marginBottom: 4,
    backgroundColor: cores.verdeSoft,
    color: cores.ink,
    fontSize: 13.5,
  },
  botao: {
    backgroundColor: cores.azul,
    paddingVertical: 15,
    borderRadius: raio.sm,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
    ...sombra.destaque,
  },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 14.5 },
  botaoSecundario: {
    borderWidth: 1.5,
    borderColor: cores.verde,
    paddingVertical: 14,
    borderRadius: raio.sm,
    alignItems: 'center',
    backgroundColor: cores.verdeSoft,
  },
  botaoSecundarioTexto: { color: cores.verdeEscuro, fontWeight: '800', fontSize: 14.5 },
  faixaOffline: {
    backgroundColor: cores.surface,
    borderLeftWidth: 3,
    borderLeftColor: cores.inkSoft,
    padding: 12,
    borderRadius: raio.sm,
    marginTop: 16,
  },
  faixaOfflineTexto: { color: cores.inkSoft, fontSize: 12.5 },
  faixaPendente: {
    backgroundColor: cores.azulSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.azul,
    padding: 12,
    borderRadius: raio.sm,
    marginTop: 10,
  },
  faixaPendenteTexto: { color: cores.azulEscuro, fontSize: 12.5, fontWeight: '700' },
  faixaErro: {
    backgroundColor: cores.vermelhoSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
    padding: 12,
    borderRadius: raio.sm,
    marginTop: 12,
  },
  faixaErroTexto: { color: cores.vermelho, fontSize: 13, fontWeight: '600' },
  faixaSucesso: {
    backgroundColor: cores.verdeSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.verde,
    padding: 12,
    borderRadius: raio.sm,
    marginTop: 12,
  },
  faixaSucessoTexto: { color: cores.verdeEscuro, fontSize: 13, fontWeight: '700' },
  vazio: { color: cores.inkSoft, marginTop: 34, textAlign: 'center', lineHeight: 20 },
});
