---
id: 2026-09-12
tipo: task-mobile
tags: [projeto, mobile, offline-first, seguranca]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída com testes automatizados pendentes"
prioridade: P0
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-021 — Isolar fila offline por conta

## Problema

`mobile/src/filaOffline.js` usa uma chave global (`@ponto_saas_fila_offline`). Uma ação criada por um responsável pode ser exibida ou reenviada depois do login de um professor, com o token da sessão atual.

## Escopo

- Namespacear a fila por perfil, identidade, empresa e filial.
- Exigir namespace nas operações de leitura, gravação, remoção, retry e processamento.
- Migrar a fila legada de forma explícita, sem atribuí-la silenciosamente a outra conta.
- Pausar o processamento quando não houver identidade autenticada.
- Atualizar telas e serviços que observam a fila.
- Limpar a fila do perfil atual no logout; não tocar em filas de outras contas.

## Arquivos prováveis

- `mobile/src/filaOffline.js`
- `mobile/src/api.js`
- `mobile/src/context/AuthContext.js`
- `mobile/src/App.js`
- `mobile/src/screens/InicioScreen.js`
- `mobile/src/screens/SincronizacaoScreen.js`

## Critérios de aceite

- [x] responsável e professor possuem filas distintas;
- [x] ação nunca é processada sem namespace autenticado;
- [x] troca de perfil não exibe a fila de outra conta;
- [x] fila legada fica bloqueada para decisão explícita, sem reenvio automático;
- [x] logout limpa apenas a fila do perfil atual;
- [x] ouvintes recebem apenas a fila do namespace assinado;
- [x] processamento continua em ordem dentro da fila correta;
- [x] diagnósticos dos módulos alterados passam;
- [ ] testes automatizados de isolamento e concorrência.

## Resultado

- A task original MOB-003 foi substituída por esta task nova para respeitar a política de versionamento do backlog.
- A fila antiga permanece separada e é apresentada na tela de sincronização para descarte explícito; nunca é enviada com uma identidade atual.

## Dependências

- MOB-002: cache por conta, já concluída.
- Política de sessão/identidade do `AuthContext`.
- MOB-020: testes automatizados, ainda pendente.

## Validação

- Diagnóstico dos módulos alterados.
- Teste com duas identidades e fila pendente.
- Teste de logout/troca de perfil.
- Teste de fila legada.
- Teste de processamento online/offline.

## Decisão de segurança

A fila legada não será automaticamente associada à primeira sessão encontrada. Ela deve permanecer bloqueada até ser migrada, exportada ou removida por uma ação explícita.
