# 🛡️ Sistema Clã Infinity - Perfect World

Sistema web completo para gerenciamento do clã Infinity no jogo Perfect World, desenvolvido com Next.js 16, TypeScript, Tailwind CSS e Firebase.

## 🚀 Funcionalidades

### 👥 Gestão de Membros
- **Cadastro de Usuários**: Nick, Classe, Telefone e WhatsApp
- **Sistema de Aprovação**: Administradores aprovam novos membros
- **Diferentes Níveis**: Pendente, Membro e Administrador

### 📅 Sistema de Eventos
- **Criação de Eventos**: Admins podem criar eventos (TW, GvG, Boss, Farm, etc.)
- **Votação**: Membros votam se podem ou não participar
- **Visualização**: Lista de eventos com data, hora e tipo

### ✅ Presença e Pontuação
- **Check-in Diário**: Marque presença diariamente
- **Sistema de Pontos**: Ganhe 10 pontos por dia
- **Histórico**: Visualize todas as suas presenças
- **Estatísticas**: Acompanhe seus pontos e presenças mensais

### 🎁 Sistema de Sorteios
- **Criação de Sorteios**: Admins criam sorteios com prêmios
- **Participação**: Membros se inscrevem nos sorteios
- **Sorteio Automático**: Sistema sorteia um vencedor aleatório
- **Notificação**: Vencedor recebe notificação automática

### 🏆 Ranking
- **Classificação**: Ranking de membros por pontos
- **Top 3**: Destaques especiais para os 3 primeiros
- **Sua Posição**: Visualize sua posição no ranking

### 👥 Membros do Clã
- **Lista de Membros**: Visualize todos os membros do clã
- **Filtros**: Filtre por todos, apenas admins ou apenas membros
- **Informações**: Veja classe, pontos e informações de contato
- **Estatísticas**: Total de membros, admins e membros ativos

### 🔔 Notificações
- **Em Tempo Real**: Notificações de eventos importantes
- **Tipos**: Aprovação de cadastro, vitória em sorteios, eventos
- **Badge de Não Lidas**: Contador de notificações não lidas

### 👨‍💼 Painel Administrativo
- **Aprovação de Membros**: Aprovar ou rejeitar cadastros
- **Gerenciar Membros**: Promover usuários a admin ou remover do clã
- **Criar Eventos**: Gerenciar eventos do clã
- **Criar Sorteios**: Gerenciar sorteios e realizar o sorteio
- **Visualizar Todos os Dados**: Acesso completo ao sistema

## 🛠️ Tecnologias

- **Framework**: Next.js 16.1.1
- **Linguagem**: TypeScript 5
- **Estilização**: Tailwind CSS 4
- **Backend**: Firebase (Authentication + Firestore)
- **Ícones**: Lucide React
- **Notificações**: React Hot Toast

## 📋 Pré-requisitos

- Node.js 20 ou superior
- Conta no Firebase
- npm ou yarn

## ⚙️ Configuração

### 1. Clone o repositório

```bash
git clone <url-do-repositorio>
cd infinity
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto
3. Ative **Authentication** (Email/Password)
4. Ative **Firestore Database**
5. Obtenha as credenciais do projeto

### 4. Configure as variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=sua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id
```

### 5. Configure as regras do Firestore

