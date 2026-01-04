'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Item, Redemption } from '@/types';
import { ShoppingBag, ArrowLeft, Coins, Package, AlertCircle, Check, Settings } from 'lucide-react';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';

function StoreContent() {
  const { userData, refreshUserData } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      const itemsQuery = query(
        collection(db, 'items'),
        where('active', '==', true)
      );
      const snapshot = await getDocs(itemsQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      } as Item));
      setItems(list.sort((a, b) => a.pointsCost - b.pointsCost));
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeemClick = (item: Item) => {
    setSelectedItem(item);
    setShowConfirmModal(true);
  };

  const handleRedeem = async () => {
    if (!selectedItem || !userData) return;

    setRedeeming(true);
    try {
      await runTransaction(db, async (transaction) => {
        // Buscar dados atualizados do usuário
        const userRef = doc(db, 'users', userData.id);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('Usuário não encontrado');
        }

        const currentPoints = userDoc.data().pontos;

        // Verificar se tem pontos suficientes
        if (currentPoints < selectedItem.pointsCost) {
          throw new Error('Pontos insuficientes');
        }

        // Buscar dados atualizados do item
        const itemRef = doc(db, 'items', selectedItem.id);
        const itemDoc = await transaction.get(itemRef);

        if (!itemDoc.exists()) {
          throw new Error('Item não encontrado');
        }

        const currentStock = itemDoc.data().stock;

        // Verificar se tem estoque
        if (currentStock <= 0) {
          throw new Error('Item sem estoque');
        }

        // Descontar pontos do usuário
        transaction.update(userRef, {
          pontos: currentPoints - selectedItem.pointsCost
        });

        // Descontar estoque do item
        transaction.update(itemRef, {
          stock: currentStock - 1
        });

        // Criar registro de resgate
        const redemptionRef = doc(collection(db, 'redemptions'));
        transaction.set(redemptionRef, {
          itemId: selectedItem.id,
          itemName: selectedItem.name,
          userId: userData.id,
          userName: userData.nick,
          pointsSpent: selectedItem.pointsCost,
          status: 'pending',
          createdAt: new Date()
        });
      });

      setSuccessMessage(`${selectedItem.name} resgatado com sucesso! Um admin entrará em contato para entrega.`);
      await refreshUserData();
      await loadItems();
      setShowConfirmModal(false);
      setSelectedItem(null);

      // Limpar mensagem de sucesso após 5 segundos
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error: any) {
      console.error('Erro ao resgatar item:', error);
      alert(error.message || 'Erro ao resgatar item. Tente novamente.');
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <ShoppingBag className="h-6 w-6" />
              Loja de Recompensas
            </h1>
            {userData?.role === 'admin' && (
              <Link
                href="/admin/store"
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition text-sm"
              >
                <Settings className="h-4 w-4" />
                Gerenciar
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Saldo de Pontos */}
        <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm opacity-90 mb-1">Seus Pontos Disponíveis</p>
              <p className="text-4xl font-bold text-white flex items-center gap-2">
                <Coins className="h-8 w-8" />
                {userData?.pontos || 0}
              </p>
            </div>
            <Package className="h-16 w-16 text-white opacity-50" />
          </div>
        </div>

        {/* Mensagem de Sucesso */}
        {successMessage && (
          <div className="mb-6 bg-green-600 border border-green-500 rounded-lg p-4 flex items-center gap-3">
            <Check className="h-6 w-6 text-white" />
            <p className="text-white">{successMessage}</p>
          </div>
        )}

        {/* Lista de Itens */}
        {items.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <ShoppingBag className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum item disponível no momento</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const canAfford = (userData?.pontos || 0) >= item.pointsCost;
              const hasStock = item.stock > 0;

              return (
                <div 
                  key={item.id}
                  className={`bg-gray-800 rounded-lg border ${
                    canAfford && hasStock 
                      ? 'border-gray-700 hover:border-red-500' 
                      : 'border-gray-700 opacity-75'
                  } overflow-hidden transition`}
                >
                  {/* Imagem do Item */}
                  {item.imageUrl ? (
                    <div className="h-32 bg-gray-700 overflow-hidden flex items-center justify-center">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-32 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                      <Package className="h-12 w-12 text-gray-600" />
                    </div>
                  )}

                  {/* Conteúdo */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{item.name}</h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{item.description}</p>

                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-white">{item.pointsCost}</span>
                      </div>
                      <div className={`text-sm ${hasStock ? 'text-gray-400' : 'text-red-400'}`}>
                        {hasStock ? `${item.stock} disponível` : 'Sem estoque'}
                      </div>
                    </div>

                    {/* Botão de Resgate */}
                    {!canAfford && hasStock && (
                      <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 mb-3 flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-yellow-300 text-xs">
                          Você precisa de mais {item.pointsCost - (userData?.pontos || 0)} pontos
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => handleRedeemClick(item)}
                      disabled={!canAfford || !hasStock}
                      className={`w-full py-3 rounded-lg font-semibold transition ${
                        canAfford && hasStock
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {!hasStock ? 'Sem Estoque' : canAfford ? 'Resgatar' : 'Pontos Insuficientes'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Confirmação */}
      {selectedItem && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onCancel={() => {
            setShowConfirmModal(false);
            setSelectedItem(null);
          }}
          onConfirm={handleRedeem}
          title="Confirmar Resgate"
          message={`Deseja resgatar "${selectedItem.name}" por ${selectedItem.pointsCost} pontos?`}
          confirmText="Resgatar"
          type="warning"
        />
      )}
    </div>
  );
}

export default function StorePage() {
  return (
    <ProtectedRoute>
      <StoreContent />
    </ProtectedRoute>
  );
}

