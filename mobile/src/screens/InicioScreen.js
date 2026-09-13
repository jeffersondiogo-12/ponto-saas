import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, obterNamespaceCache } from '../api';
import { obterFila, ouvirFila } from '../filaOffline';
import { useAuth } from '../context/AuthContext';
import { AparecerEm, PressaoAnimada } from '../components/Animacoes';
import { Aviso, BotaoGrande, Cabecalho, Cartao, FaixaOffline, FaixaPendente, Ficha } from '../components/Ui';
import { cores, raio, sombra } from '../theme';

const HOJE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function saudacao() {
  const hora = Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(new Date())
  );
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function InicioScreen({ navigation }) {
  const { logout } = useAuth();
  const [turmas, setTurmas] = useState([]);
  const [resumo, setResumo] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [offline, setOffline] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    let parar = () => {};
    obterNamespaceCache().then((namespace) => {
      if (!ativo || !namespace) return;
      obterFila(namespace).then((itens) => {
        if (ativo) setPendentes(itens);
      });
      parar = ouvirFila(namespace, setPendentes);
    });
    return () => {
      ativo = false;
      parar();
    };
  }, []);

  const carregar = useCallback(async () => {
    try {
      const [respostaTurmas, respostaResumo] = await Promise.all([
        api.listarMinhasTurmas(),
        api.resumoProfessor().catch(() => ({ resumo: [] })),
      ]);
      setTurmas(respostaTurmas.turmas || []);
      setResumo(respostaResumo.resumo || []);
      setOffline(Boolean(respostaTurmas._offline));
      setErro('');
    } catch (err) {
      if (err?.status === 401) return logout();
      setErro(err?.message || 'Não foi possível carregar seus dados agora.');
    } finally {
      setCarregando(false);
    }
  }, [logout]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function aoAtualizar() {
    setAtualizando(true);
    await carregar();
    setAtualizando(false);
  }

  const presentes = resumo.reduce((total, linha) => total + (Number(linha.presentes_facial) || 0), 0);
  const alunos = resumo.reduce((total, linha) => total + (Number(linha.total_alunos) || 0), 0);

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.azul} />
      </View>
    );
  }

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={estilos.conteudo}
      refreshControl={
        <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={cores.azul} colors={[cores.azul, cores.verde]} />
      }
    >
      <Cabecalho
        rotulo="PONTE·ESCOLAR"
        titulo={`${saudacao()}, professor`}
        subtitulo={`Seu dia em ${HOJE.split('-').reverse().join('/')}`}
        acao={
          <PressaoAnimada style={estilos.sair} onPress={logout}>
            <Text style={estilos.sairTexto}>Sair</Text>
          </PressaoAnimada>
        }
      />

      <FaixaOffline visivel={offline} texto="Sem conexão — mostrando as turmas salvas no aparelho." />
      <FaixaPendente quantidade={pendentes.length} onPress={() => navigation.navigate('sincronizar')} />
      <Aviso tipo="erro" texto={erro} />

      <View style={estilos.fichas}>
        <Ficha rotulo="Turmas" valor={turmas.length} atraso={0} onPress={() => navigation.navigate('agenda')} />
        <Ficha rotulo="Presentes hoje" valor={`${presentes}/${alunos}`} atraso={70} destaque onPress={() => navigation.navigate('relatorios')} />
        <Ficha rotulo="Pendências" valor={pendentes.length} atraso={140} onPress={() => navigation.navigate('sincronizar')} />
      </View>

      <BotaoGrande texto="Fazer chamada" onPress={() => navigation.navigate('chamada')} />

      <View style={estilos.atalhos}>
        <PressaoAnimada style={estilos.atalho} onPress={() => navigation.navigate('Notas')} escala={0.97}>
          <Text style={estilos.atalhoTitulo}>Notas</Text>
          <Text style={estilos.atalhoTexto}>Lançar avaliações</Text>
        </PressaoAnimada>
        <PressaoAnimada style={estilos.atalho} onPress={() => navigation.navigate('Observacoes')} escala={0.97}>
          <Text style={estilos.atalhoTitulo}>Observações</Text>
          <Text style={estilos.atalhoTexto}>Recados ao responsável</Text>
        </PressaoAnimada>
      </View>

      <Text style={estilos.secao}>Chamada do dia</Text>
      {turmas.length === 0 ? (
        <Cartao>
          <Text style={estilos.vazio}>Nenhuma turma atribuída pelo gestor ainda.</Text>
        </Cartao>
      ) : (
        turmas.slice(0, 4).map((item, indice) => {
          const linha = resumo.find((dado) => dado.atribuicao_id === item.atribuicao_id);
          return (
            <AparecerEm key={item.atribuicao_id} atraso={indice * 60} deslocamento={10}>
              <PressaoAnimada style={estilos.linhaTurma} onPress={() => navigation.navigate('chamada')} escala={0.98}>
                <View style={estilos.linhaTextos}>
                  <Text style={estilos.linhaNome}>{item.nome}</Text>
                  <Text style={estilos.linhaDetalhe}>{item.materia}</Text>
                </View>
                <View style={estilos.selo}>
                  <Text style={estilos.seloTexto}>
                    {linha ? `${linha.presentes_facial}/${linha.total_alunos}` : 'Abrir'}
                  </Text>
                </View>
              </PressaoAnimada>
            </AparecerEm>
          );
        })
      )}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingBottom: 32, gap: 14 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.paper },
  sair: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: raio.md ?? 12,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surfaceAlt,
  },
  sairTexto: { color: cores.inkSoft, fontWeight: '700', fontSize: 12 },
  fichas: { flexDirection: 'row', gap: 10 },
  atalhos: { flexDirection: 'row', gap: 10 },
  atalho: {
    flex: 1,
    padding: 14,
    borderRadius: raio.lg ?? 16,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surface ?? cores.surfaceAlt,
    ...(sombra?.leve || {}),
  },
  atalhoTitulo: { fontWeight: '800', color: cores.ink ?? '#101828' },
  atalhoTexto: { fontSize: 11, color: cores.inkSoft, marginTop: 2 },
  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginTop: 6 },
  linhaTurma: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: raio.lg ?? 16,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surface ?? cores.surfaceAlt,
    marginBottom: 10,
  },
  linhaTextos: { flex: 1 },
  linhaNome: { fontWeight: '800', color: cores.ink ?? '#101828' },
  linhaDetalhe: { fontSize: 12, color: cores.inkSoft, marginTop: 2 },
  selo: { backgroundColor: cores.azulSoft, borderRadius: raio.md ?? 12, paddingHorizontal: 10, paddingVertical: 6 },
  seloTexto: { color: cores.azul, fontWeight: '800', fontSize: 12 },
  vazio: { color: cores.inkSoft, textAlign: 'center' },
});
