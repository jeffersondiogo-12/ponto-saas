import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
  ScrollView,
} from 'react-native';
import { api } from '../api';
import { AparecerEm, PressaoAnimada, Pulsar } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';

function formatarDataHora(iso) {
  const data = new Date(iso);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatarData(iso) {
  const data = new Date(iso);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const FUSO_BRASILIA = 'America/Sao_Paulo';

function diaNoFuso(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BRASILIA }).format(new Date(iso));
}

function prepararRegistros(registros) {
  const ordenados = [...(registros || [])].sort((a, b) => {
    const diferenca = new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
    return diferenca || String(a.id || '').localeCompare(String(b.id || ''));
  });
  const quantidadePorDia = new Map();
  const classificados = ordenados.map((registro) => {
    const dia = diaNoFuso(registro.data_hora);
    const indice = quantidadePorDia.get(dia) || 0;
    quantidadePorDia.set(dia, indice + 1);
    return { ...registro, tipoExibicao: indice % 2 === 0 ? 'Chegada' : 'Saída' };
  });
  return classificados.reverse();
}

function iniciais(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || '')
    .join('');
}

const ABAS = [
  { chave: 'frequencia', rotulo: 'Escola' },
  { chave: 'sala', rotulo: 'Sala' },
  { chave: 'notas', rotulo: 'Notas' },
  { chave: 'observacoes', rotulo: 'Obs.' },
  { chave: 'avisos', rotulo: 'Avisos' },
];

