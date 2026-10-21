---
id: 2026-10-21
tipo: inventario-backend
tags: [projeto, backend, inventario, arquitetura, documentacao]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Inventário estático"
---

# Inventário detalhado do backend: [[Ponto SaaS]]

## 1. Escopo e método

Este documento registra a estrutura versionada de `backend/` verificada em 2026-10-21. O inventário foi obtido a partir do Git e da leitura dos pontos de entrada, configuração, middlewares, rotas, migrations e documentação de agentes.

- **Total versionado:** 356 arquivos.
- **Código da aplicação em `src/`:** 67 arquivos JavaScript.
- **Migrations Knex:** 63 arquivos.
- **Documentação de agente:** 71 arquivos em cada um dos diretórios `.agents/`, `.claude/` e `.windsurf/` (213 cópias físicas; os caminhos e conteúdos foram comparados e são idênticos entre os três diretórios).
- **Configuração, scripts, schema Prisma e seed:** 13 arquivos.
- **Testes:** nenhum caminho de teste (`test`, `tests` ou `__tests__`) está versionado dentro de `backend/`. Isso não afirma que não haja validação em outras áreas do monorepo.
- `node_modules/` não faz parte deste inventário versionado. O arquivo local `backend/.env` não foi lido; segredos e valores de ambiente não são documentados aqui.

## 2. Visão de arquitetura e execução

O backend é uma API Node.js CommonJS/Express, organizada por módulos de domínio. A persistência operacional usa PostgreSQL através de Knex. A API serve clientes web e mobile via HTTP/JSON; quando existe `web/dist/index.html`, o Express também serve o build web e encaminha rotas da aplicação para o `index.html`.

Fluxo principal:

1. `src/server.js` carrega a aplicação Express e abre uma única porta HTTP.
2. Na mesma instância HTTP são iniciados o WebSocket do protocolo Evo Facial e o WebSocket de realtime do aplicativo.
3. `src/app.js` configura middlewares globais, monta `/api/*`, recebe a integração HTTP pública do equipamento em `/pub/api` e configura fallback/404/tratamento de erros.
4. Cada módulo de domínio mantém suas rotas e, quando aplicável, controllers e services.
5. Controllers/services usam `src/config/db.js` e Knex para acessar PostgreSQL.
6. Os workers de coleta e avisos são processos separados, iniciados por scripts npm próprios; não são iniciados automaticamente pelo `server.js`.

Autenticação de staff e responsáveis usa JWT Bearer. Rotas de staff combinam autenticação, tipo/papel, resolução de empresa/filial e permissões conforme o módulo. `resolverTenant` deriva a empresa do usuário autenticado; `super_admin` precisa selecionar a empresa explicitamente. A autorização por recurso/ação é resolvida pelo serviço de permissões.

## 3. Pastas e arquivos na raiz de `backend/`

| Caminho | Responsabilidade |
|---|---|
| `backend/.env.example` | Modelo das variáveis de ambiente. Não contém o arquivo local `.env` nem deve receber segredos reais. |
| `backend/.gitignore` | Regras de exclusão Git específicas do backend, incluindo arquivos locais e dependências. |
| `backend/knexfile.js` | Configura PostgreSQL, SSL opcional, pool por ambiente, diretórios de migrations/seeds e ledger `knex_migrations`. |
| `backend/package.json` | Metadados, engine Node.js (>=18), dependências e comandos `start`, `dev`, `migrate`, `seed`, workers e simulador. O `start` executa `knex migrate:latest` antes de iniciar o servidor. |
| `backend/package-lock.json` | Lockfile npm para instalação reproduzível das dependências. |
| `backend/prisma.config.ts` | Configuração gerada do Prisma apontando para `prisma/schema.prisma` e `prisma/migrations`; não é o caminho de persistência usado pelo servidor atual. |
| `backend/prisma/schema.prisma` | Scaffold de generator/datasource PostgreSQL sem modelos de domínio. Prisma não consta como dependência runtime no `package.json`; Knex continua sendo a camada ativa. |
| `backend/skills-lock.json` | Lock/metadata das skills de agente instaladas no backend. |
| `backend/seeds/01_demo.js` | Seed demonstrativa de empresa, usuário, horário, funcionário e dispositivos. Limpa dados das tabelas trabalhistas listadas no início do seed antes de inserir a demonstração; não executar em banco com dados que devam ser preservados. |
| `backend/scripts/diagnosticar-login-professor.js` | Script auxiliar de diagnóstico do login de professor. |
| `backend/scripts/diagnosticar-login-responsavel.js` | Script auxiliar de diagnóstico do login de responsável. |
| `backend/scripts/resetar-senha-responsavel.js` | Utilitário operacional para redefinição da senha de responsável. Usar apenas no ambiente e registro autorizados. |
| `backend/scripts/simular-evo-facial.js` | Simulador local do protocolo WebSocket Evo Facial para validar integração/desenvolvimento. |

