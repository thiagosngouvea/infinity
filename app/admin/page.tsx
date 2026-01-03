'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Notification } from '@/types';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Check, X, Users, Shield } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmModal';

function AdminContent() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { userData } = useAuth();
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const loadPendingUsers = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'pending'));
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setPendingUsers(users);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar usuários pendentes');
    } finally {
      setLoading(false);
    }
  };

  const approveUser = async (userId: string, userName: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'member',
        approvedAt: new Date(),
        approvedBy: userData?.id
      });

      // Criar notificação para o usuário
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'approval',
        title: 'Cadastro Aprovado!',
        message: 'Seu cadastro foi aprovado! Bem-vindo ao Clã Infinity.',
        read: false,
        createdAt: new Date()
      });

      toast.success(`Usuário ${userName} aprovado!`);
      loadPendingUsers();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao aprovar usuário');
    }
  };

  const rejectUser = async (userId: string, userName: string) => {
    const confirmed = await confirm({
      title: 'Rejeitar Cadastro',
      message: `Tem certeza que deseja rejeitar o cadastro de ${userName}?\n\nO usuário não terá acesso ao sistema.`,
      confirmText: 'Rejeitar',
      cancelText: 'Cancelar',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'rejected'
      });

      toast.success(`Cadastro de ${userName} rejeitado`);
      loadPendingUsers();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao rejeitar usuário');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-red-500" />
              <span className="text-xl font-bold text-white">Clã Infinity - Admin</span>
            </div>
            <Link
              href="/dashboard"
              className="text-gray-300 hover:text-white transition"
            >
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Menu de Administração */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Link
            href="/admin/members"
            className="bg-gradient-to-br from-red-600 to-red-800 rounded-lg p-6 hover:from-red-700 hover:to-red-900 transition cursor-pointer"
          >
            <Shield className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Gerenciar Membros</h3>
            <p className="text-red-200 text-sm">Promover a admin, remover membros</p>
          </Link>

          <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6">
            <Users className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Aprovar Cadastros</h3>
            <p className="text-blue-200 text-sm">{pendingUsers.length} pendente(s)</p>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
            <Users className="h-8 w-8" />
            Aprovação de Membros
          </h1>
          <p className="text-gray-400">
            {pendingUsers.length} cadastro(s) aguardando aprovação
          </p>
        </div>

        {pendingUsers.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum cadastro pendente no momento</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingUsers.map((user) => (
              <div key={user.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-400">Nick</p>
                    <p className="text-white font-semibold">{user.nick}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Classe</p>
                    <p className="text-white font-semibold">{user.classe}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="text-white font-semibold">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">WhatsApp</p>
                    <p className="text-white font-semibold">{user.whatsapp}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => approveUser(user.id, user.nick)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                  >
                    <Check className="h-5 w-5" />
                    Aprovar
                  </button>
                  <button
                    onClick={() => rejectUser(user.id, user.nick)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2"
                  >
                    <X className="h-5 w-5" />
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminContent />
    </ProtectedRoute>
  );
}

