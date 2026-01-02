# Atualização do Sistema de Pontos

## 📊 Mudanças Implementadas

O sistema de pontos foi atualizado para rastrear **pontos totais acumulados** separadamente dos **pontos disponíveis**.

### Antes:
- `pontos`: Pontos disponíveis (diminuía ao gastar na loja)
- Ranking baseado em pontos disponíveis ❌

### Agora:
- `pontos`: Pontos disponíveis (diminui ao gastar na loja)
- `totalPointsEarned`: Pontos totais acumulados (nunca diminui) ✅
- Ranking baseado em pontos totais acumulados ✅

## 🎯 Benefícios

1. **Ranking Justo**: Membros não perdem posição no ranking ao gastar pontos
2. **Histórico Completo**: Rastreamento total de pontos ganhos ao longo do tempo
3. **Transparência para Admins**: Visibilidade de quanto cada membro já gastou
4. **Motivação**: Membros podem gastar pontos sem medo de cair no ranking

## 📋 O Que Foi Alterado

### 1. Tipo User (`types/index.ts`)
```typescript
export interface User {
  // ... campos existentes
  pontos: number;                 // Pontos disponíveis
  totalPointsEarned: number;      // ✨ NOVO: Total acumulado
  // ...
}
```

### 2. Página de Ranking (`app/ranking/page.tsx`)

**Exibição para Todos os Membros:**
- 🏆 **Total**: Pontos totais acumulados (base do ranking)
- ✅ **Disponível**: Pontos que podem gastar na loja

**Exibição Adicional para Admins:**
- 🛍️ **Gastos**: Total de pontos gastos na loja

### 3. Sistema de Attendance (`app/attendance/page.tsx`)

Ao marcar presença, agora incrementa:
- `pontos` (+10)
- `totalPointsEarned` (+10)

### 4. Sistema de Registro (`contexts/AuthContext.tsx`)

Novos usuários iniciam com:
- `pontos: 0`
- `totalPointsEarned: 0`

### 5. Sistema de Loja (`app/store/page.tsx`)

Ao resgatar item:
- `pontos` diminui ❌
- `totalPointsEarned` mantém ✅
- Cria registro em `redemptions` com `pointsSpent`

## 🔧 Migração de Dados Existentes

### ⚠️ IMPORTANTE: Atualizar Usuários Existentes

Usuários criados antes desta atualização não têm o campo `totalPointsEarned`. Você precisa atualizá-los no Firebase.

### Opção 1: Manual (Firebase Console)

Para cada usuário na coleção `users`:

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Vá em **Firestore Database**
3. Abra a coleção `users`
4. Para cada documento de usuário:
   - Clique no documento
   - Adicione o campo: `totalPointsEarned` (tipo: number)
   - Valor: Use o valor atual de `pontos` (ou calcule o total histórico)
   - Salve

### Opção 2: Script de Migração (Recomendado)

Crie um arquivo `scripts/migrate-points.js`:

```javascript
// Requer Firebase Admin SDK
const admin = require('firebase-admin');

// Inicialize com suas credenciais
admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});

const db = admin.firestore();

async function migrateUserPoints() {
  try {
    const usersSnapshot = await db.collection('users').get();
    
    const batch = db.batch();
    let count = 0;
    
    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      
      // Se não tem totalPointsEarned, adiciona
      if (userData.totalPointsEarned === undefined) {
        // Calcular total de pontos das presenças
        const attendancesSnapshot = await db.collection('attendances')
          .where('userId', '==', doc.id)
          .get();
        
        let totalFromAttendances = 0;
        attendancesSnapshot.forEach(attDoc => {
          totalFromAttendances += attDoc.data().pontos || 0;
        });
        
        // Calcular pontos gastos
        const redemptionsSnapshot = await db.collection('redemptions')
          .where('userId', '==', doc.id)
          .where('status', 'in', ['pending', 'delivered'])
          .get();
        
        let totalSpent = 0;
        redemptionsSnapshot.forEach(redDoc => {
          totalSpent += redDoc.data().pointsSpent || 0;
        });
        
        // Total acumulado = pontos disponíveis + pontos gastos
        const totalPointsEarned = (userData.pontos || 0) + totalSpent;
        
        batch.update(doc.ref, {
          totalPointsEarned: totalPointsEarned
        });
        
        count++;
        console.log(`✅ ${userData.nick}: ${totalPointsEarned} pontos totais`);
      }
    }
    
    if (count > 0) {
      await batch.commit();
      console.log(`\n✨ ${count} usuário(s) atualizado(s) com sucesso!`);
    } else {
      console.log('✅ Todos os usuários já estão atualizados!');
    }
    
  } catch (error) {
    console.error('❌ Erro na migração:', error);
  } finally {
    process.exit();
  }
}

migrateUserPoints();
```

**Para executar:**
```bash
node scripts/migrate-points.js
```

### Opção 3: Valor Simples (Rápido mas Aproximado)

Se você tem poucos usuários, pode simplesmente definir `totalPointsEarned` igual ao `pontos` atual de cada um:

```javascript
// Para cada usuário
totalPointsEarned = pontos_atual + pontos_gastos_na_loja
```

Você pode calcular `pontos_gastos_na_loja` somando os `pointsSpent` da coleção `redemptions` para cada usuário.

## 🎨 Visualização no Ranking

### Para Membros Comuns:

```
┌─────────────────────────────────────┐
│ #1 João                             │
│ Guerreiro                           │
│                                     │
│ Total: 500    Disponível: 300      │
└─────────────────────────────────────┘
```

### Para Administradores:

```
┌────────────────────────────────────────────┐
│ #1 João                                    │
│ Guerreiro                                  │
│                                            │
│ Total: 500  Gastos: 200  Disponível: 300 │
└────────────────────────────────────────────┘
```

## 📊 Exemplos

### Exemplo 1: Novo Membro
- Ganha 10 pontos (presença) → `totalPointsEarned: 10`, `pontos: 10`
- Ganha 10 pontos (presença) → `totalPointsEarned: 20`, `pontos: 20`
- Gasta 15 pontos (loja) → `totalPointsEarned: 20`, `pontos: 5` ✅
- **Ranking**: Posição baseada em 20 pontos (não em 5)

### Exemplo 2: Membro Ativo
- Acumulou 1000 pontos totais
- Gastou 600 na loja
- Tem 400 disponíveis
- **Ranking**: #1 com 1000 pontos totais
- **Loja**: Pode gastar até 400 pontos

## ✅ Checklist Pós-Atualização

- [ ] Atualizar regras do Firestore (já feito ✅)
- [ ] Migrar usuários existentes com `totalPointsEarned`
- [ ] Testar check-in de presença
- [ ] Testar resgate na loja
- [ ] Verificar ranking
- [ ] Verificar visualização admin vs membro

## 🔍 Verificação

Para verificar se está tudo funcionando:

1. **Presença**: Marque presença e veja se `totalPointsEarned` aumenta
2. **Loja**: Resgate um item e veja se:
   - `pontos` diminui
   - `totalPointsEarned` mantém
3. **Ranking**: Verifique se mostra os valores corretos
4. **Admin**: Como admin, verifique se vê a coluna "Gastos"

## 📝 Notas Importantes

1. **Não é reversível**: Uma vez que um usuário gasta pontos, o histórico fica nos `redemptions`
2. **Consistência**: Sempre use `totalPointsEarned` para ranking, nunca `pontos`
3. **Novos recursos**: No futuro, você pode adicionar relatórios baseados em `totalPointsEarned`

---

**Atualização implementada em**: 2025-01-02
**Versão**: 2.0

