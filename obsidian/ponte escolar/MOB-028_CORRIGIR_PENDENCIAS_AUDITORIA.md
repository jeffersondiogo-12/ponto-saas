---
id: 2026-09-13
tipo: task-fullstack
tags: [projeto, mobile, backend, qualidade, auditoria]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída com migration bloqueada"
prioridade: P0
relacionada: "[[RELATORIO_AUDITORIA_TASKS_MOBILE_2026-09-13]]"
---

# MOB-028 — Corrigir pendências da auditoria

## Problema

A auditoria encontrou pendências funcionais e de dados: `InicioScreen` ainda usa data congelada, CPF não é normalizado no payload, o backend reclassifica tipos oficiais de batida e a migration da ficha do professor não foi validada em banco.

## Escopo

- Corrigir data dinâmica no `InicioScreen`.
- Normalizar CPF antes de enviar o vínculo.
- Preservar tipo oficial de batida; alternância somente quando o tipo estiver indefinido.
- Tentar aplicar/validar migrations em banco configurado, sem inventar conexão.
- Atualizar o segundo cérebro com resultado e bloqueios.

## Critérios de aceite

- [x] `InicioScreen` usa a data atual no fuso de São Paulo ao focar/carregar;
- [x] payload de vínculo envia CPF somente com dígitos;
- [x] registros com tipo oficial não são sobrescritos por alternância;
- [x] migration MOB-027 foi tentada e ficou bloqueada com motivo documentado;
- [x] diagnósticos e validações disponíveis passam.

## Validação

- Diagnósticos mobile/backend.
- `node --check` no backend.
- Testes/queries em banco se houver `DATABASE_URL` configurada.

## Resultado

- Código corrigido e validado estaticamente.
- A aplicação da migration foi tentada, mas o banco local recusou conexão em `127.0.0.1:5432`; a migration permanece pendente.
