# Sistema de Agendamento de Aulas de Inglês Online (MVP)

> **Exercício 01** · Documento de requisitos gerado por IA, validado por humanos.
> Caso de referência: *Serena* (CRUD de serviços + agendamento online), adaptado para aulas de inglês online.

## Configuração e execução

1. Em [supabase.com](https://supabase.com), crie um projeto, defina nome e senha fortes para o banco e escolha a região São Paulo quando disponível.
2. Em **Project Settings → API**, copie a Project URL (somente a raiz `https://<project-ref>.supabase.co`, sem `/rest/v1`) e a chave **anon/publishable**. Não copie `service_role` para o navegador.
3. Na raiz do projeto, copie `.env.example` para `.env` (`Copy-Item .env.example .env` no PowerShell) e informe apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para o front-end.
4. No **SQL Editor** do Supabase, execute os arquivos em `supabase/migrations` em ordem cronológica: `20261117220000_booking_backend.sql`, `20261118191000_fixed_student_identity.sql`, `20261119120000_auth_roles_students.sql` e `20261124160000_grant_teacher_booking_student_id.sql`. A migration mais recente concede à agenda da professora leitura da referência do aluno; aplique-a também em projetos já configurados.
5. Execute `npm install` e `npm run dev`; abra no navegador o endereço local indicado pelo Vite (normalmente `http://localhost:5173`). A dependência `@supabase/supabase-js` já está declarada em `package.json`.
6. Para este projeto de estudo, no Supabase abra **Authentication → Providers → Email** e desative **Confirm email**. Assim, novas contas podem entrar sem aguardar mensagem de confirmação. Configure também os redirect URLs do Supabase Auth para desenvolvimento e produção.

O app não usa `localStorage` como banco de dados nem para armazenar tokens de agendamento. Sem URL e chave anon válidas, as telas informam a configuração ausente e não simulam gravações locais. Professora e aluno criam contas Supabase Auth; o papel é registrado uma única vez no banco e não pode ser alternado. No primeiro acesso, a RPC `garantir_perfil` cria ou recupera o perfil. A professora cadastra aulas, disponibilidade e bloqueios e compartilha o link público gerado no painel. O aluno acessa “Minhas aulas” com a mesma conta usada para agendar.

Abrir um link público de agendamento sempre mostra a página da professora, mesmo quando há uma sessão de professora ativa no navegador. Para reservar nessa situação, use **Sair e entrar como aluno**; os papéis são separados e não podem ser alternados na mesma conta.

O cliente Supabase está em `supabase.js` e cria o cliente com `createClient` usando somente URL/chave pública. `vite.config.js` aceita `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; somente esses valores são enviados ao bundle. A URL é validada para exigir HTTPS. O `.gitignore` ignora `.env` e arquivos `.env.*`, mantendo `.env.example` versionável.

O aluno autentica-se com a própria conta. Cada reserva é vinculada a um único registro por professora/conta, e o vínculo por e-mail normalizado preserva as reservas históricas compatíveis. O texto de consentimento é registrado com a versão `agendamento-v1`. Cancelamento e reagendamento identificam a conta autenticada e não expõem tokens de cancelamento no navegador.

No painel da professora, cadastre aulas, defina disponibilidade semanal, bloqueie datas, configure a antecedência de alteração (0 a 72 horas) e gerencie os agendamentos. O fluxo público consulta a disponibilidade no banco em blocos de 30 minutos pelos próximos 14 dias; a constraint de exclusão impede conflitos mesmo em reservas concorrentes.

## Árvore da aplicação e profundidade das ações

A árvore abaixo representa a navegação e o que cada ação faz no app. A profundidade é indicada pelo número entre colchetes e também pela indentação: **0** é a aplicação, **1** é uma inicialização ou tela, **2** é uma ação do usuário, **3** é a etapa interna (validação, consulta, RPC ou navegação) e **4** é a persistência ou o efeito final.

```text
EnglishFlow [0]
├── Inicialização e roteamento [1]
│   ├── Configuração Supabase ausente [2] → mostra erro; não simula gravação [3]
│   ├── URL com ?professora=<slug> [2] → abre o catálogo público e pré-seleciona o perfil [3]
│   ├── Sessão Supabase ativa [2] → consulta papel e garante perfil via RPC [3]
│   └── Sem sessão e sem link público [2] → abre tela inicial [3]
│
├── Tela inicial [1]
│   ├── Professor(a) [2] → entrar/criar conta → Auth → perfil → painel [3]
│   └── Aluno(a) [2] → explorar professores e aulas ou entrar/criar conta → consentimento → “Minhas aulas” [3]
│       ├── Esqueci minha senha [3] → solicitação de recuperação por e-mail [4]
│       └── Confirmação de e-mail habilitada no Supabase [3] → confirmar endereço e entrar [4]
│
├── Painel do(a) Professor(a) [1] (requer autenticação)
│   ├── Salvar prazo de alteração [2]
│   │   ├── Validar valor inteiro entre 0 e 72 horas [3]
│   │   └── Atualizar perfil da professora [4]
│   ├── Cadastrar aula [2]
│   │   ├── Validar nome, duração e preço [3]
│   │   └── Inserir em aulas [4]
│   ├── Editar aula [2]
│   │   ├── Preencher formulário com dados atuais [3]
│   │   └── Atualizar em aulas [4]
│   ├── Excluir aula [2]
│   │   ├── Pedir confirmação; reserva relacionada bloqueia exclusão [3]
│   │   └── Excluir de aulas [4]
│   ├── Abrir disponibilidade [2] → abre a tela de disponibilidade [3]
│   ├── Abrir agenda [2] → abre a tela de aulas agendadas [3]
│   ├── Meu perfil [2] → editar nome, telefone e slug [3] → atualizar perfil próprio [4]
│   ├── Excluir conta [2] → confirmação explícita [3] → remover conta e dados vinculados [4]
│   ├── Abrir link público [2] → abre fluxo do aluno com o slug da professora [3]
│   └── Sair [2] → encerrar sessão Supabase e voltar à tela inicial [3]
│
├── Tela de disponibilidade do(a) Professor(a) [1] (acessada pelo painel)
│   ├── Adicionar faixa semanal [2]
│   │   ├── Validar dia e horários; impedir sobreposição [3]
│   │   └── Inserir em disponibilidades [4]
│   ├── Remover faixa [2] → excluir de disponibilidades [3] → lista atualizada [4]
│   ├── Bloquear data [2]
│   │   ├── Validar data [3]
│   │   └── Inserir em bloqueios [4]
│   └── Remover bloqueio [2] → excluir de bloqueios [3] → lista atualizada [4]
│
├── Tela de aulas agendadas do(a) Professor(a) [1] (acessada pelo painel)
│   ├── Listar reservas pendentes/confirmadas [2] → consultar agendamentos [3]
│   ├── Confirmar reserva [2] → atualizar status para confirmado [3] → agenda atualizada [4]
│   ├── Marcar como concluída [2] → atualizar status para concluído [3] → agenda atualizada [4]
│   └── Cancelar reserva [2] → atualizar status para cancelado [3] → agenda atualizada [4]
│
├── Fluxo público de agendamento [1] (catálogo público; conta exigida para reservar)
│   ├── Carregar catálogo [2] → listar perfis com aulas ativas e respectivas regras [3]
│   ├── Escolher Professor(a) [2] → exibir somente suas aulas ativas [3]
│   ├── Escolher tipo de aula [2] → consultar horários livres nos próximos 14 dias [3]
│   ├── Escolher dia e horário [2] → atualizar seleção na tela [3] → mostrar horário selecionado [4]
│   ├── Continuar para login [2] → preservar aula/data/horário na URL [3] → retomar seleção após autenticar [4]
│   └── Confirmar reserva [2] → RPC criar_agendamento valida conta, consentimento e disponibilidade [3] → gravar reserva [4]
│
└── Área do(a) Aluno(a) [1] (requer autenticação)
    ├── Minhas aulas [2] → listar reservas próprias por RPC [3] → exibir horários e status [4]
    ├── Cancelar [2] → confirmar e chamar RPC por ID com validação de propriedade [3] → liberar horário [4]
    ├── Reagendar [2] → escolher horário e chamar RPC por ID com validação de propriedade [3] → atualizar reserva [4]
    ├── Meu perfil [2] → editar nome e telefone [3] → atualizar perfil próprio [4]
    └── Excluir conta [2] → confirmar exclusão [3] → remover dados e conta Auth [4]
```

No ambiente de estudo, mantenha **Confirm email** desativado em **Supabase → Authentication → Providers → Email**. Se a opção estiver habilitada, o Supabase exige confirmação antes de criar a sessão e concluir o acesso; essa configuração é do projeto Supabase e não pode ser alterada pelo front-end.

## Backend Supabase (PostgreSQL 15)

A migration `supabase/migrations/20261117220000_booking_backend.sql` define o modelo, constraints de agendamento sem sobreposição, RLS e consultas públicas limitadas. `20261118191000_fixed_student_identity.sql` preserva a identidade por professora/contato e associa reservas existentes. `20261119120000_auth_roles_students.sql` adiciona o papel fixo por conta, perfil privado de aluno, vínculo histórico e RPCs autenticadas de agendamento, edição e exclusão. A última migration deve ser aplicada manualmente após revisão e ainda não foi executada neste ambiente.

As RPCs de aluno autenticado não retornam tokens de cancelamento. `listar_meus_agendamentos`, `cancelar_agendamento` e `reagendar_agendamento` validam o vínculo com a conta antes de expor ou alterar registros; a exclusão de conta remove os dados pessoais e agendamentos conforme a opção confirmada pelo usuário.

O front-end usa exclusivamente a URL HTTPS e a chave anon/publishable. `SUPABASE_SERVICE_ROLE_KEY`, tokens administrativos e `SUPABASE_DB_URL` jamais devem ser colocados em variáveis `VITE_` ou no navegador. A migration cria uma fila `notificacoes`; o envio de e-mail/WhatsApp exige um worker confiável no servidor, que ainda não faz parte deste protótipo. Confirme também no painel Supabase a frequência e a retenção dos backups do plano.

### Publicação no Lovable

- Conecte o repositório ao Lovable e mantenha a sincronização Git habilitada; revise cada alteração antes de aceitar o commit gerado.
- Configure apenas as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas configurações de ambiente do preview/deploy. Não cole `.env`, `service_role`, access token ou senha do banco no chat do Lovable.
- Após publicar, no Supabase abra **Authentication → URL Configuration**; defina a URL publicada como **Site URL** e adicione-a também em **Redirect URLs** (incluindo os domínios de preview que realmente forem usados).
- Teste o catálogo público no ambiente publicado, incluindo a escolha de Professor(a), aula, login do(a) Aluno(a) e retorno ao horário selecionado. Links antigos com `?professora=<slug>` continuam pré-selecionando o perfil.

### Prints das 4 telas

Adicione as capturas finais ao diretório [`docs/prints/`](./docs/prints/):

- [`tela-login.png`](./docs/prints/tela-login.png) — entrada e seleção do papel;
- [`cadastro-professora.png`](./docs/prints/cadastro-professora.png) — criação do perfil e link público;
- [`agendamento-aluno.png`](./docs/prints/agendamento-aluno.png) — catálogo, seleção de dia/horário e consentimento;
- [`minhas-aulas.png`](./docs/prints/minhas-aulas.png) — agenda pessoal e ações do aluno.

As imagens ainda não estão no repositório; `docs/prints/.gitkeep` mantém o diretório disponível até a captura.

### Aviso temporário do `npm audit`

O Vite foi fixado em `6.4.6`, que corrige os advisories próprios do Vite e usa `esbuild` corrigido. Em 17/11/2026, o registry ainda não publica uma versão corrigida de `picomatch` para o advisory [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). Por isso, `npm audit` reporta quatro entradas altas para o mesmo problema transitivo (`picomatch`, `fdir`, `tinyglobby` e Vite); `npm audit --omit=dev` confirma zero vulnerabilidades nas dependências de execução do app. Não use `npm audit fix --force`: a sugestão de downgrade para Vite 6.2.7 reabre advisories corrigidos no Vite. Mantenha o servidor de desenvolvimento acessível apenas em `localhost` e reavalie após a publicação de uma versão corrigida de `picomatch`.

Esta etapa não aplicou a migration nem executou testes autenticados no Supabase. Depois de aplicar as migrations ao projeto correto, valide Auth, RLS e RPCs antes de considerar o sistema pronto para produção.

## Checklist de CRUD e entrega

Faça este teste com o app conectado ao seu projeto Supabase e autenticado como professora:

1. No painel, cadastre três aulas: **Conversação individual** (50 min, R$ 49,00), **Speaking for travel** (30 min, R$ 39,00) e **IELTS prep** (60 min, R$ 79,00).
2. Confirme que as três aparecem no painel e no **Table Editor → public.aulas**, associadas ao perfil da professora.
3. Edite uma aula no painel (por exemplo, altere o preço da aula IELTS) e confirme a alteração na lista e no Table Editor.
4. Exclua uma das aulas sem agendamentos e confirme que duas permanecem. A exclusão de aulas com agendamentos relacionados é bloqueada pelo banco.
5. Cadastre uma faixa semanal, abra o link público em uma janela anônima e crie/entre em uma conta de aluno; confirme que a seleção de aula e horário sobrevive ao login.
6. Agende a aula e confira a linha em `public.agendamentos`; saia e entre novamente para validar que o aluno continua vinculado à mesma conta.
7. Teste cancelamento e reagendamento dentro e fora do prazo configurado; verifique que outro usuário não consegue consultar nem alterar a reserva.
8. Edite o perfil de professora e aluno, teste recuperação de senha e exclusão com confirmação explícita; confira que RLS impede acesso cruzado.

Não faça inserts anônimos diretamente em `public.aulas`: a tabela é protegida por RLS e exige a identidade autenticada da professora. Valide o CRUD pela interface e use o Table Editor apenas para conferir os registros.

Antes da submissão, confirme: migration aplicada sem erro; RLS/policies visíveis no Supabase; CRUD e agendamento testados; `npm run build` aprovado; `.env` não aparece no Git. Envie o link do repositório e o link do protótipo publicado (ou do projeto Supabase, se solicitado), nunca credenciais, tokens ou chave `service_role`.

---

## Sumário

1. [CONTEXT](#01--context)
2. [PERSON](#02--person)
3. [RF](#03--rf-requisitos-funcionais)
4. [RNF](#04--rnf-requisitos-não-funcionais)
5. [US](#05--us-histórias-de-usuário)
6. [AC](#06--ac-critérios-de-aceite-checklist)
7. [OUT](#07--out-fora-de-escopo)
8. [MAPA – Dor, cenário e métrica](#08--mapa-dor-cenário-de-uso-e-métrica-de-sucesso)
9. [Apêndice A – Entrevista simulada](#apêndice-a--entrevista-simulada-ctqf)

---

## 01 · CONTEXT

Professores e escolas pequenas de inglês online no Brasil controlam hoje seus horários por WhatsApp, planilhas e agendas pessoais, o que gera conflitos de horário, faltas sem aviso e muito tempo gasto em mensagens de "qual horário você pode?". Este MVP é um sistema web em português que permite ao professor cadastrar seus tipos de aula (nome, duração, preço) e sua disponibilidade, e ao aluno (ou responsável) escolher sozinho um horário livre, receber confirmação e cancelar ou reagendar dentro de uma regra de antecedência. O sistema deve funcionar bem em celular, ser simples para usuários de pouca familiaridade com tecnologia e respeitar a LGPD. O foco do MVP é **agendar, confirmar e cancelar**; pagamento e videochamada própria ficam de fora.

---

## 02 · PERSON

Três personas foram geradas por IA (prompt CTQF, papel de pesquisadora de UX sênior) e revisadas por humanos. A **persona primária** é a Mariana, pois é quem cadastra os serviços e sem ela não existe oferta para agendar.

### Persona 1 — Mariana Duarte ⭐ (primária)

| Campo | Descrição |
|---|---|
| **Idade / Profissão / Cidade** | 34 anos · Professora autônoma de inglês (proprietária do negócio) · Curitiba, PR |
| **Principal dor** | Perde cerca de 1h por dia no WhatsApp combinando horários; já marcou duas aulas no mesmo horário e teve alunos que sumiram sem avisar. |
| **Familiaridade com tecnologia** | Média. Usa bem celular, Google Agenda e WhatsApp Business, mas desiste de ferramentas com muitas configurações. |
| **Cenário típico** | Domingo à noite, no celular, define a disponibilidade da semana e confere os agendamentos que entraram. Durante o dia, só recebe notificações de novas aulas e cancelamentos. |
| **Métrica de sucesso** | Reduzir para **menos de 15 min por semana** o tempo gasto organizando horários e cair para **menos de 5%** o índice de conflitos e faltas sem aviso. |

---

### Persona 2 — Rafael Nogueira

| Campo | Descrição |
|---|---|
| **Idade / Profissão / Cidade** | 28 anos · Analista de dados em empresa de tecnologia · São Paulo, SP |
| **Principal dor** | Rotina imprevisível; precisa remarcar aulas em cima da hora e não sabe quais horários o professor tem livres sem perguntar. |
| **Familiaridade com tecnologia** | Alta. Espera fluxo rápido, confirmação imediata e integração com calendário. |
| **Cenário típico** | No intervalo do almoço, abre o link do professor no celular, escolhe um horário livre de amanhã, confirma e recebe o lembrete no e-mail. |
| **Métrica de sucesso** | Agendar uma aula em **menos de 1 minuto e no máximo 3 toques/cliques**, sem trocar mensagens. |

---

### Persona 3 — Sônia Albuquerque

| Campo | Descrição |
|---|---|
| **Idade / Profissão / Cidade** | 47 anos · Auxiliar administrativa, mãe de aluno de 15 anos · Belo Horizonte, MG |
| **Principal dor** | Não consegue acompanhar os horários do filho e esquece cancelamentos; tem receio de errar o agendamento e perder a aula paga. |
| **Familiaridade com tecnologia** | Baixa. Usa WhatsApp e app do banco; precisa de textos claros, botões grandes e mensagens de confirmação. |
| **Cenário típico** | À noite, no celular, abre o link recebido por WhatsApp, agenda a aula da semana para o filho e confere a mensagem de confirmação. |
| **Métrica de sucesso** | Concluir o agendamento **sozinha, na primeira tentativa, sem pedir ajuda** e receber lembrete **24h antes** da aula. |

---

### Comparativo das personas

| Persona | Dor principal | Tecnologia | Métrica |
|---|---|---|---|
| Mariana (professora, primária) | Tempo perdido combinando horários e conflitos de agenda | Média | < 15 min/semana de gestão; < 5% de conflitos/faltas |
| Rafael (aluno adulto) | Não saber horários livres e remarcar em cima da hora | Alta | Agendar em < 1 min e ≤ 3 cliques |
| Sônia (responsável) | Medo de errar e esquecer a aula do filho | Baixa | Agendar sozinha na 1ª tentativa; lembrete 24h antes |

---

## 03 · RF (Requisitos funcionais)

| ID | Requisito | Persona | Teste de verificação |
|---|---|---|---|
| **RF01** | O sistema deve permitir à professora **cadastrar, listar, editar e excluir tipos de aula** (nome, duração, preço). | Mariana | Criar, editar e excluir uma aula e verificar a lista atualizada. |
| **RF02** | O sistema deve permitir à professora **definir sua disponibilidade semanal** (dias e faixas de horário) e bloquear datas específicas. | Mariana | Cadastrar disponibilidade e verificar que só esses horários aparecem ao aluno. |
| **RF03** | O sistema deve permitir ao aluno autenticado **visualizar horários livres e agendar uma aula** com seu perfil de contato. | Rafael, Sônia | Entrar como aluno, agendar e verificar que a reserva é vinculada à conta. |
| **RF04** | O sistema deve **impedir agendamentos em horários já ocupados** ou fora da disponibilidade. | Mariana | Tentar agendar horário ocupado e verificar bloqueio com mensagem. |
| **RF05** | O sistema deve permitir **cancelar ou reagendar** uma aula até um prazo mínimo configurável (padrão: 12h antes). | Rafael, Sônia | Cancelar dentro e fora do prazo e verificar resultado esperado. |
| **RF06** | O sistema deve **enfileirar confirmação e lembrete 24h antes** da aula para entrega por serviço confiável. | Sônia, Rafael | Agendar e verificar os registros pendentes em `public.notificacoes`. |
| **RF07** | O sistema deve permitir à professora criar conta, entrar e recuperar a senha. | Mariana | Criar conta, confirmar e-mail quando habilitado, entrar e testar recuperação. |
| **RF08** | O sistema deve permitir ao aluno criar conta, entrar e recuperar a senha para manter suas aulas vinculadas. | Rafael, Sônia | Criar conta com consentimento, agendar e retomar “Minhas aulas” após entrar novamente. |

---

## 04 · RNF (Requisitos não funcionais)

| ID | Requisito | Meta mensurável | Como medir |
|---|---|---|---|
| **RNF01** | **Desempenho**: listas e horários livres devem carregar rapidamente. | Resposta em **< 1 s** para 95% das requisições (até 500 agendamentos). | Teste de carga / Lighthouse. |
| **RNF02** | **Usabilidade e responsividade**: uso confortável em celular. | Funcional de **360 px** de largura; agendamento em **≤ 3 cliques**; nota de usabilidade ≥ 80 (SUS) com 5 testes. | Teste com usuários + checklist responsivo. |
| **RNF03** | **Segurança e privacidade (LGPD)**: dados pessoais protegidos. | 100% do tráfego em **HTTPS**; senhas com **hash (bcrypt/argon2)**; consentimento registrado no 1º agendamento. | Revisão de código + varredura OWASP ZAP. |
| **RNF04** | **Disponibilidade**: sistema acessível quando alunos agendam. | **≥ 99% de uptime** mensal. | Monitoramento (UptimeRobot ou similar). |

---

## 05 · US (Histórias de usuário)

Formato canônico XP: *Como \<papel\>, quero \<ação\>, para \<valor\>.*
Priorização **MoSCoW**; qualidade conforme **INVEST**; componentes **3 C's** (Card, Conversation, Confirmation).

### US-01 · Cadastrar novo tipo de aula

```
ID: US-01
Título: Cadastrar novo tipo de aula
Como professora proprietária (persona: Mariana),
quero cadastrar um novo tipo de aula com nome, duração e preço,
para que meus alunos possam agendar esta aula online.
Prioridade: MUST (MoSCoW)
Estimativa: 2 pontos (story points)
Depende de: — (entrada de dados autônoma)
```

**Critérios de aceite**

- **AC1.** Campos obrigatórios: nome (≥ 3 caracteres), duração (15–120 min) e preço (> R$ 0).
- **AC2.** Duração deve aceitar apenas inteiros positivos.
- **AC3.** Preço deve ser formatado como R$ X.XXX,XX ao digitar.
- **AC4.** Após salvar, a aula aparece na lista em menos de 1 s.
- **AC5.** Cancelar descarta os dados sem persistência parcial.
- **AC6.** Erro de rede exibe mensagem amigável e mantém os dados digitados.

---

### US-02 · Agendar aula em horário livre

```
ID: US-02
Título: Agendar aula em horário livre
Como aluno adulto (persona: Rafael),
quero escolher um horário livre da professora e confirmar meu agendamento,
para garantir minha aula sem precisar trocar mensagens.
Prioridade: MUST (MoSCoW)
Estimativa: 5 pontos (story points)
Depende de: US-01 (precisa existir ao menos um tipo de aula e disponibilidade)
```

**Critérios de aceite**

- **AC1.** Só são exibidos horários livres, dentro da disponibilidade da professora, para o tipo de aula escolhido.
- **AC2.** É necessário autenticar como aluno e aceitar o consentimento LGPD antes de confirmar.
- **AC3.** Ao confirmar, o horário some imediatamente da lista de livres para os demais usuários.
- **AC4.** Se o horário for ocupado por outra pessoa durante o processo, o sistema avisa e sugere os próximos horários livres.
- **AC5.** A tela de confirmação mostra aula, data, hora e preço; o registro fica associado à conta do aluno.
- **AC6.** O fluxo completo é concluído em, no máximo, 3 cliques após escolher a aula.

---

### US-03 · Cancelar ou reagendar aula

```
ID: US-03
Título: Cancelar ou reagendar aula
Como responsável por aluno (persona: Sônia),
quero cancelar ou reagendar uma aula já marcada dentro do prazo permitido,
para evitar perder aulas e não precisar pedir ajuda à professora.
Prioridade: SHOULD (MoSCoW)
Estimativa: 3 pontos (story points)
Depende de: US-02 (precisa existir um agendamento)
```

**Critérios de aceite**

- **AC1.** O botão de cancelar/reagendar fica disponível até o prazo configurado pela professora (padrão: 12h).
- **AC2.** Antes de cancelar, o sistema pede confirmação com texto claro ("Tem certeza que deseja cancelar?").
- **AC3.** Ao cancelar, o horário volta a ficar livre e a professora recebe notificação.
- **AC4.** Ao reagendar, a nova data só pode ser escolhida entre horários livres e o horário antigo é liberado.
- **AC5.** Fora do prazo, o sistema explica o motivo e informa que a alteração deve ser combinada com a professora.

---

### US-04 · Professora cria conta

```
ID: US-04
Título: Professora cria conta
Como professora (persona: Mariana),
quero criar uma conta segura com meu link público,
para cadastrar minhas aulas e disponibilidades.
Prioridade: MUST (MoSCoW)
Estimativa: 5 pontos (story points)
Depende de: — (cadastro autônomo)
```

**Critérios de aceite**

- **AC1.** Nome, e-mail, senha e slug são obrigatórios; o slug é validado quanto ao formato e disponibilidade.
- **AC2.** Quando a confirmação de e-mail estiver habilitada, a tela informa que é necessário confirmar antes de entrar.
- **AC3.** Após entrar, a professora vê apenas o próprio perfil, aulas, disponibilidade e agendamentos.
- **AC4.** “Esqueci minha senha” envia as instruções pelo Supabase Auth e permite definir uma nova senha.
- **AC5.** O perfil permite editar nome, telefone e antecedência de alteração (0–72h), além de solicitar exclusão da própria conta.

---

### US-05 · Aluno cria conta

```
ID: US-05
Título: Aluno cria conta
Como aluno ou responsável (personas: Rafael e Sônia),
quero criar uma conta com consentimento LGPD,
para agendar, consultar e gerenciar minhas aulas sem perder meu histórico ao reabrir o app.
Prioridade: MUST (MoSCoW)
Estimativa: 3 pontos (story points)
Depende de: US-02 (para existir uma professora, aula e disponibilidade para reservar)
```

**Critérios de aceite**

- **AC1.** Nome, e-mail, senha e aceite LGPD são obrigatórios; telefone é opcional quando há e-mail válido.
- **AC2.** Após entrar, “Minhas aulas” mostra apenas reservas vinculadas à conta, inclusive após sair e entrar novamente.
- **AC3.** A aula, data e horário selecionados no link público são preservados durante o login/cadastro.
- **AC4.** O aluno pode cancelar ou reagendar dentro do prazo e editar nome/telefone do próprio perfil.
- **AC5.** A exclusão exige confirmação explícita e remove apenas a própria conta e seus dados associados.
- **AC6.** Erro de validação ou rede é informado e não mostra sucesso falso.

---

## 06 · AC (Critérios de aceite — checklist)

### US-01 · Cadastrar tipo de aula (MUST)
- [ ] AC1. Campos obrigatórios: nome (≥ 3 caracteres), duração (15–120 min), preço (> R$ 0)
- [ ] AC2. Duração aceita apenas inteiros positivos
- [ ] AC3. Preço formatado em R$ X.XXX,XX ao digitar
- [ ] AC4. Aula aparece na lista em < 1 s após salvar
- [ ] AC5. Cancelar descarta dados sem persistência parcial
- [ ] AC6. Erro de rede exibe mensagem amigável e mantém dados

### US-02 · Agendar aula em horário livre (MUST)
- [ ] AC1. Apenas horários livres e dentro da disponibilidade são exibidos
- [ ] AC2. Autenticação de aluno e consentimento LGPD são obrigatórios
- [ ] AC3. Horário agendado some da lista de livres imediatamente
- [ ] AC4. Conflito de horário gera aviso e sugestão de alternativas
- [ ] AC5. Tela de confirmação mostra aula, data, hora e preço
- [ ] AC6. Fluxo concluído em no máximo 3 cliques

### US-03 · Cancelar ou reagendar aula (SHOULD)
- [ ] AC1. Ação disponível apenas até o prazo configurado (padrão 12h)
- [ ] AC2. Confirmação explícita antes de cancelar
- [ ] AC3. Horário liberado e notificação registrada ao cancelar
- [ ] AC4. Reagendamento só para horários livres; horário antigo liberado
- [ ] AC5. Fora do prazo: mensagem explicativa

### US-04 · Professora cria conta (MUST)
- [ ] AC1. Nome, e-mail, senha e slug obrigatórios; slug validado quanto a formato e disponibilidade
- [ ] AC2. Mensagem de confirmação de e-mail quando habilitada
- [ ] AC3. Professora acessa apenas os próprios dados
- [ ] AC4. Recuperação de senha e redefinição funcionais
- [ ] AC5. Perfil permite editar nome, telefone e antecedência; exclusão pede confirmação

### US-05 · Aluno cria conta (MUST)
- [ ] AC1. Nome, e-mail, senha e aceite LGPD obrigatórios
- [ ] AC2. “Minhas aulas” lista apenas reservas próprias após novo login
- [ ] AC3. Seleção do link público sobrevive ao login/cadastro
- [ ] AC4. Aluno edita nome/telefone e gerencia reserva dentro do prazo
- [ ] AC5. Exclusão confirmada remove apenas seus dados
- [ ] AC6. Falhas são apresentadas sem confirmação falsa

> **Definição de pronto:** a história está pronta quando **todos** os ACs acima passam.

---

## 07 · OUT (Fora de escopo)

O que **NÃO** será feito no MVP:

- Pagamento online (Pix, cartão, boleto); o preço é apenas informativo.
- Videochamada própria; a professora informa o link (Meet/Zoom) manualmente.
- Aplicativo nativo (iOS/Android); apenas web responsivo.
- Integração com Google Agenda / Outlook.
- Pacotes de aulas, assinaturas e planos recorrentes.
- Aulas em grupo (cada agendamento é individual).
- Avaliações, chat interno, material didático e acompanhamento de progresso.
- Gestão de várias professoras por uma única escola/conta; professoras independentes podem manter suas próprias contas e agendas.
- Envio efetivo de e-mails/WhatsApp: a migration registra notificações em fila, mas o worker de entrega é serviço externo e não faz parte deste front-end client-side.
- Suporte a outros idiomas de interface além do português.
- Emissão de nota fiscal e relatórios financeiros.

---

## 08 · MAPA (Dor, cenário de uso e métrica de sucesso)

Mapeamento baseado na persona primária (Mariana, professora autônoma), que cadastra as aulas e sustenta a oferta do sistema.

### Dor principal

**Perda de tempo e erros ao combinar horários manualmente.** A Mariana gasta cerca de 1h por dia no WhatsApp perguntando e respondendo "qual horário você tem livre?". Isso causa conflitos de agenda (duas aulas no mesmo horário) e faltas sem aviso, que significam horário perdido e menos receita.

As dores das outras personas estão ligadas a essa:

- **Rafael (aluno adulto):** não sabe quais horários estão livres e precisa remarcar em cima da hora.
- **Sônia (responsável):** tem medo de errar o agendamento e esquecer a aula do filho.

### Cenário de uso da solução

**Mariana (professora):**

1. No domingo à noite, pelo celular, cadastra seus tipos de aula (nome, duração, preço) e define a disponibilidade da semana.
2. Envia o link do sistema aos alunos.
3. Durante o dia, só recebe notificações de novos agendamentos e cancelamentos.

**Aluno ou responsável:**

1. Abre o link da professora no celular.
2. Escolhe um horário livre e confirma, em no máximo 3 cliques.
3. Recebe a confirmação na hora e um lembrete 24h antes.
4. Se precisar, cancela ou reagenda até 12h antes da aula.

Em resumo: o professor configura uma vez, o aluno agenda sozinho e o sistema cuida das confirmações, lembretes e conflitos.

### Principal métrica de sucesso

**Reduzir o tempo de gestão de horários da Mariana para menos de 15 minutos por semana**, com menos de 5% de conflitos e faltas sem aviso.

Esta é a métrica da persona primária e mede diretamente o problema que o sistema resolve. As métricas das outras personas funcionam como apoio:

- **Rafael:** agendar em menos de 1 minuto e em até 3 cliques.
- **Sônia:** agendar sozinha na primeira tentativa, com lembrete 24h antes.

---

## Apêndice A — Entrevista simulada (CTQF)

Prompt usado (estrutura **C**ontexto, **T**arefa, **Q**uem, **F**ormato) para gerar as personas:

```
# CONTEXTO  Estou especificando um MVP de sistema web de agendamento de serviços
para aulas de inglês online. Domínio: serviços on-line, agendamento por horário.
Região: Brasil. Idioma: português.

# TAREFA  Gere 3 personas distintas que representem o público-alvo deste sistema.
Para cada persona, inclua: nome (fictício, realista), idade, profissão, cidade,
principal dor relacionada a agendamento, nível de familiaridade com tecnologia,
cenário típico de uso do sistema, 1 métrica de sucesso.

# QUEM  Você é uma pesquisadora de UX sênior com experiência em design de serviços
para pequenos negócios.

# FORMATO  Markdown, 1 bloco por persona, separados por ---. No final, inclua uma
tabela comparativa das 3 personas (colunas: persona, dor principal, tecnologia, métrica).
```

Entrevista simulada (≈ 10 min, perguntas abertas) com a persona primária:

**Entrevistadora:** Conte como você organiza suas aulas hoje.
**Mariana:** Uso o WhatsApp e uma planilha. Cada aluno me manda mensagem perguntando o que tenho livre e eu respondo um por um.

**Entrevistadora:** Qual foi a última vez que algo deu errado?
**Mariana:** Marquei dois alunos no mesmo horário porque esqueci de atualizar a planilha. Tive que pedir desculpas e remarcar um deles.

**Entrevistadora:** E quando um aluno precisa cancelar?
**Mariana:** Muitos avisam em cima da hora, ou nem avisam. Eu fico esperando na chamada e perco o horário.

**Entrevistadora:** O que seria "mágico" para você nesse processo?
**Mariana:** Mandar um link e o aluno escolher sozinho um horário livre, sem eu precisar responder nada.

**Entrevistadora:** O que não pode faltar?
**Mariana:** Ser simples de configurar, funcionar no celular e me avisar quando alguém marcar ou cancelar.

**Principais insights → requisitos:** autonomia do aluno (RF03), prevenção de conflitos (RF04), regra de cancelamento (RF05), avisos automáticos (RF06), simplicidade e mobile (RNF02).

---
