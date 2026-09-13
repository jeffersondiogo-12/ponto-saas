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

## Como registrar novas atualizações

- Use uma entrada curta com data, tipo, resumo, área e links.
- Para uma task nova, adicione a task em [[TASKS_MOBILE_PONTO_SAAS]] e registre aqui apenas o resumo e o link.
- Para uma decisão arquitetural, crie ou atualize [[Decisões Arquiteturais Ponto SaaS]] e registre a decisão aqui.
- Para implementação, registre arquivos, validação e resultado; não cole o diff inteiro.
- Para pendência, registre o bloqueio e a informação necessária para resolvê-lo.
