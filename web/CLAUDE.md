# Front-end (web/) — Preferências e Contexto

> **Leia este arquivo antes de qualquer mudança no front-end.** Ele guarda as
> decisões visuais, as convenções do código e o backlog acordado. Está nomeado
> `CLAUDE.md` de propósito: o Claude Code carrega automaticamente arquivos com
> esse nome ao trabalhar nesta pasta, então ele é lido sem ninguém precisar pedir.
>
> Ao concluir uma tarefa do backlog, marque o checkbox e anote aqui o que mudou.

> **Regra de escopo: não altere nada dentro de `backend/`.** O backend é mantido
> por outra pessoa e chega por `git pull`. Se uma tarefa de front depender de
> mudança no servidor, registre a dependência aqui e pare — não implemente do
> lado de lá.

---

## 1. Stack

- **React 19** + **Vite 8** (bundler rolldown), JavaScript puro — sem TypeScript
- **react-router-dom 7** para rotas
- **Sem biblioteca de UI** e **sem Tailwind**: todo o estilo vive em
  `src/index.css` (~100 linhas), com classes semânticas e tokens em `:root`
- **oxlint** como linter (`npm run lint`)

### Como rodar

O repositório é um monorepo com workspaces (`backend` + `web`). O `npm install`
roda **na raiz**, nunca dentro de `web/`:

```bash
npm install --prefix <raiz>
npm run dev --prefix <raiz> --workspace=web   # http://localhost:5173
```

O front consome a **API hospedada**, não um backend local. O endereço vem de
`web/.env`:

```
VITE_API_URL=https://ponto-saas-u8zf.onrender.com
```

Sem barra no final — `api.js` concatena `${BASE_URL}${caminho}` direto.
O Vite escuta em `::1` (IPv6); testes locais apontando para `127.0.0.1` são recusados.

---

## 2. Identidade visual

### Direção acordada

- **Branco é a base.** O fundo predominante do sistema é branco.
- **Azul é o detalhe predominante.** É a cor de destaque, marca e ênfase:
  bordas de card, item ativo do menu, foco de input, botão primário, links.
- **Verde é a cor de sistema.** Reservado para estado e feedback: sucesso,
  confirmação, indicadores positivos, status ativo.

### Como a cor é distribuída

A tela é **colorida, não branca**, e o **azul domina** — verde vem em segundo.
Cada cor tem um território, e é isso que impede a poluição:

| Cor | Onde manda |
|---|---|
| **Azul** | Estrutura: dock, títulos de seção, cabeçalho de tabela, valores numéricos, chips, borda dos filtros, fundo da página |
| **Verde** | Dado positivo/efetivo: gráfico de alunos por turma, badge "Ativo", estado "tudo certo" |
| **Âmbar** | Atenção: pendências, gráfico de faltas |
| **Vermelho** | Só falha real. Nunca identidade, nunca pendência |

O **fundo da página é azul suave** (`--fundo: #e8f0fb`), não branco — os painéis
brancos é que se destacam contra ele. Não devolva o fundo para branco.

Pendência é âmbar, não vermelho: pendência é algo a fazer, não um erro.
Misturar os dois gasta o alarme e a tela vira um mar de vermelho.

**Âmbar para pendência, vermelho só para falha.** Uma pendência é algo a fazer,
não um erro. Misturar os dois gasta o alarme e a tela vira um mar de vermelho.

**Nada de caixa dentro de caixa.** Seções usam régua fina + rótulo (`.secao > h2`),
não `.card` aninhado. O `.card` perdeu a barra colorida de 3px no topo — cinco
delas empilhadas eram a maior fonte de ruído.

### Tokens (`:root` em `src/index.css`)

