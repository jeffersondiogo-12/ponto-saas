---
id: 2026-09-13
tipo: auditoria-tecnica
tags: [projeto, mobile, backend, tasks, qualidade]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Auditoria concluída"
---

# Auditoria das Tasks Mobile: [[Ponto SaaS]]

## Resumo crítico

O histórico recente confirma trabalho relevante em MOB-001 a MOB-007, mas o backlog está superestimando a conclusão de algumas tasks. Os problemas mais importantes são:

1. MOB-008/027 ainda não completam o fluxo mobile do professor: o backend foi criado, mas a navegação continua usando `AlunoDetalheScreen` com rotas de responsável.
2. A migration da MOB-027 não foi comprovadamente executada em banco real e registros antigos de notas/observações continuam sem autor.
3. MOB-009 tem dados de `horarios_turma` no backend, mas nenhuma tela mobile os apresenta.
4. MOB-011 é parcial: o backend pode reclassificar `tipo_batida` por alternância quando considera a sequência não confiável.
5. MOB-012 foi corrigida em `ChamadaScreen`, mas `InicioScreen` ainda calcula `HOJE` na importação.
6. MOB-002, MOB-021, MOB-025, MOB-026 e MOB-022 têm diagnósticos, mas não têm validação automatizada/runtime completa porque `jest-expo` não está materializado em `node_modules`.

## Matriz de status

| Task | Situação | Evidência / problema |
|---|---|---|
| MOB-001 | Parcialmente validada | Home real foi implementada no commit recente; faltam testes de estados vazio/erro/cache. |
| MOB-002 | Implementada, sem testes executados | Cache namespaceado/TTL presentes; suíte bloqueada. |
| MOB-003 | Substituída | Implementação está na MOB-021. |
| MOB-004 | Substituída | Implementação está na MOB-022. |
| MOB-005 | Implementada, sem runtime | AuthContext/API tratam 401/offline; falta teste real. |
| MOB-006 | Implementada, sem runtime | Sincronização usa função nomeada; falta teste com fila/falha. |
| MOB-007 | Implementada, sem build | Origem HTTP/WS compartilhada; falta validar APK/dispositivo. |
| MOB-008 | Incompleta | Ficha do professor ainda não está integrada à navegação mobile. |
| MOB-009 | Backend pronto, UI pendente | `horarios_turma` existe no contrato, mas não é exibido. |
| MOB-010 | Implementada, sem testes | `Promise.allSettled` presente. |
| MOB-011 | Parcial | Cliente usa tipo oficial, mas backend pode sobrescrever classificação. |
| MOB-012 | Parcial | Chamada atualiza data; `InicioScreen` ainda congela `HOJE`. |
| MOB-013 | Não iniciada | Rascunho da chamada continua em estado React. |
| MOB-014 | Parcial | Valida CPF/nome/matrícula, mas payload não é normalizado antes do envio. |
| MOB-015 | Cancelada | Conteúdo de notificações deve permanecer visível. |
| MOB-016 | Não iniciada | Sem Error Boundary/telemetria segura confirmados. |
| MOB-017 | Não iniciada | Acessibilidade ainda não foi sistematizada. |
| MOB-018 | Não iniciada | Tokens visuais antigos ainda podem ser referenciados. |
| MOB-019 | Não iniciada | Código legado comentado permanece em `HomeScreen`. |
| MOB-020 | Não iniciada | Cobertura mínima ainda não executada. |
| MOB-021 | Implementada, sem testes | Namespace e bloqueio legado presentes. |
| MOB-022 | Implementada, sem dispositivo | Secure Store/migração presentes; falta teste nativo. |
| MOB-023 | Preparada e bloqueada | `jest-expo` declarado, mas ausente em `node_modules`. |
| MOB-024 | Cancelada | Projeto permanece no Expo 54. |
| MOB-025 | Implementada, sem ambiente | Auth/realtime/sync alinhados; falta runtime. |
| MOB-026 | Parcialmente validada | Correções implementadas; testes pendentes. |
| MOB-027 | Backend parcial | Endpoint/migration/serviço existem; tela, migration aplicada e integração pendentes. |

## Commits verificados

- `59d701b`: MOB-001, navegação e retorno ao SDK 54.
- `8c0f014`: MOB-005.
- `43b7959`: MOB-004 e preparação da suíte.
- `3cd1cd2`: MOB-003/MOB-021.
- `3a21ffc`: MOB-002.

Os commits comprovam alterações, não a execução de migrations, testes em dispositivo ou testes end-to-end.

## Ações prioritárias

1. Finalizar MOB-027: aplicar migration, criar testes de autorização e integrar nova tela do professor com `turmaId`/`atribuicaoId`.
2. Corrigir `InicioScreen` para data dinâmica.
3. Decidir se o backend deve preservar sempre `tipo_batida` oficial ou documentar o fallback de alternância.
4. Exibir `horarios_turma` no fluxo responsável, caso a task visual seja retomada.
5. Instalar dependências do mobile e executar `npm test -- --runInBand`.
6. Testar Secure Store, WebSocket, 401 e fila em build Android/iOS.
7. Normalizar CPF antes de enviar o vínculo.

### Atualização M14 / #25 — Histórico de notas

O escopo foi ampliado para incluir `bimestre`, `tipo_avaliacao` e `atividade` no `SELECT` de `historicoDoAluno` do backend. Os filtros por aluno e disciplina, a ordenação e o limite da consulta permanecem inalterados.

## Conclusão

O núcleo de segurança local e sessão evoluiu, mas “implementado” ainda não significa “validado”. O maior risco funcional é o professor continuar abrindo uma ficha de responsável apesar do endpoint novo existir. O maior risco de qualidade é o backlog marcar correções sem testes executáveis ou migration aplicada.