export default function AlunoDetalheScreen({ route }) {
  const { alunoId, nome } = route.params;
  const [aba, setAba] = useState('frequencia');
  const [registros, setRegistros] = useState([]);
  const [presencasSala, setPresencasSala] = useState([]);
  const [notas, setNotas] = useState([]);
  const [observacoes, setObservacoes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [offline, setOffline] = useState(false);
  const [atualizandoEvento, setAtualizandoEvento] = useState(false);

  const carregar = useCallback(async () => {
    const [frequencia, sala, notasResposta, observacoesResposta, avisosResposta] = await Promise.all([
      api.frequenciaDoAluno(alunoId),
      api.presencaSalaDoAluno(alunoId),
      api.notasDoAluno(alunoId),
      api.observacoesDoAluno(alunoId),
      api.avisosDoAluno(alunoId),
    ]);
    setRegistros(prepararRegistros(frequencia.registros));
    setPresencasSala(sala.registros);
    setNotas(notasResposta.notas);
    setObservacoes(observacoesResposta.observacoes);
    setAvisos(avisosResposta.avisos);
    setOffline(
      Boolean(
        frequencia._offline ||
          sala._offline ||
          notasResposta._offline ||
          observacoesResposta._offline ||
          avisosResposta._offline
      )
    );
    setCarregando(false);
  }, [alunoId]);

  const recarregarPorEvento = useCallback(async () => {
    if (atualizandoEvento) return;
    setAtualizandoEvento(true);
    try { await carregar(); } finally { setAtualizandoEvento(false); }
  }, [atualizandoEvento, carregar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O professor pode lancar presenca/nota/observacao pra este aluno enquanto
  // a tela esta aberta, e a escola pode publicar um aviso novo - o
  // realtime.js emite esse evento local (ver conectarRealtime em App.js).
  useEffect(() => {
    const assinatura = DeviceEventEmitter.addListener('ponto-saas:atualizado', (mensagem) => {
      if (mensagem?.dados?.alunoId === alunoId || mensagem?.tipo === 'aviso.criado') recarregarPorEvento();
    });
    return () => assinatura.remove();
  }, [alunoId, recarregarPorEvento]);

  const listaPadrao = {
    contentContainerStyle: estilos.lista,
    showsVerticalScrollIndicator: false,
  };

  return (
    <View style={estilos.container}>
      <View style={estilos.cabecalho}>
        <AparecerEm style={estilos.cabecalhoLinha}>
          <View style={estilos.avatar}>
            <Text style={estilos.avatarTexto}>{iniciais(nome)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={estilos.rotuloTopo}>Acompanhamento</Text>
            <Text style={estilos.titulo} numberOfLines={2} ellipsizeMode="tail">{nome}</Text>
          </View>
        </AparecerEm>
      </View>

      {offline ? (
        <Pulsar style={estilos.offlineCaixa}>
          <Text style={estilos.offline}>
            Sem conexão — mostrando os últimos dados salvos no aparelho.
          </Text>
        </Pulsar>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={estilos.seletor}
      >
        {ABAS.map((item, indice) => (
          <AparecerEm key={item.chave} atraso={indice * 55} deslocamento={8}>
            <PressaoAnimada
              style={[estilos.opcao, aba === item.chave && estilos.opcaoAtiva]}
              onPress={() => setAba(item.chave)}
              escala={0.94}
            >
              <Text style={[estilos.opcaoTexto, aba === item.chave && estilos.opcaoTextoAtivo]}>
                {item.rotulo}
              </Text>
            </PressaoAnimada>
          </AparecerEm>
        ))}
      </ScrollView>

      {carregando ? (
        <ActivityIndicator color={cores.azul} style={estilos.carregando} />
      ) : aba === 'frequencia' ? (
        <FlatList
          {...listaPadrao}
          data={registros}
          keyExtractor={(item, indice) => `${item.data_hora}-${indice}`}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhum registro ainda.</Text>}
          renderItem={({ item, index }) => {
            const tipo = item.tipoExibicao;
            return (
              <AparecerEm atraso={index * 45}>
                <View style={estilos.linha}>
                  <View
                    style={[
                      estilos.ponto,
                      tipo === 'Chegada' ? estilos.pontoVerde : estilos.pontoAzul,
                    ]}
                  />
                  <Text style={estilos.tipoTexto}>{tipo}</Text>
                  <Text style={estilos.dataTexto}>{formatarDataHora(item.data_hora)}</Text>
                </View>
              </AparecerEm>
            );
          }}
        />
      ) : aba === 'sala' ? (
        <FlatList
          {...listaPadrao}
          data={presencasSala}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Nenhuma chamada do professor em sala ainda.</Text>
          }
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.linha}>
                <View
                  style={[estilos.ponto, item.presente ? estilos.pontoVerde : estilos.pontoVermelho]}
                />
                <View style={estilos.linhaTexto}>
                  <Text style={estilos.tipoTexto}>
                    {item.presente ? 'Presente em sala' : item.falta_justificada ? 'Falta justificada' : 'Ausente em sala'} · {item.materia || 'Aula legada'} · {item.turma_nome || 'Turma'}
                  </Text>
                  {item.justificativa ? <Text style={estilos.linhaSubtexto}>{item.justificativa}</Text> : null}
                  {item.observacao ? (
                    <Text style={estilos.linhaSubtexto}>{item.observacao}</Text>
                  ) : null}
                </View>
                <Text style={estilos.dataTexto}>{formatarData(item.data)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : aba === 'notas' ? (
        <FlatList
          {...listaPadrao}
          data={notas}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma nota lançada ainda.</Text>}
          renderItem={({ item, index }) => {
            const valor = item.nota != null ? Number(item.nota) : null;
            const bom = valor != null && valor >= 6;
            return (
              <AparecerEm atraso={index * 55}>
                <View style={estilos.cartao}>
                  <View style={estilos.notaTopo}>
                    <Text style={estilos.cartaoTitulo}>{item.disciplina}</Text>
                    <View style={[estilos.notaSelo, bom ? estilos.notaSeloVerde : estilos.notaSeloAlerta]}>
                      <Text style={[estilos.valorNota, bom ? estilos.valorNotaVerde : estilos.valorNotaAlerta]}>
                        {valor != null ? valor.toFixed(1) : '—'}
                      </Text>
                    </View>
                  </View>
                  <Text style={estilos.notaEtapa}>
                    {item.etapa} · {formatarData(item.created_at)}
                  </Text>
                  {item.observacao ? <Text style={estilos.cartaoTexto}>{item.observacao}</Text> : null}
                </View>
              </AparecerEm>
            );
          }}
        />
      ) : aba === 'observacoes' ? (
        <FlatList
          {...listaPadrao}
          data={observacoes}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma observação enviada ainda.</Text>}
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 55}>
              <View style={estilos.cartao}>
                <Text style={estilos.cartaoTitulo}>{item.titulo}</Text>
                <Text style={estilos.cartaoTexto}>{item.texto}</Text>
                <Text style={estilos.cartaoRodape}>
                  {item.autor_nome ? `${item.autor_nome} · ` : ''}
                  {formatarDataHora(item.created_at)}
                </Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : (
        <FlatList
          {...listaPadrao}
          data={avisos}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Nenhum aviso publicado pela escola ainda.</Text>
          }
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 55}>
              <View style={[estilos.cartao, estilos.cartaoAviso]}>
                <Text style={estilos.cartaoTitulo}>{item.titulo}</Text>
                <Text style={estilos.cartaoTexto}>{item.mensagem}</Text>
                <Text style={estilos.cartaoRodape}>{formatarDataHora(item.publicado_em)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { flex: 1, backgroundColor: cores.paper },
  cabecalho: {
    backgroundColor: cores.ink,
    paddingTop: 58,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderBottomLeftRadius: raio.lg,
    borderBottomRightRadius: raio.lg,
  },
  cabecalhoLinha: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  rotuloTopo: { color: cores.claroSuave, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.5 },
  titulo: { fontSize: 21, fontWeight: '800', color: cores.claro, marginTop: 3 },
  offlineCaixa: {
    backgroundColor: cores.surface,
    borderLeftWidth: 3,
    borderLeftColor: cores.inkSoft,
    padding: 11,
    borderRadius: raio.sm,
    marginHorizontal: 20,
    marginTop: 14,
  },
  offline: { color: cores.inkSoft, fontSize: 12.5 },
  carregando: { marginTop: 34 },
  seletor: { paddingHorizontal: 20, paddingVertical: 16, gap: 8 },
  opcao: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: raio.pill,
    backgroundColor: cores.surface,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  opcaoAtiva: { backgroundColor: cores.azul, borderColor: cores.azul },
  opcaoTexto: { color: cores.inkSoft, fontWeight: '700', fontSize: 12.5 },
  opcaoTextoAtivo: { color: cores.claro },
  lista: { paddingHorizontal: 20, paddingBottom: 26 },
  linha: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.surface,
    borderRadius: raio.md,
    padding: 14,
    marginBottom: 9,
    borderWidth: 1,
    borderColor: cores.linha,
    gap: 10,
  },
  linhaTexto: { flex: 1 },
  linhaSubtexto: { color: cores.inkSoft, fontSize: 12.5, marginTop: 3 },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  pontoVerde: { backgroundColor: cores.verde },
  pontoAzul: { backgroundColor: cores.azul },
  pontoVermelho: { backgroundColor: cores.vermelho },
  tipoTexto: { flex: 1, color: cores.ink, fontWeight: '700', fontSize: 14 },
  dataTexto: { color: cores.inkSoft, fontSize: 12.5 },
  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.md,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.linha,
    borderLeftWidth: 4,
    borderLeftColor: cores.azul,
    ...sombra.cartao,
  },
  cartaoAviso: { borderLeftColor: cores.verde },
  cartaoTitulo: { color: cores.ink, fontWeight: '800', fontSize: 15 },
  cartaoTexto: { color: cores.ink, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  cartaoRodape: { color: cores.inkSoft, fontSize: 11.5, marginTop: 9 },
  notaTopo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notaSelo: { borderRadius: raio.pill, paddingHorizontal: 12, paddingVertical: 5 },
  notaSeloVerde: { backgroundColor: cores.verdeSoft },
  notaSeloAlerta: { backgroundColor: cores.vermelhoSoft },
  valorNota: { fontWeight: '800', fontSize: 15 },
  valorNotaVerde: { color: cores.verdeEscuro },
  valorNotaAlerta: { color: cores.vermelho },
  notaEtapa: { color: cores.inkSoft, fontSize: 12.5, marginTop: 5 },
  vazio: { textAlign: 'center', color: cores.inkSoft, marginTop: 40, fontSize: 14 },
});