| Token | Valor | Papel |
|---|---|---|
| `--branco` | `#ffffff` | painéis e cards |
| `--fundo` | `#e8f0fb` | fundo da página, azul suave |
| `--fundo-2` | `#f3f8fe` | linha alternada de tabela, trilho de gráfico |
| `--borda` / `--borda-forte` | `#d3e1f3` / `#b3c9e5` | fios e contornos de campo |
| `--azul` / `--azul-forte` / `--azul-medio` / `--azul-fraco` | `#1b5fd0` / `#12459c` / `#2f74e6` / `#dfeafc` | cor dominante |
| `--azul-escuro` | `#0d2b5e` | fim do gradiente da dock, títulos de seção |
| `--verde` / `--verde-forte` / `--verde-fraco` | `#0f7a4f` / `#0b613e` / `#d7efe3` | dado positivo, estado ativo |
| `--ambar` / `--ambar-fraco` | `#b45309` / `#fbecd8` | atenção, pendência |
| `--vermelho` / `--vermelho-fraco` | `#be3a34` / `#fce2e0` | erro real, nada além disso |
| `--tinta` / `--tinta-fraca` / `--tinta-tenue` | `#12203a` / `#566a86` / `#8ba0bb` | texto em três níveis |

### Tipografia

- **Newsreader** (serifada) nos títulos de página e de seção
- **Inter** em toda a interface
- **IBM Plex Mono** em números e dados, com `tabular-nums`

A serifada não é enfeite: este sistema produz **registro legal de jornada**
(Portaria 671, AFD, fiscalização trabalhista). O registro pede tom de documento,
não de painel de marketing — e é o que separa a tela de qualquer dashboard
genérico. Use com moderação: só títulos, nunca em texto corrido ou botão.

### Navegação: dock lateral

A sidebar larga com rótulos foi substituída por uma **dock vertical em ícones**
(`.dock` em `src/components/Layout.jsx`): rail azul de 80px, **encostado no
topo e no rodapé** (`height: 100vh`, `position: sticky`, sem margem e sem canto
arredondado). Ícones de 25px em alvos de 52px. Devolve ~150px de largura ao
conteúdo — é o que torna possível o layout em duas colunas.

O conteúdo **ocupa a largura toda**: `.conteudo` tem `max-width: none`. Não
reintroduza teto de largura ali — sobra faixa morta à direita.

Ícones são **SVG inline** no próprio `Layout.jsx`, não biblioteca: são 9 ícones
de traço simples, herdam `currentColor` e acompanham o estado do item sem CSS
extra. Uma lib de ícones custaria 50 kB+ para isso.

Cada item revela o **rótulo ao lado no hover e no foco de teclado**
(`::after` com `data-rotulo`) e carrega `aria-label`. Ícone sozinho é ambíguo —
não remova o rótulo.

> **Armadilha já paga:** `.dock-grupo` **não pode ter `overflow`**. Com
> `overflow-y: auto` o navegador força `overflow-x` para `auto` também, e o
> rótulo, que fica fora da dock, é recortado — a dock inteira perde os rótulos.
> Isso passa despercebido lendo o código; só aparece renderizando.

Em telas ≤860px a dock deita e vira barra horizontal no topo, com o rótulo
descendo para baixo do ícone.

### Selects — duas implementações convivendo

**Nos filtros do Dashboard: `<Selecao>`** (`src/components/Selecao.jsx`), com
lista própria estilizada. Existe porque a lista do `<select>` nativo é desenhada
pelo sistema operacional e **não aceita CSS em navegador nenhum** — era o que
destoava do resto.

O preço é que a acessibilidade que o nativo dava de graça virou nossa. O
componente cobre: `role="combobox"`/`listbox`, `aria-expanded`,
`aria-activedescendant`, `aria-selected`; teclado completo (setas, Home/End,
Enter, Espaço, Esc, Tab); busca por digitação; foco que permanece no botão; e
clique fora que fecha. **Se mexer nele, não derrube isso** — sem esses pedaços
o componente vira uma `div` que só funciona no mouse.

Dois detalhes de CSS que já custaram bug:
- A lista usa `width: max-content` com `min-width: 100%`. Travada em 100% do
  botão, uma opção comprida ficava cortada com rolagem horizontal.
- `.selecao-opcao.marcada` é a opção sob o cursor **e** sob a navegação por
  teclado, de propósito: mouse e teclado compartilham o mesmo destaque.

**Não existe mais nenhum `<select>` nativo no projeto** — os 14 que havia foram
migrados (Dashboard, AlunoForm, UsuarioForm, TurmasLista, TurmaDetalhe,
UnidadeForm, DispositivoForm, ProfessorPainel). O CSS que estilizava o nativo
foi removido junto, para não deixar regra morta.

