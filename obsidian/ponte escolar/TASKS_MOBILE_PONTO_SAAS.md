---
id: 2026-09-12
tipo: backlog-tecnico
tags: [projeto, mobile, tarefas, offline-first, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Backlog Priorizado"
fonte: "[[RELATORIO_ANALISE_SEGUNDO_CEREBRO_PONTO_SAAS]]"
---

# Tasks Mobile: [[Ponto SaaS]]

Backlog derivado do estado confirmado em [[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]], do contexto técnico do mobile e da análise do vault em [[RELATORIO_ANALISE_SEGUNDO_CEREBRO_PONTO_SAAS]].

## Regra de execução

- Toda atualização de código no mobile deve criar uma nova task `MOB-xxx` antes da implementação.
- Tasks concluídas são históricas e não devem ser reabertas ou reutilizadas.
- Uma nova task relacionada deve apontar para a task anterior e descrever a diferença de escopo.
- Nenhuma alteração de código deve ser iniciada sem problema, arquivos, critérios de aceite, dependências e validação definidos.

## Ordem recomendada

### MOB-021 — Isolar fila offline por conta

- **Status:** [x] Concluída em 2026-09-12
- **Prioridade:** P0
- **Área:** offline-first / segurança
- **Nota detalhada:** [[MOB-021_ISOLAR_FILA_OFFLINE_POR_CONTA]]
- **Problema:** a fila global pode reenviar uma ação criada por outro perfil com o token da sessão atual.
- **Escopo:** namespace por identidade, migração explícita da fila legada, processamento somente com sessão correspondente e limpeza por perfil no logout.
- **Critérios de aceite:** [x] duas contas não compartilham fila; [x] fila sem identidade não processa; [x] fila legada não é atribuída automaticamente; [x] logout limpa apenas o namespace atual.
- **Dependências:** MOB-002 concluída; MOB-020 pendente.
- **Validação:** diagnósticos, troca de perfil, logout, fila legada e processamento online/offline.
- **Implementado:** filas v2 por namespace, listeners por namespace, serialização de operações, bloqueio da fila legada, processamento interrompido ao trocar de identidade e limpeza seletiva no logout.
- **Validação realizada:** diagnósticos sem erros em `filaOffline.js`, `api.js`, `AuthContext.js`, `InicioScreen.js` e `SincronizacaoScreen.js`.
- **Pendente:** testes automatizados de isolamento e concorrência em MOB-020.

### P0 — Segurança e integridade de dados

#### MOB-001 — Remover dados demonstrativos da Home do responsável

- **Status:** [ ] A fazer
- **Prioridade:** P0
- **Área:** UI / domínio responsável
- **Arquivos prováveis:** `mobile/src/screens/ResponsavelHomeScreen.js`, `mobile/src/api.js`
- **Problema:** a tela inicia com filhos de exemplo e mantém esses dados quando a API retorna vazio ou falha. Status, métricas, aviso, horário, unidade e pendências também são fixos.
- **Implementação:**
  - iniciar a tela com lista vazia;
  - representar `loading`, `empty`, `error` e `offline-cache` separadamente;
  - usar apenas dados reais ou cache identificado do responsável atual;
  - remover status e métricas calculados pelo índice da lista;
  - conectar avisos ao endpoint real ou remover o atalho temporariamente.
- **Critérios de aceite:**
  - [ ] API vazia exibe estado vazio sem alunos fictícios;
  - [ ] falha de rede sem cache não exibe dados inventados;
  - [ ] cache válido mostra indicador offline e data da fonte;
  - [ ] nenhuma métrica fixa permanece na tela.
- **Dependências:** contrato de `/api/responsaveis/alunos` e avisos.
- **Validação:** testes de renderização para sucesso, vazio, erro e cache.

#### MOB-002 — Isolar cache por conta, perfil e empresa

- **Status:** [x] Concluída em 2026-09-12
- **Prioridade:** P0
- **Área:** persistência local
- **Arquivos prováveis:** `mobile/src/storage.js`, `mobile/src/api.js`, `mobile/src/context/AuthContext.js`
- **Problema:** o cache usa apenas o caminho da requisição. Troca de usuário pode exibir dados de outra conta.
- **Implementação:**
  - definir uma identidade local estável (`perfil`, usuário/responsável, empresa e filial quando aplicável);
  - incluir identidade no namespace da chave;
  - criar migração/limpeza das chaves antigas;
  - invalidar cache no logout e na troca de perfil/empresa;
  - adicionar TTL por tipo de recurso.
- **Critérios de aceite:**
  - [x] dois usuários no mesmo aparelho nunca compartilham fallback;
  - [x] logout remove ou invalida cache privado;
  - [x] cache expirado não é exibido como atual;
  - [ ] testes cobrem troca de responsável para professor e vice-versa.
- **Dependências:** decisão sobre identidade/tenant retornada por `/api/auth/me`.
- **Validação:** testes unitários com duas sessões e falha de rede.
- **Implementado:** cache versionado em `@ponto_saas_cache:v2`, namespaceado por perfil, id, empresa e filial; entradas legadas são removidas uma vez; TTL de 7 dias; cache do perfil é limpo no logout; sem identidade conhecida, nenhuma leitura ou gravação de cache ocorre.
- **Validação realizada:** diagnósticos estáticos sem erros em `storage.js`, `api.js` e `AuthContext.js`; referências de `salvarCache`/`lerCache` foram conferidas.
- **Pendente:** criar testes automatizados de isolamento quando a infraestrutura de testes do mobile for adicionada em MOB-020.

#### MOB-003 — Isolar e proteger a fila offline por conta

- **Status:** [→] Substituída pela MOB-021 em 2026-09-12
- **Prioridade:** P0
- **Área:** offline-first / segurança
- **Arquivos prováveis:** `mobile/src/filaOffline.js`, `mobile/src/api.js`, `mobile/src/context/AuthContext.js`
- **Problema:** a fila usa uma chave global e pode reenviar ação antiga com o token da conta atual.
- **Implementação:**
  - particionar a fila por identidade/perfil/empresa;
  - armazenar metadados de origem da operação;
  - pausar fila ao trocar de conta;
  - oferecer sincronizar, exportar ou descartar a fila anterior;
  - impedir processamento se a identidade persistida não corresponder à sessão atual.
- **Critérios de aceite:**
  - [ ] operação do responsável não é enviada pelo professor;
  - [ ] troca de conta mostra pendências da conta correta;
  - [ ] logout não deixa fila privada sendo processada silenciosamente;
  - [ ] migração de fila antiga tem comportamento explícito.
- **Dependências:** MOB-002 e política de logout.
- **Validação:** testes de troca de identidade durante fila pendente.
- **Nota:** a implementação foi executada na nova task [[MOB-021_ISOLAR_FILA_OFFLINE_POR_CONTA]], criada conforme a regra de não reutilizar tasks de código.

#### MOB-004 — Migrar tokens para armazenamento seguro

- **Status:** [→] Substituída pela MOB-022 em 2026-09-12
- **Prioridade:** P0
- **Área:** autenticação
- **Arquivos prováveis:** `mobile/src/api.js`, `mobile/src/context/AuthContext.js`, `mobile/package.json`
- **Problema:** tokens persistidos em `AsyncStorage` não usam proteção nativa do sistema.
- **Implementação:**
  - adicionar `expo-secure-store` compatível com Expo 54;
  - migrar token de responsável e professor;
  - manter no AsyncStorage apenas dados não sensíveis quando necessário;
  - remover chaves antigas após migração bem-sucedida;
  - não incluir tokens em logs, URLs HTTP ou mensagens de erro.
- **Critérios de aceite:**
  - [ ] tokens persistidos ficam no Secure Store;
  - [ ] atualização preserva sessões válidas uma única vez;
  - [ ] falha de Secure Store impede persistência silenciosa;
  - [ ] logout remove token seguro do perfil correto.
- **Dependências:** política de “Manter login salvo”.
- **Validação:** teste em Android físico/emulador e iOS quando disponível.
- **Nota:** a implementação foi executada na nova task [[MOB-022_MIGRAR_TOKENS_PARA_SECURE_STORE]], criada conforme a regra de não reutilizar tasks de código.

#### MOB-022 — Migrar tokens para Secure Store

- **Status:** [x] Concluída em 2026-09-12, com testes de dispositivo pendentes
- **Prioridade:** P0
- **Nota detalhada:** [[MOB-022_MIGRAR_TOKENS_PARA_SECURE_STORE]]
- **Implementado:** `expo-secure-store ~15.0.8` adicionado; tokens de responsável/professor usam chaves seguras; tokens legados do AsyncStorage são migrados e removidos; logout limpa Secure Store e legado.
- **Validação realizada:** diagnósticos sem erros em `api.js` e `AuthContext.js`.
- **Pendente:** teste em dispositivo físico/Android/iOS e testes automatizados de migração em MOB-020.

#### MOB-005 — Corrigir restauração de sessão e tratamento global de 401

- **Status:** [ ] A fazer
- **Prioridade:** P0
- **Área:** autenticação / API
- **Arquivos prováveis:** `mobile/src/api.js`, `mobile/src/context/AuthContext.js`
- **Problema:** qualquer erro de `/api/auth/me` mantém sessão salva; telas tratam `401` de forma duplicada.
- **Implementação:**
  - exportar/classificar falha de rede;
  - registrar callback de não autenticado no `AuthProvider`;
  - em `401`, limpar token/sessão do perfil e retornar ao login;
  - em falha de rede, permitir modo offline somente com sessão/cache claramente identificado;
  - pausar a fila em `401`.
- **Critérios de aceite:**
  - [ ] token expirado não mantém área autenticada como se estivesse online;
  - [ ] erro de rede não desloga indevidamente;
  - [ ] todas as telas obedecem ao mesmo fluxo;
  - [ ] fila não tenta reenviar operações com sessão rejeitada.
- **Dependências:** MOB-003 e MOB-004.
- **Validação:** testes de `401`, timeout, DNS/offline e resposta válida.

### P1 — Contratos e fluxos principais

#### MOB-006 — Corrigir sincronização manual

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** fila offline
- **Arquivos prováveis:** `mobile/src/screens/SincronizacaoScreen.js`, `mobile/src/api.js`
- **Problema:** `SincronizacaoScreen` chama `api.processarFilaOffline()`, mas a exportação atual é nomeada e separada.
- **Implementação:** escolher uma única API pública: importar a função nomeada ou adicioná-la conscientemente ao objeto `api`.
- **Critérios de aceite:**
  - [ ] botão manual funciona com fila vazia;
  - [ ] processa item válido;
  - [ ] preserva item em falha de rede;
  - [ ] marca erro HTTP conforme política;
  - [ ] atualiza data e contador sem travar o spinner.
- **Validação:** teste manual e teste automatizado da tela/serviço.

#### MOB-007 — Unificar configuração HTTP e WebSocket

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** rede / build
- **Arquivos prováveis:** `mobile/src/api.js`, `mobile/src/realtime.js`, `mobile/app.json`, `mobile/eas.json`
- **Problema:** HTTP tem fallback de produção, WebSocket cai sempre no IP local quando `EXPO_PUBLIC_API_URL` não está embutida.
- **Implementação:**
  - criar configuração única de origem;
  - derivar `ws/wss` com segurança;
  - definir variável por profile development/preview/production;
  - validar configuração no build;
  - não usar produção em desenvolvimento por acidente.
- **Critérios de aceite:**
  - [ ] preview e production conectam no host correto;
  - [ ] development funciona na rede local;
  - [ ] logs não exibem token;
  - [ ] erro de configuração é explícito.
- **Dependências:** URL e endpoint oficiais do backend.
- **Validação:** APK/Expo development build em cada ambiente.

#### MOB-008 — Separar ficha do aluno por perfil

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** navegação / contratos
- **Arquivos prováveis:** `mobile/src/screens/AlunoDetalheScreen.js`, `mobile/src/navigation/NavegacaoProfessor.js`, `mobile/src/api.js`
- **Problema:** professor abre `AlunoDetalheScreen`, mas a tela chama rotas `/api/responsaveis/*` protegidas para responsável.
- **Implementação:**
  - definir endpoints de histórico para professor ou restringir a ficha ao responsável;
  - separar telas/serviços por papel ou passar modo explícito;
  - adaptar abas conforme permissão.
- **Critérios de aceite:**
  - [ ] responsável acessa apenas dados autorizados de seus filhos;
  - [ ] professor acessa apenas dados autorizados da atribuição/empresa;
  - [ ] nenhum fluxo depende de `403` para descobrir o papel;
  - [ ] navegação de chamada abre uma ficha compatível.
- **Dependências:** contrato backend e autorização por papel.
- **Validação:** testes de autorização para ambos os tokens.

#### MOB-009 — Exibir janela oficial da turma

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** responsável / horário escolar
- **Arquivos prováveis:** `mobile/src/screens/ResponsavelHomeScreen.js`, `mobile/src/screens/AlunoDetalheScreen.js`, `mobile/src/api.js`
- **Problema:** `horarios_turma` já é retornado, mas a tela não exibe entrada/saída previstas.
- **Implementação:**
  - mapear payload real de `horarios_turma`;
  - exibir janela prevista por dia/turma;
  - diferenciar “previsto” de “batida realizada”;
  - tratar múltiplos horários e ausência de grade.
- **Critérios de aceite:**
  - [ ] horário previsto aparece na área correta;
  - [ ] batida não é apresentada como janela da turma;
  - [ ] fuso e formato são consistentes;
  - [ ] ausência de horário exibe estado neutro.
- **Dependências:** schema do endpoint e regras escolares.
- **Validação:** fixtures com horário único, múltiplo e ausente.

#### MOB-010 — Corrigir carregamento parcial do detalhe do aluno

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** resiliência de UI
- **Arquivos prováveis:** `mobile/src/screens/AlunoDetalheScreen.js`
- **Problema:** `Promise.all` faz qualquer falha deixar a tela em loading ou descartar as outras abas.
- **Implementação:** usar `Promise.allSettled` ou carregamento independente; manter estado por aba; permitir retry específico.
- **Critérios de aceite:**
  - [ ] falha de notas não impede frequência;
  - [ ] cada aba informa erro próprio;
  - [ ] loading sempre termina;
  - [ ] cache offline de uma aba não mascara falha das demais.
- **Validação:** testes com cada endpoint falhando isoladamente.

#### MOB-011 — Usar tipo oficial das batidas

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** domínio de ponto
- **Arquivos prováveis:** `mobile/src/screens/AlunoDetalheScreen.js`, contrato backend
- **Problema:** “Chegada/Saída” é inferido por posição, podendo classificar registros duplicados ou incompletos incorretamente.
- **Implementação:** consumir campo oficial; se ausente, exibir registro sem classificação definitiva; documentar regra de múltiplas batidas.
- **Critérios de aceite:**
  - [ ] entrada/saída vem do contrato oficial;
  - [ ] múltiplas batidas são exibidas sem alternância enganosa;
  - [ ] data usa `America/Sao_Paulo`;
  - [ ] payload incompleto tem fallback neutro.
- **Dependências:** contrato do endpoint de frequência.
- **Validação:** registros pares, ímpares, duplicados e fora de ordem.

#### MOB-012 — Corrigir data dinâmica da chamada

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** fuso/data
- **Arquivos prováveis:** `mobile/src/screens/ChamadaScreen.js`, `mobile/src/screens/InicioScreen.js`
- **Problema:** `HOJE` é calculado na importação do módulo e não muda após meia-noite.
- **Implementação:** calcular no foco/carregamento da tela; invalidar seleção quando o dia muda; manter fuso de São Paulo.
- **Critérios de aceite:**
  - [ ] app aberto na virada atualiza a data;
  - [ ] payload de chamada usa o dia correto;
  - [ ] resumo e texto da tela são consistentes.
- **Validação:** teste com relógio/fuso simulado próximo à meia-noite.

#### MOB-013 — Evitar perda do rascunho da chamada

- **Status:** [ ] A fazer
- **Prioridade:** P1
- **Área:** UX / persistência local
- **Arquivos prováveis:** `mobile/src/screens/ChamadaScreen.js`, `mobile/src/navigation/BarraInferior.js`
- **Problema:** troca de aba desmonta a tela e perde `estados`/`justificativas` antes do salvamento.
- **Implementação:** persistir rascunho por `atribuicao_id + data + usuário` ou migrar para tabs que preservem telas; limpar após confirmação.
- **Critérios de aceite:**
  - [ ] alternar aba preserva marcações;
  - [ ] reiniciar app recupera rascunho conforme política;
  - [ ] salvar com sucesso limpa o rascunho;
  - [ ] rascunho de outro usuário nunca aparece.
- **Dependências:** MOB-003 e MOB-012.
- **Validação:** fluxo completo com troca de aba, encerramento e retorno.

### P2 — Qualidade, privacidade e manutenção

#### MOB-014 — Implementar validação de Adicionar Filho

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** formulário
- **Arquivos prováveis:** `mobile/src/screens/AdicionarFilhoScreen.js`
- **Implementação:** validar nome, matrícula, CPF, normalização e dígito verificador; bloquear envio inválido mesmo offline.
- **Critérios de aceite:** [ ] erros aparecem antes da fila; [ ] CPF é normalizado; [ ] campos obrigatórios não aceitam espaços; [ ] backend continua sendo a validação final.

#### MOB-015 — Corrigir notificações, privacidade e deep links

- **Status:** [cancelada] Cancelada em 2026-09-12
- **Prioridade:** P2
- **Área:** push / privacidade
- **Arquivos prováveis:** `mobile/src/notifications.js`, `mobile/App.js`, `mobile/app.json`
- **Implementação:** listener de toque com destino validado, visibilidade Android privada para dados sensíveis, revogação/atualização de token no logout/troca de dispositivo.
- **Critérios de aceite:** [ ] toque abre o aluno/aviso correto; [ ] permissão negada não quebra o app; [ ] conteúdo sensível não aparece publicamente na tela bloqueada; [ ] token antigo é desativado.
- **Decisão:** manter o conteúdo das notificações visível conforme solicitado; não implementar a alteração para visibilidade privada da tela bloqueada. Deep link, revogação de token e demais melhorias permanecem fora desta task cancelada.

#### MOB-016 — Criar Error Boundary e telemetria segura

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** confiabilidade
- **Arquivos prováveis:** `mobile/App.js`, novo componente de boundary
- **Implementação:** fallback de recuperação, registro de erro sem token/payload sensível e correlação por versão/build.
- **Critérios de aceite:** [ ] erro de render não fecha silenciosamente; [ ] usuário pode tentar recuperar; [ ] telemetria não contém credenciais ou dados de crianças.

#### MOB-017 — Adicionar acessibilidade aos controles customizados

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** UX
- **Arquivos prováveis:** `mobile/src/navigation/BarraInferior.js`, `mobile/src/components/Animacoes.js`, telas
- **Implementação:** `accessibilityRole`, labels, estado selecionado, foco e tamanho mínimo de toque.
- **Critérios de aceite:** [ ] tabs são anunciadas corretamente; [ ] estado ativo é informado; [ ] ações de chamada e sincronização têm label claro; [ ] teste com leitor de tela.

#### MOB-018 — Reconciliar tokens de tema

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** UI / manutenção
- **Arquivos prováveis:** `mobile/src/theme.js`, `BarraInferior.js`, `ChamadaScreen.js`
- **Implementação:** decidir tokens oficiais e remover usos de `raio.xl`, `sombra.leve` e `sombra.media` inexistentes ou adicioná-los conscientemente.
- **Critérios de aceite:** [ ] nenhum token referenciado está indefinido; [ ] sombras e raios aparecem de forma consistente; [ ] não há fallback morto em componentes revisados.

#### MOB-019 — Remover ou arquivar código legado após confirmação

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** manutenção
- **Arquivos prováveis:** `mobile/src/screens/ProfessorScreen.js`, `mobile/src/screens/HomeScreen.js`
- **Implementação:** confirmar referências, remover implementação morta e registrar decisão em [[Decisões Arquiteturais Ponto SaaS]].
- **Critérios de aceite:** [ ] nenhum import depende do legado; [ ] build continua funcionando; [ ] histórico e motivo da remoção ficam documentados.

#### MOB-020 — Criar suíte mínima de testes do mobile

- **Status:** [ ] A fazer
- **Prioridade:** P2
- **Área:** qualidade
- **Arquivos prováveis:** `mobile/package.json`, nova pasta de testes
- **Cobertura mínima:**
  - [ ] autenticação e restauração;
  - [ ] cache/fila por conta;
  - [ ] sincronização manual;
  - [ ] Home sem dados fictícios;
  - [ ] navegação por papel;
  - [ ] chamada e virada de data;
  - [ ] detalhe com falha parcial;
  - [ ] configuração/reconexão do WebSocket.
- **Critérios de aceite:** comando reproduzível no README e execução no CI.

## Ordem de execução sugerida

1. MOB-001, MOB-002, MOB-003, MOB-005.
2. MOB-022 e MOB-006.
3. MOB-007 e MOB-008.
4. MOB-009, MOB-010, MOB-011 e MOB-012.
5. MOB-013.
6. MOB-014 a MOB-020.

## Notas relacionadas

- [[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]]
- [[RELATORIO_ANALISE_SEGUNDO_CEREBRO_PONTO_SAAS]]
- [[Operação Offline Mobile]]
- [[Contratos API Mobile Ponto SaaS]]
- [[Arquitetura de Autenticação]]
- [[WebSocket e Realtime]]
- [[Regras de Negócio]]
