'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Item, Redemption } from '@/types';
import { ShoppingBag, ArrowLeft, Plus, Edit, Trash2, Package, X, Check, Clock, Ban } from 'lucide-react';
import Link from 'next/link';
import ConfirmModal from '@/components/ConfirmModal';

function AdminStoreContent() {
  const { userData } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<'items' | 'redemptions'>('items');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    pointsCost: 0,
    stock: 0,
    active: true
  });

  useEffect(() => {
    if (userData?.role === 'admin') {
      loadItems();
      loadRedemptions();
    }
  }, [userData]);

  const loadItems = async () => {
    try {
      const itemsQuery = query(collection(db, 'items'));
      const snapshot = await getDocs(itemsQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      } as Item));
      setItems(list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRedemptions = async () => {
    try {
      const redemptionsQuery = query(
        collection(db, 'redemptions'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(redemptionsQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        deliveredAt: doc.data().deliveredAt?.toDate()
      } as Redemption));
      setRedemptions(list);
    } catch (error) {
      console.error('Erro ao carregar resgates:', error);
    }
  };

  const handleOpenModal = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl || '',
        pointsCost: item.pointsCost,
        stock: item.stock,
        active: item.active
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        pointsCost: 0,
        stock: 0,
        active: true
      });
    }
    setShowItemModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      if (editingItem) {
        // Atualizar item existente
        await updateDoc(doc(db, 'items', editingItem.id), {
          ...formData,
          pointsCost: Number(formData.pointsCost),
          stock: Number(formData.stock)
        });
      } else {
        // Criar novo item
        await addDoc(collection(db, 'items'), {
          ...formData,
          pointsCost: Number(formData.pointsCost),
          stock: Number(formData.stock),
          createdBy: userData.id,
          createdAt: new Date()
        });
      }

      await loadItems();
      setShowItemModal(false);
      setFormData({
        name: '',
        description: '',
        imageUrl: '',
        pointsCost: 0,
        stock: 0,
        active: true
      });
    } catch (error) {
      console.error('Erro ao salvar item:', error);
      alert('Erro ao salvar item. Tente novamente.');
    }
  };

  const handleDeleteClick = (item: Item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteDoc(doc(db, 'items', itemToDelete.id));
      await loadItems();
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir item:', error);
      alert('Erro ao excluir item. Tente novamente.');
    }
  };

  const handleRedemptionStatus = async (redemption: Redemption, newStatus: 'delivered' | 'cancelled') => {
    try {
      const updateData: any = {
        status: newStatus
      };

      if (newStatus === 'delivered') {
        updateData.deliveredAt = new Date();
        updateData.deliveredBy = userData?.id;
      }

      await updateDoc(doc(db, 'redemptions', redemption.id), updateData);
      await loadRedemptions();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert('Erro ao atualizar status. Tente novamente.');
    }
  };

  if (userData?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Acesso negado</p>
          <Link href="/dashboard" className="text-purple-500 hover:text-purple-400">
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/store" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar à Loja
            </Link>
            <h1 className="text-xl font-bold text-white">Gerenciar Loja</h1>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
            >
              <Plus className="h-5 w-5" />
              Novo Item
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('items')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'items'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Package className="h-5 w-5 inline mr-2" />
            Itens ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('redemptions')}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              activeTab === 'redemptions'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <ShoppingBag className="h-5 w-5 inline mr-2" />
            Resgates ({redemptions.filter(r => r.status === 'pending').length} pendentes)
          </button>
        </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'items' ? (
          /* Lista de Itens */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div 
                key={item.id}
                className={`bg-gray-800 rounded-lg border overflow-hidden ${
                  item.active ? 'border-gray-700' : 'border-red-900 opacity-75'
                }`}
              >
                {/* Imagem */}
                {item.imageUrl ? (
                  <div className="h-40 bg-gray-700 overflow-hidden">
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                    <Package className="h-16 w-16 text-gray-600" />
                  </div>
                )}

                {/* Conteúdo */}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-white">{item.name}</h3>
                    {!item.active && (
                      <span className="px-2 py-1 bg-red-900 text-red-200 text-xs rounded">
                        Inativo
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-400 text-sm mb-3 line-clamp-2">{item.description}</p>

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-yellow-500 font-bold">{item.pointsCost} pts</span>
                    <span className={`text-sm ${item.stock > 0 ? 'text-gray-400' : 'text-red-400'}`}>
                      Estoque: {item.stock}
                    </span>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenModal(item)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition"
                    >
                      <Edit className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="col-span-full bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                <Package className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg mb-4">Nenhum item cadastrado</p>
                <button
                  onClick={() => handleOpenModal()}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
                >
                  Cadastrar Primeiro Item
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Lista de Resgates */
          <div className="space-y-4">
            {redemptions.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
                <ShoppingBag className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">Nenhum resgate realizado ainda</p>
              </div>
            ) : (
              redemptions.map((redemption) => (
                <div 
                  key={redemption.id}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">{redemption.itemName}</h3>
                      <p className="text-gray-400 text-sm">
                        Resgatado por: <span className="text-white">{redemption.userName}</span>
                      </p>
                      <p className="text-gray-400 text-sm">
                        Pontos gastos: <span className="text-yellow-500 font-semibold">{redemption.pointsSpent}</span>
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {redemption.createdAt.toLocaleString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {redemption.status === 'pending' && (
                        <>
                          <span className="px-3 py-1 bg-yellow-900 text-yellow-300 text-xs rounded-full flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pendente
                          </span>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleRedemptionStatus(redemption, 'delivered')}
                              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-white text-xs transition flex items-center gap-1"
                            >
                              <Check className="h-3 w-3" />
                              Entregar
                            </button>
                            <button
                              onClick={() => handleRedemptionStatus(redemption, 'cancelled')}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs transition flex items-center gap-1"
                            >
                              <Ban className="h-3 w-3" />
                              Cancelar
                            </button>
                          </div>
                        </>
                      )}
                      {redemption.status === 'delivered' && (
                        <span className="px-3 py-1 bg-green-900 text-green-300 text-xs rounded-full flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Entregue
                        </span>
                      )}
                      {redemption.status === 'cancelled' && (
                        <span className="px-3 py-1 bg-red-900 text-red-300 text-xs rounded-full flex items-center gap-1">
                          <Ban className="h-3 w-3" />
                          Cancelado
                        </span>
                      )}
                    </div>
                  </div>

                  {redemption.deliveredAt && (
                    <p className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-700">
                      Entregue em: {redemption.deliveredAt.toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal de Item */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">
                {editingItem ? 'Editar Item' : 'Novo Item'}
              </h2>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome do Item *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL da Imagem
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Custo em Pontos *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.pointsCost}
                    onChange={(e) => setFormData({ ...formData, pointsCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Estoque *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                />
                <label htmlFor="active" className="text-sm font-medium text-gray-300">
                  Item ativo (visível na loja)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
                >
                  {editingItem ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onCancel={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        onConfirm={handleDelete}
        title="Excluir Item"
        message={`Tem certeza que deseja excluir "${itemToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
      />
    </div>
  );
}

export default function AdminStorePage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminStoreContent />
    </ProtectedRoute>
  );
}

