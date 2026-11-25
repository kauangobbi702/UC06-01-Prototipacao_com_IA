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

A migration `supabase/migrations/20261117220000_booking_backend.sql` define o modelo, constraints de agendamento sem sobreposição, RLS e consultas públicas limitadas. `20261118191000_fixed_student_identity.sql` preserva a identidade por professora/contato e associa reservas existentes. `20261119120000_auth_roles_students.sql` adiciona o papel fixo por conta, perfil privado de aluno, vínculo histórico e RPCs autenticadas de agendamento, edição e exclusão. A migration mais recente concede à agenda da professora leitura da referência do aluno. O estado observado do projeto de testes e o resultado da tentativa de aplicação estão registrados na seção 9.7.1.

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

A rodada de 25/11/2026 executou os 13 fluxos E2E nos viewports de 375, 768 e 1280 px (39 aprovações), com contas e dados temporários removidos ao final; consulte a seção 9.7.1. Na mesma data, a suíte funcional executou os 52 casos: 48 aprovados, 2 reprovados, 1 parcial e 1 inaplicável. TF-07 ainda excede a meta de 1 s e TF-29 não mostra na interface a reserva cancelada, embora estado, notificação e liberação do horário tenham sido confirmados no banco. No início do E2E, o editor SQL ainda mostrava a migration de `GRANT` como “Running”, mas o E2E-10 confirmou na prática que a professora consegue ler o aluno na agenda. Não considere o MVP pronto para produção até resolver as falhas e concluir as verificações restantes de RNF.

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
9. [ENTREGÁVEL · PLANO DE TESTES](#09--entregável--plano-de-testes)
10. [Apêndice A – Entrevista simulada](#apêndice-a--entrevista-simulada-ctqf)

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

## 09 · ENTREGÁVEL · PLANO DE TESTES

> **Meta:** MVP validado + plano de testes documentado. *O MVP funciona de verdade? Provemos.*
>
> **Estado deste documento:** o plano foi **escrito por IA com base neste README** e precisa de revisão humana. Os 13 fluxos E2E passaram nos três viewports (39 execuções); os 52 testes funcionais e a sessão de usabilidade continuam pendentes. As colunas "Obtido" e "Status" só devem registrar evidências observadas. A seção 9.4 é uma **simulação** de teste de usabilidade, não uma observação real.

### 9.0 Como usar este plano (humanos e GitHub Copilot)

**Ordem de trabalho para o Copilot (modo Agent):**

1. **Fase A · Preparar:** ler o código e este plano; adicionar os `data-testid` do contrato da seção 9.3.3 sem alterar comportamento.
2. **Fase B · Integração:** criar `playwright.config.ts` e `tests/e2e/fluxo-completo.spec.ts` (seção 9.3), ajustar os seletores ao que existe de fato e rodar `npx playwright test --project=mobile-375`; depois nos 3 viewports.
3. **Fase C · Funcional:** automatizar só os casos marcados com ⚙ (críticos) que ainda não estiverem no E2E; os casos 🖐 (manuais) e 🗄 (conferência no Supabase) são executados por pessoas.
4. **Fase D · Corrigir com IA:** aplicar o prompt CTQ da seção 9.6 nos 3 bugs candidatos, sempre propondo **diff** e a verificação (SQL ou DevTools) antes de aplicar.
5. **Fase E · Melhorar:** implementar as melhorias da seção 9.5 por prioridade MoSCoW (uma por commit) e reexecutar os testes afetados.

**Regras inegociáveis:**

- Nunca marcar um teste como aprovado (`☑`) sem tê-lo executado; nunca editar o *resultado esperado* para fazer um teste passar. Se o comportamento real divergir do esperado, registrar como bug.
- Usar um **projeto Supabase de testes**, nunca o projeto de produção ou de demonstração; e-mails de teste sempre `@example.com`; sem dados pessoais reais.
- Não ler nem imprimir `.env`/`.env.*`; não usar `service_role` em nenhum teste; não registrar senhas ou tokens em logs, relatórios ou capturas.
- Nomes de tabelas, colunas, RPCs e telas citados aqui vêm do README: **confirmar nos arquivos de `supabase/migrations` e no código** antes de usar.

**Legenda dos casos:** ⚙ = automatizar (crítico) · 🖐 = manual · 🗄 = conferir no Table Editor/SQL do Supabase · `+` = caso positivo · `−` = caso negativo.

### 9.0.1 Checklist do entregável

| Item do entregável | Onde | Escrito | Executado |
|---|---|---|---|
| Matriz de rastreabilidade RF → teste | 9.1 | ☑ | ☑ (evidência E2E parcial; testes funcionais pendentes) |
| Casos de teste da US-01 (9 casos) + demais histórias (52 casos no total) | 9.2 | ☑ | ☐ |
| 1 teste E2E em Playwright executável | 9.3 | ☑ | ☑ (39/39 execuções) |
| Relatório de teste de usabilidade (2 colegas) | 9.4 | ☑ (simulado) | ☐ (sessão real) |
| 3 bugs documentados: reprodução + diagnóstico + fix | 9.6 | ☑ (candidatos) | ☐ |
| MoSCoW atualizado do projeto | 9.5 | ☑ | — |
| Seção "Limitações da IA encontradas" | 9.8 | ☑ | — |

---

### 9.1 Matriz de rastreabilidade: cada RF tem teste correspondente?

| RF | Requisito (resumo) | Testes correspondentes | Status |
|---|---|---|---|
| RF01 | Cadastrar, listar, editar e excluir tipos de aula | TF-01 a TF-12 · E2E-02, E2E-03 | ⚠ E2E parcial: criar e validar; listar/editar/excluir pendentes |
| RF02 | Disponibilidade semanal e bloqueio de datas | TF-13 a TF-19 · E2E-05, E2E-06 | ⚠ E2E validou faixas e bloqueio; TF pendentes |
| RF03 | Aluno autenticado vê horários livres e agenda | TF-18 a TF-25 · TF-43 · E2E-06 a E2E-09 | ⚠ E2E validou consulta, reserva e agenda; TF pendentes |
| RF04 | Impedir horário ocupado ou fora da disponibilidade | TF-19 · TF-23 · TF-31 · TF-52 · E2E-08 | ⚠ E2E validou reserva ocupada; demais casos pendentes |
| RF05 | Cancelar ou reagendar dentro do prazo configurável | TF-26 a TF-31 · E2E-11, E2E-12 | ⚠ E2E validou prazo e cancelamento; reagendamento pendente |
| RF06 | Enfileirar confirmação e lembrete 24h | TF-50 · verificação no banco em E2E-07 | ⚠ Parcial por escopo: valida a fila `notificacoes`, não a entrega real |
| RF07 | Professora: criar conta, entrar, recuperar senha | TF-32 a TF-39 · TF-47 · E2E-01 | ⚠ E2E validou criação; login/recuperação e TF pendentes |
| RF08 | Aluno: criar conta, entrar, recuperar senha | TF-40 a TF-46 · TF-47 · E2E-07, E2E-13 | ⚠ E2E validou criação, isolamento e exclusão; login/recuperação e TF pendentes |

**Cobertura planejada:** 7 de 8 RFs com cobertura completa + 1 parcial (RF06) = **88%**. **Execução E2E:** 13/13 fluxos aprovados nos 3 viewports (39/39); **execução funcional/manual:** 0/52 casos.

**Crítico:** os E2E fornecem evidência parcial, não substituem a matriz funcional. Não apresentar o MVP sem executar os 52 casos, incluindo os testes ⚙ de RF01, RF03, RF04, RF05 e RF08.

**Fora desta tabela (RNFs):** desempenho, responsividade, acessibilidade e segurança são verificados com Lighthouse, axe e os testes TF-25/TF-49 (ver 9.7.3).

**Cobertura de critérios de aceite (1 AC = pelo menos 1 caso de teste):**

| História | ACs | Casos | Cobertura |
|---|---|---|---|
| US-01 Cadastrar aula | 6 | 9 (TF-01 a TF-09) | 6/6 |
| US-02 Agendar aula | 6 | 8 (TF-18 a TF-25) | 6/6 |
| US-03 Cancelar ou reagendar | 5 | 6 (TF-26 a TF-31) | 5/5 |
| US-04 Professora cria conta | 5 | 8 (TF-32 a TF-39) | 5/5 |
| US-05 Aluno cria conta | 6 | 7 (TF-40 a TF-46) | 6/6 |
| **Total** | **28** | **38** (+ 14 de RF e transversais) | **28/28** |

---

### 9.2 Testes funcionais: cada critério de aceite vira um caso de teste

Cada caso tem **pré-condição, passo a passo, resultado esperado e resultado obtido**. Regra: casos positivos **e** negativos; começar manual e automatizar só os críticos (cadastro, login, reserva, cancelamento).

**Pré-condições padrão**

| Código | Descrição |
|---|---|
| **PC1** | Projeto Supabase **de testes** com as 4 migrations aplicadas em ordem e **Confirm email desativado** (exceto TF-34). |
| **PC2** | Professora A logada, com a aula "Conversação individual" (50 min, R$ 49,00), faixa semanal no dia da semana de **amanhã** das 09:00 às 12:00 e antecedência de alteração de 12 h. |
| **PC3** | Aluno A e Aluno B com contas criadas; link público da professora A (`?professora=<slug>`). |

#### US-01 · Cadastrar novo tipo de aula (MUST): 9 casos para 6 ACs

| ID | AC | Cenário (pré-condição → passos) | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-01 ⚙ | AC1 + | PC1, professora logada → Nova aula → nome "Speaking for travel", duração 30, preço 39,00 → Salvar | Salva; item na lista com nome, 30 min e R$ 39,00 | — | ☐ |
| TF-02 ⚙ | AC1 − | Nova aula → nome "En" (2 caracteres), demais campos válidos → Salvar | Bloqueia com erro "mínimo 3 caracteres"; nada gravado | — | ☐ |
| TF-03 | AC2 + | Duração 15; repetir com duração 120 | Salva os dois (limites inclusivos) | — | ☐ |
| TF-04 | AC2 − | Duração 14, 121, 0, 45,5, "abc" e vazio | Cada um é bloqueado com erro de faixa ou de inteiro; nada gravado | — | ☐ |
| TF-05 ⚙ | AC3 + | Campo preço: digitar 4900; depois 123456789 | Exibe R$ 49,00; depois R$ 1.234.567,89 | — | ☐ |
| TF-06 | AC1/AC3 − | Preço R$ 0,00 e valor negativo | Bloqueia com "preço inválido"; nada gravado | — | ☐ |
| TF-07 🗄 | AC4 | Salvar aula válida cronometrando (DevTools → Network) | Item aparece na lista em menos de 1 s; linha em `public.aulas` ligada à professora | 1.378 ms no último run; persistência confirmada | Reprovado |
| TF-08 | AC5 | Preencher todos os campos e clicar em Cancelar | Formulário descartado; lista e tabela inalteradas | — | ☐ |
| TF-09 | AC6 | DevTools → Network → Offline → Salvar | Mensagem amigável; campos preservados; nenhuma aula criada; ao voltar online, salvar funciona | — | ☐ |

#### RF01 (editar e excluir) e RF02 (disponibilidade e bloqueios)

| ID | RF | Cenário | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-10 🗄 | RF01 | PC2 → Editar aula → alterar preço para R$ 79,00 → Salvar | Lista e `public.aulas` refletem o novo preço | — | ☐ |
| TF-11 | RF01 | Excluir aula sem reservas (com confirmação) | Aula some; as demais permanecem | — | ☐ |
| TF-12 🗄 | RF01 | Excluir aula que tem reserva | Exclusão bloqueada com mensagem amigável; nada removido | — | ☐ |
| TF-13 ⚙ | RF02 | Adicionar faixa segunda 09:00 a 12:00 → abrir link público | Só horários dentro da faixa aparecem para o aluno | — | ☐ |
| TF-14 | RF02 − | Faixa com fim menor ou igual ao início; faixa sobreposta a outra do mesmo dia | Bloqueia com erro claro; nada gravado | — | ☐ |
| TF-15 | RF02 | Remover faixa | Horários daquele dia deixam de aparecer no catálogo | — | ☐ |
| TF-16 ⚙ | RF02 | Bloquear uma data que tem faixa | Nenhum horário é oferecido nessa data | — | ☐ |
| TF-17 | RF02 | Remover o bloqueio | Horários voltam a aparecer | — | ☐ |

#### US-02 · Agendar aula em horário livre (MUST): 8 casos para 6 ACs

| ID | AC | Cenário (pré-condição → passos) | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-18 ⚙ | AC1 + | PC2, aluno anônimo abre o link → escolhe a aula de 50 min | Lista horários em blocos de 30 min nos próximos 14 dias, só nos dias com faixa; nenhum horário cujo fim passe de 12:00 | — | ☐ |
| TF-19 ⚙ | AC1 − | Data bloqueada (TF-16) e dia da semana sem faixa | Sem horários nessas datas, com mensagem "sem horários" | — | ☐ |
| TF-20 🗄 | AC2 + | PC3, aluno A logado → escolhe horário → marca consentimento → Confirmar | Reserva criada; consentimento `agendamento-v1` registrado | — | ☐ |
| TF-21 | AC2 − | (a) tentar confirmar sem consentimento; (b) tentar confirmar sem sessão | (a) bloqueia com mensagem; (b) leva ao login/cadastro; nenhuma reserva criada | — | ☐ |
| TF-22 ⚙ | AC3 | Após TF-20, aluno B abre o catálogo da mesma aula | O horário reservado não aparece | — | ☐ |
| TF-23 🗄 | AC4 | Alunos A e B selecionam o mesmo horário; A confirma; B confirma depois | B recebe aviso de conflito e sugestão dos próximos horários; existe só 1 reserva ativa no banco | — | ☐ |
| TF-24 ⚙🗄 | AC5 | Concluir uma reserva | Tela com aula, data, hora e preço; reserva vinculada à conta do aluno que reservou | — | ☐ |
| TF-25 🖐 | AC6 | Com conta existente, contar cliques após escolher a aula e cronometrar | No máximo 3 cliques (horário, continuar, confirmar) e menos de 1 min | — | ☐ |

#### US-03 · Cancelar ou reagendar aula (SHOULD): 6 casos para 5 ACs

| ID | AC | Cenário (pré-condição → passos) | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-26 | AC1 + | Antecedência 0 h, aluno com reserva → Minhas aulas | Cancelar e Reagendar habilitados | — | ☐ |
| TF-27 ⚙🗄 | AC1/AC5 − | Antecedência 72 h e aula em menos de 72 h → Minhas aulas | Botões desabilitados; mensagem explica o motivo e orienta combinar com a professora; chamada direta à RPC com a sessão do aluno também é recusada | — | ☐ |
| TF-28 | AC2 | Cancelar → "Não"; depois Cancelar → "Sim" | Aparece "Tem certeza que deseja cancelar?"; "Não" mantém a reserva; "Sim" cancela | — | ☐ |
| TF-29 ⚙🗄 | AC3 | Cancelar dentro do prazo | Status cancelado; horário volta ao catálogo; notificação de cancelamento registrada; agenda da professora mostra cancelada | Banco/horário/notificação OK; agenda sem item visível | Reprovado |
| TF-30 | AC4 + | Reagendar → escolher novo horário livre | Reserva muda de horário; horário antigo fica livre | — | ☐ |
| TF-31 🗄 | AC4 − | Tentar reagendar para horário ocupado por outra reserva | Horário não é oferecido; se forçado via RPC, é recusado sem alterar a reserva | — | ☐ |

#### US-04 · Professora cria conta (MUST): 8 casos para 5 ACs

| ID | AC | Cenário (pré-condição → passos) | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-32 ⚙🗄 | AC1 + | PC1 → Criar conta de professora: nome, e-mail, senha, slug `ana-english` | Conta criada; painel abre; slug gravado em `perfis` | — | ☐ |
| TF-33 | AC1 − | (a) campos vazios; (b) slug com maiúscula, espaço ou acento; (c) slug já em uso; (d) senha curta; (e) e-mail inválido | Cada caso bloqueado com mensagem clara; nenhuma conta criada | — | ☐ |
| TF-34 🖐 | AC2 | **Só com Confirm email ligado:** criar conta | Tela informa que é preciso confirmar o e-mail; login antes de confirmar é recusado com mensagem clara (N/A no ambiente de estudo) | Confirm email desativado no projeto de testes | N/A |
| TF-35 🗄 | AC3 | Professoras A e B com dados diferentes; entrar como A | A vê só suas aulas, disponibilidade e reservas; consulta REST com o token de A pedindo dados de B retorna vazio | — | ☐ |
| TF-36 🖐 | AC4 | "Esqueci minha senha" com o e-mail da conta | Instruções enviadas; o link abre a definição de nova senha; login com a nova senha funciona; e-mail inexistente não revela se a conta existe | Respostas neutras diferem; caixa de e-mail/link inacessível | Parcial |
| TF-37 | AC5 + | Meu perfil → alterar nome, telefone e antecedência para 24 | Salva e reflete no painel e no catálogo público | — | ☐ |
| TF-38 | AC5 − | Antecedência −1, 73, 1,5 e vazio | Bloqueia; mantém o valor anterior | — | ☐ |
| TF-39 ⚙🗄 | AC5 | Excluir conta → desistir; depois confirmar | Sem confirmação nada é excluído; com confirmação, conta e dados saem e o login falha | — | ☐ |

#### US-05 · Aluno cria conta (MUST): 7 casos para 6 ACs

| ID | AC | Cenário (pré-condição → passos) | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-40 ⚙ | AC1 + | Criar conta de aluno: nome, e-mail, senha, aceite LGPD, telefone vazio | Conta criada; telefone opcional é aceito | — | ☐ |
| TF-41 | AC1 − | Sem aceite LGPD; e-mail inválido; senha curta; nome vazio | Cada caso bloqueado com mensagem; nenhuma conta criada | — | ☐ |
| TF-42 ⚙ | AC2 | Aluno A reserva → sair → entrar → Minhas aulas; depois entrar como B | A vê só as suas reservas, inclusive após novo login; B não vê as de A | — | ☐ |
| TF-43 ⚙ | AC3 | Anônimo escolhe aula e horário → Continuar → cadastrar; repetir entrando com conta existente | Seleção (aula, data, horário) reaparece resumida após autenticar; nada precisa ser reescolhido | — | ☐ |
| TF-44 | AC4 | Editar nome e telefone; cancelar e reagendar dentro do prazo | Perfil salvo; ações conforme TF-26 a TF-31 | — | ☐ |
| TF-45 ⚙🗄 | AC5 | Excluir conta que tem reservas | Exige confirmação; remove só os dados do aluno; a professora deixa de ver dados pessoais dele; contas de terceiros intactas | — | ☐ |
| TF-46 | AC6 | Offline ao criar conta, ao reservar e ao cancelar; e entradas inválidas | Mensagem de erro em cada caso; nunca tela de sucesso; dados digitados mantidos | — | ☐ |

#### Casos transversais (papéis, RLS, notificações)

| ID | Ref. | Cenário | Resultado esperado | Obtido | Status |
|---|---|---|---|---|---|
| TF-47 ⚙ | RF07/RF08 | Login com senha correta e com errada; logout | Correta abre painel ou Minhas aulas conforme o papel; errada mostra erro genérico; logout volta ao início | — | ☐ |
| TF-48 🗄 | RF07/RF08 | Conta de aluno tenta abrir o painel da professora; conta de professora tenta criar perfil de aluno | Papel fixo: acesso negado ou redirecionado; nenhum perfil duplicado | — | ☐ |
| TF-49 🗄 | RNF03 | Com a chave anon, consultar via REST `agendamentos`, `perfis_alunos` e `notificacoes` | Resposta vazia ou 401/403; nenhum dado pessoal retornado | — | ☐ |
| TF-50 🗄 | RF06 | Reservar e depois cancelar | Registros pendentes de confirmação e lembrete 24 h em `notificacoes`; após cancelar, registro de cancelamento (sem envio real) | — | ☐ |
| TF-51 🖐 | RF03 | Professora logada abre o link público | Mostra o catálogo; para reservar, orienta sair e entrar como aluno; a sessão da professora não é usada na reserva | — | ☐ |
| TF-52 🗄 | RF04 | Chamar `criar_agendamento` autenticado com horário fora da faixa (ex.: 03:00) e com horário sobreposto | Ambos recusados pelo banco com erro tratado; nada gravado | — | ☐ |

**Total: 52 casos** (9 da US-01, 8 de RF01/RF02, 8 da US-02, 6 da US-03, 8 da US-04, 7 da US-05 e 6 transversais). Os 20 casos com ⚙ formam o conjunto crítico; o E2E da seção 9.3 cobre o fluxo ponta a ponta entre eles.

**Resultados da rodada funcional 3 (25/11/2026):** aprovados: TF-01, TF-02, TF-03, TF-04, TF-05, TF-06, TF-08, TF-09, TF-10, TF-11, TF-12, TF-13, TF-14, TF-15, TF-16, TF-17, TF-18, TF-19, TF-20, TF-21, TF-22, TF-23, TF-24, TF-25, TF-26, TF-27, TF-28, TF-30, TF-31, TF-32, TF-33, TF-35, TF-37, TF-38, TF-39, TF-40, TF-41, TF-42, TF-43, TF-44, TF-45, TF-46, TF-47, TF-48, TF-49, TF-50, TF-51 e TF-52. Reprovados: TF-07 e TF-29. Parcial: TF-36. N/A: TF-34. Detalhes e evidências estão na seção 9.7.1.

---

### 9.3 Teste de integração (E2E): professora configura, aluno reserva

Valida **front, Auth, RPCs, RLS e banco juntos**: cadastro de professora → aulas → horários disponíveis → horários bloqueados → cadastro de aluno → reserva → cancelamento. Usar **dados de teste e um projeto Supabase de testes**, jamais o banco de produção.

#### 9.3.1 Ambiente e execução

- Projeto usado nesta rodada: Supabase TESTES `hpcitfmbiyyqwyiihcgn`; o painel mostrava a branch `main` com rótulo `PRODUCTION`, portanto confira cuidadosamente o projeto-alvo antes de repetir qualquer operação.
- As migrations 1–3 foram aplicadas. A instrução da migration de `GRANT` ainda aparecia como “Running” no SQL Editor antes da rodada; o E2E-10 confirmou que a professora consegue ler o aluno na agenda.
- As variáveis públicas do Supabase estavam configuradas. O `.env` não foi aberto nem seus valores registrados; a configuração Playwright restringe o endpoint ao projeto informado e usa apenas a chave anon/publishable, nunca `service_role`.
- Playwright e Chromium estão instalados. Os scripts disponíveis são `npm run test:e2e` (mobile) e `npm run test:e2e:all` (todos os viewports).
- Execução aprovada: `npm run test:e2e:all -- --workers=1` — 39/39, nos projetos `mobile-375`, `tablet-768` e `desktop-1280`. O relatório HTML fica em `docs/relatorio-playwright`.
- As contas descartáveis e os dados da rodada foram removidos; a exclusão foi verificada por tentativa de autenticação. Atenção ao limite de cadastros por hora do Supabase Auth ao repetir muitas execuções.

#### 9.3.2 Fluxo ponta a ponta

| Passo | Quem | Ação | Verificação na UI | Verificação no banco 🗄 |
|---|---|---|---|---|
| E2E-01 | Professora | Cria conta com nome, e-mail, senha e slug | Painel da professora visível | Linha em `perfis` com o slug |
| E2E-02 | Professora | Cadastra 2 aulas (50 min R$ 49,00 e 30 min R$ 39,00) | Preço formatado; 2 itens na lista | 2 linhas em `aulas` da professora |
| E2E-03 | Professora | Tenta salvar aula com nome "En" | Erro de nome; lista continua com 2 itens | Nenhuma linha nova |
| E2E-04 | Professora | Define antecedência de 72 h | Confirmação de salvo | Valor 72 no perfil |
| E2E-05 | Professora | Define 0 h temporariamente; cadastra disponibilidade semanal 09:00–12:00 nos dias da semana de amanhã e depois de amanhã; tenta faixa sobreposta; bloqueia a data de depois de amanhã | Erro na sobreposta; 1 bloqueio listado | 2 faixas em `disponibilidades`; 1 linha em `bloqueios` |
| E2E-06 | Aluno 1 (anônimo) | Abre `?professora=<slug>` e escolhe a aula de 50 min | Horários de amanhã entre 09:00 e 11:00; nenhum na data bloqueada | — |
| E2E-07 | Aluno 1 | Escolhe horário → continuar → cria conta → seleção permanece marcada → consente → confirma | Confirmação com aula, hora e R$ 49,00 | 1 linha em `agendamentos` ligada à conta, status `confirmado`; consentimento `agendamento-v1`; 2 linhas em `notificacoes` |
| E2E-08 | Aluno 2 (anônimo) | Abre o mesmo link e a mesma aula | O horário reservado não aparece | — |
| E2E-09 | Aluno 1 | Abre Minhas aulas | 1 reserva com status confirmado | — |
| E2E-10 | Professora | Abre a agenda | Nome do aluno visível; status confirmado | Status `confirmado` |
| E2E-11 | Professora e Aluno 1 | Professora define antecedência de 72 h após a reserva; aluno tenta cancelar | Mensagem de prazo encerrado; ações de alteração não são exibidas | Reserva continua ativa |
| E2E-12 | Professora e Aluno 1 | Professora define antecedência 0; aluno cancela na confirmação nativa do navegador | Status cancelado; horário volta ao catálogo | Status `cancelado`; registro de cancelamento em `notificacoes` |
| E2E-13 | Aluno 2 | Cria conta e abre Minhas aulas | Lista vazia (não vê a reserva do aluno 1) | — |
| Limpeza | Todos | Excluem as próprias contas | Voltam à tela inicial | Contas e dados removidos |

#### 9.3.3 Contrato de `data-testid` (o Copilot deve adicionar o que faltar)

| Área | Identificadores |
|---|---|
| Início e autenticação | `home-professora`, `home-aluno`, `auth-tab-entrar`, `auth-tab-criar`, `role-professora`, `role-aluno`, `field-nome`, `field-email`, `field-telefone`, `field-senha`, `field-slug`, `field-lgpd`, `auth-submit`, `auth-error` |
| Navegação | `painel-professora`, `nav-painel`, `nav-perfil`, `nav-disponibilidade`, `nav-agenda`, `nav-minhas-aulas`, `logout` |
| Aulas (professora) | `aula-novo`, `aula-nome`, `aula-duracao`, `aula-preco`, `aula-salvar`, `aula-cancelar`, `aula-item`, `erro-nome`, `erro-duracao`, `erro-preco` |
| Perfil | `perfil-antecedencia`, `perfil-salvar`, `perfil-excluir`, `toast-sucesso` |
| Disponibilidade | `disp-dia`, `disp-inicio`, `disp-fim`, `disp-adicionar`, `erro-disponibilidade`, `bloq-data`, `bloq-adicionar`, `bloq-item` |
| Agenda (professora) | `agenda-item`, `agenda-confirmar`, `agenda-concluir`, `agenda-cancelar` |
| Catálogo e reserva (aluno) | `catalogo-aula`, `slot` (com `data-date="AAAA-MM-DD"`, `data-time="HH:MM"` e `aria-pressed`), `continuar-login`, `consentimento`, `confirmar-reserva`, `reserva-confirmada` |
| Minhas aulas | `reserva-item`, `btn-cancelar` (somente dentro do prazo), `btn-reagendar`, `msg-fora-prazo` |

Comportamento verificado no código: a reserva já nasce `confirmado`, portanto a professora não precisa confirmá-la na agenda. Após o cadastro, a seleção é verificada pelo horário marcado (`aria-pressed`), pois não há um resumo separado. Fora do prazo, `msg-fora-prazo` aparece dentro de `reserva-item` e os botões de alteração ficam ocultos (não desabilitados). A confirmação de cancelamento é um diálogo nativo do navegador, não controles HTML `confirm-yes`/`confirm-no`.

#### 9.3.4 `playwright.config.ts`

O arquivo executável é [`playwright.config.ts`](./playwright.config.ts); ele fixa o projeto Supabase de testes, configura os três viewports e inicia o Vite em modo `e2e`. O exemplo a seguir é apenas referência de configuração.

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'docs/relatorio-playwright', open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev -- --mode e2e --port 5173', url: 'http://localhost:5173', reuseExistingServer: true },
});
```

#### 9.3.5 `tests/e2e/fluxo-completo.spec.ts`

O teste executável está em [`tests/e2e/fluxo-completo.spec.ts`](./tests/e2e/fluxo-completo.spec.ts) e é a fonte de verdade. Ele cobre os 13 passos, as verificações de RLS/banco e a limpeza autenticada sem chave `service_role`; o código abaixo é o rascunho original do plano e não deve ser copiado como implementação.

> Os seletores seguem o contrato da seção 9.3.3 e são **hipóteses**: o Copilot deve ajustá-los ao app real antes da primeira execução.

```ts
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const RUN = Date.now().toString(36);
const SENHA = 'Senha#E2E-2026';
const prof = { nome: 'Professora E2E', email: `e2e.prof.${RUN}@example.com`, telefone: '41999990001', slug: `e2e-prof-${RUN}` };
const alu1 = { nome: 'Aluno E2E Um', email: `e2e.aluno1.${RUN}@example.com`, telefone: '11999990002' };
const alu2 = { nome: 'Aluno E2E Dois', email: `e2e.aluno2.${RUN}@example.com`, telefone: '31999990003' };
const AULA_A = { nome: 'Conversação individual', duracao: '50', centavos: '4900', preco: /R\$\s*49,00/ };
const AULA_B = { nome: 'Speaking for travel', duracao: '30', centavos: '3900', preco: /R\$\s*39,00/ };

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const daquiA = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const iso = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const D1 = daquiA(1);
const D2 = daquiA(2);

