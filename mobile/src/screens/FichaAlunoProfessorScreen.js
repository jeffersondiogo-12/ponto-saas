import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, obterToken, ehFalhaDeRede } from '../api';
import { obterOrigemApi } from '../config/rede';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { cores, raio, sombra } from '../theme';
import { formatarData, formatarDataHora, formatarDataSemHora } from '../datas';
import { prepararRegistros } from '../batidas';

const ABAS = [
  { chave: 'frequencia', rotulo: 'Escola' },
  { chave: 'sala', rotulo: 'Sala' },
  { chave: 'notas', rotulo: 'Notas' },
  { chave: 'observacoes', rotulo: 'Obs.' },
  { chave: 'avisos', rotulo: 'Avisos' },
];

function iniciais(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || '')
    .join('');
}

function alcanceDoAviso(aviso) {
  if (aviso.turma_id) return 'Aviso da turma';
  if (aviso.filial_id) return 'Aviso da escola';
  return 'Aviso da rede';
}

/** Uma linha "rotulo: valor" do cartao de identificacao. Valor ausente nao aparece. */
function Dado({ rotulo, valor }) {
  if (!valor) return null;
  return (
    <View style={estilos.dadoLinha}>
      <Text style={estilos.dadoRotulo}>{rotulo}</Text>
      <Text style={estilos.dadoValor}>{valor}</Text>
    </View>
  );
}

/**
 * Ficha do aluno para o professor (MOB-008).
 *
 * Tela propria, separada da ficha do responsavel: o professor ve so os alunos
 * das turmas que leciona, e so as notas e observacoes que ele mesmo lancou.
 * O backend resolve tudo numa requisicao autorizada pela atribuicao.
 */
