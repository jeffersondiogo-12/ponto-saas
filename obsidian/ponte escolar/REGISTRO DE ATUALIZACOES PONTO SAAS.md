---
id: 2026-09-12
tipo: registro-de-atualizacoes
tags: [projeto, segundo-cerebro, changelog, decisoes]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Ativo"
---

# Registro de Atualizações: [[Ponto SaaS]]

Registro compacto das mudanças de conhecimento, decisões, tasks e validações adicionadas ao segundo cérebro. O conteúdo detalhado permanece nas notas temáticas relacionadas.

## 2026-09-12

### Configuração

- **Tipo:** decisão / configuração
- **Atualização:** toda atualização relevante do projeto deve ser registrada no vault, mesmo quando a resposta principal ocorrer no chat.
- **Regra:** mudanças curtas entram neste registro; análises extensas, decisões e backlog entram em notas próprias e devem ser linkadas aqui.
- **Arquivos:** [[.github/copilot-instructions.md]], [[.github/skills/obsidian-second-brain/SKILL.md]]

### Segundo cérebro

- **Tipo:** política de conhecimento
- **Atualização:** o vault passa a usar este arquivo como registro compacto de alterações duráveis.
- **Objetivo:** manter rastreabilidade sem copiar conversas inteiras ou aumentar desnecessariamente o contexto.
- **Notas relacionadas:** [[RELATORIO_ANALISE_SEGUNDO_CEREBRO_PONTO_SAAS]], [[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]]

### Mobile

- **Tipo:** backlog
- **Atualização:** as tasks do mobile estão centralizadas em [[TASKS_MOBILE_PONTO_SAAS]].
- **Prioridades atuais:** isolamento de conta/cache/fila, autenticação, sincronização manual, configuração HTTP/WS, contratos por perfil, rascunho da chamada e testes.

### MOB-002 — Cache por conta

- **Tipo:** implementação / validação
- **Status:** concluída em 2026-09-12.
- **Atualização:** cache do mobile foi versionado e namespaceado por perfil, identidade, empresa e filial; TTL definido em 7 dias; cache legado é removido uma vez; logout limpa o namespace do perfil.
- **Arquivos:** `mobile/src/storage.js`, `mobile/src/api.js`, `mobile/src/context/AuthContext.js`.
- **Validação:** diagnósticos estáticos sem erros; testes automatizados permanecem em [[MOB-020]].
- **Próxima dependência:** task `MOB-003` em [[TASKS_MOBILE_PONTO_SAAS]] para isolar a fila offline pelo mesmo critério de identidade.

### Política de tasks para código mobile

- **Tipo:** decisão / processo
- **Status:** ativa a partir de 2026-09-12.
- **Atualização:** toda alteração de código no mobile deverá criar uma nova task `MOB-xxx` antes da implementação.
- **Regra:** tasks concluídas não serão reabertas nem reutilizadas; mudanças posteriores devem criar uma nova task relacionada.
- **Critérios mínimos da nova task:** problema, escopo, arquivos, critérios de aceite, dependências e validação.
- **Fonte:** [[TASKS_MOBILE_PONTO_SAAS]], [[.github/copilot-instructions.md]], [[.github/skills/obsidian-second-brain/SKILL.md]]

### Relatório do banco de dados

- **Tipo:** análise / arquitetura
- **Status:** concluída em 2026-09-12.
- **Atualização:** criado [[RELATORIO_BANCO_DE_DADOS_PONTO_SAAS]] com inventário de tabelas, domínios trabalhista e escolar, integridade, tenant, índices, migrations, riscos de legado e tasks DB-001 a DB-007.
- **Achados principais:** `schema.sql` está atrás das migrations atuais; `horarios_alunos` é uma estrutura legada sem `empresa_id`/`filial_id`; o isolamento multi-tenant precisa ser comprovado por testes negativos; backup/restore verificável não foi encontrado neste escopo.
- **Notas relacionadas:** [[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]], [[RELATORIO_ANALISE_SEGUNDO_CEREBRO_PONTO_SAAS]], [[Banco de Dados Ponto SaaS]]

### Análise dos documentos de modelagem e RLS