## 4. `backend/src/` — aplicação

### 4.1 Entrada, configuração, jobs, middlewares e utilitários

| Caminho | Responsabilidade |
|---|---|
| `src/app.js` | Cria/configura Express; Helmet, CORS, compression, Morgan, parsing JSON/URL-encoded; endpoint HTTP público do dispositivo; monta os módulos `/api/*`; serve `web/dist` quando disponível; responde 404 e aplica `errorHandler`. |
| `src/server.js` | Abre o servidor HTTP na porta configurada e inicia nele os serviços WebSocket Evo Facial e realtime. |
| `src/realtime.js` | Serviço WebSocket de eventos realtime para clientes autenticados do aplicativo. |
| `src/config/db.js` | Instancia e exporta Knex para o ambiente corrente usando `knexfile.js`. |
| `src/jobs/avisosScheduler.js` | Worker separado para processar/publicar avisos escolares agendados. |
| `src/jobs/coletaScheduler.js` | Worker separado que busca dispositivos ativos configurados para coleta por polling, ingere registros e registra falhas; exclui dispositivos em modo servidor, que enviam dados ao backend. |
| `src/middlewares/auth.js` | Verifica Bearer JWT, revalida usuário/responsável ativo no banco e disponibiliza identidade; oferece verificações de tipo e papel. |
| `src/middlewares/tenant.js` | Resolve empresa e filial do contexto autenticado, valida pertencimento da filial e exige empresa explícita para operações de `super_admin`. |
| `src/middlewares/permissions.js` | Middleware RBAC por recurso e ação (`ver`, `adicionar`, `atualizar`, `deletar`), delegando a decisão ao módulo de permissões. |
| `src/middlewares/errorHandler.js` | Middleware final centralizado para serializar erros da aplicação em respostas HTTP. |
| `src/utils/crc16.js` | Cálculo CRC16 usado por integrações/protocolos de dispositivos. |
| `src/utils/crypto.js` | Utilitários de criptografia usados pelo backend, incluindo segredos de integração/dispositivo. |
| `src/utils/tempo.js` | Funções de datas, horários e fuso horário compartilhadas pelos domínios. |

### 4.2 Módulos de domínio

Nos módulos que possuem as três camadas, `*.routes.js` declara endpoints e middlewares; `*.controller.js` adapta HTTP para a chamada de serviço; `*.service.js` contém as operações e regras de domínio/persistência. As exceções (sem controller ou com serviço próprio) estão indicadas.