const t = (page: Page, id: string) => page.getByTestId(id);
const slots = (page: Page, data: string, hora?: string) =>
  page.locator(`[data-testid="slot"][data-date="${data}"]${hora ? `[data-time="${hora}"]` : ''}`);

function novoContexto(browser: Browser) {
  const u = test.info().project.use;
  return browser.newContext({
    baseURL: u.baseURL, viewport: u.viewport ?? undefined, isMobile: u.isMobile, hasTouch: u.hasTouch,
    locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
  });
}

async function criarConta(page: Page, papel: 'professora' | 'aluno',
                          d: { nome: string; email: string; telefone: string; slug?: string }) {
  await t(page, 'auth-tab-criar').click();
  await t(page, papel === 'professora' ? 'role-professora' : 'role-aluno').click();
  await t(page, 'field-nome').fill(d.nome);
  await t(page, 'field-email').fill(d.email);
  await t(page, 'field-telefone').fill(d.telefone);
  await t(page, 'field-senha').fill(SENHA);
  if (papel === 'professora') await t(page, 'field-slug').fill(d.slug!);
  else await t(page, 'field-lgpd').check();
  await t(page, 'auth-submit').click();
}

async function cadastrarAula(page: Page, a: typeof AULA_A) {
  await t(page, 'aula-novo').click();
  await t(page, 'aula-nome').fill(a.nome);
  await t(page, 'aula-duracao').fill(a.duracao);
  await t(page, 'aula-preco').pressSequentially(a.centavos);   // máscara de moeda (US-01 AC3)
  await expect(t(page, 'aula-preco')).toHaveValue(a.preco);
  await t(page, 'aula-salvar').click();
  await expect(t(page, 'aula-item').filter({ hasText: a.nome })).toBeVisible();
}