**Consequência que exige atenção ao criar formulário novo:** `<Selecao>` é um
`<button>`, então **não participa da validação nativa do formulário**. O
atributo `required` do `<select>` não tem equivalente aqui — campo obrigatório
tem que ser conferido no `onSubmit`, com `setErro(...)` e `return`. Já feito em
`TurmasLista` (unidade da turma) e `TurmaDetalhe` (professor);
`AlunoForm` e `UsuarioForm` já validavam antes.

Props: `valor`, `aoMudar`, `opcoes` (`[{ valor, rotulo }]`), `id`, `rotuloAria`,
`desabilitado` e `vazio` (texto quando nada está escolhido — use uma instrução
como "Selecione a escola", não "--").

Duas aparências, escolhidas pelo contexto e não por prop: dentro de `.filtros`
o botão vem azul; fora, branco.

**Duas armadilhas já pagas — não reintroduza:**

1. **Nada de `scrollIntoView` para destacar a opção marcada.** Essa API rola
   **todos** os ancestrais roláveis, inclusive a página: abrir a lista fazia o
   conteúdo da tela saltar. O componente ajusta só o `scrollTop` da própria
   lista, na mão.
2. **A lista vive num portal no `<body>`, com `position: fixed`.** Posicionada
   dentro do componente, era recortada por qualquer ancestral com `overflow` — e
   o `.card` dos formulários tem `overflow: hidden`, então ela aparecia cortada
   na borda do cartão. O preço do portal é calcular a posição na mão
   (`medir()`), refazer no scroll e no resize, e inverter para cima quando não
   há espaço abaixo. O clique-fora também precisa checar `lista.contains`, não
   só `wrap.contains`: fora da árvore do componente, a lista contaria como
   "clique fora" e fecharia sozinha ao ser clicada.

### Componentes acrescentados

`.secao` (régua + rótulo), `.numeros`/`.numero` (bloco único com divisórias
internas, no lugar de N caixas soltas), `.atencao` (bloco de pendências),
`.tudo-certo`, `.painel`/`.painel-corpo`, `.filtros`, `.menu`/`.menu-wrap`
(menu suspenso), `.grafico`, `.vazio`, `.info`, `.btn-verde`, `.btn-perigo`,
`.btn-pequeno`, `.badge-info` e um bloco `@media print`.

`.metricas`/`.metrica` continuam existindo só por compatibilidade com as telas
antigas; em tela nova use `.numeros`/`.numero`.

> **Nunca use `.vazio` como modificador de outro componente.** `.vazio` é o
> estado-vazio genérico e carrega `text-align: center`. Usado como
> `.numero.vazio`, centralizava aquela célula enquanto as vizinhas ficavam à
> esquerda. O modificador correto é `.numero.indisponivel`.

### Piso de qualidade

`:focus-visible` visível em tudo, `prefers-reduced-motion` respeitado, e um
breakpoint em 860px que vira a sidebar em barra horizontal. Não regrida isso.

### Convenções de estilo

- Tokens em `:root`; nunca hardcode cor dentro de componente
- Classes semânticas em português (`.card`, `.campo`, `.btn-primario`, `.titulo-pagina`)
- Fontes: Space Grotesk (display), Inter (corpo), IBM Plex Mono (números/dados)
- Números e dados tabulares sempre com `.mono` (usa `tabular-nums`)

---

## 3. Convenções de código

- **Tudo em português**: nomes de componentes, funções, estado, rotas
  (`carregarFiliais`, `aoEnviar`, `setErro`, `/unidades/nova`)
- **Um único cliente HTTP**: `src/api.js`. Toda chamada passa por `requisitar()`,
  que injeta `Authorization: Bearer`, `X-Empresa-Id` e `X-Filial-Id`.
  **Nunca faça `fetch` direto numa página.**
- Novos endpoints entram como método no objeto `api` exportado no fim de `api.js`
- Sessão e empresa/filial selecionadas ficam no `localStorage`
  (`ponto_saas_token`, `ponto_saas_empresa_id`, `ponto_saas_filial_id`)
- Papel do usuário vem de `useAuth()` (`src/context/AuthContext.jsx`).
  Papéis: `super_admin`, `admin`, `rh`, `gestor`, `professor`
- Páginas em `src/pages/`, componentes compartilhados em `src/components/`
- Toda tela autenticada é envolvida por `<Layout>` e `<RotaProtegida>`