| Caminho | Responsabilidade |
|---|---|
| `src/modules/afd/afd.routes.js` | Endpoints de geração/consulta de exportações AFD, com autorização de staff. |
| `src/modules/afd/afd.service.js` | Consulta os registros e produz/exporta os arquivos AFD com o escopo exigido. |
| `src/modules/alunos/alunos.routes.js` | Endpoints administrativos de alunos e cadastro de foto facial, protegidos por autenticação/permissões. |
| `src/modules/alunos/alunos.controller.js` | Valida/adapta requisições e respostas do cadastro, consulta, edição e operações de aluno. |
| `src/modules/alunos/alunos.service.js` | Regras de cadastro, atualização, matrícula por empresa, turma/filial, consulta e dados escolares do aluno. |
| `src/modules/auditoria/auditoria.routes.js` | Endpoints de consulta de registros de auditoria. |
| `src/modules/auditoria/auditoria.controller.js` | Adapta filtros e resultados da consulta de auditoria para HTTP. |
| `src/modules/auditoria/auditoria.service.js` | Grava e consulta eventos de auditoria no banco. |
| `src/modules/auth/auth.routes.js` | Login de staff, sessão atual e operações administrativas de usuários. |
| `src/modules/auth/auth.controller.js` | Adapta operações de autenticação/usuários à API HTTP. |
| `src/modules/auth/auth.service.js` | Valida credenciais, emite sessão JWT e realiza operações de usuários de staff. |
| `src/modules/avisos/avisos.routes.js` | Rotas staff para avisos: listagem, criação, edição, remoção, ativação e duplicação. |
| `src/modules/avisos/avisos.controller.js` | Adapta operações de avisos e seus resultados para HTTP. |
| `src/modules/avisos/avisos.service.js` | Regras de escopo/alvos, agendamento, leitura, duplicação e notificação de avisos escolares. |
| `src/modules/dispositivos/adapters/DeviceAdapter.js` | Contrato/base comum de operações para adapters de dispositivos. |
| `src/modules/dispositivos/adapters/EvoFacialAdapter.js` | Adapter de operações e comandos compatíveis com dispositivos Evo Facial/WebSocket. |
| `src/modules/dispositivos/adapters/NaoConfiguradoAdapter.js` | Adapter fallback para dispositivos cujo protocolo não está configurado. |
| `src/modules/dispositivos/adapters/ZkProtocolAdapter.js` | Adapter de comunicação/coleta para protocolo de dispositivos ZK. |
| `src/modules/dispositivos/adapters/index.js` | Seleciona/exporta o adapter apropriado a partir da configuração do dispositivo. |
| `src/modules/dispositivos/dispositivos.routes.js` | CRUD de dispositivos, teste/conexão, coleta, consulta/reconciliação de usuários e operações faciais. |
| `src/modules/dispositivos/dispositivos.controller.js` | Adapta cadastro, configuração, conexão, coleta e sincronização de dados do dispositivo. |
| `src/modules/dispositivos/dispositivos.service.js` | Regras de cadastro, isolamento, conexão/coleta, reconciliação de usuários, comandos e envio facial ao dispositivo. |
| `src/modules/dispositivos/evoFacialServidor.js` | Implementa o servidor WebSocket e processamento dos comandos/check-ins HTTP do protocolo Evo Facial, conectado ao servidor HTTP principal. |
| `src/modules/dispositivos/faceSync.service.js` | Armazena/processa a fila cifrada de faces de alunos para transmissão ao dispositivo quando possível. |
| `src/modules/dispositivos/fotoStorage.js` | Persistência e recuperação de fotos faciais, abstraindo o armazenamento utilizado pelo serviço. |
| `src/modules/empresas/empresas.routes.js` | Rotas administrativas de empresas. |
| `src/modules/empresas/empresas.controller.js` | Adapta operações de empresas para HTTP. |
| `src/modules/empresas/empresas.service.js` | CRUD e regras de domínio de empresas/tenants. |
| `src/modules/filiais/filiais.routes.js` | Rotas administrativas de filiais/unidades. |
| `src/modules/filiais/filiais.controller.js` | Adapta operações de filiais para HTTP. |
| `src/modules/filiais/filiais.service.js` | CRUD e validações de vínculo de filial com empresa. |
| `src/modules/funcionarios/funcionarios.routes.js` | Rotas administrativas de funcionários. |
| `src/modules/funcionarios/funcionarios.controller.js` | Adapta operações de funcionários para HTTP. |
| `src/modules/funcionarios/funcionarios.service.js` | CRUD, matrícula, horário e vínculo organizacional de funcionários. |
| `src/modules/permissoes/permissoes.routes.js` | Rotas de consulta e administração de permissões. |
| `src/modules/permissoes/permissoes.controller.js` | Adapta operações de matriz e exceções de permissões para HTTP. |
| `src/modules/permissoes/permissoes.service.js` | Resolve permissões por papel/usuário e escopo de empresa, filial e atribuição. |
| `src/modules/ponto/bancoHoras.service.js` | Regras e lançamentos do ledger de banco de horas. |
| `src/modules/ponto/calculoJornada.js` | Cálculo de jornada, duração, intervalos, tolerância e saldos diários. |
| `src/modules/ponto/classificacaoBatidas.js` | Classifica e organiza batidas de ponto para processamento. |
| `src/modules/ponto/ponto.routes.js` | Rotas de apontamentos, registros não resolvidos, batidas manuais, fotos e extrato de banco de horas. |
| `src/modules/ponto/ponto.controller.js` | Adapta operações de ponto e apontamentos para HTTP. |
| `src/modules/ponto/ponto.service.js` | Ingestão/resolução de batidas de funcionários e alunos, apontamento diário e consultas de ponto. |
| `src/modules/professores/professores.routes.js` | Rotas de turmas atribuídas, alunos/fichas, presenças, notas, observações, histórico e gestão de atribuições. |
| `src/modules/professores/professores.controller.js` | Adapta fluxos do professor e de gestão de turma para HTTP. |
| `src/modules/professores/professores.service.js` | Escopa leitura e escrita às atribuições de professor; processa presença, notas, observações, ficha e grade. |
| `src/modules/relatorios/relatorios.routes.js` | Define endpoints de espelho de ponto e resumo por período; implementa consultas no próprio arquivo (não há controller/service separado neste inventário). |
| `src/modules/responsaveis/responsaveis.routes.js` | Cadastro/login de responsáveis, acesso aos alunos vinculados, frequência, avisos, leituras, tokens push e vínculos. |
| `src/modules/responsaveis/responsaveis.controller.js` | Adapta autenticação e operações do portal de responsáveis para HTTP. |
| `src/modules/responsaveis/responsaveis.service.js` | Cadastro/autenticação, autorização por alunos vinculados e consultas escolares/frequência do responsável. |
| `src/modules/responsaveis/notificacoes.service.js` | Envia notificações Expo e Web Push para responsáveis em eventos escolares. |
| `src/modules/turmas/turmas.routes.js` | Rotas de turmas e seus horários. |
| `src/modules/turmas/turmas.controller.js` | Adapta operações de turmas/horários para HTTP. |
| `src/modules/turmas/turmas.service.js` | CRUD de turmas e manutenção da janela de horário da turma. |