async function adicionarFaixa(page: Page, dia: Date, ini: string, fim: string) {
  await t(page, 'disp-dia').selectOption({ label: DIAS[dia.getDay()] });
  await t(page, 'disp-inicio').fill(ini);
  await t(page, 'disp-fim').fill(fim);
  await t(page, 'disp-adicionar').click();
}

async function definirAntecedencia(page: Page, horas: string) {
  await t(page, 'nav-perfil').click();
  await t(page, 'perfil-antecedencia').fill(horas);
  await t(page, 'perfil-salvar').click();
  await expect(t(page, 'toast-sucesso')).toBeVisible();
  await t(page, 'nav-painel').click();
}

async function excluirConta(page: Page) {
  await t(page, 'nav-perfil').click();
  await t(page, 'perfil-excluir').click();
  await t(page, 'confirm-yes').click();
  await expect(t(page, 'auth-tab-entrar')).toBeVisible();
}

test.describe('Fluxo ponta a ponta: professora configura, aluno reserva', () => {
  let ctxProf: BrowserContext, ctxA1: BrowserContext, ctxA2: BrowserContext;
  let pProf: Page, pA1: Page, pA2: Page;
  let horaReservada = '';

  test.beforeAll(async ({ browser }) => {
    [ctxProf, ctxA1, ctxA2] = await Promise.all([novoContexto(browser), novoContexto(browser), novoContexto(browser)]);
    [pProf, pA1, pA2] = await Promise.all([ctxProf.newPage(), ctxA1.newPage(), ctxA2.newPage()]);
  });

  test.afterAll(async () => {
    // Limpeza que também valida a exclusão de conta (US-04 AC5 e US-05 AC5).
    for (const page of [pA1, pA2, pProf]) {
      try { await excluirConta(page); } catch { /* conta pode não existir se o fluxo falhou antes */ }
    }
    await Promise.all([ctxProf.close(), ctxA1.close(), ctxA2.close()]);
  });

  test('E2E-01 professora cria conta e vê o painel (RF07, US-04 AC1)', async () => {
    await pProf.goto('/');
    await t(pProf, 'home-professora').click();
    await criarConta(pProf, 'professora', prof);
    await expect(t(pProf, 'painel-professora')).toBeVisible();
  });

  test('E2E-02 professora cadastra 2 aulas (RF01, US-01 AC1 e AC3)', async () => {
    await cadastrarAula(pProf, AULA_A);
    await cadastrarAula(pProf, AULA_B);
    await expect(t(pProf, 'aula-item')).toHaveCount(2);
  });

  test('E2E-03 nome com 2 caracteres é bloqueado (US-01 AC1 negativo)', async () => {
    await t(pProf, 'aula-novo').click();
    await t(pProf, 'aula-nome').fill('En');
    await t(pProf, 'aula-duracao').fill('50');
    await t(pProf, 'aula-preco').pressSequentially('4900');
    await t(pProf, 'aula-salvar').click();
    await expect(t(pProf, 'erro-nome')).toBeVisible();
    await t(pProf, 'aula-cancelar').click();
    await expect(t(pProf, 'aula-item')).toHaveCount(2);
  });

  test('E2E-04 professora define antecedência de 72 h (US-04 AC5)', async () => {
    await definirAntecedencia(pProf, '72');
  });

  test('E2E-05 disponibilidade e bloqueio de data (RF02)', async () => {
    await t(pProf, 'nav-disponibilidade').click();
    await adicionarFaixa(pProf, D1, '09:00', '12:00');
    await adicionarFaixa(pProf, D2, '09:00', '12:00');
    await adicionarFaixa(pProf, D1, '10:00', '11:00');                // sobreposta: deve falhar
    await expect(t(pProf, 'erro-disponibilidade')).toBeVisible();
    await t(pProf, 'bloq-data').fill(iso(D2));
    await t(pProf, 'bloq-adicionar').click();
    await expect(t(pProf, 'bloq-item')).toHaveCount(1);
    await t(pProf, 'nav-painel').click();
  });

  test('E2E-06 aluno anônimo vê só horários livres e fora de bloqueios (RF03, RF04, US-02 AC1)', async () => {
    await pA1.goto(`/?professora=${prof.slug}`);
    await t(pA1, 'catalogo-aula').filter({ hasText: AULA_A.nome }).click();
    await expect(slots(pA1, iso(D1)).first()).toBeVisible();
    const horas = await slots(pA1, iso(D1)).evaluateAll(els => els.map(e => e.getAttribute('data-time') ?? ''));
    expect(horas.every(h => h >= '09:00' && h <= '11:00')).toBe(true);   // aula de 50 min termina até 12:00
    await expect(slots(pA1, iso(D2))).toHaveCount(0);                      // data bloqueada
  });

  test('E2E-07 aluno cria conta, seleção sobrevive e reserva é confirmada (RF08, US-02, US-05 AC3)', async () => {
    const primeiro = slots(pA1, iso(D1)).first();
    horaReservada = (await primeiro.getAttribute('data-time')) ?? '';
    await primeiro.click();
    await t(pA1, 'continuar-login').click();
    await criarConta(pA1, 'aluno', alu1);
    await expect(t(pA1, 'resumo-selecao')).toContainText(AULA_A.nome);
    await expect(t(pA1, 'resumo-selecao')).toContainText(horaReservada);
    await t(pA1, 'consentimento').check();
    await t(pA1, 'confirmar-reserva').click();
    const ok = t(pA1, 'reserva-confirmada');
    await expect(ok).toContainText(AULA_A.nome);
    await expect(ok).toContainText(/49,00/);
    await expect(ok).toContainText(horaReservada);
  });

  test('E2E-08 horário reservado some para outro aluno (US-02 AC3, RF04)', async () => {
    await pA2.goto(`/?professora=${prof.slug}`);
    await t(pA2, 'catalogo-aula').filter({ hasText: AULA_A.nome }).click();
    await expect(slots(pA2, iso(D1)).first()).toBeVisible();
    await expect(slots(pA2, iso(D1), horaReservada)).toHaveCount(0);
  });

  test('E2E-09 aluno vê a reserva em Minhas aulas (US-05 AC2)', async () => {
    await t(pA1, 'nav-minhas-aulas').click();
    await expect(t(pA1, 'reserva-item')).toHaveCount(1);
    await expect(t(pA1, 'reserva-item')).toContainText(/pendente/i);
  });

  test('E2E-10 professora vê o aluno na agenda e confirma (regressão da migration 20261124160000)', async () => {
    await pProf.reload();
    await t(pProf, 'nav-agenda').click();
    const item = t(pProf, 'agenda-item').filter({ hasText: alu1.nome });
    await expect(item).toBeVisible();
    await item.getByTestId('agenda-confirmar').click();
    await expect(item).toContainText(/confirmad/i);
  });

  test('E2E-11 cancelamento fora do prazo é bloqueado (RF05, US-03 AC1 e AC5)', async () => {
    await pA1.reload();
    await t(pA1, 'nav-minhas-aulas').click();
    const item = t(pA1, 'reserva-item').first();
    await expect(item.getByTestId('msg-fora-prazo')).toBeVisible();
    await expect(item.getByTestId('btn-cancelar')).toBeDisabled();
  });

  test('E2E-12 dentro do prazo, cancelar libera o horário (RF05, US-03 AC2 e AC3)', async () => {
    await definirAntecedencia(pProf, '0');
    await pA1.reload();
    await t(pA1, 'nav-minhas-aulas').click();
    const item = t(pA1, 'reserva-item').first();
    await item.getByTestId('btn-cancelar').click();
    await t(pA1, 'confirm-yes').click();
    await expect(item).toContainText(/cancelad/i);
    await pA2.goto(`/?professora=${prof.slug}`);
    await t(pA2, 'catalogo-aula').filter({ hasText: AULA_A.nome }).click();
    await expect(slots(pA2, iso(D1), horaReservada)).toHaveCount(1);
  });

  test('E2E-13 outro aluno não enxerga reservas alheias (RLS)', async () => {
    await pA2.goto('/');
    await t(pA2, 'home-aluno').click();
    await criarConta(pA2, 'aluno', alu2);
    await t(pA2, 'nav-minhas-aulas').click();
    await expect(t(pA2, 'reserva-item')).toHaveCount(0);
  });
});
```

#### 9.3.6 Conferência no banco após a execução 🗄

Executar no SQL Editor **do projeto de testes**, antes da limpeza (ou pausando o `afterAll`). Confirmar os nomes de tabelas e colunas nas migrations.

```sql
-- 1) A professora de teste existe e tem 2 aulas
select p.id, p.slug, (select count(*) from public.aulas a where a.professora_id = p.id) as aulas
from public.perfis p
where p.slug like 'e2e-prof-%';

