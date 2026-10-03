import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, obterNamespaceCache } from '../api';
import { AparecerEm } from '../components/Animacoes';
import { Aviso } from '../components/Ui';
import { formatarDataHora } from '../datas';
import { avisosLidos, ehLido, marcarAvisoLido, ROTULOS_ALCANCE } from '../novidades';
import { cores, raio } from '../theme';

/**
 * Um aviso, inteiro (#57). A leitura e confirmada quando o FIM do texto aparece
 * na tela (decisao do Samuel, 2026-09-27):
 * - aviso longo: ao rolar ate o fim;
 * - aviso curto, que ja cabe inteiro: depois de 2 s com o fim a vista, para
 *   nao contar quem abriu e voltou na hora.
 * Rolar ate o fim nao prova leitura - e um sinal mais forte que so abrir.
 * Com leitor de tela funciona igual: ele rola o texto enquanto le.
 *
 * Sem internet, a confirmacao vai para a fila e sobe depois. Espelho da
 * AvisoTela do PWA.
 */
const ESPERA_AVISO_CURTO_MS = 2000;

export default function AvisoScreen({ route }) {
  const { alunoId, avisoId } = route.params;
  const insets = useSafeAreaInsets();
  const [aviso, setAviso] = useState(route.params.aviso || null);
  const [erro, setErro] = useState('');
  // null enquanto o "lido" gravado no aparelho nao foi lido: nada e confirmado antes.
  const [lido, setLido] = useState(route.params.aviso?.lido_em ? true : null);
  const [alturas, setAlturas] = useState({ visivel: 0, conteudo: 0 });
  const confirmadoRef = useRef(false);

  // Aberto sem o aviso em maos (so com o id): busca na lista do filho.
  useEffect(() => {
    if (aviso) return;
    api.avisosDoAluno(alunoId)
      .then((resposta) => {
        const achado = (resposta?.avisos || []).find((item) => item.id === avisoId);
        if (achado) setAviso(achado);
        else setErro('Este aviso não está mais disponível.');
      })
      .catch((err) => setErro(err?.message || 'Não foi possível abrir o aviso. Volte e tente de novo.'));
  }, [aviso, alunoId, avisoId]);

  useEffect(() => {
    if (!aviso || lido !== null) return;
    obterNamespaceCache()
      .then(avisosLidos)
      .then((lidos) => setLido(ehLido(aviso, lidos)));
  }, [aviso, lido]);

  const confirmar = useCallback(() => {
    if (confirmadoRef.current || !aviso) return;
    confirmadoRef.current = true;
    setLido(true);
    obterNamespaceCache().then((namespace) => marcarAvisoLido(namespace, aviso.id));
    api.registrarLeituraAviso(aviso.id).catch(() => {});
  }, [aviso]);

  const cabeInteiro = alturas.visivel > 0 && alturas.conteudo > 0 && alturas.conteudo <= alturas.visivel + 1;

  // Aviso curto: 2 s com o fim a vista. Sair antes cancela.
  useEffect(() => {
    if (lido !== false || !cabeInteiro) return undefined;
    const timer = setTimeout(confirmar, ESPERA_AVISO_CURTO_MS);
    return () => clearTimeout(timer);
  }, [lido, cabeInteiro, confirmar]);

  // Aviso longo: chegou ao fim do texto.
  function aoRolar({ nativeEvent }) {
    if (lido !== false) return;
    const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 2) confirmar();
  }

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingBottom: 40 + insets.bottom }]}
      onLayout={({ nativeEvent }) => {
        const visivel = nativeEvent.layout.height;
        setAlturas((atual) => (atual.visivel === visivel ? atual : { ...atual, visivel }));
      }}
      onContentSizeChange={(_, conteudo) => setAlturas((atual) => (atual.conteudo === conteudo ? atual : { ...atual, conteudo }))}
      onScroll={aoRolar}
      scrollEventThrottle={100}
    >
      <Aviso tipo="erro" texto={erro} />
      {!aviso && !erro ? <ActivityIndicator color={cores.azul} style={estilos.carregando} /> : null}
      {aviso ? (
        <AparecerEm>
          {aviso.alcance ? <Text style={estilos.alcance}>{ROTULOS_ALCANCE[aviso.alcance] || 'Aviso'}</Text> : null}
          <Text style={estilos.titulo} accessibilityRole="header">{aviso.titulo}</Text>
          <Text style={estilos.data}>{formatarDataHora(aviso.publicado_em)}</Text>
          <Text style={estilos.texto}>{aviso.mensagem}</Text>
          <View style={estilos.fim}>
            {lido ? (
              <Text style={estilos.lido} accessibilityLiveRegion="polite">✓ Leitura confirmada</Text>
            ) : (
              <Text style={estilos.dica}>A leitura é confirmada quando você chega ao fim do aviso.</Text>
            )}
          </View>
        </AparecerEm>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20 },
  carregando: { marginTop: 34 },
  alcance: { color: cores.azul, fontSize: 11.5, fontWeight: '800', textTransform: 'uppercase' },
  titulo: { color: cores.ink, fontSize: 22, fontWeight: '800', lineHeight: 28, marginTop: 6 },
  data: { color: cores.inkSoft, fontSize: 12.5, marginTop: 6 },
  texto: { color: cores.ink, fontSize: 16, lineHeight: 26, marginTop: 18 },
  fim: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: cores.linha },
  // Tom escuro: o verde puro nao passa de 4,5:1 sobre o verde claro.
  lido: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: raio.pill,
    overflow: 'hidden',
    backgroundColor: cores.verdeSoft,
    color: cores.verdeEscuro,
    fontSize: 12.5,
    fontWeight: '800',
  },
  dica: { color: cores.inkSoft, fontSize: 12.5 },
});
