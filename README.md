# ✈️ CD Consultoria de Viagem — Atendimento Inteligente WhatsApp & Dashboard

Sistema completo de triagem automatizada via WhatsApp com Inteligência Artificial (Google Gemini / OpenAI Function Calling) e Dashboard Administrativo em Next.js com transbordo humano para consultores de viagem.

---

## 🚀 Funcionalidades Principais

1. **Triagem Inteligente em 5 Etapas (WhatsApp Bot)**:
   - Gatilho de ativação vindo do site: `"Olá! Vim pelo site da CD Consultoria de Viagem e gostaria de fazer um orçamento."`
   - Coleta conversacional (1 pergunta por vez, sem inventar preços) dos 5 dados essenciais:
     1. **Nome do cliente** (`nome`)
     2. **Período de viagem** (`periodo`)
     3. **Forma de viagem** (`formaViagem`)
     4. **Aeroporto de chegada** (`aeroportoChegada`)
     5. **Quantidade de pessoas** (`quantidadePessoas`)
   - Janela deslizante de 4 mensagens + memória progressiva de campos extraídos via Function Calling (`atualizar_progresso_triagem` e `salvar_resumo_viagem`).
   - Suporte duplo: **API Oficial da Meta (WhatsApp Cloud API)** e **Conexão Direta via QR Code (`@whiskeysockets/baileys`)** com resolução automática de `@lid` para números brasileiros reais (`+55`).

2. **Dashboard Administrativo (`/dashboard`) — Next.js App Router + Tailwind CSS**:
   - **Autenticação e Gestão de Administradores (`/api/auth`)**: Login e criação/atualização de usuários administradores e senhas direto pelo painel.
   - **Fila FIFO em Tempo Real**: Ordenação por chegada (`createdAt asc`) com atualização automática a cada 10s via SWR.
   - **Abas e Contadores Rápidos**: *Todos*, *Em Aguardo*, *Em Processo*, *Atendido* e *Cancelado*.
   - **Ficha de Orçamento Estruturada**: Exibição dos 5 campos coletados em cards limpos.
   - **Ação Direta WhatsApp Web**: Redireciona para `https://wa.me/{telefone}` e altera o status automaticamente para `EM_PROCESSO`.
   - **Reabertura por Cancelamento**: Ao marcar como `CANCELADO`, o bot silencia e permite que o cliente refaça o cadastro do zero caso envie a frase de gatilho novamente.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express, `@whiskeysockets/baileys`, OpenAI SDK (compatível com Gemini Flash e GPT-4o-mini)
- **Banco de Dados**: PostgreSQL + Prisma ORM (`Atendimento` e `AdminUser`)
- **Frontend / API**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, SWR, Lucide Icons

---

## 📦 Como Executar o Projeto

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie o arquivo `.env.example` para `.env` e preencha sua `DATABASE_URL` (PostgreSQL) e sua chave de IA (`GEMINI_API_KEY` ou `OPENAI_API_KEY`):
```bash
cp .env.example .env
npx prisma generate
npx prisma db push
```

### 3. Iniciar o Backend (WhatsApp Bot & Webhook na porta `3001`)
```bash
npm run backend:dev
```
- Para conectar o WhatsApp via QR Code, acesse: `http://localhost:3001/qr`
- Endpoint de Webhook (Meta Cloud API): `http://localhost:3001/webhook`

### 4. Iniciar o Frontend / Dashboard (Next.js na porta `3000`)
```bash
npm run dev
```
- Acesse o painel em: `http://localhost:3000/dashboard`
- **Login padrão inicial:** usuário `admin` | senha `cd123456` (ou crie seu próprio administrador na tela de login).