-- 2) Reservas, status e janela de tempo (conferir também o fuso)
select ag.id, ag.status, ag.inicio, ag.inicio at time zone 'America/Sao_Paulo' as inicio_brt
from public.agendamentos ag
order by ag.inicio desc
limit 5;

-- 3) Fila de notificações da reserva
select n.tipo, n.enviar_em, n.enviada_em
from public.notificacoes n
order by n.enviar_em desc
limit 10;
```

**Critério de aprovação do E2E:** 13 passos aprovados em cada projeto (`mobile-375`, `tablet-768` e `desktop-1280`). **Resultado em 25/11/2026:** 39/39 execuções aprovadas.

---

### 9.4 Teste de usabilidade (SIMULADO) e melhorias sugeridas

> **Atenção:** esta seção é uma **simulação por IA** feita a partir dos fluxos descritos neste README e de heurísticas de usabilidade (Nielsen). Os participantes são fictícios e **todos os tempos e notas são estimativas**, não medições. Serve para formular hipóteses e preparar a sessão real com 2 colegas; substitua pelos dados reais usando a folha da seção 9.4.5.

#### 9.4.1 Método e roteiro (5 min por participante)

- **Dispositivo:** celular (375 px) com o app publicado ou em `localhost`. Um participante por vez, sem ajuda; o observador anota hesitações, erros e comentários em voz alta.
- **Perguntas-guia:** um colega sem conhecimento do sistema cadastra 1 aula em menos de 2 min? Agenda em até 3 cliques e menos de 1 min? Entende o que acontece quando não pode mais cancelar?

| Tarefa | Quem | Descrição | Meta |
|---|---|---|---|
| T1 | Professora | Criar conta e cadastrar 1 aula | Menos de 2 min |
| T2 | Professora | Definir disponibilidade de segunda a sexta e bloquear 1 data | Menos de 2 min |
| T3 | Professora | Copiar o link público e achar a agenda | Menos de 30 s |
| T4 | Aluno | Abrir o link, escolher aula e horário, criar conta e confirmar | Menos de 2 min (com cadastro); em até 3 cliques após escolher a aula (conta existente) |
| T5 | Aluno | Tentar cancelar uma aula fora do prazo | Entender o motivo e o que fazer |
| T6 | Aluno | Reagendar uma aula dentro do prazo | Menos de 1 min |

**Participantes (fictícios):** **P1 Camila**, 23 anos, estudante de Administração, nunca usou ferramenta de agenda, Android intermediário (faz T1 a T3 como professora). **P2 Bruno**, 30 anos, representante comercial, usa apps o dia todo (faz T4 a T6 como aluno).

#### 9.4.2 Resultados simulados por tarefa

| Tarefa | Participante | Tempo estimado | Concluiu sem ajuda | SEQ (1–7) | Hesitações e erros previstos |
|---|---|---|---|---|---|
| T1 | P1 | 2 min 40 s (meta não atingida) | Sim | 5 | Parou ao escolher "Sou professora/Sou aluno" sem saber que não poderia mudar depois; não entendeu o campo de link personalizado; digitou "49" no preço e viu R$ 0,49 |
| T2 | P1 | 3 min 10 s (meta não atingida) | Sim | 4 | Repetiu o cadastro da faixa 5 vezes (um dia por vez); bloquear data foi fácil |
| T3 | P1 | 25 s | Sim | 6 | Procurou o link no painel antes de achar o botão |
| T4 | P2 | 2 min 05 s; 6 cliques após a aula | Sim | 5 | Perguntou "por que preciso criar conta?"; rolou uma lista longa de horários dos 14 dias; gostou de a seleção voltar após o cadastro |
| T5 | P2 | 40 s | Parcial | 3 | Entendeu que estava fora do prazo, mas não encontrou como falar com a professora (beco sem saída) |
| T6 | P2 | 50 s | Sim | 6 | Sem dificuldades |

**Resumo simulado:** 5 de 6 tarefas concluídas sem ajuda; 2 metas de tempo não atingidas (T1 e T2); meta de "3 cliques" não atingida na primeira reserva com cadastro. Com 2 participantes não é possível calcular SUS; reunir 5 sessões reais para o RNF02.

#### 9.4.3 Achados (severidade 0–4, escala de Nielsen)

| ID | Achado | Severidade | Persona afetada | Relacionado a |
|---|---|---|---|---|
| U-01 | Campo de slug/link personalizado sem explicação nem prévia do link | 2 | Mariana | US-04 AC1 |
| U-02 | Escolha de papel (professora/aluno) é irreversível e não avisa | 3 | Todas | US-04, US-05 |
| U-03 | Máscara de preço confunde: digitar "49" resulta em R$ 0,49 | 3 | Mariana | US-01 AC3 |
| U-04 | Disponibilidade exige uma faixa por vez por dia da semana | 2 | Mariana | RF02 |
| U-05 | Criar conta no meio da reserva é percebido como barreira e aumenta cliques | 3 | Sônia, Rafael | US-02 AC6, US-05 |
| U-06 | Lista de horários dos 14 dias sem agrupar por dia | 2 | Rafael, Sônia | US-02 AC1 |
| U-07 | Fora do prazo, a mensagem não oferece caminho (contato da professora) | 3 | Sônia | US-03 AC5 |
| U-08 | Professora logada que abre o link público precisa "Sair e entrar como aluno" sem orientação | 2 | Mariana | RF03 |
| U-09 | Primeiro acesso da professora sem guia do que fazer (aula, horários, link) | 2 | Mariana | RF01, RF02 |
| U-10 | Aluno espera e-mail de confirmação e lembrete, mas o MVP só registra a fila | 3 | Sônia | RF06 |
| U-11 | "Excluir conta" é fácil demais de alcançar para uma ação irreversível | 2 | Todas | US-04 AC5, US-05 AC5 |

#### 9.4.4 Melhorias sugeridas

| ID | Melhoria | Resolve | Prioridade | Esforço |
|---|---|---|---|---|
| MEL-01 | Avisar antes de confirmar o papel: "Esta escolha não pode ser alterada" e usar cartões grandes "Sou professora" e "Sou aluno" | U-02 | **Must** | P |
| MEL-02 | Corrigir a máscara de preço: aceitar vírgula, mostrar exemplo "R$ 49,00" como placeholder e usar teclado numérico no celular | U-03 | **Must** | P |
| MEL-03 | Fora do prazo, mostrar telefone/WhatsApp da professora (quando cadastrado) com link direto | U-07 | **Must** | P |
| MEL-04 | Deixar claro que lembretes por e-mail ainda não são enviados e mostrar "anote seu horário" na confirmação, até existir o worker de envio | U-10 | **Must** | P |
| MEL-05 | Cadastro de aluno em uma única tela dentro da reserva (nome, e-mail, senha, aceite), com o resumo da aula e do horário visível durante todo o processo | U-05 | **Should** | M |
| MEL-06 | Checklist de início para a professora: "1. Criar aula · 2. Definir horários · 3. Copiar link", com progresso e estados vazios que levam ao próximo passo | U-09 | **Should** | M |
| MEL-07 | Cadastrar a mesma faixa para vários dias de uma vez (marcar segunda a sexta) | U-04 | **Should** | M |
| MEL-08 | Agrupar horários por dia ("qua, 25/11") com o primeiro dia aberto e os demais recolhidos | U-06 | **Should** | M |
| MEL-09 | Quando a professora abrir o link público, mostrar aviso com botão "Sair e continuar como aluno" que preserve a seleção | U-08 | **Should** | M |
| MEL-10 | Mover "Excluir conta" para uma zona de perigo no perfil, com confirmação por digitação | U-11 | **Should** | P |
| MEL-11 | Explicar o slug com prévia do link ("englishflow.app/?professora=ana") e validação em tempo real | U-01 | **Could** | P |
| MEL-12 | Botão "Adicionar ao calendário" (.ics) na confirmação da reserva | U-10 | **Could** | M |

*Esforço: P = pequeno, M = médio.*

#### 9.4.5 Folha de observação para a sessão real (preencher com 2 colegas)

| Participante | Perfil | Tarefa | Tempo | Concluiu sem ajuda? | Hesitações e erros | Frase marcante | SEQ (1–7) |
|---|---|---|---|---|---|---|---|
| — | — | T1 | — | — | — | — | — |
| — | — | T2 | — | — | — | — | — |
| — | — | T3 | — | — | — | — | — |
| — | — | T4 | — | — | — | — | — |
| — | — | T5 | — | — | — | — | — |
| — | — | T6 | — | — | — | — | — |

---

### 9.5 MoSCoW atualizado do projeto

| Prioridade | Item | Origem |
|---|---|---|
| **Must** | US-01 Cadastrar aula · US-02 Agendar aula · US-04 Professora cria conta · US-05 Aluno cria conta | Requisitos |
| **Must** | MEL-01 aviso de papel irreversível · MEL-02 máscara de preço · MEL-03 contato fora do prazo · MEL-04 expectativa honesta sobre lembretes | Usabilidade |
| **Must** | Corrigir BUG-01, BUG-02 e BUG-03 (seção 9.6) se confirmados | Testes |
| **Should** | US-03 Cancelar ou reagendar (mantida como Should; promover a Must se T5 e T6 reais falharem) | Requisitos |
| **Should** | MEL-05 cadastro dentro da reserva · MEL-06 checklist inicial · MEL-07 faixa para vários dias · MEL-08 horários por dia · MEL-09 aviso de sessão de professora · MEL-10 zona de perigo | Usabilidade |
| **Could** | MEL-11 prévia do link · MEL-12 arquivo .ics · testes automatizados dos casos 🖐 | Usabilidade e testes |
| **Won't (neste MVP)** | Pagamento online, videochamada própria, app nativo, integração com Google Agenda, pacotes, aulas em grupo, chat, nota fiscal, worker de e-mail/WhatsApp (ver seção 07) | Fora de escopo |

---

### 9.6 Bugs observados e candidatos: diagnóstico e fix validável (IA propõe, humano valida)

> Estes bugs foram inicialmente **candidatos** derivados de pontos de risco do README. A rodada E2E reproduziu duas condições de corrida, corrigidas e revalidadas (seção 9.7); os demais riscos abaixo não foram cobertos de forma exaustiva.

#### BUG-01 · Agenda da professora vazia ou sem o nome do aluno (regressão da migration `20261124160000`)

- **Tela:** aulas agendadas da professora. **Sintoma candidato:** lista vazia ou sem dados do aluno, mesmo com reservas no banco. **Console:** erro `42501` (permission denied) ou nenhum erro. **Verificação:** E2E-10 cobre este fluxo.
- **Resultado desta rodada:** E2E-10 passou nos três viewports e a professora leu o aluno na agenda. A resposta visual da instrução SQL de `GRANT` não foi confirmada; não a submeta novamente sem verificar o estado no painel.

| # | Hipótese | Sintoma esperado | Como verificar | Fix sugerido (sem aplicar) |
|---|---|---|---|---|
| 1 | A migration `20261124160000_grant_teacher_booking_student_id.sql` não foi aplicada: falta permissão de leitura da referência do aluno | Erro 42501 na aba Network, ou campo do aluno vazio | `select grantee, column_name, privilege_type from information_schema.column_privileges where table_schema = 'public' and table_name = 'agendamentos' and grantee = 'authenticated' order by column_name;` | Aplicar a migration no SQL Editor; nenhuma mudança de código |
| 2 | Policy de SELECT para a professora em `agendamentos` ou `alunos` com condição incorreta | Query retorna 200 com array vazio | `select policyname, cmd, qual from pg_policies where schemaname = 'public' and tablename in ('agendamentos', 'alunos');` | Corrigir a policy para comparar a professora dona com `auth.uid()` |
| 3 | O front filtra o dia em UTC e perde reservas do fim do dia | Reservas noturnas ausentes, diurnas presentes | DevTools → Network: ver os parâmetros de data enviados | Calcular início e fim do dia em `America/Sao_Paulo` antes de consultar |

**Próximo passo:** não reaplicar a instrução com estado incerto; o comportamento funcional já foi validado pelo E2E-10.

#### BUG-02 · Seleção de aula, data e horário perdida após login ou cadastro do aluno (US-05 AC3)

- **Tela:** fluxo público de agendamento. **Sintoma:** após autenticar, o aluno volta ao catálogo sem a seleção, ou vê a seleção e o horário já não está livre, mas a UI confirma como se estivesse. **Reprodução esperada:** a confirmar; E2E-07 e TF-43.
- **Resultado desta rodada:** a seleção permaneceu após o cadastro e a reserva (E2E-07). Foi reproduzida uma corrida diferente no catálogo, antes do login, e corrigida conforme E2E-06 na seção 9.7; a reserva concorrente por outro aluno continua como caso pendente.

| # | Hipótese | Sintoma esperado | Como verificar | Fix sugerido (sem aplicar) |
|---|---|---|---|---|
| 1 | O redirecionamento pós-login reescreve a URL e descarta os parâmetros de seleção | URL antes do login tem a seleção; depois, não | DevTools: comparar a URL antes e depois do login | Preservar `search` ao redirecionar e ler os parâmetros depois da sessão |
| 2 | A seleção vive só em estado de componente, que é desmontado ao abrir a tela de login | Seleção some mesmo com a URL intacta | React DevTools: observar o estado ao trocar de tela | Derivar a seleção da URL como fonte única |
| 3 | A seleção é restaurada, mas o horário foi ocupado no meio do caminho e a confirmação não revalida | Mensagem de sucesso sem linha nova em `agendamentos` | Reservar com outro aluno o mesmo horário e confirmar; conferir a tabela | Revalidar na confirmação e tratar o erro `23P01` com aviso e sugestões |

**Próximo passo:** valide a hipótese 1 comparando a URL antes e depois do login no DevTools.

#### BUG-03 · Horários exibidos com deslocamento de fuso ou no dia errado (RNF, RF03)

- **Tela:** catálogo de horários e Minhas aulas. **Sintoma:** horário mostrado 3 h diferente do cadastrado, ou reserva noturna aparecendo no dia seguinte. **Reprodução esperada:** a confirmar, principalmente após as 21h em Brasília e em navegador com outro fuso.

| # | Hipótese | Sintoma esperado | Como verificar | Fix sugerido (sem aplicar) |
|---|---|---|---|---|
| 1 | O front converte datas com `toISOString()` ou `new Date('AAAA-MM-DD')`, que usam UTC | Dia deslocado perto da meia-noite | Console do navegador: `new Date('2026-11-25').toString()` e comparar com a data exibida | Formatar com `Intl.DateTimeFormat` e `timeZone: 'America/Sao_Paulo'`; montar datas em horário local |
| 2 | A RPC de horários usa `now()::date` ou `current_date` em UTC | Hoje e amanhã trocam após as 21h BRT | `select now(), now() at time zone 'America/Sao_Paulo', current_setting('TimeZone');` | Usar `(now() at time zone 'America/Sao_Paulo')::date` na função |
| 3 | A exibição não fixa o fuso e muda conforme o navegador | Resultado diferente em máquinas com outro fuso | Testar com `timezoneId` alterado no Playwright | Fixar o fuso nas formatações do app |

**Próximo passo:** valide a hipótese 2 rodando a consulta de fuso no SQL Editor.

**Lista de observação (candidatos extras, sem detalhamento):** reagendar para um horário que sobrepõe a própria reserva; exclusão de conta com reservas futuras; duplo clique em Confirmar reserva; slug com maiúsculas; sessão expirada no meio do fluxo.

#### Prompt CTQ para corrigir bug com IA (reutilizável)

Preencher os campos `{{...}}` com um dos blocos acima e rodar no Copilot em modo Agent.

```text
# CONTEXTO
Projeto: EnglishFlow, sistema de agendamento de aulas de inglês online (MVP).
Stack: React + Vite + Tailwind + Supabase JS SDK. PostgreSQL 15 com RLS habilitada.
Bug reportado:
- Tela: {{tela}}
- Sintoma: {{sintoma}}
- Console: {{console / aba Network}}
- Reprodução: {{passos e frequência}}
Hipóteses já levantadas: {{cole a tabela de hipóteses do bug}}