No Firebase Console, vá em Firestore Database > Regras e adicione:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuários podem ler seus próprios dados
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                     get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Eventos são públicos para leitura, apenas admins podem escrever
    match /events/{eventId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Votos de eventos
    match /eventVotes/{voteId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.userId;
    }
    
    // Presenças
    match /attendances/{attendanceId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
    
    // Sorteios
    match /raffles/{raffleId} {
      allow read: if request.auth != null;
      allow create, delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow update: if request.auth != null;
    }
    
    // Notificações
    match /notifications/{notifId} {
      allow read, update: if request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
  }
}
```

### 6. Crie o primeiro usuário administrador

1. Inicie o servidor: `npm run dev`
2. Acesse `http://localhost:3000`
3. Faça o cadastro normalmente
4. No Firebase Console, vá em Firestore Database
5. Encontre o documento do seu usuário em `users`
6. Edite o campo `role` de `pending` para `admin`
7. Faça logout e login novamente

## 🚀 Executando o Projeto

### Desenvolvimento

```bash
npm run dev
```

Acesse: `http://localhost:3000`

### Produção

```bash
npm run build
npm start
```

## 📱 Estrutura de Páginas

- `/` - Página inicial (redireciona automaticamente)
- `/login` - Login de usuários
- `/register` - Cadastro de novos membros
- `/pending-approval` - Aguardando aprovação
- `/dashboard` - Painel principal
- `/events` - Eventos e votação
- `/attendance` - Presença diária
- `/raffles` - Sorteios
- `/ranking` - Ranking de membros
- `/members` - Membros do clã
- `/admin` - Painel administrativo
- `/admin/members` - Gerenciamento de membros (apenas admin)

## 🎨 Classes do Perfect World

O sistema suporta as seguintes classes:
- Guerreiro
- Arqueiro
- Mago
- Sacerdote
- Bárbaro
- Arcano
- Místico
- Feiticeiro

## 📊 Estrutura do Banco de Dados (Firestore)

### Coleção: users
```typescript
{
  id: string;
  email: string;
  nick: string;
  classe: PlayerClass;
  telefone: string;
  whatsapp: string;
  role: 'pending' | 'member' | 'admin';
  pontos: number;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}
```

### Coleção: events
```typescript
{
  id: string;
  title: string;
  description: string;
  date: Date;
  type: 'TW' | 'GvG' | 'Boss' | 'Farm' | 'Outro';
  createdBy: string;
  createdAt: Date;
  active: boolean;
}
```

### Coleção: eventVotes
```typescript
{
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  canParticipate: boolean;
  comment?: string;
  createdAt: Date;
}
```

### Coleção: attendances
```typescript
{
  id: string;
  userId: string;
  userName: string;
  date: Date;
  pontos: number;
  createdBy: string;
  createdAt: Date;
}
```

### Coleção: raffles
```typescript
{
  id: string;
  title: string;
  description: string;
  prize: string;
  participants: string[];
  winnerId?: string;
  winnerName?: string;
  status: 'open' | 'closed' | 'completed';
  createdBy: string;
  createdAt: Date;
  drawDate?: Date;
}
```

### Coleção: notifications
```typescript
{
  id: string;
  userId: string;
  type: 'raffle_win' | 'approval' | 'event' | 'general';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}
```

## 🔐 Níveis de Acesso

### Pending (Pendente)
- Aguardando aprovação
- Não pode acessar o sistema

### Member (Membro)
- Acesso ao dashboard
- Pode votar em eventos
- Pode marcar presença
- Pode participar de sorteios
- Pode ver o ranking

### Admin (Administrador)
- Todos os acessos de membro
- Aprovar/rejeitar cadastros
- Promover membros a admin
- Remover membros do clã
- Criar eventos
- Criar sorteios
- Realizar sorteios

## 🎯 Fluxo de Uso

1. **Novo Membro**:
   - Acessa o site e faz cadastro
   - Aguarda aprovação de um admin
   - Recebe notificação quando aprovado

2. **Membro Aprovado**:
   - Faz login no sistema
   - Marca presença diariamente (+10 pontos)
   - Vota em eventos do clã
   - Participa de sorteios
   - Acompanha sua posição no ranking

3. **Administrador**:
   - Aprova novos membros
   - Cria eventos para votação
   - Cria sorteios
   - Realiza o sorteio quando oportuno
   - Vencedor recebe notificação automática

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou pull requests.

## 📄 Licença

Este projeto é de uso privado para o Clã Infinity.

## 👨‍💻 Desenvolvido por

Sistema desenvolvido para o Clã Infinity - Perfect World

---

**Bom jogo e boa sorte no ranking! 🎮🏆**
