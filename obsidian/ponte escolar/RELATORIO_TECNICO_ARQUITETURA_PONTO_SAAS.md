---
id: 2026-09-12
tipo: relatorio-tecnico
tags: [projeto, arquitetura, documentacao]
projeto: "Ponto SaaS"
status: "Em Desenvolvimento"
---

# Relatório Técnico: [[Ponto SaaS]]

## 📱 1. Mobile
- **Tecnologias & Frameworks:**
  - React Native `0.81.5` com Expo SDK `54.0.0`.
  - React `19.1.0`.
  - React Navigation Native Stack `7.3.28`.
  - `AsyncStorage` para sessão, cache e fila offline; `expo-notifications` para push; `expo-updates` para OTA.
  - WebSocket nativo do React Native para realtime.
- **Arquitetura & Gerenciamento de Estado:**
  - Cliente organizado por telas, componentes, contexto de autenticação, navegação e serviços (`api.js`, `storage.js`, `filaOffline.js`, `realtime.js`, `notifications.js`).
  - Não há Redux, Zustand ou outra store global. O estado de autenticação usa `AuthContext`; telas usam `useState`/`useEffect`.
  - Estratégia offline-first: GET tenta API e usa cache em falha de rede; escritas podem entrar em fila e ser reprocessadas no foreground ou após uma chamada bem-sucedida.
  - Há dois perfis de login no cliente: responsável e professor.
- **Fluxos Principais Implementados:**
  - [x] Login de responsável por `/api/responsaveis/login`.
  - [x] Login de professor por `/api/auth/login`.
  - [x] Restauração de sessão e logout.
  - [x] Listagem de filhos e detalhe com frequência, presença em sala, notas, observações e avisos.
  - [x] Vinculação de filho por matrícula/CPF.
  - [x] Agenda, chamada, notas e observações para o fluxo de professor.
  - [x] Cache de leituras e fila offline de escritas.
  - [x] Push para responsável e realtime por WebSocket.
  - [ ] Isolamento completo de cache/fila por usuário, perfil e empresa.
  - [ ] Contratos de detalhe do aluno separados corretamente entre responsável e professor.
  - [ ] Persistência de rascunho da chamada durante troca de aba ou encerramento do app.
- **Desafios Atuais & Próximos Passos:**
  - Corrigir dados demonstrativos e valores fixos em `ResponsavelHomeScreen` antes de uso produtivo.
  - Centralizar tratamento de `401` e não aceitar sessão persistida quando o token foi rejeitado.
  - Migrar tokens de `AsyncStorage` para armazenamento seguro e aplicar expiração/rotação.
  - Isolar cache e fila por identidade/tenant; adicionar idempotência, limite, retry e classificação de erros.
  - Corrigir `SincronizacaoScreen`, que chama `api.processarFilaOffline()` embora a função seja exportada separadamente.
  - Unificar a origem HTTP/WS por ambiente; o fallback de `realtime.js` ainda pode apontar para IP local em um APK sem variável embutida.
  - Confirmar o contrato do WebSocket mobile com o backend: o cliente usa `/ws?token=...` e JSON, não STOMP.
  - Revisar a política OTA: `App.js` pode executar `reloadAsync()` enquanto uma chamada está em edição.
  - Adicionar testes para autenticação, fila, cache, navegação por papel, chamada e realtime.

## 🎨 2. Front-end (Web)
- **Tecnologias & Frameworks:**
  - O `README.md` documenta um cliente React com Vite para o painel web.
  - O diretório `web/` e o arquivo `web/package.json` não estão presentes no filesystem atual; portanto, versões de React, Vite e dependências não podem ser confirmadas no estado analisado.
  - O Git indica remoções pré-existentes de arquivos do `web`, mas essas alterações não foram revertidas nem modificadas nesta análise.
- **Estilização e Componentização:**
  - Não é possível confirmar a implementação atual porque o código web não está disponível no workspace.
  - Pelo README, o painel foi concebido para tabelas e formulários densos de empresas/escolas, separado do app mobile.
  - O backend pode servir `web/dist` como arquivos estáticos quando `web/dist/index.html` existe; caso contrário, responde JSON na raiz.
