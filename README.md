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
npm install
npm run seed      # opcional: empresa "Weld Inox" + dispositivo do print original
npm run dev       # http://localhost:3000
```

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

O fabricante real por trás do "Evo Facial AI-5" é a **Evo Sistemas
Inteligentes** (Curitiba/PR — contato@evosistemasinteligentes.com.br), que
declara oferecer um SDK para integradores — esse é o caminho definitivo.
Enquanto isso não chega, o backend usa um adapter experimental
(`ZkProtocolAdapter.js`, biblioteca `node-zklib`) baseado no protocolo mais
comum entre terminais biométricos chineses revendidos no Brasil — **não
confirmado para o seu equipamento especificamente**. Veja
`backend/src/modules/dispositivos/adapters/` para como validar e trocar o
protocolo sem afetar o resto do sistema (site, app e a resolução
funcionário/aluno são todos agnósticos ao protocolo do dispositivo).

## 7. O que fica para a próxima etapa

- Telas no site para Funcionários, Turmas, Alunos, Relatórios, Banco de
  horas (o padrão já está em Dispositivos/Unidades — extensão direta).
- Tela de cadastro do responsável dentro do próprio app (hoje só existe via
  API — `POST /api/responsaveis/cadastro`).
- Um endpoint tipo `/api/responsaveis/me` para restaurar os dados da sessão
  ao reabrir o app sem precisar logar de novo (hoje só guardamos se HÁ
  token, não os dados do responsável).
- Gerador de AEJ e assinatura PAdES no comprovante.
- Suporte completo a escala 12x36 (hoje usa aproximação de 12h fixas).
- Fila de resolução manual para batidas sem funcionário/aluno vinculado.

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
