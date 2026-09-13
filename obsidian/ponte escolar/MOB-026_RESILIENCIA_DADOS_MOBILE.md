---
id: 2026-09-13
tipo: task-mobile
tags: [projeto, mobile, dados, resiliencia, validacao]
projeto: "Ponto SaaS / Ponte Escolar"
status: "Concluída com testes automatizados pendentes"
prioridade: P1
relacionada: "[[TASKS_MOBILE_PONTO_SAAS]]"
---

# MOB-026 — Resiliência e integridade dos dados mobile

## Problema

O detalhe do aluno carrega cinco recursos com `Promise.all`, classifica batidas por alternância quando o backend pode fornecer o tipo oficial, e telas de chamada usam uma data congelada na importação do módulo. O vínculo de filho também pode entrar na fila sem validação local mínima.

## Escopo

- Carregar abas do aluno de forma parcial, sem travar todas as abas por uma falha.
- Usar `tipo_batida`/`tipo` oficial quando disponível.
- Recalcular a data da chamada ao foco da tela.
- Validar nome, matrícula e CPF antes de enfileirar vínculo.
- Não alterar layout além dos estados necessários para representar erro parcial.

## Arquivos prováveis

- `mobile/src/screens/AlunoDetalheScreen.js`
- `mobile/src/screens/ChamadaScreen.js`
- `mobile/src/screens/InicioScreen.js`
- `mobile/src/screens/AdicionarFilhoScreen.js`

## Critérios de aceite

- [x] uma falha de aba não deixa o detalhe inteiro em loading;
- [x] erro de uma aba não apaga dados válidos das outras;
- [x] tipo oficial de batida prevalece sobre alternância;
- [x] data da chamada acompanha o dia atual em São Paulo;
- [x] vínculo inválido não entra na fila offline;
- [x] diagnósticos dos módulos passam;
- [ ] testes automatizados.

## Dependências

- Contratos atuais de frequência e vínculo no backend.
- MOB-020/MOB-023 para cobertura automatizada quando o runner estiver instalado.

## Validação

- Diagnóstico dos arquivos alterados.
- Fixtures de resposta parcial e falha isolada.
- Registros com tipo oficial e registros legados.
- Teste próximo à meia-noite em `America/Sao_Paulo`.
- CPF vazio, inválido e válido; matrícula e nome ausentes.