- **Integração com APIs:**
  - O contrato esperado é REST/JSON com autenticação `Authorization: Bearer`.
  - O backend registra rotas para empresas, funcionários, dispositivos, ponto, relatórios, AFD, filiais, turmas, alunos, avisos, auditoria e permissões.
  - Não foi possível confirmar o cliente HTTP, as páginas ativas, o tratamento de erros ou o estado real das rotas web sem os arquivos do módulo.
- **Desafios Atuais & Próximos Passos:**
  - Restaurar ou disponibilizar o diretório `web` antes de avaliar componentes, rotas, build e segurança do painel.
  - Confirmar se o build web deve ser empacotado dentro do deploy do backend ou publicado separadamente.
  - Revalidar compatibilidade do cliente web com escopo multiempresa, filial, permissões e tipos `staff`.
  - Criar uma nota específica `[[Arquitetura do Front-end Web]]` somente após o código web estar presente.

## ⚙️ 3. Back-end & Infraestrutura
- **Tecnologias & Linguagens:**
  - Node.js `>=18`, Express `4.19.2` e JavaScript CommonJS.
  - PostgreSQL como banco relacional, acessado por `Knex 3.1.0` e `pg 8.12.0`.
  - `ws 8.18.0` para WebSocket; `node-zklib` para integração com dispositivos ZK.
  - Helmet, CORS, compression, Morgan, bcrypt e jsonwebtoken.
  - Workers separados por scripts para coleta de dispositivos e agendamento de avisos.
- **Padrões de Arquitetura:**
  - Monorepo com três áreas previstas: `backend`, `mobile` e `web`.
  - Backend é uma API REST modular por domínio, com `routes`, `controllers` e `services` em módulos como autenticação, alunos, responsáveis, professores, dispositivos, ponto, avisos e auditoria.
  - O processo HTTP Express compartilha a mesma porta com dois fluxos WebSocket: realtime do aplicativo em `/ws` e protocolo do equipamento Evo Facial.
  - O protocolo Evo Facial é iniciado no mesmo `http.Server`; o equipamento abre a conexão contra o backend. O protocolo ZK usa adapter/coleta em sentido diferente.
  - Não há evidência de microserviços, BFF, GraphQL ou gRPC. O desenho atual é um monólito modular com workers auxiliares.
- **Segurança & Autenticação:**
  - Autenticação via JWT Bearer; o backend não usa cookie de sessão.
  - `autenticar` valida o JWT e reidrata o usuário no banco, conferindo usuário ativo ou responsável ativo.
  - `exigirTipo` separa tokens `staff` e `responsavel`; `exigirPapel` aplica RBAC para papéis como professor, gestor, admin e super_admin.
  - `resolverTenant` e permissões são aplicados nas rotas de staff; a arquitetura pretende filtrar dados por `empresa_id` do token.
  - Senhas de usuários/responsáveis usam bcrypt; senhas de dispositivos são descritas no README como protegidas por AES-256-GCM.
  - Helmet, CORS, compression e rate limit específico para `/pub/api` estão presentes.
  - O WebSocket mobile recebe JWT em query string (`/ws?token=`), o que deve ser revisado por exposição potencial em logs.
  - Dados de crianças, responsáveis, frequência, notas e fotos exigem revisão contínua de [[LGPD]] e controles de retenção.
- **Banco de Dados & Migrations:**
  - O fluxo ativo de schema é Knex + PostgreSQL; há migrations em `backend/migrations` cobrindo empresas, usuários, filiais, departamentos, horários de trabalho, funcionários, dispositivos, vínculos, registros de ponto, apontamentos, justificativas, feriados, banco de horas, AFD, auditoria e domínio escolar.
  - O domínio escolar inclui turmas, alunos, responsáveis, vínculos responsável-aluno, horários de turma, presença em sala, avisos, leituras e alvos de avisos.
  - Migrations recentes tratam integração Evo Facial, modo server/client, payload bruto, CPF de alunos, integridade relacional, escopo de filial, permissões e agendamento de avisos.
  - Há constraints e triggers adicionados por migrations para integridade e `updated_at`; a modelagem também diferencia funcionário e aluno em registros de ponto.
  - `backend/prisma/schema.prisma` contém somente configuração de generator/datasource, sem modelos de domínio; Prisma não deve ser considerado a camada de persistência atual.
  - `knexfile.js` usa `DATABASE_URL` ou host/porta/usuário/senha separados, com SSL opcional e pool de `2-10` em desenvolvimento e `2-20` em produção.
  - O histórico de migrations está avançado, mas é necessário manter uma única fonte de verdade operacional: migrations Knex ou uma futura adoção completa de Prisma, não os dois parcialmente.