### Carregamento de dados

Padrão atual: `useEffect` + `async function` interna + flag `mounted` no cleanup.

**Cuidado com `Promise.all`:** o `Dashboard.jsx` usa `Promise.all` sem
`try/catch`, então **uma** rota com falha derruba a tela inteira. Em telas que
carregam várias fontes, prefira `Promise.allSettled` e degrade por seção.

---

## 4. Backlog

### 4.1 Dashboard — **concluído**

- [x] Adicionar **gráficos**
- [x] **Filtro por mês** dos dados daquela empresa
- [x] **Exportação de relatórios** em duas opções: **.csv** e **.pdf**
- [x] **Notificação** sobre dados de turmas e alunos **em pendência**

Como ficou (`src/pages/Dashboard.jsx`):

- **Gráficos em HTML/CSS**, sem biblioteca: a barra é uma `div` com largura em
  porcentagem. **Não volte para SVG** — em SVG o texto escala junto com o
  container, e o mesmo componente saía com fonte minúscula na coluna estreita e
  enorme em largura cheia. Dois gráficos: alunos por turma (verde) e faltas do
  mês (âmbar).
- **Filtro mês/ano** que recarrega `/api/relatorios/resumo-periodo` com
  `de`/`ate` calculados por `limitesDoMes` (usa o dia 0 do mês seguinte, então
  trata ano bissexto sozinho).
- **CSV** montado no cliente, com `;` como separador e **BOM** no início —
  sem o BOM o Excel em pt-BR abre a acentuação trocada.
- **PDF** pelo diálogo de impressão do navegador ("Salvar como PDF"), apoiado
  no `@media print` do `index.css`, que esconde `.sidebar`, `.topbar` e tudo
  que tiver a classe `.nao-imprimir`. Escolhido por não adicionar dependência;
  se um dia precisar de PDF gerado no servidor ou com layout fixo, aí sim entra
  uma lib como jsPDF.
- **Filtros**: unidade, mês e ano, numa barra própria acima do conteúdo. O
  filtro de unidade só se aplica a alunos e turmas — dispositivos e batidas
  não são escopados por filial nesta API.
- **Um botão "Exportar"** que abre menu para escolher o formato, em vez de dois
  botões concorrendo. Fecha com clique fora e com Esc, e tem `aria-haspopup`.
- **Pendências** calculadas no cliente: alunos sem turma, sem data de
  nascimento, sem matrícula, turmas ativas vazias e batidas sem vínculo.
  Só aparecem as que têm contagem > 0 — é o elemento de assinatura da tela,
  e some inteiro quando não há nada a fazer.
- **`Promise.allSettled`** no lugar de `Promise.all`: o painel agora degrada
  por seção em vez de morrer inteiro. Com `/api/funcionarios` em 500, o card de
  funcionários mostra "indisponível" e o resto continua funcionando.

### 4.7 Relatórios — **concluído**

Tela própria em `/relatorios`, **fora da dock**: a porta de entrada é a seção
"Relatórios" do Dashboard.

O coração é o array `RELATORIOS` em `src/pages/Relatorios.jsx`. Cada entrada
declara `filtros`, `buscar()` e `colunas` — **acrescentar relatório novo é
acrescentar um objeto ali; a tela não muda.** Os filtros aparecem sozinhos
conforme o que a entrada declara.

Hoje são 9, em 5 grupos: Cadastros (alunos, turmas, dispositivos), Presença
(presença de aluno), Funcionários (resumo de ponto, espelho de ponto,
funcionários), Ponto (batidas sem vínculo) e Sistema (auditoria).

Trocar de relatório limpa o resultado anterior de propósito: mostrar a tabela
de um relatório sob o título de outro é pior do que não mostrar nada.

Exportação csv/pdf vive em `src/utils/exportar.js`, compartilhada com o
Dashboard. **`celulaCsv` neutraliza CSV Injection** — célula começando com
`= + - @` é fórmula para Excel/Sheets, e os dados vêm do cadastro; um aluno
chamado `=HYPERLINK(...)` executaria na máquina de quem abrisse a planilha.
Não remova o prefixo de apóstrofo.

### 4.2 Turmas — **concluído**

