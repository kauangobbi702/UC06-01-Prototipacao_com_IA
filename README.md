# Sistema de Agendamento de Aulas de Inglês Online (MVP)

> **Exercício 01** · Documento de requisitos gerado por IA, validado por humanos.
> Caso de referência: *Serena* (CRUD de serviços + agendamento online), adaptado para aulas de inglês online.

## Configuração inicial

1. Execute `npm install`.
2. Execute `npm run dev`.
3. Abra no navegador o endereço local indicado pelo Vite (normalmente `http://localhost:5173`).

O protótipo funciona sem credenciais do Supabase: aulas, horários e agendamentos ficam salvos no `localStorage` do navegador. Os dados não são compartilhados entre dispositivos ou navegadores. A professora demonstrativa é Mariana Duarte.

No painel da professora, acesse **Disponibilidade semanal** para adicionar ou remover faixas por dia da semana. O sistema oferece horários em blocos de 30 minutos pelos próximos 14 dias, considerando a duração da aula e evitando conflitos com reservas existentes. No fluxo do aluno, os dias aparecem em uma grade de botões grandes e os horários são exibidos somente para o dia escolhido.

As reservas da professora ficam em uma tela separada, acessível pelo botão **Ver aulas agendadas** no painel.

O fluxo do aluno permite confirmar uma reserva e consultar, cancelar ou reagendar usando o mesmo e-mail/WhatsApp informado no agendamento. Cancelamentos e reagendamentos ficam disponíveis somente até 12 horas antes da aula. A confirmação aparece na tela; envio de e-mail e notificações externas ainda dependem de integração com backend.

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
| **RF03** | O sistema deve permitir ao aluno **visualizar os horários livres e agendar uma aula** informando nome e contato. | Rafael, Sônia | Agendar um horário livre e verificar que ele deixa de estar disponível. |
| **RF04** | O sistema deve **impedir agendamentos em horários já ocupados** ou fora da disponibilidade. | Mariana | Tentar agendar horário ocupado e verificar bloqueio com mensagem. |
| **RF05** | O sistema deve permitir **cancelar ou reagendar** uma aula até um prazo mínimo configurável (padrão: 12h antes). | Rafael, Sônia | Cancelar dentro e fora do prazo e verificar resultado esperado. |
| **RF06** | O sistema deve **enviar confirmação imediata e lembrete 24h antes** da aula por e-mail (ou WhatsApp, se disponível). | Sônia, Rafael | Agendar uma aula e verificar recebimento da confirmação e do lembrete. |

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
- **AC2.** Nome e contato (e-mail ou telefone válido) são obrigatórios para confirmar.
- **AC3.** Ao confirmar, o horário some imediatamente da lista de livres para os demais usuários.
- **AC4.** Se o horário for ocupado por outra pessoa durante o processo, o sistema avisa e sugere os próximos horários livres.
- **AC5.** A tela de confirmação mostra aula, data, hora e preço, e uma confirmação é enviada por e-mail em até 1 minuto.
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

- **AC1.** O botão de cancelar/reagendar está disponível apenas até 12h antes da aula.
- **AC2.** Antes de cancelar, o sistema pede confirmação com texto claro ("Tem certeza que deseja cancelar?").
- **AC3.** Ao cancelar, o horário volta a ficar livre e a professora recebe notificação.
- **AC4.** Ao reagendar, a nova data só pode ser escolhida entre horários livres e o horário antigo é liberado.
- **AC5.** Fora do prazo, o sistema explica o motivo e mostra o contato da professora.

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
- [ ] AC2. Nome e contato válidos são obrigatórios
- [ ] AC3. Horário agendado some da lista de livres imediatamente
- [ ] AC4. Conflito de horário gera aviso e sugestão de alternativas
- [ ] AC5. Tela e e-mail de confirmação com aula, data, hora e preço (≤ 1 min)
- [ ] AC6. Fluxo concluído em no máximo 3 cliques

### US-03 · Cancelar ou reagendar aula (SHOULD)
- [ ] AC1. Ação disponível apenas até 12h antes da aula
- [ ] AC2. Confirmação explícita antes de cancelar
- [ ] AC3. Horário liberado e professora notificada ao cancelar
- [ ] AC4. Reagendamento só para horários livres; horário antigo liberado
- [ ] AC5. Fora do prazo: mensagem explicativa e contato da professora

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
- Múltiplos professores / painel de escola com várias contas.
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
