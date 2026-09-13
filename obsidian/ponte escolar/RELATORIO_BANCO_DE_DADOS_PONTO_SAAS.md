---
id: 2026-09-12
tipo: relatorio-banco-de-dados
tags: [projeto, banco-de-dados, postgresql, knex, arquitetura, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Em Desenvolvimento"
fonte: "[[RELATORIO_TECNICO_ARQUITETURA_PONTO_SAAS]]"
---

# Relatório do Banco de Dados: [[Ponto SaaS]]

## 1. Resumo executivo

- Banco relacional PostgreSQL acessado pelo backend Node.js por Knex.
- O modelo reúne dois domínios no mesmo banco:
  - controle trabalhista/REP-P para funcionários;
  - domínio escolar para filiais, turmas, alunos, responsáveis, presença em sala e avisos.
- O isolamento principal é por `empresa_id`, com refinamento por `filial_id` e, em alguns recursos escolares, por `atribuicao_id`.
- A fonte operacional de evolução é `backend/migrations/`, com 49 migrations listadas até `20260906000003`.
- `schema.sql` é um dump para importação direta, mas não representa todas as migrations atuais.
- A maior fragilidade estrutural encontrada é a existência de estruturas escolares legadas e uma divergência entre dump e migrations, o que pode gerar bancos novos diferentes do banco evoluído.

## 2. Tecnologia e operação

- **SGBD:** PostgreSQL 14+ documentado no dump; o dump foi gerado a partir do PostgreSQL 16.14.
- **Driver/ORM:** `pg` + Knex `3.1.0`; não há uso ativo de Prisma como modelador de domínio.
- **Configuração:** [backend/knexfile.js](../../backend/knexfile.js) aceita `DATABASE_URL` ou conexão separada por host, porta, usuário, senha e banco.
- **SSL:** opcional por `DB_SSL`; produção possui pool máximo de 20 conexões e desenvolvimento máximo de 10.
- **Extensão:** `pgcrypto` fornece `gen_random_uuid()`.
- **Migrations:** tabela `knex_migrations`; execução por `npm run migrate` no backend.
- **Seed:** disponível por `npm run seed`.
- **Dump alternativo:** `schema.sql` deve ser importado **ou** as migrations devem ser executadas; os dois caminhos não devem ser misturados no mesmo banco.

## 3. Modelo de dados por domínio

### 3.1 Tenancy e organização

- `empresas`
  - raiz do tenant;
  - CNPJ único;
  - plano, ativo e estimativa de funcionários.
- `filiais`
  - pertence a uma empresa;
  - possui tipo `empresa` ou `escola`;
  - possui fuso horário e ativo.
- `usuarios`
  - usuários de staff;
  - papel `super_admin`, `admin`, `rh`, `gestor` e `professor`;
  - `empresa_id` pode ser nulo apenas para `super_admin`;
  - `filial_id` foi adicionado posteriormente.
- `departamentos`
  - estrutura organizacional do domínio trabalhista.

### 3.2 Funcionários e jornada

- `funcionarios`
  - matrícula e CPF únicos por empresa;
  - filial, departamento e horário de trabalho;
  - admissão, demissão e ativo.
- `horarios_trabalho`
  - tipo `fixo_semanal`, `escala_12x36` ou `flexivel`;
  - `config_semana` em JSONB;
  - carga horária, tolerância e banco de horas.
- `justificativas`
  - período, tipo, status, aprovação e anexo.
- `apontamentos_diarios`
  - um registro por funcionário/data;
  - batidas pareadas em JSONB;
  - minutos previstos, trabalhados, saldo, extras, atraso e status.
- `banco_horas_lancamentos`
  - ledger de créditos/débitos;
  - mantém `saldo_acumulado_apos` e referência opcional ao apontamento.
- `feriados`
  - feriados por empresa ou abrangência configurada.

### 3.3 Dispositivos e registros de ponto

- `dispositivos`
  - empresa, filial, modelo, biometria, situação, IP/porta, protocolo e modo de conexão;
  - suporta ZK e Evo Facial;
  - guarda último NSR, última coleta, comunicação WebSocket e `ultimo_devinfo` JSONB.
- `funcionario_dispositivos`
  - vínculo entre funcionário e ID interno do dispositivo;
  - unicidade por dispositivo/ID e funcionário/dispositivo.
- `aluno_dispositivos`
  - vínculo equivalente para alunos;
  - evita colisão lógica com IDs de funcionários no serviço.
- `registros_ponto`
  - tabela de alto volume, com PK bigint sequencial;
  - empresa, filial, dispositivo, funcionário ou aluno;
  - NSR, data/hora, tipo bruto, tipo interpretado, origem, geolocalização, foto e payload bruto;
  - `processado` indica entrada no cálculo diário;
  - CHECK impede funcionário e aluno simultaneamente.
- `afd_exports`
  - períodos e faixa NSR de exportações AFD;
  - arquivo gerado, quantidade e usuário responsável.

### 3.4 Domínio escolar

- `turmas`
  - empresa, filial, turno, ano letivo e ativo.
- `alunos`
  - empresa e filial obrigatórias;
  - matrícula única por empresa;
  - turma opcional, ativo, CPF e dados de contato;
  - possui histórico de alteração de horário legado via `horario_aluno_id`.
- `turma_professores`
  - atribuição de professor à turma e matéria;
  - dias, hora de início/fim e ativo;
  - `id` da atribuição é usado pelo mobile para chamada, notas e observações.
- `presencas_sala`
  - aluno, turma, professor, atribuição, data, presença, justificativa e matéria;
  - unicidade final por `atribuicao_id`, `aluno_id` e data.
- `horarios_turmas`
  - janela oficial de entrada/saída por turma;
  - a migration final tornou a janela única por turma, sem múltiplas linhas por dia.
- `notas_alunos`
  - disciplina, etapa, nota, bimestre, tipo de avaliação, atividade e observação;
  - CHECK de nota entre 0 e 10 e bimestre entre 1 e 4.
- `observacoes_alunos`
  - mensagens textuais vinculadas ao aluno, com autor e timestamps.
- `responsaveis`
  - conta de acesso dos pais/responsáveis, empresa, CPF, email, senha hash e ativo.
- `responsavel_alunos`
  - relação N:N entre responsável e aluno;
  - parentesco informativo e unicidade do vínculo.
- `push_tokens`
  - tokens Expo por responsável e plataforma;
  - token globalmente único.
- `avisos_escola`
  - mensagens por empresa/filial, publicação, ativo e, nas migrations posteriores, turma/agendamento.
- `aviso_leituras`
  - leitura por aviso/responsável, com unicidade do par.
- `aviso_alvos`
  - alvos por filial ou turma.

### 3.5 Segurança, permissões e auditoria

- `permissoes_papeis`
  - matriz de papel/recurso/ação;
  - migrations posteriores adicionam escopo por empresa, filial e atribuição.
- `permissoes_usuarios`
  - exceções individuais acima das permissões do papel;
  - também recebe escopo de empresa, filial e atribuição.
- `auditoria_logs`
  - ação, entidade, entidade_id, dados antes/depois, IP e usuário;
  - indexação por empresa, entidade e entidade_id.

## 4. Integridade e constraints

### Pontos fortes

- UUIDs com `gen_random_uuid()` para entidades de negócio.
- PK bigint em `registros_ponto`, compatível com alto volume e NSR/ordenação.
- Unicidade por tenant para CNPJ, matrícula de funcionário e matrícula de aluno.
- Unicidade de `dispositivo_id + nsr` para reduzir duplicidade de coleta.
- CHECKs para:
  - porta de dispositivo;
  - NSR positivo;
  - demissão após admissão;
  - datas de justificativa;
  - horas/minutos não negativos;
  - limite de extras;
  - minutos de banco de horas não zero;
  - nota e bimestre escolares;
  - horário de saída maior que entrada;
  - justificativa obrigatória quando falta é justificada.
- FKs compostas recentes garantem que registros relacionados pertençam à mesma empresa:
  - aluno/turma/filial;
  - turma/professor;
  - presença/turma/aluno/professor;
  - avisos/filiais;
  - registros de ponto/filial.
- `ON DELETE` foi ajustado com intenção de domínio:
  - `CASCADE` para dados dependentes do tenant;
  - `RESTRICT` para impedir apagar entidades históricas usadas em presença/notas;
  - `SET NULL` para referências operacionais que precisam sobreviver.
- Triggers `updated_at` existem para as tabelas trabalhistas principais.

### Pontos de atenção

- O dump mostra 21 tabelas, mas as migrations posteriores criam tabelas escolares e de permissões que não aparecem no `schema.sql` atual.
- A presença de várias migrations corretivas indica que o schema passou por reparos de escopo e integridade; banco criado por caminhos diferentes pode não ter o mesmo estado.
- Nem todas as tabelas novas aparecem na lista original de tabelas com trigger `updated_at`; confirmar se notas, observações, avisos, leituras e permissões precisam de atualização automática.
- Algumas relações antigas usam FKs simples e só depois receberam FKs compostas por empresa. A versão efetiva precisa ser validada após todas as migrations.

## 5. Riscos críticos

### Requisitos dos documentos recebidos

- O documento de modelagem descreve 33 grupos/tabelas, incluindo o núcleo trabalhista, escolar, permissões e controle de migrations.
- O documento de modelagem usa nomes no singular em seu script conceitual (`empresa`, `aluno`, `nota_aluno`), enquanto o backend/migrations usam nomes no plural (`empresas`, `alunos`, `notas_alunos`). O script documental não deve ser executado diretamente sem uma decisão de nomenclatura.
- O documento descreve campos escolares/financeiros como `ficha_medica`, `desconto_percentual`, `asaas_customer_id`, `cpf_responsavel` e dados financeiros que não aparecem no modelo ativo de `alunos` analisado. Devem ser classificados como requisito futuro, campo removido ou divergência documental.
- O documento descreve RLS por empresa, restrição adicional por filial, políticas por papel e gatilhos de proteção de campos.
- **Estado atual confirmado:** não foram encontradas ocorrências de `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY` ou `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nas migrations/schema analisados.
- **Estado atual confirmado:** o isolamento é aplicado pela camada HTTP em [backend/src/middlewares/tenant.js](../../backend/src/middlewares/tenant.js), e as permissões são consultadas por [backend/src/middlewares/permissions.js](../../backend/src/middlewares/permissions.js).
- **Estado atual confirmado:** existe o gatilho genérico `definir_updated_at()`, mas ele não cobre automaticamente todas as tabelas escolares/permissões criadas nas migrations posteriores.
- **Estado atual confirmado:** não existe gatilho identificado que impeça alteração direta de `empresa_id`, `filial_id`, autor, proprietário ou outros campos de segurança.

### Decisão técnica necessária antes de RLS

RLS não pode ser ativado diretamente em produção sem adaptar o acesso do backend. O pool Knex reutiliza conexões; cada transação/request precisará definir contexto de sessão de forma segura, por exemplo `app.empresa_id`, `app.filial_id`, `app.usuario_id`, `app.papel` e `app.is_super_admin`, usando `SET LOCAL` dentro de transação. Também é necessário evitar que a aplicação se conecte como owner das tabelas sem `FORCE ROW LEVEL SECURITY`, pois o owner normalmente pode ignorar políticas. A adoção deve ser incremental, com testes de vazamento e plano de rollback.

### DB-001 — `schema.sql` defasado em relação às migrations

- **Evidência:** `schema.sql` lista tabelas base, responsáveis e push tokens, mas não contém `turma_professores`, `presencas_sala`, `horarios_turmas`, `notas_alunos`, `observacoes_alunos`, `avisos_escola`, `aviso_leituras`, `aviso_alvos`, `permissoes_papeis` ou `permissoes_usuarios` encontrados nas migrations.
- **Impacto:** importação direta produz banco sem parte do domínio atual, embora o README apresente o dump como schema completo.
- **Risco:** instalação nova, disaster recovery e ambiente de homologação podem divergir da produção.
- **Recomendação:** regenerar o dump a partir de um banco com todas as migrations aplicadas ou retirar a opção de importação direta até automatizar a geração.

### DB-002 — `horarios_alunos` legado sem tenant

- **Evidência:** `20260826000006_fix_scope_and_student_schedule.js` cria `horarios_alunos` com `nome`, `turno`, `turma`, `dia_semana`, horários e sala, sem `empresa_id` ou `filial_id`.
- **Impacto:** o horário pode ser referenciado por qualquer aluno de qualquer empresa se o serviço validar somente o ID.
- **Risco:** mistura de dados entre tenants e modelo duplicado com `horarios_turmas`.
- **Recomendação:** decidir se `horarios_alunos` será removida, migrada para `horarios_turmas` ou receberá escopo completo; adicionar FKs compostas e validação no serviço antes de permitir novos vínculos.

### DB-003 — Migrações e dump não possuem um único artefato de verdade

- **Evidência:** README permite `schema.sql` ou Knex; migrations continuam evoluindo após o dump documentado.
- **Impacto:** ambientes podem ter tabelas, enums, índices e constraints diferentes.
- **Recomendação:** pipeline deve criar banco vazio via migrations, rodar smoke checks de schema e gerar dump versionado somente como artefato derivado.

### DB-004 — Integridade tenant depende parcialmente do código

- **Evidência:** [backend/src/middlewares/tenant.js](../../backend/src/middlewares/tenant.js) exige `empresa_id`/`filial_id` no fluxo da API, mas algumas tabelas históricas e relações foram criadas inicialmente com FKs simples.
- **Impacto:** uma query nova ou serviço que use apenas um ID pode atravessar empresas se não aplicar o filtro correto.
- **Recomendação:** ampliar FKs compostas e índices compostos onde o domínio exige; adicionar testes negativos tentando cruzar empresa/filial.

### DB-005 — Permissões escopadas exigem migração cuidadosa

- **Evidência:** `20260906000003_scope_permissoes_por_empresa.js` replica permissões antigas para cada empresa e bloqueia rollback quando há escopo por empresa, filial ou atribuição.
- **Impacto:** migration é deliberadamente não trivial e rollback pode ser impossível por segurança.
- **Recomendação:** executar backup, validação de contagens e plano de recuperação antes de produção; documentar migration como forward-only se esse for o contrato operacional.

## 6. Índices e desempenho

### Índices existentes relevantes

- Empresa/ativo para alunos e funcionários.
- Empresa/funcionário/data para registros e apontamentos.
- Empresa/aluno/data para presença facial escolar.
- Empresa/filial/data para registros de ponto.
- Dispositivo/situação e dispositivo/NSR.
- Turma/ano letivo e horário/turma/dia.
- Auditoria por empresa/entidade/entidade_id.
- Banco de horas por empresa/funcionário/data.
- Permissões por empresa/papel ou empresa/usuário/recurso/ação.

### Melhorias recomendadas

- Medir queries reais com `EXPLAIN (ANALYZE, BUFFERS)` antes de criar índices adicionais.
- Avaliar índice parcial para `registros_ponto(processado = false)` se a fila de processamento for grande.
- Avaliar particionamento ou retenção para `registros_ponto`, considerando crescimento por empresa e data.
- Confirmar índices para consultas de `avisos_escola` por responsável, filial, turma, ativo e período.
- Confirmar índice para `presencas_sala` por `empresa_id`, `aluno_id`, data e atribuição.
- Evitar índices duplicados gerados por migrations antigas e corretivas.
- Monitorar tamanho de JSONB em `payload_bruto`, `batidas` e `config_semana`.

## 7. Qualidade dos tipos e dados

- Normalização de CPF e CNPJ ocorre principalmente no serviço; o banco armazena strings formatadas/desformatadas conforme fluxo. Definir padrão único.
- Emails possuem unicidade global em `usuarios` e `responsaveis`; confirmar se a regra de negócio realmente impede o mesmo email em empresas diferentes.
- `filiais.cnpj` não aparece com unicidade por empresa; avaliar duplicidade e normalização.
- Valores escolares possuem campos textuais flexíveis (`etapa`, `tipo_avaliacao`, `atividade`); isso facilita evolução, mas reduz consistência analítica.
- `dias_semana` e `config_semana` em JSONB exigem validação de schema fora do banco ou constraints adicionais.
- `registros_ponto.tipo_batida` possui `indefinido`, o que é correto para ingestão bruta, mas exige fluxo explícito de resolução antes de relatórios oficiais.
- Fotos e payloads brutos podem conter dados pessoais sensíveis; definir retenção, criptografia, acesso e remoção.

## 8. Backup, migração e observabilidade

- Não foi encontrado neste escopo um procedimento automatizado de backup, restore e teste periódico de restauração.
- O `schema.sql` é útil para inspeção, mas não deve ser tratado como snapshot confiável enquanto estiver atrás das migrations.
- Migrations com `UPDATE` de dados e recriação de horários exigem backup e medição antes/depois.
- Toda migration de produção deve informar:
  - lock esperado;
  - volume afetado;
  - compatibilidade backward/forward;
  - estratégia de rollback ou declaração forward-only;
  - validação pós-migration.
- Adicionar checks automatizados:
  - todas as migrations aplicam em banco vazio;
  - schema dump e migrations produzem as mesmas tabelas/constraints;
  - FKs compostas não permitem cruzamento de tenant;
  - contagens de permissões antes/depois;
  - restore de backup em ambiente isolado.

## 9. Tasks recomendadas para o banco

> As tasks abaixo são de banco/backend e não devem ser confundidas com o backlog mobile `MOB-xxx`.

### DB-001 — Regenerar e validar `schema.sql`

- **Prioridade:** P0
- **Escopo:** gerar dump após todas as migrations e comparar tabelas, enums, índices, constraints e triggers.
- **Aceite:** importação direta e `knex migrate:latest` produzem o mesmo schema funcional.

### DB-002 — Resolver `horarios_alunos` legado

- **Prioridade:** P0
- **Escopo:** decidir migração para `horarios_turmas`, escopo por tenant ou remoção segura.
- **Aceite:** nenhum horário escolar pode ser associado entre empresas; não há dois modelos concorrentes sem justificativa.

### DB-003 — Testar isolamento multi-tenant no banco

- **Prioridade:** P0
- **Escopo:** fixtures de duas empresas e duas filiais, com tentativas cruzadas em alunos, turmas, professores, dispositivos, presenças, avisos e permissões.
- **Aceite:** FKs e serviços rejeitam todo vínculo cruzado; queries de leitura não vazam registros.

### DB-004 — Criar pipeline de validação de migrations

- **Prioridade:** P1
- **Escopo:** banco PostgreSQL limpo, migrations, seed, smoke queries e validação de rollback quando suportado.
- **Aceite:** execução reproduzível em CI e relatório de schema gerado.

### DB-005 — Revisar índices do domínio escolar e registros

- **Prioridade:** P1
- **Escopo:** usar métricas e `EXPLAIN ANALYZE`; cobrir feed de responsável, presença, avisos, fila de processamento e relatórios.
- **Aceite:** planos críticos não fazem scans desnecessários no volume esperado.

### DB-006 — Definir retenção e proteção de dados sensíveis

- **Prioridade:** P1
- **Escopo:** fotos, `payload_bruto`, auditoria, frequência, notas, avisos e tokens push.
- **Aceite:** política documentada em [[LGPD Dados de Crianças]] e jobs/constraints de retenção definidos.

### DB-007 — Implementar backup e restore verificável

- **Prioridade:** P1
- **Escopo:** backup automático, criptografia, retenção, restore em ambiente isolado e RPO/RTO.
- **Aceite:** restore periódico executado e evidenciado, não apenas backup criado.

### DB-008 — Preparar contexto de sessão para RLS

- **Prioridade:** P0
- **Relação com o documento:** pré-requisito para “isolamento por empresa”, “restrição por filial” e políticas por papel.
- **Escopo:** definir como o backend transmite para o PostgreSQL `empresa_id`, `filial_id`, `usuario_id`, `papel` e modo `super_admin`; aplicar contexto com `SET LOCAL` dentro de transações e limpar automaticamente ao devolver conexão ao pool.
- **Arquivos prováveis:** `backend/src/middlewares/tenant.js`, camada de acesso/transações, `backend/knexfile.js`, novas migrations e testes.
- **Aceite:** nenhuma requisição reutiliza contexto de outra; conexão sem contexto não acessa dados tenant; `super_admin` exige empresa explícita; testes cobrem concorrência com pool.
- **Dependência:** DB-003 e decisão de papel do usuário de banco.

### DB-009 — Implementar RLS por empresa

- **Prioridade:** P0
- **Relação com o documento:** “devem restringir os dados à empresa do usuário autenticado”.
- **Escopo:** habilitar RLS nas tabelas tenant, criar policies de `SELECT/INSERT/UPDATE/DELETE` usando contexto de sessão e garantir que inserts não aceitem `empresa_id` diferente do contexto.
- **Tabelas iniciais:** empresas dependentes, usuários, filiais, departamentos, funcionários, dispositivos, registros, apontamentos, justificativas, turmas, alunos, responsáveis, notas, observações, avisos, permissões e auditoria.
- **Aceite:** usuário de empresa A não consegue ler, inserir, atualizar ou excluir linhas de B mesmo por query direta feita pela aplicação; jobs internos usam papel técnico explícito e auditado.
- **Dependência:** DB-008.

### DB-010 — Implementar RLS adicional por filial

- **Prioridade:** P0
- **Relação com o documento:** “algumas tabelas devem limitar o acesso à filial do usuário”.
- **Escopo:** definir matriz por tabela: escopo somente empresa, empresa+filial, ou empresa+atribuição; aplicar filial nula apenas onde o domínio permitir; impedir que header altere o escopo além do token.
- **Tabelas candidatas:** usuários, funcionários, dispositivos, turmas, alunos, registros, AFD, avisos e permissões; validar exceções para `super_admin` e gestor.
- **Aceite:** professor/gestor restrito à filial não acessa outra filial da mesma empresa; dados sem filial têm regra explícita; tentativas de cruzamento retornam vazio/negação e são auditadas.
- **Dependência:** DB-008 e matriz de autorização documentada.

### DB-011 — Mapear permissões por papel para RLS e API

- **Prioridade:** P1
- **Relação com o documento:** “as tabelas de permissões permitem implementar autorização por função”.
- **Escopo:** manter `permissoes_papeis`/`permissoes_usuarios` como autorização de ação no serviço e usar RLS como barreira de escopo de dados; não duplicar regras de negócio de papel em policies sem uma fonte de verdade.
- **Aceite:** `ver/adicionar/atualizar/deletar` continua sendo decidido pela camada de permissões; RLS limita linhas independentemente do endpoint; exceções por usuário/filial/atribuição são testadas.
- **Dependência:** DB-008, DB-009 e DB-010.

### DB-012 — Completar gatilhos de `updated_at`

- **Prioridade:** P1
- **Relação com o documento:** “atualização automática de `updated_at`”.
- **Escopo:** aplicar o gatilho padrão a todas as tabelas que possuem `updated_at`, incluindo tabelas escolares, avisos, leituras quando aplicável e permissões com timestamp; evitar duplicidade de triggers em bancos migrados.
- **Aceite:** qualquer `UPDATE` altera `updated_at`; atualização idempotente é definida; migration pode ser aplicada em banco vazio e existente; dump contém os mesmos triggers.
- **Dependência:** DB-001 e inventário final de tabelas.

### DB-013 — Proteger campos de segurança contra alteração indevida

- **Prioridade:** P1
- **Relação com o documento:** “gatilho pode impedir que usuários alterem diretamente campos de segurança”.
- **Escopo:** definir campos imutáveis ou controlados: `empresa_id`, `filial_id`, proprietário/autor, vínculos de tenant, `created_at`, identificadores de auditoria e, quando aplicável, `senha_hash`; permitir alterações administrativas por função técnica/flag transacional auditada.
- **Aceite:** alteração comum não consegue mover uma linha entre empresa/filial; mudança autorizada ocorre somente por serviço explícito; toda exceção gera auditoria; trigger não quebra cadastro/login legítimo.
- **Dependência:** DB-008 e decisão de quais campos podem ser alterados por workflow.

### DB-014 — Testar RLS, triggers e concorrência com pool

- **Prioridade:** P0
- **Escopo:** criar banco de teste com duas empresas, duas filiais, papéis distintos e conexões concorrentes; validar RLS, `updated_at`, campos protegidos, jobs, migrations e rollback/forward-only.
- **Aceite:** zero vazamento entre empresas/filiais; contexto não vaza entre requests; triggers cobrem todas as tabelas; migrations são reproduzíveis; relatório de evidência é armazenado no vault.
- **Dependências:** DB-008 a DB-013.

## 10. Conclusão

A modelagem apresenta boa evolução: separação por empresa/filial, UUIDs, constraints de domínio, unicidade de ingestão, ledger de banco de horas e reforço de FKs compostas. O banco já suporta o núcleo trabalhista e escolar com uma arquitetura relacional adequada ao monólito modular.

O principal risco não é ausência de tabelas básicas, mas **divergência de schema e legado não escopado**. Antes de ampliar funcionalidades, a prioridade deve ser alinhar `schema.sql` às migrations, resolver `horarios_alunos`, provar isolamento multi-tenant com testes negativos e estabelecer backup/restore verificável.