- **Tipo:** análise / backlog de banco
- **Status:** concluída em 2026-09-12.
- **Atualização:** os PDFs recebidos foram comparados com migrations e `schema.sql`; o relatório [[RELATORIO_BANCO_DE_DADOS_PONTO_SAAS]] foi ampliado com a matriz de divergências e as tasks DB-008 a DB-014.
- **Conclusão:** RLS por empresa/filial ainda não existe no banco; hoje o isolamento é feito pela API. O gatilho de `updated_at` existe parcialmente e não foi identificado gatilho de proteção de campos de segurança.
- **Prioridades:** preparar contexto seguro no pool, implementar RLS incremental, completar triggers, proteger campos tenant e testar concorrência.

### MOB-021 — Fila offline por conta

- **Tipo:** task / implementação
- **Status:** concluída em 2026-09-12, com testes automatizados pendentes.
- **Atualização:** a fila global foi substituída por namespaces de identidade; a fila legada ficou bloqueada; processamento e listeners exigem a sessão correspondente; logout limpa somente a fila atual.
- **Arquivos:** `mobile/src/filaOffline.js`, `mobile/src/api.js`, `mobile/src/context/AuthContext.js`, `mobile/src/screens/InicioScreen.js`, `mobile/src/screens/SincronizacaoScreen.js`.
- **Dependência:** [[MOB-002]] concluída; testes automatizados permanecem em MOB-020.
- **Resultado:** a MOB-003 original foi substituída pela task [[MOB-021_ISOLAR_FILA_OFFLINE_POR_CONTA]]; a fila legada agora aparece bloqueada para descarte explícito e nunca é reenviada automaticamente.

### MOB-022 — Tokens no Secure Store

- **Tipo:** task / implementação
- **Status:** iniciada em 2026-09-12.
- **Atualização:** criada a task detalhada [[MOB-022_MIGRAR_TOKENS_PARA_SECURE_STORE]] para substituir o armazenamento persistido de tokens em AsyncStorage por Secure Store, com migração compatível.
- **Dependência:** a MOB-004 original foi substituída pela MOB-022 conforme a política de criar nova task para toda atualização de código.

### MOB-015 — Notificações com conteúdo visível

- **Tipo:** decisão / cancelamento
- **Status:** cancelada em 2026-09-12.
- **Atualização:** a política de tornar notificações privadas na tela bloqueada foi cancelada; o conteúdo deve continuar visível conforme solicitado.
- **Nota:** futuras alterações de deep link ou revogação de token deverão receber uma nova task, sem reabrir a MOB-015.

### MOB-022 — Tokens no Secure Store

- **Tipo:** implementação / validação
- **Status:** concluída em 2026-09-12, com testes de dispositivo e automatizados pendentes.
- **Atualização:** tokens de responsável e professor migrados para `expo-secure-store ~15.0.8`; tokens antigos do AsyncStorage são migrados sob demanda e removidos; logout limpa ambos os locais.
- **Arquivos:** `mobile/package.json`, `mobile/package-lock.json`, `mobile/src/api.js`.
- **Validação:** diagnósticos sem erros em `api.js` e `AuthContext.js`.
- **Relação:** a MOB-004 original foi substituída pela [[MOB-022_MIGRAR_TOKENS_PARA_SECURE_STORE]].

### MOB-023 — Testes de cache e fila

- **Tipo:** task / testes
- **Status:** preparada em 2026-09-12; execução bloqueada por dependência ausente.
- **Atualização:** criada [[MOB-023_TESTES_ISOLAMENTO_CACHE_FILA]] com Jest, mock de AsyncStorage e cobertura de MOB-002/MOB-021.
- **Validação:** diagnósticos sem erros; `npm test` iniciou o script, mas `jest-expo` não está presente em `mobile/node_modules`.
- **Pendência:** instalar dependências de desenvolvimento e executar `npm test -- --runInBand`; só então fechar os critérios de teste das MOB-002 e MOB-021.

### MOB-024 — Upgrade Expo SDK 57

- **Tipo:** task / upgrade de dependências
- **Status:** dependências atualizadas; validação de ambiente pendente em 2026-09-13.
- **Atualização:** `mobile/package.json` e `mobile/package-lock.json` foram alinhados ao SDK 57: React 19.2.3, React Native 0.86.3, `jest-expo ~57.0.5`, módulos Expo 57 e módulos nativos compatíveis.
- **Configuração:** Secure Store, notificações, StatusBar, OTA e EAS permanecem declarados no `app.json`/`eas.json`.
- **Validação pendente:** instalação efetiva, `expo-doctor`, `expo config --type public`, testes, prebuild/build nativo e verificação em dispositivo.
- **Nota:** SDK 57 exige Node >=22.13.x, Android API 36 e iOS 16.4+; `runtimeVersion` ainda precisa de decisão para a nova build nativa.

