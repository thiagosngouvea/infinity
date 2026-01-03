# Sistema de Pontuação em Eventos

Sistema completo de gerenciamento de eventos com pontuação automática em dois níveis: confirmação e comparecimento.

## 📋 O Que Foi Implementado

### 1. Tipos Atualizados (`types/index.ts`)

#### Event
```typescript
{
  pointsForVoting: number;      // Pontos por confirmar presença
  pointsForAttendance: number;  // Pontos por comparecer
}
```

#### EventVote
```typescript
{
  attended?: boolean;                    // Se compareceu
  attendanceConfirmedBy?: string;        // Admin que confirmou
  attendanceConfirmedAt?: Date;          // Data da confirmação
  votingPointsAwarded?: boolean;         // Se recebeu pontos por votar
  attendancePointsAwarded?: boolean;     // Se recebeu pontos por comparecer
}
```

### 2. Criação de Eventos Atualizada (`/events`)

**Novos Campos no Formulário:**
- **Pontos por Confirmar Presença**: Pontos ganhos ao votar (primeira vez)
- **Pontos por Comparecer**: Pontos ganhos quando admin confirma comparecimento

**Padrões Sugeridos:**
- Confirmação: 5 pontos
- Comparecimento: 20 pontos

### 3. Sistema de Votação com Pontos

**Funcionamento:**
- Ao confirmar presença pela primeira vez → Ganha pontos de votação
- Alterar voto (sim/não) → Não ganha pontos novamente
- Pontos creditados automaticamente em `pontos` e `totalPointsEarned`

### 4. Página Admin de Gerenciamento (`/admin/events/[eventId]`)

**Recursos:**

#### Estatísticas
- 📊 Total de votos
- ✅ Quantos confirmaram presença
- 🎖️ Quantos compareceram
- ❌ Quantos não podem participar

#### Confirmação Individual
- Botão para confirmar presença de cada participante
- Pontos creditados automaticamente
- Feedback visual (verde quando confirmado)
- Possibilidade de remover confirmação

#### Confirmação em Massa
- Botão "Confirmar Presença de Todos"
- Confirma todos que disseram "sim" de uma vez
- Usa batch write para performance
- Mostra total de pontos que serão distribuídos

#### Listas Separadas
- **Confirmaram Presença**: Podem ter presença confirmada
- **Não Podem Participar**: Lista informativa

## 🎯 Fluxo Completo

### Para Membros:

1. **Ver Evento**
   - Acessa `/events`
   - Vê quantos pontos cada ação vale

2. **Confirmar Presença**
   - Clica em "Posso Participar"
   - Recebe **pontos de confirmação** imediatamente
   - Ex: +5 pontos

3. **Participar do Evento**
   - Comparece ao evento
   - Aguarda admin confirmar

4. **Receber Pontos de Comparecimento**
   - Admin confirma presença
   - Recebe **pontos de comparecimento**
   - Ex: +20 pontos

**Total possível**: 5 + 20 = 25 pontos por evento

### Para Admins:

1. **Criar Evento**
   - Define título, descrição, data
   - **Define pontos de confirmação**
   - **Define pontos de comparecimento**

2. **Durante o Evento**
   - Membros confirmam presença
   - Recebem pontos automaticamente

3. **Após o Evento**
   - Acessa `/admin/events/[eventId]` clicando no ícone 👥
   - Vê lista de quem confirmou
   - Confirma individualmente ou em massa
   - Pontos creditados automaticamente

## 🔧 Características Técnicas

### Prevenção de Duplicatas
- ✅ Flag `votingPointsAwarded`: Garante que pontos de confirmação só são dados uma vez
- ✅ Flag `attendancePointsAwarded`: Garante que pontos de comparecimento só são dados uma vez
- ✅ Se membro alterar voto, não recebe pontos novamente

### Transações Seguras
- Usa `increment()` para pontos (thread-safe)
- Confirmação em massa usa `writeBatch()`
- Atualiza `pontos` e `totalPointsEarned` simultaneamente

### Auditoria
- Registra quem confirmou presença (`attendanceConfirmedBy`)
- Registra quando foi confirmado (`attendanceConfirmedAt`)
- Histórico completo mantido

## 📊 Exemplos de Uso

### Exemplo 1: TW (Territory War)
```
Título: TW de Sábado
Tipo: TW
Pontos por confirmar: 5
Pontos por comparecer: 25

Resultado:
- 20 membros confirmaram → 20 × 5 = 100 pontos distribuídos
- 15 compareceram → 15 × 25 = 375 pontos distribuídos
- Total distribuído: 475 pontos
```