export default function FichaAlunoProfessorScreen({ route, navigation }) {
  const { alunoId, turmaId, atribuicaoId, nome: nomeInicial } = route.params || {};
  const insets = useSafeAreaInsets();
  const [aba, setAba] = useState('frequencia');
  const [ficha, setFicha] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [dadosAbertos, setDadosAbertos] = useState(false);
  const [fotoToken, setFotoToken] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api.fichaAlunoProfessor(turmaId, alunoId, atribuicaoId);
      setFicha(resposta);
    } catch (falha) {
      setFicha(null);
      if (ehFalhaDeRede(falha)) {
        setErro('Sem conexão com a escola. A ficha do professor não fica salva no aparelho.');
      } else if (falha?.status === 403) {
        setErro('Você não leciona para este aluno, então a ficha dele não pode ser aberta.');
      } else {
        setErro(falha?.message || 'Não deu para abrir a ficha. Tente de novo.');
      }
    } finally {
      setCarregando(false);
    }
  }, [turmaId, alunoId, atribuicaoId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A foto da batida sai por rota autenticada, entao a Image precisa do token.
  useEffect(() => {
    let ativo = true;
    obterToken()
      .then((token) => { if (ativo) setFotoToken(token); })
      .catch(() => { if (ativo) setFotoToken(null); });
    return () => { ativo = false; };
  }, []);

  const aluno = ficha?.aluno;
  const nome = aluno?.nome || nomeInicial || 'Aluno';
  const registros = prepararRegistros(ficha?.frequencia);
  const fotoRecente = ficha?.foto_facial_recente;
  const idFotoRecente = fotoRecente
    ? ficha.frequencia?.find((registro) => registro.foto_url === fotoRecente.foto_url)?.id
    : null;
  const fonteDaFoto = idFotoRecente && fotoToken
    ? {
        uri: `${obterOrigemApi()}/api/ponto/registros/${idFotoRecente}/foto`,
        headers: { Authorization: `Bearer ${fotoToken}` },
      }
    : null;

  const listaPadrao = {
    style: estilos.listaArea,
    contentContainerStyle: estilos.lista,
    showsVerticalScrollIndicator: false,
  };

  if (carregando) {
    return (
      <View style={[estilos.container, estilos.centro, { paddingTop: insets.top }]}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={[estilos.container, estilos.centro, { paddingTop: insets.top }]}>
        <AparecerEm style={estilos.estado}>
          <Text style={estilos.estadoTitulo}>Não deu para abrir a ficha</Text>
          <Text style={estilos.estadoTexto}>{erro}</Text>
          <PressaoAnimada style={estilos.estadoBotao} onPress={carregar}>
            <Text style={estilos.estadoBotaoTexto}>Tentar de novo</Text>
          </PressaoAnimada>
          <PressaoAnimada onPress={() => navigation.goBack()}>
            <Text style={estilos.estadoVoltar}>Voltar para a chamada</Text>
          </PressaoAnimada>
        </AparecerEm>
      </View>
    );
  }

  return (
    <View style={[estilos.container, { paddingTop: insets.top }]}>
      <View style={estilos.cabecalho}>
        <AparecerEm style={estilos.cabecalhoLinha}>
          {fonteDaFoto ? (
            <Image source={fonteDaFoto} style={estilos.foto} onError={() => setFotoToken(null)} />
          ) : (
            <View style={estilos.avatar}>
              <Text style={estilos.avatarTexto}>{iniciais(nome)}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={estilos.rotuloTopo}>Ficha do aluno</Text>
            <Text style={estilos.titulo} numberOfLines={2} ellipsizeMode="tail">{nome}</Text>
            {aluno?.matricula ? (
              <Text style={estilos.subtitulo}>Mat. {aluno.matricula}</Text>
            ) : null}
            <Text style={estilos.subtitulo}>
              {[aluno?.turma_nome, ficha?.atribuicao?.materia].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </AparecerEm>

        <PressaoAnimada
          style={estilos.expandir}
          onPress={() => setDadosAbertos((aberto) => !aberto)}
          escala={0.97}
          accessibilityRole="button"
          accessibilityState={{ expanded: dadosAbertos }}
        >
          <Text style={estilos.expandirTexto}>
            {dadosAbertos ? 'Esconder dados do aluno' : 'Ver dados do aluno'}
          </Text>
          <Text style={estilos.expandirSeta}>{dadosAbertos ? '⌃' : '⌄'}</Text>
        </PressaoAnimada>

        {dadosAbertos ? (
          <AparecerEm deslocamento={8} style={estilos.dados}>
            <Dado rotulo="Filial" valor={aluno?.filial_nome} />
            <Dado
              rotulo="Nascimento"
              valor={aluno?.data_nascimento ? formatarDataSemHora(aluno.data_nascimento) : null}
            />
            <Dado rotulo="Responsável" valor={aluno?.nome_responsavel} />
            <Dado rotulo="Contato" valor={aluno?.contato_responsavel} />
            <Dado
              rotulo="Última foto"
              valor={fotoRecente?.data_hora ? formatarDataHora(fotoRecente.data_hora) : null}
            />
            {!aluno?.nome_responsavel && !aluno?.contato_responsavel && !aluno?.data_nascimento ? (
              <Text style={estilos.dadoVazio}>A escola não preencheu estes dados.</Text>
            ) : null}
          </AparecerEm>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.seletorBarra}
        contentContainerStyle={estilos.seletor}
      >
        {ABAS.map((item, indice) => (
          <AparecerEm key={item.chave} atraso={indice * 55} deslocamento={8}>
            <PressaoAnimada
              style={[estilos.opcao, aba === item.chave && estilos.opcaoAtiva]}
              onPress={() => setAba(item.chave)}
              escala={0.94}
              accessibilityRole="tab"
              accessibilityState={{ selected: aba === item.chave }}
            >
              <Text style={[estilos.opcaoTexto, aba === item.chave && estilos.opcaoTextoAtivo]}>
                {item.rotulo}
              </Text>
            </PressaoAnimada>
          </AparecerEm>
        ))}
      </ScrollView>

      {aba === 'frequencia' ? (
        <FlatList
          {...listaPadrao}
          data={registros}
          keyExtractor={(item, indice) => `${item.data_hora}-${indice}`}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhuma batida registrada ainda.</Text>}
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.linha}>
                <View
                  style={[
                    estilos.ponto,
                    !item.tipoConfirmado
                      ? estilos.pontoNeutro
                      : item.tipoExibicao === 'Chegada'
                        ? estilos.pontoVerde
                        : estilos.pontoAzul,
                  ]}
                />
                <View style={estilos.linhaTexto}>
                  <Text style={estilos.tipoTexto}>{item.tipoExibicao}</Text>
                  {!item.tipoConfirmado ? (
                    <Text style={estilos.linhaSubtexto}>
                      Sem classificação nesta cópia salva. Reabra a tela para atualizar.
                    </Text>
                  ) : null}
                </View>
                <Text style={estilos.dataTexto}>{formatarDataHora(item.data_hora)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : aba === 'sala' ? (
        <FlatList
          {...listaPadrao}
          data={ficha?.presencas_sala || []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Nenhuma chamada sua para este aluno ainda.</Text>
          }
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.linha}>
                <View
                  style={[estilos.ponto, item.presente ? estilos.pontoVerde : estilos.pontoVermelho]}
                />
                <View style={estilos.linhaTexto}>
                  <Text style={estilos.tipoTexto}>
                    {item.presente
                      ? 'Presente em sala'
                      : item.falta_justificada
                        ? 'Falta justificada'
                        : 'Ausente em sala'}
                    {item.materia ? ' · ' + item.materia : ''}
                  </Text>
                  {item.justificativa ? (
                    <Text style={estilos.linhaSubtexto}>{item.justificativa}</Text>
                  ) : null}
                  {item.observacao ? (
                    <Text style={estilos.linhaSubtexto}>{item.observacao}</Text>
                  ) : null}
                </View>
                <Text style={estilos.dataTexto}>{formatarDataSemHora(item.data)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : aba === 'notas' ? (
        <FlatList
          {...listaPadrao}
          data={ficha?.notas || []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Você ainda não lançou notas para este aluno.</Text>
          }
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.cartao}>
                <View style={estilos.cartaoTopo}>
                  <Text style={estilos.cartaoTitulo}>{item.disciplina || 'Disciplina'}</Text>
                  <Text style={estilos.notaValor}>{item.nota}</Text>
                </View>
                <Text style={estilos.cartaoRodape}>
                  {[
                    item.bimestre ? item.bimestre + 'º bimestre' : item.etapa,
                    item.tipo_avaliacao,
                    item.atividade,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {item.observacao ? (
                  <Text style={estilos.cartaoTexto}>{item.observacao}</Text>
                ) : null}
                <Text style={estilos.cartaoData}>{formatarData(item.created_at)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : aba === 'observacoes' ? (
        <FlatList
          {...listaPadrao}
          data={ficha?.observacoes || []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={estilos.vazio}>Você ainda não registrou observações para este aluno.</Text>
          }
          ListFooterComponent={
            (ficha?.observacoes || []).length >= 5 ? (
              <Text style={estilos.rodapeLista}>
                Mostrando as suas cinco observações mais recentes.
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.cartao}>
                <Text style={estilos.cartaoTitulo}>{item.titulo || 'Observação'}</Text>
                {item.texto ? <Text style={estilos.cartaoTexto}>{item.texto}</Text> : null}
                <Text style={estilos.cartaoData}>{formatarDataHora(item.created_at)}</Text>
              </View>
            </AparecerEm>
          )}
        />
      ) : (
        <FlatList
          {...listaPadrao}
          data={ficha?.avisos || []}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={<Text style={estilos.vazio}>Nenhum aviso publicado.</Text>}
          renderItem={({ item, index }) => (
            <AparecerEm atraso={index * 45}>
              <View style={estilos.cartao}>
                <Text style={estilos.cartaoRotulo}>{alcanceDoAviso(item)}</Text>
                <Text style={estilos.cartaoTitulo}>{item.titulo}</Text>
                {item.mensagem ? <Text style={estilos.cartaoTexto}>{item.mensagem}</Text> : null}
                <Text style={estilos.cartaoData}>{formatarDataHora(item.publicado_em)}</Text>
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
  centro: { alignItems: 'center', justifyContent: 'center', padding: 24 },

  cabecalho: { backgroundColor: cores.ink, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  cabecalhoLinha: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: cores.azulSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTexto: { color: cores.azul, fontWeight: '800', fontSize: 17 },
  foto: { width: 52, height: 52, borderRadius: 26, backgroundColor: cores.azulSoft },
  rotuloTopo: { color: cores.claroSuave, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.6 },
  titulo: { color: cores.claro, fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginTop: 3 },
  subtitulo: { color: cores.claroSuave, fontSize: 12.5, marginTop: 2 },

  expandir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: raio.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  expandirTexto: { color: cores.claro, fontSize: 13, fontWeight: '700' },
  expandirSeta: { color: cores.claroSuave, fontSize: 15, fontWeight: '800' },
  dados: { marginTop: 10, gap: 7 },
  dadoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dadoRotulo: { color: cores.claroSuave, fontSize: 12.5, width: 96 },
  dadoValor: { color: cores.claro, fontSize: 12.5, fontWeight: '600', flex: 1 },
  dadoVazio: { color: cores.claroSuave, fontSize: 12.5, fontStyle: 'italic' },

  // A ScrollView do RN nasce com flexGrow/flexShrink 1, e a FlatList abaixo e
  // outra ScrollView. Com muitos itens as duas disputam altura e a fita de abas
  // encolhe ate cortar os rotulos. A fita nao cresce nem encolhe; a lista fica
  // com o resto e rola por dentro.
  seletorBarra: { flexGrow: 0, flexShrink: 0 },
  listaArea: { flex: 1 },
  seletor: { paddingHorizontal: 16, paddingVertical: 13, gap: 8 },
  opcao: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: raio.pill,
    backgroundColor: cores.surface,
    borderWidth: 1,
    borderColor: cores.linha,
  },
  opcaoAtiva: { backgroundColor: cores.azul, borderColor: cores.azul },
  opcaoTexto: { color: cores.inkSoft, fontSize: 13, fontWeight: '700' },
  opcaoTextoAtivo: { color: cores.claro },

  lista: { paddingHorizontal: 16, paddingBottom: 30 },
  vazio: { textAlign: 'center', color: cores.inkSoft, fontSize: 14, marginTop: 40 },
  rodapeLista: { textAlign: 'center', color: cores.inkSoft, fontSize: 12, marginTop: 12 },

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
  pontoNeutro: { backgroundColor: cores.inkSoft },
  tipoTexto: { color: cores.ink, fontWeight: '700', fontSize: 14 },
  dataTexto: { color: cores.inkSoft, fontSize: 12.5 },

  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.md,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.linha,
    ...sombra.cartao,
  },
  cartaoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cartaoRotulo: {
    color: cores.azul,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 5,
  },
  cartaoTitulo: { color: cores.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  cartaoTexto: { color: cores.inkSoft, fontSize: 13.5, marginTop: 6, lineHeight: 19 },
  cartaoRodape: { color: cores.inkSoft, fontSize: 12.5, marginTop: 5 },
  cartaoData: { color: cores.inkSoft, fontSize: 12, marginTop: 9 },
  notaValor: { color: cores.azul, fontSize: 19, fontWeight: '800' },

  estado: { alignItems: 'center', gap: 10 },
  estadoTitulo: { color: cores.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  estadoTexto: { color: cores.inkSoft, fontSize: 13.5, textAlign: 'center', lineHeight: 19 },
  estadoBotao: {
    backgroundColor: cores.azul,
    borderRadius: raio.sm,
    paddingVertical: 13,
    paddingHorizontal: 26,
    marginTop: 6,
  },
  estadoBotaoTexto: { color: cores.claro, fontWeight: '800' },
  estadoVoltar: { color: cores.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 10 },
});
