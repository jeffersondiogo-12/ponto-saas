# Ponto SaaS

Sistema multi-empresa de controle de ponto com integração a relógios biométricos
(REP-P, Portaria 671/2021), com suporte a dois tipos de unidade — **empresa**
(funcionários/CLT) e **escola** (alunos/turmas) — no mesmo sistema, e um app
para os pais acompanharem a chegada/saída dos filhos com notificação push.

## 1. Estrutura do monorepo

```
ponto-saas/
├── backend/    API pura (Node/Express + Knex + PostgreSQL) — nenhuma tela aqui
├── web/        Site (React + Vite) — painel de empresas/escolas (staff)
├── mobile/     App (React Native + Expo) — pais acompanhando os filhos
└── schema.sql  Dump do banco, pronto pra importar direto (ver seção 2)
```

`backend/` foi separado de vez do frontend nesta rodada: antes ele também
renderizava páginas EJS, agora é só JSON, consumido pelo site e pelo app da
mesma forma (autenticação 100% Bearer token, sem cookie — um app mobile não
tem "cookie de navegador").

**Por que dois frameworks de frontend em vez de um só**: cheguei a considerar
usar só React Native + `react-native-web` pros dois, mas o site é
essencialmente tabelas e formulários densos (cadastro de dispositivo,
unidade, etc.) — isso é mais natural em HTML/CSS direto do que forçando
componentes de app numa tela de desktop. E notificação push de verdade no
iPhone só funciona com um app nativo mesmo — não dá pra terceirizar isso pro
navegador. Então: **React + Vite** pro site, **React Native + Expo** pro app.
Pensei também em criar um pacote `shared/` pro cliente de API e desisti — o
que sobraria pra compartilhar é um arquivo de ~40 linhas, pequeno demais pra
justificar um terceiro pacote com configuração própria (Metro, o bundler do
Expo, tem regras próprias e um tanto frágeis pra resolver pacotes fora da
pasta do projeto num monorepo). Cada frontend tem o seu.

## 2. Backend — setup e teste

Precisa de PostgreSQL e Node.js instalados (processos separados — o Node não
"roda" o banco, só se conecta nele). Sem Postgres local:
`docker run -e POSTGRES_PASSWORD=ponto -e POSTGRES_USER=ponto -e POSTGRES_DB=ponto_saas -p 5432:5432 postgres:16`

Criar o banco (escolha **uma** das duas formas):

**Opção A — importar `schema.sql` direto:**
```bash
createdb ponto_saas
psql -U ponto -d ponto_saas -f schema.sql
```

**Opção B — Knex a partir das migrations** (recomendado se for continuar
desenvolvendo):
```bash
cd backend && npm install && npm run migrate
```
Não faça as duas no mesmo banco.

Rodar a API:
```bash
cd backend
cp .env.example .env
# edite .env: credenciais do Postgres, JWT_SECRET, DEVICE_CREDENTIALS_KEY
#   (gere as duas com: openssl rand -hex 32)
# CORS_ORIGINS já vem com http://localhost:5173 (Vite) e :19006 (Expo web)
# EVO_FACIAL_WS_PORT já vem com um padrão (9998) - só mude se essa porta colidir com algo
npm install
npm run seed      # opcional: empresa "Weld Inox" + os dois dispositivos de exemplo (ZK e Evo Facial)
npm run dev       # http://localhost:3000 (API REST + WebSocket de eventos em /ws)
```

O backend também mantém o WebSocket de eventos em `ws://localhost:3000/ws`.
Ele usa o mesmo JWT da API, por exemplo: `ws://localhost:3000/ws?token=SEU_JWT`.
Eventos de presença de aluno, notas, observações e avisos são enviados somente
para a empresa e os alunos autorizados daquele token. O WebSocket do
equipamento Evo Facial continua na porta definida por `EVO_FACIAL_WS_PORT`.

Teste rápido: `curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@weldinox.example.com","senha":"admin123"}'`
deve devolver um token JSON.

Coleta automática dos relógios em segundo plano: `npm run coleta:worker`

## 3. Site (staff) — setup e teste

```bash
cd web
npm install
cp .env.example .env   # VITE_API_URL apontando pro backend
npm run dev             # http://localhost:5173
```