- **Desafios Atuais & Próximos Passos:**
  - Validar migrations em banco limpo e banco já migrado, incluindo rollback das últimas alterações críticas.
  - Adicionar testes de contrato para os clientes mobile/web e testes de autorização por tipo, papel, empresa e filial.
  - Definir estratégia para múltiplas instâncias: conexões Evo Facial e realtime ficam em memória por processo; escala horizontal exigirá sticky routing ou estado compartilhado/pub-sub.
  - Retirar ou proteger qualquer credencial de assinatura, service account Firebase e segredo presente no diretório do mobile; revisar histórico Git e rotação.
  - Formalizar observabilidade: logs estruturados, métricas de coleta, falhas de WebSocket, fila, notificações e auditoria sem registrar tokens ou payloads sensíveis.
  - Revisar rate limiting geral, tamanho de payload, timeouts, idempotência de escritas e tratamento de jobs duplicados.
  - Confirmar deploy da API e do frontend: `app.js` serve `web/dist` somente se o build estiver disponível; atualmente o `web` não está presente no filesystem analisado.
  - Manter separados os requisitos trabalhistas do REP-P e os requisitos de privacidade de menores em [[Conformidade Portaria 671]] e [[LGPD Dados de Crianças]].

## 🔗 4. Conexões e Dependências Mútuas
- O Mobile e o Front-end Web consomem a mesma API Express por HTTP/JSON usando `Authorization: Bearer <JWT>`; o backend não depende de renderização de telas para responder aos clientes.
- O Mobile usa rotas de responsável, como `/api/responsaveis/alunos`, `/frequencia`, `/notas`, `/observacoes`, `/presenca-sala`, `/avisos` e `/push-token`.
- O Mobile usa rotas de professor, como `/api/professores/minhas-turmas`, `/resumo`, `/alunos`, `/presencas`, `/notas` e `/observacoes`. O cliente precisa separar esses contratos por papel; uma tela compartilhada hoje usa rotas incompatíveis em alguns fluxos.
- O Web, conforme o README, é o painel de staff para empresas e escolas e deve consumir os módulos de administração, dispositivos, ponto, turmas, alunos, relatórios, permissões e avisos.
- O Backend integra dispositivos de ponto por dois caminhos: coleta ZK via adapters/worker e WebSocket Evo Facial iniciado na mesma porta HTTP da API.
- O Backend publica eventos no WebSocket `/ws`; o Mobile reconecta, deduplica eventos localmente e emite `DeviceEventEmitter` para atualizar telas.
- O Backend envia notificações push por Expo para tokens registrados de responsáveis; o Mobile registra o token no endpoint de responsáveis.
- PostgreSQL é a dependência central de persistência para autenticação, tenant, domínio trabalhista, domínio escolar, dispositivos, auditoria e notificações.
- Gargalos atuais identificados:
  - estado de conexões WebSocket e Evo Facial em memória, incompatível com escala horizontal sem afinidade/estado compartilhado;
  - fila/cache offline globais no Mobile, com risco de mistura entre contas;
  - ausência do código web no workspace, impedindo validação ponta a ponta do painel;
  - contratos de detalhes do aluno e navegação de perfis ainda desalinhados;
  - build OTA do Mobile pode recarregar enquanto há estado não salvo.
- Notas relacionadas do Obsidian:
  - [[Arquitetura de Banco de Dados]]
  - [[Regras de Negócio]]
  - [[Arquitetura de Autenticação]]
  - [[Integração com Dispositivos]]
  - [[Offline First Mobile]]
  - [[WebSocket e Realtime]]
  - [[Conformidade Portaria 671]]
  - [[LGPD Dados de Crianças]]