- [x] Tela de **gestão de turmas** com CRUD completo (criar, editar, excluir)
- [x] **Gerenciar os alunos** de cada turma
- [x] **Gerenciar professores** da turma
- [x] **Adição de alunos em massa** pela própria turma

Como ficou:

- **`src/pages/TurmasLista.jsx`** — só listagem: contagem de alunos por turma e
  exclusão com **confirmação inline** (dois cliques na própria linha, sem
  `window.confirm`).
- **`src/pages/TurmaForm.jsx`** — criar e editar turma em **tela própria**
  (`/turmas/nova` e `/turmas/:id/editar`). Ficavam como formulário inline
  dentro da listagem, o que confundia: a mesma tela era lista e formulário.
  Ao criar, leva direto para a gestão da turma nova — o passo seguinte natural
  é pôr alunos e professores nela.
- **`src/pages/TurmaDetalhe.jsx`** (rota `/turmas/:id`) — alunos da turma,
  vínculo de aluno já cadastrado, remoção da turma, adição em massa e
  atribuição de professores.

Dois detalhes que não são óbvios e é bom não desfazer:

1. `PUT /api/alunos/:id` faz **UPDATE de todos os campos**. Mandar só o
   `turma_id` apagaria nome, CPF e o resto. Por isso existe o helper
   `payloadAluno()`, que reenvia o registro inteiro com a alteração aplicada.
2. A gravação em massa é **sequencial, não paralela**, de propósito: o backend
   valida matrícula duplicada consultando o banco, e em paralelo duas linhas
   com a mesma matrícula passariam as duas. Erros são reportados por linha, e
   as linhas que falharam permanecem na tela para correção.

> **Conflito ainda aberto — professores e disciplinas.** Foi combinado que
> professores **não teriam disciplinas por enquanto**, mas
> `20260822000002_professores_escola.js` criou `turma_professores` com
> **`materia` NOT NULL**, mais `dias_semana`, `hora_inicio` e `hora_fim`.
> A tela hoje **pede matéria e horário** porque o backend exige. Se a intenção
> era mesmo não ter disciplina, quem muda é a migration, não o front.

### 4.3 Alunos

Campos do cadastro:

- [ ] **Obrigatórios:** nome completo, filial (escola), data de nascimento, CPF
- [ ] **Não obrigatório, porém essencial:** matrícula

**Feito:** `AlunoForm` foi reescrito com nome, CPF (com máscara e validação de
11 dígitos), data de nascimento, escola, matrícula, turma opcional e dados do
responsável. Antes ele enviava só nome/matrícula/filial — **sem CPF** — e por
isso o cadastro estava quebrado desde que o backend passou a exigi-lo.

**Matrícula agora é opcional** — o `NOT NULL` saiu do banco em produção
(2026-08-23). O campo aceita vazio e o aluno passa a aparecer em **"Precisa de
atenção" → "Alunos sem matrícula — regularizar"** no Dashboard. Esse item é o
único lembrete de que ela falta; **não o remova.**

> **Limitação do servidor, ainda aberta.** `alunos.service.criar` confere
> duplicidade com `where({ matricula })`, que em SQL vira `matricula is null`
> quando ela vem vazia. Resultado: o **segundo** aluno sem matrícula "colide"
> com o primeiro e recebe 409 *"Já existe um aluno com esta matrícula"*.
> O `AlunoForm` detecta esse caso e troca a mensagem por uma que explica o que
> houve, mas o conserto de verdade é no backend — pular a checagem quando a
> matrícula for vazia. Enviar `undefined` não resolve: o Knex estoura
> "Undefined binding(s)" e vira 500. Por isso o front manda `null`.

> **CPF parou de ser gravado.** O commit `70aac60` removeu a validação e a
> escrita de `cpf` de `alunos.service.js`. A coluna continua no banco, mas o
> insert não a inclui — então o CPF digitado no formulário **é descartado em
> silêncio**. O campo segue na tela porque foi pedido e a coluna existe; quando
> o backend voltar a gravá-lo, nada muda no front.