# TAREFA
1. Diagnostique as 3 hipóteses mais prováveis (confirme ou refute as acima).
2. Para cada hipótese, indique: sintoma esperado, como verificar (SQL, log ou DevTools) e fix sugerido (sem aplicar).
3. Identifique a hipótese mais provável, com justificativa.
4. Proponha o fix como diff (não reescreva o arquivo inteiro).
5. Indique qual teste (TF-xx ou E2E-xx) deve passar a partir do fix e qual nova regressão deve ser adicionada.

# QUEM
Você é um engenheiro front-end sênior + DBA especializado em Supabase e RLS.

# FORMATO
Markdown. Hipóteses numeradas. Diff em bloco de código. Não leia nem imprima .env.
No final: "Próximo passo: valide a hipótese número X rodando {{SQL / verificação}}".
```

---

### 9.7 Relatório de execução e critérios de saída

#### 9.7.1 Relatório de execução (preencher a cada rodada)

| Rodada | Data | Commit e ambiente | Executor | Casos | Aprovados | Reprovados | Bloqueados | Observações |
|---|---|---|---|---|---|---|---|---|
| 1 | 25/11/2026 | Supabase TESTES (`hpcitfmbiyyqwyiihcgn`, branch `main`) + workspace local | Copilot | 52 funcionais + 13 E2E planejados | 0 | 0 | 65 | Registro da inspeção inicial, antes da configuração do Playwright e da execução E2E: o painel mostrava “No migrations” e o SQL Editor ficou em branco durante o aviso de incidente técnico. Nenhuma conta ou dado de teste foi criado nessa etapa. O build passou, com aviso de chunk >500 kB; `.env` não foi inspecionado. |
| 2 | 25/11/2026 | Supabase TESTES (`hpcitfmbiyyqwyiihcgn`, `main` (painel rotulado `PRODUCTION`)) + workspace local | Copilot | 52 funcionais + 13 E2E × 3 viewports (39) | 39 | 0 | 52 | E2E completo aprovado em mobile (375), tablet (768) e desktop (1280). Contas e dados temporários foram removidos e a exclusão foi verificada por tentativa de autenticação; foi usada somente a chave pública, sem `service_role`. O E2E-10 validou o acesso do aluno na agenda. A resposta da migration de `GRANT` ainda aparecia como “Running” no SQL Editor antes da rodada. Os 52 casos funcionais manuais não foram executados. |
| 3 | 25/11/2026 | Supabase TESTES (`hpcitfmbiyyqwyiihcgn`) + workspace local; Playwright `mobile-375` | Copilot | 52 funcionais | 48 | 2 | 2 (1 parcial + 1 N/A) | Contas temporárias removidas; `cleanupFailures=0`. Reprovados: TF-07 (1.378 ms no último run; meta <1.000 ms) e TF-29 (status `cancelado`, notificação e horário livre confirmados no banco, mas a agenda não exibiu a reserva). TF-36 parcial: pedido para conta existente exibiu erro genérico, e e-mail inexistente exibiu confirmação neutra; caixa de e-mail/link não acessível. TF-34 N/A porque Confirm email está desativado. |

**Bugs encontrados na execução**

| ID | Caso que falhou | Severidade | Status | Commit do fix |
|---|---|---|---|---|
| E2E-06 | Resposta duplicada do carregamento do catálogo podia apagar a aula selecionada no React StrictMode. | Média | Corrigido e aprovado nos 3 viewports | — |
| E2E-10 | Uma resposta antiga da agenda podia substituir os resultados da data selecionada. | Média | Corrigido e aprovado nos 3 viewports | — |
| TF-06 | Máscara de moeda removia o sinal negativo e podia transformar preço inválido em positivo. | Média | Corrigido; TF-06 aprovado | — |
| TF-33 | Slug manual com maiúsculas, espaços ou acentos era normalizado em vez de recusado. | Baixa | Corrigido; entradas inválidas bloqueadas e TF-33 aprovado | — |
| TF-41 | Erro local de consentimento era substituído por mensagem genérica. | Média | Corrigido; validação apresenta mensagem específica e TF-41 aprovado | — |
| TF-29 | Interface da agenda não exibe a reserva cancelada, embora a linha, notificação e horário liberado estejam corretos no banco. | Média | Aberto; TF-29 reprovado | — |
| TF-07 | Salvamento e renderização ultrapassam a meta de 1 s no projeto de testes. | Baixa | Aberto; 1.378 ms no último run (medições variaram entre 1.363 e 2.392 ms) | — |
| TF-36 | Respostas da recuperação diferem para e-mail existente e inexistente; não foi possível verificar entrega/link por e-mail. | Média | Parcial; verificar configuração/limite de e-mail e repetir com acesso à caixa | — |

#### 9.7.2 Critérios de saída (o MVP está pronto para apresentar?)

- [ ] 100% dos casos ⚙ aprovados e todos os ACs de histórias **Must** (US-01, US-02, US-04, US-05) sem caso reprovado.
- [x] E2E aprovado nos 3 viewports (375, 768 e 1280 px).
- [ ] Nenhum bug de severidade alta aberto (perda de dados, vazamento entre contas, reserva duplicada).
- [ ] RF06 apresentado com a ressalva de que a entrega real de notificações está fora do escopo.
- [ ] Matriz da seção 9.1 com todos os RFs executados.
- [x] `npm run build` aprovado e `.env` ausente do Git.

#### 9.7.3 Verificações de RNF (fora da matriz de RFs)

| RNF | Como verificar | Meta | Resultado |
|---|---|---|---|
| RNF01 Desempenho | Lighthouse no celular + aba Network nas listas e horários | Resposta menor que 1 s em 95% das requisições | TF-07: 1.378 ms para salvar/renderizar (meta <1 s não atingida); Lighthouse não executado |
| RNF02 Usabilidade | 5 sessões reais com SUS; axe nas 4 telas principais | SUS maior ou igual a 80; sem violações críticas; funcional em 360 px | — |
| RNF03 Segurança e LGPD | TF-35, TF-48, TF-49; HTTPS; consentimento `agendamento-v1`; varredura OWASP ZAP | Nenhum dado cruzado entre contas; 100% HTTPS | TF-35/48/49 e consentimento passaram; HTTPS e ZAP pendentes |
| RNF04 Disponibilidade | Monitor de uptime após publicar no Lovable | 99% ou mais ao mês | — |

---

### 9.8 Limitações da IA encontradas

1. **Execução parcial do plano.** Os 13 fluxos E2E foram aprovados nos três viewports (39 execuções). Os 52 casos funcionais foram executados uma vez: 48 aprovados, 2 reprovados, 1 parcial e 1 N/A; TF-07 e TF-29 permanecem pendentes.
2. **Defeitos observados e corrigidos.** A rodada E2E reproduziu duas condições de corrida: o catálogo podia perder a seleção após respostas duplicadas no StrictMode, e a agenda podia exibir resultados de uma data anterior. As correções foram revalidadas nos três viewports.
3. **Usabilidade simulada não é evidência.** Os tempos, as notas SEQ e as hesitações da seção 9.4 foram estimados por heurísticas; podem errar a gravidade e deixar de fora problemas reais.
4. **Cobertura de segurança ainda incompleta.** TF-35, TF-48, TF-49 e TF-52 passaram nesta rodada. Ainda são necessárias uma revisão independente de RLS, a verificação de HTTPS e a varredura OWASP ZAP.
5. **Estado da migration de permissão.** O SQL Editor mostrava a instrução de `GRANT` como “Running” antes da rodada; o E2E-10 confirmou o acesso funcional da professora ao aluno na agenda, mas o resultado visual daquela execução SQL não foi confirmado.
6. **E2E sensível a ambiente.** Depende de Confirm email desativado, do relógio e do fuso do computador (as datas usam o dia seguinte) e do limite de cadastros por hora do Supabase Auth.
7. **Cobertura de acessibilidade incompleta.** Playwright não substitui axe, Lighthouse e teste com leitor de tela.
8. **RF06 só valida a fila.** A entrega real de e-mail ou WhatsApp não existe no MVP e não pode ser comprovada por estes testes.

**Mitigação:** corrigir a exibição da agenda em TF-29, investigar o tempo de TF-07 e validar recuperação de senha em TF-36 com a configuração de e-mail do projeto; depois repetir os casos afetados e as verificações de RNF. Registrar novas rodadas na seção 9.7 antes de declarar o MVP pronto.

---

### 9.9 Cronograma e submissão

| Passo | Atividade | Seção | Responsável | Status |
|---|---|---|---|---|
| 1 | Teste funcional: executar e revisar os 52 casos (começar pelos ⚙) | 9.2 | Aluno e Copilot | Executado: 48 aprovados, 2 reprovados, 1 parcial e 1 N/A; repetir TF-07/29/36 |
| 2 | Integração: rodar o E2E nos 3 viewports | 9.3 | Copilot e aluno | ☑ 39/39 aprovados |
| 3 | Usabilidade: sessão real de 5 min com 2 colegas e atualização da seção 9.4 | 9.4 | Aluno | ☐ |
| 4 | Corrigir com IA: 3 bugs prioritários com o prompt CTQ e diff | 9.6 | Copilot e aluno | 3 corrigidos; TF-07/29 e TF-36 ainda pendentes |

**Submissão:** repositório Git + este plano de testes em Markdown (este README), com o link do protótipo publicado no Lovable. Não enviar credenciais, tokens nem a chave `service_role`.

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