## 5. `backend/migrations/` — histórico de schema

Knex executa as migrations em ordem de nome e mantém o ledger `knex_migrations`. A aplicação executa `knex migrate:latest` no comando de start. Abaixo, cada um dos 63 arquivos versionados e sua finalidade, conforme o nome/objeto da migration:

| Migration | Finalidade |
|---|---|
| `20260719000000_enable_extensions.js` | Habilita extensões PostgreSQL requeridas pelo schema. |
| `20260719000001_create_empresas.js` | Cria empresas/tenants. |
| `20260719000002_create_usuarios.js` | Cria usuários de staff. |
| `20260719000003_create_filiais.js` | Cria filiais/unidades. |
| `20260719000004_create_departamentos.js` | Cria departamentos. |
| `20260719000005_create_horarios_trabalho.js` | Cria jornadas e horários de trabalho. |
| `20260719000006_create_funcionarios.js` | Cria funcionários. |
| `20260719000007_create_dispositivos.js` | Cria dispositivos de ponto. |
| `20260719000008_create_funcionario_dispositivos.js` | Cria vínculos de funcionários com IDs nos dispositivos. |
| `20260719000009_create_registros_ponto.js` | Cria registros brutos de ponto. |
| `20260719000010_create_apontamentos_diarios.js` | Cria apontamentos calculados por funcionário/dia. |
| `20260719000011_create_justificativas.js` | Cria justificativas de ausência/ocorrência. |
| `20260719000012_add_fk_justificativa_apontamento.js` | Relaciona justificativas a apontamentos. |
| `20260719000013_create_feriados.js` | Cria feriados. |
| `20260719000014_create_banco_horas_lancamentos.js` | Cria lançamentos de banco de horas. |
| `20260719000015_create_afd_exports.js` | Cria controle de exportações AFD. |
| `20260719000016_create_auditoria_logs.js` | Cria logs de auditoria. |
| `20260719000017_add_check_constraints.js` | Adiciona constraints de validação a tabelas existentes. |
| `20260719000018_add_updated_at_triggers.js` | Adiciona triggers de atualização de timestamps. |
| `20260719000019_add_tipo_unidade.js` | Adiciona classificação do tipo de unidade. |
| `20260719000020_create_turmas.js` | Cria turmas escolares. |
| `20260719000021_create_alunos.js` | Cria alunos. |
| `20260719000022_create_aluno_dispositivos.js` | Cria vínculos de alunos com IDs nos dispositivos. |
| `20260719000023_add_aluno_a_registros_ponto.js` | Permite associar registros de ponto a alunos. |
| `20260719000024_create_responsaveis.js` | Cria contas de responsáveis. |
| `20260719000025_create_responsavel_alunos.js` | Cria vínculos responsável-aluno. |
| `20260719000026_create_push_tokens.js` | Cria armazenamento de tokens de push. |
| `20260719000027_add_updated_at_responsaveis.js` | Inclui suporte a atualização de timestamps em responsáveis. |
| `20260818000001_add_protocolo_evo_ws.js` | Adiciona configuração do protocolo Evo via WebSocket. |
| `20260818000002_dispositivos_modo_server.js` | Adiciona modo de conexão iniciado pelo dispositivo/servidor. |
| `20260818000003_registros_ponto_payload_bruto.js` | Armazena payload original recebido nos registros. |
| `20260822000001_create_portal_responsaveis.js` | Complementa estrutura do portal de responsáveis. |
| `20260822000002_professores_escola.js` | Adiciona estruturas/relacionamentos de professores escolares. |
| `20260823000001_allow_null_device_ip_server.js` | Permite IP ausente para dispositivo que inicia a conexão. |
| `20260826000001_repair_dispositivo_communication_columns.js` | Repara/adiciona colunas de comunicação de dispositivos. |
| `20260826000002_repair_registros_ponto_payload.js` | Repara estrutura de payload bruto dos registros de ponto. |
| `20260826000003_add_cpf_alunos.js` | Adiciona CPF ao cadastro de alunos. |
| `20260826000005_regras_escolares.js` | Adiciona regras/estruturas do domínio escolar. |
| `20260826000006_fix_scope_and_student_schedule.js` | Ajusta escopo escolar e estrutura de horário de aluno legada. |
| `20260826000007_complete_relational_integrity.js` | Completa integridade relacional do domínio escolar. |
| `20260826000008_add_class_schedule_and_presence_scope.js` | Adiciona horários de turma e escopo às presenças. |
| `20260826000009_fix_presence_unique_by_subject.js` | Ajusta unicidade de presença considerando matéria/atribuição. |
| `20260826000010_make_class_window_unique.js` | Torna única a janela de horário da turma. |
| `20260826000011_harden_school_domain.js` | Endurece constraints/relações do domínio escolar. |
| `20260826000012_finalize_school_integrity.js` | Finaliza integridade do domínio escolar. |
| `20260830000001_add_turma_aos_avisos.js` | Relaciona avisos escolares a turmas. |
| `20260831000001_allow_null_aluno_matricula.js` | Permite matrícula nula para aluno. |
| `20260831000002_fix_legacy_aluno_cpf_responsavel.js` | Corrige estrutura legada de CPF/relação de responsável de aluno. |
| `20260903000001_create_permissoes_papeis.js` | Cria permissões associadas a papéis. |
| `20260903000002_add_filial_scope_to_usuarios.js` | Adiciona escopo de filial aos usuários. |
| `20260903000003_add_filial_scope_to_afd_exports.js` | Adiciona escopo de filial às exportações AFD. |
| `20260903000004_add_agendamento_avisos.js` | Adiciona agendamento de avisos. |
| `20260903000005_create_aviso_leituras.js` | Cria registro de leitura de avisos. |
| `20260903000006_create_aviso_alvos.js` | Cria alvos de distribuição de avisos. |
| `20260905000001_restrict_avisos_to_admin.js` | Ajusta restrições de acesso à gestão de avisos. |
| `20260906000001_create_permissoes_usuarios.js` | Cria permissões específicas por usuário. |
| `20260906000002_restore_gestor_avisos.js` | Restaura a capacidade de gestão de avisos para gestor. |
| `20260906000003_scope_permissoes_por_empresa.js` | Escopa permissões por empresa. |
| `20260913000001_add_professor_authors_to_school_records.js` | Registra autoria do professor em registros escolares. |
| `20260926000001_create_push_web.js` | Cria suporte a inscrições/token para Web Push. |
| `20261020000001_scope_aluno_matricula_uniqueness.js` | Remove unicidade global incompatível de matrícula e mantém unicidade por empresa. |
| `20261020000002_allow_device_transfer.js` | Permite reutilização de serial ao transferir dispositivo inativo, preservando unicidade para dispositivos ativos. |
| `20261020000003_create_pending_student_faces.js` | Cria persistência da fila de faces pendentes de alunos para sincronização com dispositivos. |

