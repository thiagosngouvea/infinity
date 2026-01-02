# Sistema de Loja de Recompensas

Sistema completo de loja de recompensas onde membros podem resgatar itens usando pontos acumulados.

## 📋 O que foi implementado

### 1. Novos Tipos (types/index.ts)

- **Item**: Define os itens disponíveis na loja
  - `name`: Nome do item
  - `description`: Descrição detalhada
  - `imageUrl`: URL da imagem (opcional)
  - `pointsCost`: Custo em pontos
  - `stock`: Quantidade disponível
  - `active`: Se o item está visível na loja

- **Redemption**: Registra os resgates realizados
  - `itemId`, `itemName`: Referência ao item resgatado
  - `userId`, `userName`: Quem resgatou
  - `pointsSpent`: Pontos gastos
  - `status`: pending / delivered / cancelled
  - Datas de criação e entrega

### 2. Página da Loja (/store)

**Recursos para Membros:**
- ✅ Visualização de todos os itens ativos
- ✅ Exibição do saldo de pontos disponível
- ✅ Indicação clara de itens que podem ou não ser resgatados
- ✅ Alertas quando não tem pontos suficientes
- ✅ Verificação de estoque disponível
- ✅ Confirmação antes de resgatar
- ✅ Transação segura usando `runTransaction` do Firebase
- ✅ Desconto automático dos pontos após resgate
- ✅ Redução automática do estoque
- ✅ Link direto para área administrativa (apenas para admins)

**Validações Implementadas:**
- Verifica se o usuário tem pontos suficientes
- Verifica se há estoque disponível
- Usa transação para garantir consistência dos dados
- Atualiza dados do usuário automaticamente após resgate

### 3. Página Administrativa (/admin/store)

**Recursos para Admins:**

#### Aba Itens
- ➕ Cadastrar novos itens
- ✏️ Editar itens existentes
- 🗑️ Excluir itens
- 👁️ Visualizar todos os itens (ativos e inativos)
- 📦 Gerenciar estoque
- 🎯 Ativar/desativar itens

**Campos do Formulário:**
- Nome do item (obrigatório)
- Descrição (obrigatório)
- URL da imagem (opcional)
- Custo em pontos (obrigatório)
- Estoque (obrigatório)
- Item ativo (checkbox)

#### Aba Resgates
- 📋 Listagem de todos os resgates
- 🔍 Informações detalhadas:
  - Nome do item resgatado
  - Quem resgatou
  - Pontos gastos
  - Data/hora do resgate
  - Status atual
- ✅ Marcar como entregue
- ❌ Cancelar resgate
- 📊 Contador de resgates pendentes

### 4. Integração no Dashboard

- Card da Loja adicionado ao dashboard principal
- Design consistente com os outros cards
- Cor roxa/purple para diferenciação visual
- Ícone de sacola de compras (ShoppingBag)

## 🎮 Como Usar

### Para Membros:

1. **Acessar a Loja:**
   - Clique no card "Loja" no dashboard
   - Ou acesse diretamente `/store`

2. **Resgatar Itens:**
   - Verifique seu saldo de pontos no topo da página
   - Escolha um item disponível
   - Clique em "Resgatar"
   - Confirme a operação
   - Aguarde um admin entregar o item

3. **Restrições:**
   - Só pode resgatar se tiver pontos suficientes
   - Só pode resgatar se houver estoque
   - Os pontos são descontados imediatamente

### Para Administradores:

1. **Cadastrar Itens:**
   - Acesse `/admin/store`
   - Clique em "Novo Item"
   - Preencha os campos
   - Defina se o item está ativo
   - Clique em "Criar"

2. **Gerenciar Estoque:**
   - Edite o item
   - Altere o campo "Estoque"
   - Salve as alterações

3. **Gerenciar Resgates:**
   - Acesse a aba "Resgates"
   - Veja todos os resgates pendentes
   - Marque como "Entregar" quando efetuar a entrega
   - Ou "Cancelar" se necessário

4. **Ativar/Desativar Itens:**
   - Edite o item
   - Marque/desmarque "Item ativo"
   - Itens inativos não aparecem na loja

## 🔥 Recursos de Segurança

1. **Transações Atômicas:**
   - Usa `runTransaction` para garantir consistência
   - Previne condições de corrida
   - Garante que pontos e estoque sejam atualizados juntos

2. **Validações:**
   - Verifica pontos antes de permitir resgate
   - Verifica estoque em tempo real
   - Impede resgates duplicados

3. **Proteção de Rotas:**
   - Página admin protegida por `ProtectedRoute`
   - Apenas admins podem gerenciar itens
   - Verificação de role do lado do servidor também recomendada

## 📊 Estrutura do Banco de Dados (Firebase)

### Coleção: items
```
{
  id: string (auto-gerado),
  name: string,
  description: string,
  imageUrl?: string,
  pointsCost: number,
  stock: number,
  active: boolean,
  createdBy: string,
  createdAt: timestamp
}
```

### Coleção: redemptions
```
{
  id: string (auto-gerado),
  itemId: string,
  itemName: string,
  userId: string,
  userName: string,
  pointsSpent: number,
  status: 'pending' | 'delivered' | 'cancelled',
  createdAt: timestamp,
  deliveredAt?: timestamp,
  deliveredBy?: string
}
```

## 🎨 Design

- **Tema Dark:** Consistente com o resto da aplicação
- **Cores:**
  - Loja: Roxo/Purple (purple-600)
  - Botões de ação: Verde, Vermelho, Azul
  - Pontos: Amarelo dourado
- **Ícones:** Lucide React
- **Responsivo:** Grid adaptável para diferentes tamanhos de tela

## 🚀 Próximas Melhorias Sugeridas

1. **Notificações:**
   - Notificar admin quando houver novo resgate
   - Notificar membro quando item for entregue

2. **Histórico:**
   - Página para membros verem seus resgates
   - Filtros por status e data

3. **Categorias:**
   - Adicionar categorias aos itens
   - Filtros por categoria na loja

4. **Imagens:**
   - Upload de imagens direto (Firebase Storage)
   - Preview de imagens no formulário

5. **Estatísticas:**
   - Itens mais resgatados
   - Total de pontos gastos
   - Ranking de resgates

## ✅ Checklist de Implementação

- ✅ Tipos TypeScript criados
- ✅ Página de loja para membros
- ✅ Página administrativa
- ✅ Sistema de transações seguras
- ✅ Validação de pontos e estoque
- ✅ Interface responsiva
- ✅ Integração no dashboard
- ✅ Gerenciamento de resgates
- ✅ Status de entrega

---

**Tudo pronto para uso!** 🎉

Os membros já podem começar a resgatar itens e os admins podem cadastrar o catálogo de recompensas.