### MOB-024 — Cancelamento do upgrade Expo

- **Tipo:** decisão / cancelamento
- **Status:** cancelada em 2026-09-13.
- **Atualização:** o projeto permanece no Expo SDK 54 conforme solicitado; `package.json` e `package-lock.json` foram sincronizados com a linha 54.
- **Motivo:** manter estabilidade e adiar o upgrade nativo para uma task futura autorizada.

### MOB-025 — Auth, realtime e sincronização

- **Tipo:** task / implementação
- **Status:** concluída em 2026-09-13, com testes de ambiente pendentes.
- **Atualização:** `realtime.js` passou a usar a origem compartilhada do `api.js`; sincronização manual usa `processarFilaOffline` diretamente; restauração/401 e pausa da fila ficam consolidados no fluxo atual.
- **Arquivos:** `mobile/src/api.js`, `mobile/src/realtime.js`, `mobile/src/context/AuthContext.js`, `mobile/src/screens/SincronizacaoScreen.js`.
- **Validação:** diagnósticos sem erros nos módulos alterados; runner Jest ainda não está materializado em `node_modules`.
- **Relação:** MOB-005, MOB-006 e MOB-007 foram substituídas/resolvidas por [[MOB-025_FECHAR_AUTH_REALTIME_SINCRONIZACAO]].

### MOB-026 — Resiliência e integridade dos dados

- **Tipo:** implementação / validação
- **Status:** concluída em 2026-09-13, com testes automatizados pendentes.
- **Atualização:** detalhe do aluno usa `Promise.allSettled`; batidas usam tipo oficial quando disponível; chamada recalcula data no foco; vínculo de filho valida nome, matrícula e CPF antes da fila.
- **Arquivos:** `mobile/src/screens/AlunoDetalheScreen.js`, `mobile/src/screens/ChamadaScreen.js`, `mobile/src/screens/AdicionarFilhoScreen.js`.
- **Validação:** diagnósticos sem erros; cobertura automatizada permanece dependente do runner da MOB-023.

### MOB-027 — Ficha do aluno para professor

- **Tipo:** task / backend + mobile
- **Status:** backend concluído em 2026-09-13; tela e integração de banco pendentes.
- **Atualização:** adicionada migration de autoria em notas/observações, endpoint `GET /api/professores/turmas/:turmaId/alunos/:alunoId/ficha` e serviço mobile `api.fichaAlunoProfessor`.
- **Segurança:** endpoint exige staff/professor, permissão de leitura, atribuição ativa, empresa e filial; notas/observações são filtradas pelo professor autor.
- **Validação:** diagnósticos e `node --check` passam; migration/testes de integração dependem de banco executável.

### MOB-028 — Correções da auditoria

- **Tipo:** implementação / validação
- **Status:** concluída em 2026-09-13, com migration bloqueada.
- **Atualização:** `InicioScreen` usa data dinâmica; CPF é normalizado antes do vínculo; backend preserva tipos oficiais de batida e só alterna lotes totalmente indefinidos.
- **Validação:** diagnósticos sem erros e `node --check` backend sem erros.
- **Bloqueio:** tentativa de migration MOB-027 não pôde conectar ao PostgreSQL local em `127.0.0.1:5432`.

### MOB-029 — Conflito Git do realtime

- **Tipo:** manutenção / merge
- **Status:** concluída em 2026-09-13.
- **Atualização:** conflito de `mobile/src/realtime.js` resolvido preservando `config/rede.js`; `api.js` corrigido para definir `BASE_URL` via `obterOrigemApi()`.
- **Validação:** diagnósticos sem erros, `git diff --check` limpo e nenhum arquivo não mesclado.
- **Nota:** nenhum commit foi criado; alterações staged/locais preexistentes foram preservadas.

### Auditoria completa das MOBs