> **CPF deixou de ser bloqueio.** A migration `20260822000001_create_portal_responsaveis.js`
> (chegou no pull de 2026-08-22) adicionou `cpf` a `alunos`, e
> `alunos.service.js` passou a **exigir 11 dígitos**, devolvendo 400 se não
> vier. Ou seja: CPF já é obrigatório no backend. `data_nascimento` existe
> (nullable) e `filial_id` é NOT NULL.
>
> **Bloqueio que continua: `matricula` é NOT NULL** no banco, e o service ainda
> valida unicidade — o que contradiz "não obrigatório". As saídas são: tornar a
> coluna nullable por migration, ou gerar matrícula automaticamente quando vier
> vazia. **É uma decisão de produto, ainda não tomada.** Enquanto isso, a
> adição em massa em `TurmaDetalhe.jsx` mantém matrícula como campo livre, mas
> o backend rejeita se vier vazia.
>
> Sugestão de UX para "não obrigatório mas essencial": permitir salvar sem, com
> pendência visível — o Dashboard já conta "Alunos sem matrícula" (4.1).

### 4.4 Unidades (filiais) — **concluído**

- [x] `admin` só cria escolas, dentro da própria empresa
- [x] `super_admin` escolhe a empresa
- [x] Para `super_admin`: lista de empresas primeiro; ao escolher uma, aparecem
      as filiais dela, com "trocar de empresa" para voltar
- [x] **Fuso horário somente leitura** — exibido, nunca editável
- [x] Filtro **Exibir**: todas as unidades, somente empresa ou somente escolas,
      com a contagem de cada opção no próprio rótulo

O `super_admin` opera via header `X-Empresa-Id`, lido do `localStorage` a cada
chamada. Trocar de empresa é `selecionarEmpresa()` / `limparEmpresa()` do
`AuthContext` — sem empresa escolhida a API recusa com 400, por isso a tela
força a escolha antes de listar.

A trava do fuso é de interface: o backend continua aceitando o campo. O motivo
de travar não é estético — o fuso entra no cálculo de jornada e de virada de
dia, então mudá-lo reinterpretaria batidas já gravadas.

### 4.5 Usuários — **concluído**

- [x] Contagem por papel, filtro por papel e busca por nome/e-mail/unidade
- [x] Tabela expondo o que `/api/auth/usuarios` devolve: nome, e-mail, papel,
      unidade e situação
- [x] Quadro "O que cada perfil enxerga", incluindo **gestor** e **professor**

`gestor` entrou nas opções do `UsuarioForm` (faltava). Os papéis vivem em
`src/utils/dominio.js` (`PAPEIS`, `rotuloPapel`), espelhando o enum
`usuario_papel` — não redeclare a lista dentro de tela.

> `professor` já existe no enum `usuario_papel` (adicionado na migration de
> 2026-08-22) e já há um `src/pages/ProfessorPainel.jsx` na rota `/professor`,
> vindo do upstream — **conferir o que ele já cobre antes de criar tela nova.**
> Endpoints do professor: `/api/professores/minhas-turmas`,
> `/turmas/:turmaId/alunos`, `/presencas`, `/notas`, `/observacoes`.
> Para `gestor` não há endpoint dedicado — ele usa as rotas de staff.

### 4.9 Excluir turma: fallback para desativar — **concluído**

O backend **não expõe `DELETE /api/turmas/:id`** — o módulo tem só get/post/put.
Em vez de deixar o botão sempre errando, `TurmasLista` tenta o DELETE e, ao
receber **404 ou 405**, cai para `PUT` com `ativo: false`.

Não fizemos remoção só na tela: a linha sumiria e voltaria no F5, dando a
entender que algo foi apagado quando nada mudou no servidor. Desativar
**persiste**, e é mais seguro num sistema onde a turma é referenciada por alunos
e por registros de ponto já gravados.

O botão passou a se chamar **Desativar**, e turma inativa ganha **Reativar** —
desativar sem poder desfazer seria pior do que apagar.

Dois detalhes que sustentam isso:

- `requisitar()` agora carrega `erro.status` com o código HTTP. Sem isso o
  fallback teria de comparar o **texto** da mensagem para saber se a rota existe.
- O `PUT` reescreve todos os campos: mandar só `ativo` deixaria `nome` e `turno`
  como `undefined` e o Knex do backend estouraria. Por isso reenviamos o
  registro inteiro — mesma armadilha do `payloadAluno()`.

### 4.8 Estado de conexão do dispositivo — **concluído**

