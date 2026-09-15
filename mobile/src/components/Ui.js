import { useCallback } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { setStatusBarStyle } from 'expo-status-bar';
import { AparecerEm, PressaoAnimada, Pulsar } from './Animacoes';
import { cores, raio, sombra } from '../theme';
import { formatarDataHora } from '../datas';

/**
 * O padrao do app e barra de status clara (icones brancos), que some sobre
 * as telas de fundo claro. Telas claras chamam este hook: enquanto estao em
 * foco os icones ficam escuros; ao sair ou desmontar, voltam ao padrao.
 */
export function useBarraDeStatusEscura() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
      return () => setStatusBarStyle('light');
    }, [])
  );
}

/** Cabecalho padrao do "Hub de fichas". */
function iniciaisDoNome(nome = '') {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Cabecalho das telas iniciais de professor e responsavel.
 *
 * As duas homes tinham cabecalho proprio, com escalas diferentes: o
 * responsavel trazia a logo e o avatar, o professor tinha a tipografia maior.
 * Este componente junta os dois, e e a unica copia.
 *
 * Nao substitui o `Cabecalho`, que serve as telas de formulario.
 */
export function CabecalhoHome({ papel, titulo, subtitulo, nome, onSair }) {
  const iniciais = iniciaisDoNome(nome);
  return (
    <AparecerEm>
      <View style={estilos.homeMarcaLinha}>
        <View style={estilos.homeMarca}>
          {/* Versao de 84px (28pt x3). O app-icon.png tem 407px e serve a tela
              de Login, que mostra a logo a 116pt; aqui so decodificaria em vao. */}
          <Image
            source={require('../../assets/logo-cabecalho.png')}
            style={estilos.homeLogo}
            accessibilityLabel="Ponte Escolar"
          />
          <Text style={estilos.homeMarcaTexto}>PONTE · ESCOLAR</Text>
        </View>
        <View style={estilos.homeConta}>
          {iniciais ? (
            <View style={estilos.homeAvatar}>
              <Text style={estilos.homeAvatarTexto}>{iniciais}</Text>
            </View>
          ) : null}
          {onSair ? (
            <PressaoAnimada style={estilos.homeSair} onPress={onSair} accessibilityRole="button">
              <Text style={estilos.homeSairTexto}>Sair</Text>
            </PressaoAnimada>
          ) : null}
        </View>
      </View>

      {papel ? <Text style={estilos.homePapel}>{papel}</Text> : null}
      <Text style={estilos.homeTitulo}>{titulo}</Text>
      {subtitulo ? <Text style={estilos.homeSubtitulo}>{subtitulo}</Text> : null}
    </AparecerEm>
  );
}

export function Cabecalho({ rotulo, titulo, subtitulo, acao }) {
  return (
    <AparecerEm style={estilos.topo}>
      <View style={estilos.topoTextos}>
        <Text style={estilos.rotulo}>{rotulo}</Text>
        <Text style={estilos.titulo}>{titulo}</Text>
        {subtitulo ? <Text style={estilos.subtitulo}>{subtitulo}</Text> : null}
      </View>
      {acao ? <View>{acao}</View> : null}
    </AparecerEm>
  );
}

/**
 * Faixa unica de estado: sem conexao e fila pendente na mesma linha.
 *
 * Eram duas faixas empilhadas. Com as duas condicoes ativas o usuario via dois
 * blocos empurrando a tela para baixo; agora e uma linha so. E o aviso de
 * "sem conexao" passa a dizer de quando sao os dados que estao na tela.
 *
 * `offlineEm` e a data do cache (`_cacheEm` da resposta). Sem ela, a faixa
 * ainda aparece, so nao informa a data.
 */
export function FaixaEstado({ offlineEm, offline, pendentes = 0, onSincronizar }) {
  const semConexao = Boolean(offlineEm || offline);
  if (!semConexao && !pendentes) return null;

  const partes = [];
  if (semConexao) {
    // Data invalida nao pode virar "dados de" pendurado, sem nada depois.
    const quando = offlineEm ? formatarDataHora(offlineEm) : '';
    partes.push(
      quando
        ? `Sem conexão · dados de ${quando}`
        : 'Sem conexão · mostrando o que está salvo no aparelho'
    );
  }
  if (pendentes) {
    partes.push(pendentes === 1 ? '1 ação aguardando envio' : `${pendentes} ações aguardando envio`);
  }

  return (
    <Pulsar style={estilos.faixaEstado}>
      <View style={estilos.faixaEstadoLinha}>
        <View style={estilos.faixaEstadoPonto} />
        <Text style={estilos.faixaEstadoTexto}>{partes.join(' · ')}</Text>
      </View>
      {onSincronizar ? (
        <PressaoAnimada
          style={estilos.faixaEstadoAcaoArea}
          onPress={onSincronizar}
          accessibilityRole="button"
        >
          <Text style={estilos.faixaEstadoAcao}>Sincronizar</Text>
        </PressaoAnimada>
      ) : null}
    </Pulsar>
  );
}

/**
 * Aviso de erro ou de sucesso.
 *
 * O erro era cinza como qualquer outro bloco e nao se distinguia do resto da
 * tela. Passou a usar o vermelho com faixa lateral que a home do responsavel
 * ja tinha, e que era a leitura mais clara das duas.
 */
export function Aviso({ tipo, texto }) {
  if (!texto) return null;
  const erro = tipo === 'erro';
  return (
    <AparecerEm deslocamento={8} style={[estilos.aviso, erro ? estilos.avisoErro : estilos.avisoOk]}>
      <Text style={[estilos.avisoTexto, erro ? estilos.avisoTextoErro : estilos.avisoTextoOk]}>{texto}</Text>
    </AparecerEm>
  );
}

/**
 * Ficha compacta de numero (usada nas telas iniciais).
 *
 * Sem `onPress` a ficha e so leitura: vira uma View simples, em vez de um
 * botao que o leitor de tela anuncia como tocavel e nao leva a lugar nenhum.
 */
export function Ficha({ rotulo, valor, destaque, atraso = 0, onPress }) {
  const conteudo = (
    <>
      <Text style={[estilos.fichaValor, destaque && estilos.fichaValorDestaque]}>{valor}</Text>
      <Text style={[estilos.fichaRotulo, destaque && estilos.fichaRotuloDestaque]}>{rotulo}</Text>
    </>
  );
  const forma = [estilos.ficha, destaque && estilos.fichaDestaque];
  return (
    <AparecerEm atraso={atraso} deslocamento={10} style={estilos.fichaEnvolucro}>
      {onPress ? (
        <PressaoAnimada style={forma} onPress={onPress} escala={0.97}>
          {conteudo}
        </PressaoAnimada>
      ) : (
        <View style={forma}>{conteudo}</View>
      )}
    </AparecerEm>
  );
}

export function BotaoGrande({ texto, onPress, secundario, desabilitado }) {
  return (
    <PressaoAnimada
      style={[estilos.botao, secundario && estilos.botaoSecundario, desabilitado && estilos.botaoDesativado]}
      onPress={desabilitado ? undefined : onPress}
    >
      <Text style={[estilos.botaoTexto, secundario && estilos.botaoTextoSecundario]}>{texto}</Text>
    </PressaoAnimada>
  );
}

const DIAS_LABEL = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };

function formatarDias(diasSemana) {
  if (!Array.isArray(diasSemana) || diasSemana.length === 0) return '';
  return diasSemana.map((dia) => DIAS_LABEL[dia] ?? dia).join(' ');
}

function formatarHora(hora) {
  return typeof hora === 'string' ? hora.slice(0, 5) : '';
}

function resumoHorarioColegio(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) return '';
  return horarios
    .map((horario) => `${DIAS_LABEL[horario.dia_semana] || horario.dia_semana} ${formatarHora(horario.hora_entrada)}-${formatarHora(horario.hora_saida)}`)
    .join(' · ');
}

/** Trilho horizontal de turmas, reutilizado em Chamada, Notas e Observacoes. */
export function SeletorTurma({ turmas, turmaAtiva, aoSelecionar }) {
  if (!turmas?.length) return null;
  return (
    <View>
      <Text style={estilos.secao}>Turma</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.trilho}>
        {turmas.map((item, indice) => {
          const ativa = turmaAtiva?.atribuicao_id === item.atribuicao_id;
          const horarioAula = formatarDias(item.dias_semana) || item.hora_inicio
            ? `${formatarDias(item.dias_semana)} ${formatarHora(item.hora_inicio)}-${formatarHora(item.hora_fim)}`.trim()
            : '';
          const horarioColegio = resumoHorarioColegio(item.horarios_turma);
          return (
            <AparecerEm key={item.atribuicao_id} atraso={indice * 60} deslocamento={10}>
              <PressaoAnimada
                style={[estilos.chip, ativa && estilos.chipAtivo]}
                onPress={() => aoSelecionar(item)}
                escala={0.97}
              >
                <Text style={[estilos.chipNome, ativa && estilos.chipNomeAtivo]}>{item.nome}</Text>
                <Text style={[estilos.chipDetalhe, ativa && estilos.chipDetalheAtivo]}>{item.materia}</Text>
                {horarioAula ? (
                  <Text style={[estilos.chipDetalhe, ativa && estilos.chipDetalheAtivo]} numberOfLines={1}>
                    {horarioAula}
                  </Text>
                ) : null}
                {horarioColegio ? (
                  <Text style={[estilos.chipDetalhe, ativa && estilos.chipDetalheAtivo]} numberOfLines={1}>
                    Colégio: {horarioColegio}
                  </Text>
                ) : null}
              </PressaoAnimada>
            </AparecerEm>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function Cartao({ children, style, atraso = 0 }) {
  return (
    <AparecerEm atraso={atraso} style={[estilos.cartao, style]}>
      {children}
    </AparecerEm>
  );
}

export const estilosBase = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.paper },
  conteudo: { padding: 20, paddingBottom: 40, gap: 16 },
  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, letterSpacing: 0.6, marginBottom: 8 },
  vazio: { color: cores.inkSoft, textAlign: 'center', paddingVertical: 24 },
});

const estilos = StyleSheet.create({
  // Cabecalho das homes: estrutura do responsavel (marca, avatar, papel) na
  // escala tipografica do professor, que era a legivel das duas.
  homeMarcaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  homeMarca: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  homeLogo: { width: 28, height: 28, borderRadius: 8 },
  homeMarcaTexto: { color: cores.inkSoft, fontSize: 11, letterSpacing: 1.8, fontWeight: '700' },
  homeConta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  homeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: cores.surfaceAlt,
    borderWidth: 1,
    borderColor: cores.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeAvatarTexto: { color: cores.ink, fontSize: 12, fontWeight: '800' },
  // 44px e o alvo minimo de toque. Os dois botoes Sair tinham ~30px.
  homeSair: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: raio.pill,
    borderWidth: 1,
    borderColor: cores.linha,
    backgroundColor: cores.surface,
  },
  homeSairTexto: { color: cores.inkSoft, fontSize: 13, fontWeight: '700' },
  homePapel: { color: cores.azul, fontSize: 11, letterSpacing: 1.4, fontWeight: '700' },
  homeTitulo: { color: cores.ink, fontSize: 26, fontWeight: '800', marginTop: 4 },
  homeSubtitulo: { color: cores.inkSoft, fontSize: 13, marginTop: 4 },

  topo: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  topoTextos: { flex: 1 },
  rotulo: { fontSize: 11, letterSpacing: 1.4, fontWeight: '700', color: cores.azul },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.ink, marginTop: 4 },
  subtitulo: { fontSize: 13, color: cores.inkSoft, marginTop: 4 },

  // Fusao das duas faixas antigas: o formato compacto que o responsavel ja
  // usava, no tamanho legivel de 12px que o professor ja usava.
  faixaEstado: {
    backgroundColor: cores.azulSoft,
    borderRadius: raio.md,
    borderWidth: 1,
    borderColor: cores.azul,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  faixaEstadoLinha: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 },
  faixaEstadoPonto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.azul },
  faixaEstadoTexto: { color: cores.azul, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  faixaEstadoAcaoArea: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, marginVertical: -6 },
  faixaEstadoAcao: { color: cores.azul, fontSize: 12, fontWeight: '800' },

  aviso: {
    borderRadius: raio.md,
    padding: 12,
    borderWidth: 1,
  },
  avisoErro: {
    backgroundColor: cores.vermelhoSoft,
    borderColor: cores.vermelhoSoft,
    borderLeftWidth: 3,
    borderLeftColor: cores.vermelho,
  },
  avisoOk: { backgroundColor: cores.verdeSoft, borderColor: cores.verde },
  avisoTexto: { fontSize: 12.5, fontWeight: '600' },
  avisoTextoErro: { color: cores.vermelho },
  avisoTextoOk: { color: cores.verde },

  fichaEnvolucro: { flex: 1 },
  ficha: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 14,
    minHeight: 88,
    justifyContent: 'space-between',
    ...sombra.cartao,
  },
  fichaDestaque: { backgroundColor: cores.azulSoft, borderColor: cores.azul },
  fichaValor: { fontSize: 26, fontWeight: '800', color: cores.ink },
  fichaValorDestaque: { color: cores.azul },
  fichaRotulo: { fontSize: 11, color: cores.inkSoft, fontWeight: '600' },
  fichaRotuloDestaque: { color: cores.azul },

  botao: {
    backgroundColor: cores.azul,
    borderRadius: raio.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...sombra.destaque,
  },
  botaoSecundario: { backgroundColor: cores.surfaceAlt, borderWidth: 1, borderColor: cores.linha },
  botaoDesativado: { opacity: 0.5 },
  botaoTexto: { color: cores.claro, fontWeight: '800', fontSize: 15 },
  botaoTextoSecundario: { color: cores.azul },

  secao: { fontSize: 13, fontWeight: '700', color: cores.inkSoft, marginBottom: 8 },
  trilho: { gap: 10, paddingRight: 8 },
  chip: {
    backgroundColor: cores.surfaceAlt,
    borderRadius: raio.md,
    borderWidth: 1,
    borderColor: cores.linha,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 130,
  },
  chipAtivo: { backgroundColor: cores.azulSoft, borderColor: cores.azul },
  chipNome: { fontWeight: '800', color: cores.ink },
  chipNomeAtivo: { color: cores.azul },
  chipDetalhe: { fontSize: 11, color: cores.inkSoft, marginTop: 2 },
  chipDetalheAtivo: { color: cores.azul },

  cartao: {
    backgroundColor: cores.surface,
    borderRadius: raio.lg,
    borderWidth: 1,
    borderColor: cores.linha,
    padding: 16,
    ...sombra.cartao,
  },
});