- **Tipo:** auditoria / qualidade
- **Status:** concluída em 2026-09-13.
- **Atualização:** criado [[RELATORIO_AUDITORIA_TASKS_MOBILE_2026-09-13]] com cruzamento entre tasks, commits, código atual, backend, migrations e validações executadas.
- **Achados críticos:** MOB-008/027 ainda não estão integradas ao fluxo mobile do professor; MOB-027 não tem migration executada comprovadamente; MOB-009 é visual; MOB-011 e MOB-012 são parciais; testes runtime continuam bloqueados.

### Auditoria de commits recentes

- **Tipo:** análise de histórico
- **Status:** concluída em 2026-09-13.
- **Commits confirmados:** `59d701b` (MOB-001 e SDK 54), `8c0f014` (MOB-005), `43b7959` (MOB-004/testes), `3cd1cd2` (MOB-003), `3a21ffc` (MOB-002).
- **Classificação:** MOB-001 a MOB-007 possuem implementação recente; MOB-010 a MOB-012 e MOB-014 foram resolvidas pela [[MOB-026_RESILIENCIA_DADOS_MOBILE]].
- **Pendências reais:** MOB-008 depende de endpoints backend de professor; MOB-009 depende somente da apresentação visual; MOB-023 ainda aguarda runner de testes.

### Especificação MOB-008 — Ficha do professor

- **Tipo:** decisão / especificação de contrato
- **Status:** definida em 2026-09-13; implementação ainda não iniciada.
- **Atualização:** será criada uma ficha exclusiva do professor, com endpoints próprios e escopo somente das atribuições do professor.
- **Dados:** nome completo, matrícula, turma, filial, data de nascimento, nome/contato do responsável, foto da batida facial mais recente, frequência facial, presença em sala, notas, observações e avisos.
- **Regras:** cinco abas; notas somente do professor atual; últimas cinco observações do professor atual.
- **Próxima task:** `MOB-027`, a ser criada antes de qualquer alteração de código.
- **Fonte:** [[TASKS_MOBILE_PONTO_SAAS]], task MOB-008.

### MOB-026 — Resiliência e integridade dos dados

- **Tipo:** task / implementação
- **Status:** iniciada em 2026-09-13.
- **Atualização:** criada [[MOB-026_RESILIENCIA_DADOS_MOBILE]] para resolver as tarefas não visuais de carregamento parcial, batida oficial, data dinâmica e validação de vínculo.

## 2026-10-19

### Incidente no cadastro de alunos — coluna de horário

- **Tipo:** análise / correção backend / validação
- **Atualização:** confirmado que o horário vem de `horarios_turmas` por `turma_id`; removidas as referências runtime a `horario_aluno_id` do cadastro, edição e resolução automática de alunos pelo dispositivo.
- **Validação:** a consulta read-only do `.env` local encontrou `public.alunos` sem a coluna, sem `public.horarios_alunos` e sem a FK, embora a migration histórica conste no ledger. `node --check`, diagnósticos e busca do campo em `backend/src` passaram.
- **Follow-up:** console do navegador ainda mostra `POST /api/alunos` HTTP 500; o `Failed to fetch` de `sw.js` é consequência. O fluxo completo com responsável/parentesco inseriu com sucesso usando matrícula/e-mail sintéticos no banco configurado localmente; esses registros foram removidos e a verificação posterior confirmou zero linhas. O 500 do Render não foi reproduzido sem o payload e stack reais. O schema local também tem unicidade global de matrícula, hipótese condicional se houver colisão entre empresas.
- **Limite:** não foi comprovado que o banco local é o mesmo usado pelo Render; o estado de produção e os dados legados não foram alterados.
- **Próximo passo:** confirmar o commit ativo no Render e obter o stack `[erro]` da requisição, incluindo a constraint PostgreSQL mencionada; não alterar unicidade ou limpar legado sem essa evidência.

## 2026-10-20

### Matrícula de aluno isolada por empresa

- **Tipo:** diagnóstico / migration preparada
- **Achado:** o serviço já verifica matrícula por empresa e existe a unique composta correspondente, mas o banco consultado também tem `alunos_matricula_unique` global, que bloqueia matrículas repetidas em escolas diferentes.
- **Atualização:** migration `20261020000001_scope_aluno_matricula_uniqueness.js` aplicada ao banco configurado no `.env` (batch 24); removeu somente a unicidade global e preservou a composta por empresa.
- **Validação:** teste com IDs sintéticos em transações revertidas aceitou a mesma matrícula entre empresas e rejeitou duplicidade na mesma empresa (`23505`); consulta posterior confirmou zero linhas de teste.
- **Produção:** Render mostrou `23505` na constraint `alunos_matricula_unique` para matrícula `1` às 15:46; migration batch 24 consta às 15:54 e duas edições retornaram HTTP 200 às 15:55.
- **Segurança do rollback:** falha com mensagem explícita se já houver duplicatas entre empresas.
- **Estado de publicação:** correção aplicada no banco e confirmada funcionando; o commit `deb86d7` está incluído em `main`/`origin/main` no histórico verificado em 2026-10-21.
- **Notas:** [[RELATORIO_BANCO_DE_DADOS_PONTO_SAAS]]