## 6. Skills de agente empacotadas

`backend/.agents/`, `backend/.claude/` e `backend/.windsurf/` contêm o mesmo catálogo de 71 arquivos cada. O primeiro diretório é usado como inventário abaixo; os 71 caminhos correspondentes também existem, com conteúdo idêntico, nos outros dois diretórios. São documentação de ferramenta, não dependências nem módulos executados pelo servidor.

| Skill (arquivos em `skills/<nome>/`) | Arquivos `references/` presentes |
|---|---|
| `prisma-cli` | `agent-safety.md`, `complete.md`, `db-execute.md`, `db-pull.md`, `db-push.md`, `db-seed.md`, `debug.md`, `dev.md`, `format.md`, `generate.md`, `init.md`, `mcp.md`, `migrate-deploy.md`, `migrate-dev.md`, `migrate-diff.md`, `migrate-reset.md`, `migrate-resolve.md`, `migrate-status.md`, `studio.md`, `validate.md` |
| `prisma-client-api` | `client-methods.md`, `constructor.md`, `filters.md`, `model-queries.md`, `query-options.md`, `raw-queries.md`, `relations.md`, `transactions.md` |
| `prisma-compute` | `app-deploy-cli.md`, `compute-config.md`, `create-prisma.md`, `frameworks.md`, `sdk-api.md`, `troubleshooting.md` |
| `prisma-database-setup` | `cockroachdb.md`, `mongodb.md`, `mysql.md`, `postgresql.md`, `prisma-client-setup.md`, `prisma-postgres.md`, `sqlite.md`, `sqlserver.md` |
| `prisma-driver-adapter-implementation` | Nenhum arquivo de referência; contém apenas `SKILL.md`. |
| `prisma-mongodb-upgrade` | `client-api-mapping.md`, `decision-stay-or-migrate.md`, `migrations-mapping.md`, `schema-contract-mapping.md`, `verify-cutover-checklist.md` |
| `prisma-postgres-setup` | `api-basics.md`, `auth.md`, `endpoints.md`, `prisma7-client.md` |
| `prisma-postgres` | `console-and-connections.md`, `create-db-cli.md`, `management-api-sdk.md`, `management-api.md` |
| `prisma-upgrade-v7` | `accelerate-users.md`, `driver-adapters.md`, `env-variables.md`, `esm-support.md`, `prisma-config.md`, `removed-features.md`, `schema-changes.md` |