O selo "Conectado" sozinho **mentia** em equipamento HTTP: como ele não mantém
conexão aberta, aparecia offline entre um envio e outro mesmo funcionando.

`src/utils/conexao.js` lê os três campos juntos — `conectado_agora`,
`ultima_conexao_ws_em` e `ultima_coleta_status` — e o badge **sempre** vem
acompanhado da última comunicação. É esse horário, não o selo, que diz se o
relógio está vivo. Cinco estados: Conectado, Sem comunicação, Nunca comunicou,
Sob demanda (protocolo em que o servidor é quem liga) e vazio.

Na tela do dispositivo o bloco deixou de ser restrito a `evo_ws`: em
`http_rest` o equipamento também se registra, e era justamente ali que o estado
nunca aparecia.

### 4.6 Auditoria — **concluído**

- [x] Exposta como um dos relatórios em `/relatorios`, com filtros de período,
      ação e entidade
- [x] **Tela dedicada em `/auditoria`, restrita a `super_admin`** — item próprio
      na dock, visível só para esse papel

A tela lista todas as ações e **expande a linha** ao clicar, mostrando o log
inteiro: metadados, os dois estados em JSON e o log bruto.

O que dá valor de depuração é o bloco **"O que mudou nesta ação"**: `camposAlterados()`
compara `dados_antes` com `dados_depois` e mostra **só os campos que mudaram**,
com antes em vermelho e depois em verde. Num log de 30 campos, dois JSON lado a
lado não revelam nada — a lista de diferenças revela. Não troque isso por um
dump simples.

> **Depende do backend.** `GET /api/auditoria` **não está montado no `app.js`**
> (o `auditoria.routes.js` existe, mas ninguém o registra). Até isso ser
> corrigido a tela carrega e mostra o erro, com uma dica explicando a causa.

A rota chegou no pull de 2026-08-23 (`GET /api/auditoria`, somente leitura,
restrita a `super_admin`/`admin`/`rh`). Não virou tela separada de propósito:
auditoria é consulta filtrada com exportação, exatamente o que a tela de
relatórios já faz. `api.listarAuditoria()` aceita `usuario_id`, `acao`,
`entidade`, `entidade_id`, `de`, `ate`, `pagina`, `limite` (máx. 200).

> **Em andamento do lado do servidor.** A auditoria está sendo construída por
> quem cuida do backend; quando ficar pronta, ela chega por **`git pull`**.
> Até lá não há endpoint que exponha `auditoria_logs` — a tabela existe, com
> `acao`, `entidade`, `entidade_id`, `dados_antes` (jsonb), `dados_depois`
> (jsonb), `usuario_id`, `ip_origem` e `criado_em`.
>
> **Antes de começar esta tarefa: dê `git pull` e confira se surgiu
> `/api/auditoria` em `backend/src/app.js`.** Não construa a tela contra um
> contrato imaginado.

---

## 5. Armadilhas conhecidas

**`AlunoForm.jsx` tem marcadores de diff no `origin/main`.** O arquivo contém 11
linhas começando com `+`, resto de um diff colado sobre o código, que quebram o
parse do Vite. Está corrigido apenas na working tree local — **volta a cada
`git pull`**. O `UsuarioForm.jsx` tinha o mesmo defeito e já foi corrigido no
remoto. Se aparecer `[PARSE_ERROR] Unexpected token`, é isso: remova só os `+`.

**A tabela `funcionarios` já esteve quebrada no banco de produção** —
`GET /api/funcionarios`, `GET /api/funcionarios/:id` e `GET /api/ponto/apontamentos`
devolviam **500**, provavelmente por migration não aplicada. Foram feitas
mudanças no banco em 2026-08-22, mas **isso ainda não foi reverificado**.

Como testar, sem adivinhar: `GET /api/funcionarios/<uuid-válido>` — uma tabela
sã devolve **404**, não 500. Use UUID bem formado, senão o erro de conversão de
tipo do Postgres dá falso positivo.

O Dashboard não depende mais disso para funcionar: com `Promise.allSettled`,
o card de funcionários mostra "indisponível" e o resto da tela segue normal.

**O `errorHandler` do backend mascara erros 500** como `"Erro interno. Tente
novamente."`. A exceção real só aparece no log do Render. Ao depurar um 500,
não perca tempo no front — isole qual rota falha e peça o log.