## 2026-10-21

### Inventário completo do backend

- **Tipo:** documentação / arquitetura
- **Atualização:** criado [[RELATORIO_INVENTARIO_BACKEND_PONTO_SAAS]] com inventário por arquivo de `backend/src`, dos 63 arquivos de migration, dos arquivos de configuração/scripts/seed e das skills espelhadas em `.agents`, `.claude` e `.windsurf`.
- **Escopo verificado:** 356 arquivos versionados no backend; 67 arquivos JavaScript em `src`; 213 documentos espelhados de skills (71 por diretório, conteúdo idêntico); nenhum caminho de testes está versionado dentro de `backend/`.
- **Arquitetura registrada:** API Express/Knex/PostgreSQL, autenticação e escopo tenant, workers separados, endpoint Evo Facial e WebSockets na porta HTTP compartilhada.
- **Limite:** documentação baseada no código versionado em `c010d5b`; não inclui valores de `.env` nem afirmações sobre estado não consultado de produção.

### Diagnóstico de conectividade HTTP versus comandos WebSocket do dispositivo

- **Tipo:** correção backend / interface / documentação
- **Causa:** o `checklive` HTTP e as batidas recebidas confirmam comunicação do equipamento, mas não criam uma sessão de WebSocket. Comandos como `getuserlist`, coleta sob demanda e envio de face precisam desse canal bidirecional.
- **Atualização:** o backend agora informa claramente quando o aparelho está online via HTTP sem canal de comando; o status da tela diferencia essa condição e a fila de faces só tenta transmitir com WebSocket ativo.
- **Arquivos:** `backend/src/modules/dispositivos/evoFacialServidor.js`, `backend/src/modules/dispositivos/adapters/EvoFacialAdapter.js`, `backend/src/modules/dispositivos/dispositivos.service.js`, `backend/src/modules/dispositivos/faceSync.service.js`, `web/src/utils/conexao.js`, `web/src/pages/DispositivoForm.jsx`.
- **Resultado:** batidas enviadas pelo aparelho via HTTP continuam sendo aceitas; operações remotas orientam a configurar o equipamento para WebSocket/WSS. Build web, lint focado e `node --check` passaram; o envio do comando depende de validar a configuração física e o deploy.
- **Evidência recebida:** o trecho Render de 13:40–13:42 contém apenas `POST /pub/api` com `cmd:"checklive"` a cada aproximadamente cinco segundos; não contém `sendlog` nem registro de conexão WebSocket. Esse trecho confirma heartbeat HTTP, mas não comprova que a batida foi entregue ao backend.
- **Configuração informada depois:** modelo AiFace, firmware `ai518_f40v_v2.13`; capturas mostram `Req. Servidor` e `Domínio` habilitados, porta 443, heartbeat 4 e `Servidor valida: Não`. O segundo print confirma `Enviar JSON` selecionado no menu `Função serial`, junto das opções Programas, Impressora e Código QR. Por estar na seção serial, isso não comprova capacidade de receber comandos pela rede nem de abrir WebSocket. Não registrar IP local, MAC nem senha neste vault.
- **Relação:** [[RELATORIO_INVENTARIO_BACKEND_PONTO_SAAS]]

## Como registrar novas atualizações

- Use uma entrada curta com data, tipo, resumo, área e links.
- Para uma task nova, adicione a task em [[TASKS_MOBILE_PONTO_SAAS]] e registre aqui apenas o resumo e o link.
- Para uma decisão arquitetural, crie ou atualize [[Decisões Arquiteturais Ponto SaaS]] e registre a decisão aqui.
- Para implementação, registre arquivos, validação e resultado; não cole o diff inteiro.
- Para pendência, registre o bloqueio e a informação necessária para resolvê-lo.