Faz login com as mesmas credenciais do backend. As telas de Dispositivos e
Unidades já estão portadas para React (mesmo design, mesma lógica); as
demais (Funcionários, Turmas, Alunos, Relatórios, Banco de horas) ainda usam
só a API por enquanto — ver seção 7.

## 4. App dos pais (mobile) — setup e teste

```bash
cd mobile
npm install
npx expo start
```
Aponte `EXPO_PUBLIC_API_URL` (num `.env` na pasta `mobile/`) para o IP da
máquina rodando o backend na rede local — **nunca** `localhost`, porque no
celular/emulador isso resolveria para o próprio dispositivo, não para o seu
computador.

O app usa o REST para sincronizar e mantém alunos, presença, notas,
observações e avisos em cache local. Sem rede, as últimas leituras continuam
disponíveis e vínculos feitos offline ficam em fila para sincronização. Ao
voltar a rede, o WebSocket reconecta e as telas abertas são atualizadas.

**Antes de gerar uma build de verdade**, rode `npx eas init` dentro de
`mobile/` e copie o `projectId` gerado para `extra.eas.projectId` no
`app.json` — sem isso, o pedido de token de push (`getExpoPushTokenAsync`)
não tem como saber a qual projeto do Expo pertence, e a tela de login vai
funcionar normalmente mas a notificação nunca vai chegar.

**Fluxo de teste manual, do zero:**
1. Pela API ou pelo site, crie uma unidade tipo escola, uma turma e um aluno
   (a matrícula é o que conecta o responsável ao filho).
2. No app: tela de cadastro do responsável (ainda não tem tela própria —
   use `POST /api/responsaveis/cadastro` direto por enquanto, ver seção 7),
   informando a matrícula do aluno.
3. Login no app com o e-mail/senha cadastrados.
4. A tela inicial deve listar o aluno vinculado; tocando nele, mostra o
   histórico de chegada/saída.
5. Simule uma nova batida do dispositivo (`POST /api/dispositivos/:id/forcar-coleta`,
   ou insira direto em `registros_ponto` com o `aluno_id` certo) — isso
   deve disparar uma notificação push pro celular que fez login e tem
   permissão concedida.

**O que eu consegui validar sem um celular físico**: testei o passo 5
inteiro pelo backend (a notificação é disparada, não trava a coleta, e o
código chama o endpoint certo do Expo) — mas não tenho como confirmar que a
notificação *chega* num aparelho real a partir daqui. Isso só se confirma
rodando de verdade com o Expo Go ou uma build de desenvolvimento.

## 5. Notas de conformidade legal (Portaria 671/2021)

Isto é engenharia, não parecer jurídico — antes de operar isto comercialmente
para clientes reais, valide com um advogado trabalhista/contador. Mas a
arquitetura já foi desenhada em torno destes pontos, confirmados via pesquisa:

- Empresas com **mais de 20 empregados CLT** são obrigadas a manter controle
  de ponto (CLT art. 74 §2º).
- Este é um sistema **REP-P** — categoria criada pela Portaria 671/2021 para
  sistemas em software, sem hardware certificado pelo INMETRO. **Essa
  regulação vale só para o lado funcionário/empresa** — chegada/saída de
  aluno não é ponto eletrônico trabalhista e não gera AFD.
- **O REP-P precisa de certificado de registro de programa de computador no
  INPI** (art. 91) — providência formal, não tarefa de código.
- O sistema **nunca pode bloquear ou restringir** o horário de marcação.
- **AFD** (batidas brutas, NSR sequencial) segue a estrutura documentada
  (pipe-delimitado, CRC-16/KERMIT), mas o layout byte-a-byte exato deve ser
  validado contra o PDF oficial antes de uso real:
  https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf
- **Dados de aluno menor de idade** (nome de responsável, frequência,
  notificação push): vale revisar com um advogado a adequação à **LGPD**
  quanto a dados de crianças/adolescentes (Art. 14) — camada de conformidade
  diferente da trabalhista, fora do escopo desta rodada.

## 6. A situação do protocolo do relógio

**Atualização: o protocolo real chegou e está implementado.** O fabricante
por trás do "Evo Facial AI-5" é a **Evo Sistemas Inteligentes**
(Curitiba/PR — contato@evosistemasinteligentes.com.br), que forneceu o
documento oficial do protocolo ("Protocolo WebSocket EVO FACIAL — Revisão
5"). Diferente do `ZkProtocolAdapter.js` (que segue sendo uma hipótese não
confirmada, mantido por precaução), o protocolo Evo Facial real é
**WebSocket + JSON, com o equipamento como client** — ele se conecta a
este backend, não o contrário. Isso muda a arquitetura de coleta:

- **`ZkProtocolAdapter` (dispositivo `modo_conexao=client`)**: o backend
  abre a conexão, por polling (`npm run coleta:worker`, a cada
  `COLETA_INTERVALO_MINUTOS`).
- **`EvoFacialAdapter` (dispositivo `modo_conexao=server`, `protocolo=evo_ws`)**:
  o equipamento abre a conexão contra este backend (`reg` a cada 20s até
  ser confirmado; `sendlog` a cada nova marcação). O servidor WebSocket que
  aceita essas conexões (`backend/src/modules/dispositivos/evoFacialServidor.js`)
  roda **dentro do mesmo processo do backend** (não precisa de um worker
  separado) — configure no menu do próprio equipamento o IP deste servidor
  e a porta de `EVO_FACIAL_WS_PORT` (`.env`, padrão `9998`).

**Para testar sem o equipamento físico**, há um simulador que fala o
protocolo real:
```bash
cd backend
npm run simular:evo-facial -- --sn=EVOFACIAL0001 --bater-ponto
```
(o dispositivo de exemplo `EVOFACIAL0001` já vem no `npm run seed`). Use
`--responder-comandos` para também simular o equipamento respondendo a
comandos do servidor (cadastro/remoção remota de face, listagem de
usuários) — ver comentário no topo do script para todas as opções.

**O que este adapter cobre**: registro do equipamento, recebimento de
marcações (incluindo foto, quando o modo de verificação inclui
reconhecimento facial — servida de volta via
`GET /api/ponto/registros/:id/foto`, autenticada), cadastro e remoção
remota de rosto (`POST /api/dispositivos/:id/cadastrar-face` e
`/remover-face` — dispensa ir até o equipamento fisicamente), e listagem
dos usuários cadastrados no equipamento para reconciliação. **O que fica de
fora por ora** (o protocolo documenta mas não foi implementado, por não ser
essencial ao fluxo de ponto): reboot remoto, ajuste de data/hora,
abertura remota de porta, controle de catraca e as particularidades de
equipamento 4G — a função `enviarComando()` em `evoFacialServidor.js` já
resolve a troca de mensagens ponto-a-ponto, então adicionar qualquer um
desses é majoritariamente escrever mais um método curto no adapter, não
uma peça de arquitetura nova.

**Uma interpretação sem confirmação 100% byte-a-byte**: o PDF não deixa
explícito como numerar de forma única cada marcação dentro de um mesmo
lote de `sendlog` (só expõe um `logindex` por lote). Seguimos a mesma
solução já usada no `ZkProtocolAdapter` para uma lacuna parecida: gerar um
NSR sequencial internamente a partir do `ultimo_nsr` já persistido, em vez
de confiar num campo do equipamento para isso — ver comentário em
`evoFacialServidor.js` (`tratarSendlog`).

Veja `backend/src/modules/dispositivos/adapters/` para o padrão geral de
adapter e como trocar/adicionar protocolos sem afetar o resto do sistema
(site, app e a resolução funcionário/aluno seguem agnósticos ao protocolo
do dispositivo).


## 8. Segurança

- Senha de dispositivo cifrada com AES-256-GCM; senhas de usuário/responsável
  com bcrypt (12 rounds).
- JWT Bearer, nunca cookie; toda rota de staff exige explicitamente
  `tipo: 'staff'` no token (não só a ausência de erro) — um token de
  responsável não consegue acessar rota de staff nem vice-versa, testado.
- Toda query filtra por `empresa_id` vindo do token, nunca de parâmetro de
  URL/corpo.
- Uma batida nunca resolve para funcionário E aluno ao mesmo tempo — CHECK
  constraint no banco.
- `npm audit` no backend e no app mobile aponta algumas vulnerabilidades
  moderadas/altas — todas em dependências de build-time (ex: toolchain de
  compilação nativa do bcrypt, tooling interno do Expo/xcode), não em código
  que roda a cada requisição. Revisei uma por uma antes de decidir não
  corrigir agora; não são alarme de produção, mas vale reavaliar
  periodicamente com `npm audit`.
"# ponto-saas" 
