# 🚀 Guia de Configuração - Sistema Clã Infinity

Este guia irá te ajudar a configurar o sistema do zero.

## Passo 1: Configurar o Firebase

### 1.1 Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Digite o nome: `clan-infinity` (ou outro de sua preferência)
4. Desabilite o Google Analytics (opcional)
5. Clique em "Criar projeto"

### 1.2 Configurar Authentication

1. No menu lateral, clique em "Authentication"
2. Clique em "Começar"
3. Na aba "Sign-in method", clique em "Email/Password"
4. Ative a opção "Email/Password"
5. Clique em "Salvar"

### 1.3 Configurar Firestore Database

1. No menu lateral, clique em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Selecione "Começar no modo de produção"
4. Escolha uma localização (recomendado: southamerica-east1 para Brasil)
5. Clique em "Ativar"

### 1.4 Configurar Regras do Firestore

1. Ainda em "Firestore Database", clique na aba "Regras"
2. Copie o conteúdo do arquivo `firestore.rules` deste projeto
3. Cole no editor de regras
4. Clique em "Publicar"

### 1.5 Obter Credenciais

1. Clique no ícone de engrenagem ⚙️ ao lado de "Visão geral do projeto"
2. Clique em "Configurações do projeto"
3. Role até "Seus aplicativos"
4. Clique no ícone de código `</>`
5. Digite um apelido para o app: `web-app`
6. Clique em "Registrar app"
7. Copie as credenciais que aparecem

## Passo 2: Configurar o Projeto

### 2.1 Instalar Dependências

```bash
npm install
```

### 2.2 Configurar Variáveis de Ambiente

1. Crie um arquivo `.env.local` na raiz do projeto
2. Copie o conteúdo do arquivo `.env.local.example`
3. Preencha com as credenciais do Firebase obtidas no Passo 1.5

Exemplo:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=clan-infinity.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clan-infinity
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=clan-infinity.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Passo 3: Iniciar o Servidor

```bash
npm run dev
```

O sistema estará disponível em: `http://localhost:3000`

## Passo 4: Criar o Primeiro Administrador

### 4.1 Fazer o Cadastro

1. Acesse `http://localhost:3000`
2. Clique em "Cadastre-se"
3. Preencha todos os campos:
   - Email: seu@email.com
   - Senha: (mínimo 6 caracteres)
   - Nick: Seu nick no jogo
   - Classe: Sua classe
   - Telefone e WhatsApp

4. Clique em "Cadastrar"

### 4.2 Tornar o Usuário Admin

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto
3. Vá em "Firestore Database"
4. Clique na coleção `users`
5. Encontre o documento com seu email
6. Clique no documento
7. Edite o campo `role`:
   - De: `pending`
   - Para: `admin`
8. Clique em "Atualizar"

### 4.3 Fazer Login como Admin

1. Volte para `http://localhost:3000`
2. Se estiver na página de "Aguardando Aprovação", clique em "Sair"
3. Faça login com seu email e senha
4. Agora você terá acesso ao painel administrativo!

## Passo 5: Testar o Sistema

### 5.1 Criar um Evento

1. No dashboard, clique no botão "Admin" no topo
2. Ou acesse diretamente `/events`
3. Clique em "Criar Evento"
4. Preencha:
   - Título: Ex: "TW de Sábado"
   - Descrição: Ex: "Territory War às 20h"
   - Data e Hora
   - Tipo: Ex: "TW"
5. Clique em "Criar Evento"

### 5.2 Marcar Presença

1. No dashboard, clique em "Presença"
2. Clique em "Marcar Presença (+10 pontos)"
3. Veja seus pontos aumentarem!

### 5.3 Criar um Sorteio

1. No dashboard, clique em "Sorteios"
2. Clique em "Criar Sorteio"
3. Preencha:
   - Título: Ex: "Sorteio de Espada Lendária"
   - Descrição: Ex: "Espada +12 com atributos"
   - Prêmio: Ex: "Espada Lendária +12"
4. Clique em "Criar Sorteio"
5. Participe do sorteio
6. Depois, realize o sorteio clicando em "Realizar Sorteio"

### 5.4 Aprovar Novos Membros

1. Crie um segundo usuário (em outra aba ou navegador anônimo)
2. No seu usuário admin, clique em "Admin" no topo
3. Você verá o novo cadastro pendente
4. Clique em "Aprovar"
5. O usuário receberá uma notificação!

## Estrutura de Pastas

```
infinity/
├── app/                    # Páginas Next.js
│   ├── admin/             # Painel administrativo
│   ├── attendance/        # Sistema de presença
│   ├── dashboard/         # Dashboard principal
│   ├── events/            # Eventos
│   ├── login/             # Login
│   ├── pending-approval/  # Aguardando aprovação
│   ├── raffles/           # Sorteios
│   ├── ranking/           # Ranking
│   └── register/          # Cadastro
├── components/            # Componentes React
├── contexts/              # React Contexts (Auth)
├── lib/                   # Configurações (Firebase)
├── types/                 # TypeScript types
└── public/               # Arquivos públicos
```

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Build para produção
npm run build

# Iniciar em produção
npm start

# Verificar erros de lint
npm run lint
```

## Deploy (Opcional)

### Deploy no Vercel (Recomendado)

1. Crie uma conta em [Vercel](https://vercel.com)
2. Instale o Vercel CLI:
```bash
npm i -g vercel
```
3. Faça o deploy:
```bash
vercel
```
4. Configure as variáveis de ambiente no painel do Vercel

### Deploy no Firebase Hosting

1. Instale o Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Faça login:
```bash
firebase login
```

3. Inicialize o projeto:
```bash
firebase init
```

4. Selecione "Hosting"
5. Build o projeto:
```bash
npm run build
```

6. Deploy:
```bash
firebase deploy
```

## Solução de Problemas

### Erro: "Firebase not initialized"
- Verifique se o arquivo `.env.local` existe e está preenchido corretamente
- Reinicie o servidor de desenvolvimento

### Erro: "Permission denied" no Firestore
- Verifique se as regras do Firestore foram configuradas corretamente
- Copie o conteúdo do arquivo `firestore.rules` e publique no Firebase Console

### Não consigo fazer login
- Verifique se o Authentication está ativado no Firebase
- Verifique se o método "Email/Password" está ativo
- Verifique se o usuário foi criado corretamente

### O admin não aparece
- Verifique no Firestore se o campo `role` do usuário está como `admin`
- Faça logout e login novamente

## Suporte

Para dúvidas ou problemas, entre em contato com o administrador do clã.

---

**Boa sorte e bom jogo! 🎮🛡️**