Cada uma das nove pastas de skill acima também contém seu respectivo `SKILL.md`. Total: 9 arquivos `SKILL.md` + 62 referências = 71 por catálogo.

## 7. Limites e observações operacionais

- A contagem é do inventário versionado em `main`/`origin/main` na verificação de 2026-10-21; o documento não descreve o conteúdo do banco de produção nem variáveis locais.
- O processo web inicia os dois serviços WebSocket no mesmo processo; workers de coleta/avisos são invocados separadamente por `npm run coleta:worker` e `npm run avisos:worker`.
- A comunicação HTTP (`checklive`/`sendlog`) confirma que o dispositivo está vivo e permite receber batidas enviadas por ele; consultas/comandos remotos (`getuserlist`, `getnewlog`, cadastro facial) exigem WebSocket/WSS ativo. O heartbeat HTTP não é um canal de comando.
- No trecho de log fornecido em 2026-10-21, só há `checklive` via HTTP; não aparece `sendlog`. Assim, aquele trecho confirma que o equipamento alcança o backend, mas não comprova que a batida realizada foi recebida/processada. Para confirmar a batida, procurar o `sendlog` correspondente e o registro criado.
- Nas capturas do painel local do AiFace, `Req. Servidor` e `Domínio` estão habilitados, a porta está em 443, o heartbeat em 4 e `Servidor valida` em `Não`; o endereço IP do servidor está zerado. Há uma seção separada `Rede => Função serial` com ID, porta 5005, baud rate 38400 e uma lista de função serial. Essa seção serial não deve ser confundida com o transporte HTTP/WebSocket de rede. O significado exato de `Servidor valida` e das opções da lista serial depende do manual do firmware e não foi inferido pelas imagens.
- Configuração do equipamento informada pelo usuário: AiFace com firmware `ai518_f40v_v2.13`, domínio do Render habilitado e porta 443. A opção da lista `Função serial` aparece sem seleção na captura; a afirmação de que `Enviar JSON` está marcado pode referir-se a outra configuração. Como os logs observados são HTTP `checklive`, as capturas não provam conexão WebSocket nem polling HTTP de comandos. Consultar manual/fabricante antes de implementar outro transporte. Dados locais como IP/MAC e senha foram omitidos.
- A fila facial de alunos, conexões WebSocket e estruturas de conexão que vivem em memória devem ser consideradas ao planejar mais de uma instância do backend; avaliar o serviço atual antes de escalar horizontalmente.
- Prisma aparece em configuração e documentação de agente, mas o runtime e as migrations efetivas do projeto são Knex/PostgreSQL.
- A ausência de testes backend versionados é uma lacuna de inventário, não evidência de que os fluxos não foram validados manualmente.
- Relacionado: [[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]], [[RELATORIO_BANCO_DE_DADOS_PONTO_SAAS]], [[REGISTRO DE ATUALIZACOES PONTO SAAS]].