### Exemplo 2: Boss Raid
```
Título: Boss Raid - Dragão Negro
Tipo: Boss
Pontos por confirmar: 3
Pontos por comparecer: 15

Resultado:
- 30 membros confirmaram → 30 × 3 = 90 pontos
- 28 compareceram → 28 × 15 = 420 pontos
- Total: 510 pontos
```

### Exemplo 3: Farm em Grupo
```
Título: Farm de Materiais
Tipo: Farm
Pontos por confirmar: 2
Pontos por comparecer: 8

Resultado:
- 10 membros confirmaram → 10 × 2 = 20 pontos
- 10 compareceram → 10 × 8 = 80 pontos
- Total: 100 pontos
```

## 🎨 Interface

### Visualização de Eventos (Membros)

```
┌──────────────────────────────────────────────┐
│ TW de Sábado                        [TW]     │
│ Territory War no mapa central                │
│ 15/01/2025 às 20:00                         │
│                                              │
│ 💰 5 pts por confirmar                       │
│ 🏆 25 pts por comparecer                     │
│                                              │
│ [✅ Posso Participar] [❌ Não Posso]        │
└──────────────────────────────────────────────┘
```

### Painel Admin de Presença

```
┌──────────────────────────────────────────────┐
│ TW de Sábado                                 │
│ 📅 15/01/2025 20:00  🏷️ TW                  │
│ ✅ 5 pts confirmar  🎖️ 25 pts comparecer    │
├──────────────────────────────────────────────┤
│ Estatísticas                                 │
│ 📊 30 votos  ✅ 25 confirmaram               │
│ 🎖️ 20 compareceram  ❌ 5 não podem          │
├──────────────────────────────────────────────┤
│ [Confirmar Presença de Todos (5)]           │
├──────────────────────────────────────────────┤
│ ✅ Confirmaram Presença (25)                 │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ João Silva                    ✅ Compareceu│
│ │ joao@email.com                            │
│ │ Confirmado em 15/01/2025 21:30           │
│ │                    [Remover Confirmação] │
│ └──────────────────────────────────────────┘ │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ Maria Santos                              │
│ │ maria@email.com                           │
│ │                    [Confirmar Presença]  │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## 🔍 Acesso às Funcionalidades

### Membros
- ✅ Ver todos os eventos
- ✅ Ver pontuação de cada evento
- ✅ Confirmar/recusar presença
- ✅ Receber pontos automaticamente ao confirmar
- ❌ Não vê quem mais confirmou
- ❌ Não pode confirmar comparecimento

### Admins
- ✅ Tudo que membros podem
- ✅ Criar eventos
- ✅ Definir pontuação
- ✅ Ver lista completa de confirmações
- ✅ Confirmar comparecimento individual
- ✅ Confirmar comparecimento em massa
- ✅ Excluir eventos
- ✅ Ver estatísticas detalhadas

## 📝 Regras de Negócio

1. **Pontos de Confirmação**
   - Dados apenas na primeira confirmação
   - Alterar de "sim" para "não" ou vice-versa não dá pontos novamente
   - Creditados automaticamente ao votar

2. **Pontos de Comparecimento**
   - Dados apenas quando admin confirma
   - Podem ser removidos (admin remove confirmação)
   - Apenas quem confirmou "sim" pode ter presença confirmada

3. **Duplicatas**
   - Sistema previne automaticamente
   - Flags no banco garantem que pontos só são dados uma vez
   - Mesmo se admin confirmar múltiplas vezes por engano

4. **Histórico**
   - Todos os votos são mantidos
   - Registros de confirmação salvos
   - Auditoria completa disponível

## ✅ Vantagens do Sistema

1. **Automático**: Pontos creditados sem intervenção manual
2. **Justo**: Todos recebem o mesmo por mesma ação
3. **Transparente**: Membros sabem quanto vale cada evento
4. **Flexível**: Admin define pontuação por evento
5. **Motivador**: Incentiva confirmação antecipada e comparecimento
6. **Seguro**: Previne duplicatas e fraudes
7. **Auditável**: Histórico completo mantido

## 🚀 Próximas Melhorias Sugeridas

1. **Notificações**
   - Notificar quando receber pontos
   - Lembrar membros de confirmar presença

2. **Estatísticas**
   - Taxa de comparecimento por membro
   - Eventos mais populares
   - Média de pontos por evento

3. **Penalidades**
   - Descontar pontos de quem confirma mas não vai
   - Sistema de strikes

4. **Recompensas Extras**
   - Bônus por streak de comparecimento
   - Bônus por ser o primeiro a confirmar

---

**Sistema implementado em**: 2025-01-02
**Versão**: 1.0
**Status**: ✅ Pronto para uso

