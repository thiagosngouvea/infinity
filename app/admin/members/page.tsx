'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import toast from 'react-hot-toast';
import { Shield, ArrowLeft, Crown, UserX, UserCheck, Trash2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';

function AdminMembersContent() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const membersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['member', 'admin'])
      );
      const snapshot = await getDocs(membersQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      } as User));
      
      // Ordenar: admins primeiro
      list.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (a.role !== 'admin' && b.role === 'admin') return 1;
        return b.pontos - a.pontos;
      });
      
      setMembers(list);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
      toast.error('Erro ao carregar membros');
    } finally {
      setLoading(false);
    }
  };

  const promoteToAdmin = async (userId: string, userName: string) => {
    const confirmed = await confirm({
      title: 'Promover a Administrador',
      message: `Promover ${userName} a Administrador?\n\nEle terá acesso total ao sistema, incluindo:\n• Aprovar membros\n• Criar eventos e sorteios\n• Gerenciar outros membros`,
      confirmText: 'Promover',
      cancelText: 'Cancelar',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'admin'
      });
      toast.success(`${userName} agora é administrador!`);
      loadMembers();
    } catch (error) {
      console.error('Erro ao promover usuário:', error);
      toast.error('Erro ao promover usuário');
    }
  };

  const demoteToMember = async (userId: string, userName: string) => {
    if (userId === userData?.id) {
      toast.error('Você não pode remover seu próprio status de admin!');
      return;
    }

    const confirmed = await confirm({
      title: 'Remover Privilégios de Admin',
      message: `Remover ${userName} de Administrador?\n\nEle voltará a ser membro comum e perderá:\n• Acesso ao painel admin\n• Permissões de gerenciamento\n• Capacidade de aprovar membros`,
      confirmText: 'Rebaixar',
      cancelText: 'Cancelar',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'member'
      });
      toast.success(`${userName} agora é membro comum`);
      loadMembers();
    } catch (error) {
      console.error('Erro ao rebaixar usuário:', error);
      toast.error('Erro ao rebaixar usuário');
    }
  };

  const removeMember = async (userId: string, userName: string) => {
    if (userId === userData?.id) {
      toast.error('Você não pode remover sua própria conta!');
      return;
    }

    const confirmed = await confirm({
      title: '⚠️ REMOVER MEMBRO DO CLÃ',
      message: `ATENÇÃO: Você está prestes a remover ${userName} permanentemente do clã.\n\n⚠️ Esta ação NÃO pode ser desfeita!\n\nO usuário perderá:\n• Todo acesso ao sistema\n• Histórico de presenças\n• Pontuação acumulada\n• Participação em eventos\n\nTem CERTEZA ABSOLUTA?`,
      confirmText: 'Sim, Remover',
      cancelText: 'Cancelar',
      type: 'danger',
      requiresTextConfirmation: true,
      confirmationText: 'CONFIRMAR'
    });

    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
      toast.success(`${userName} foi removido do clã`);
      loadMembers();
    } catch (error) {
      console.error('Erro ao remover usuário:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const getClassColor = (classe: string) => {
    const colors: { [key: string]: string } = {
      'Guerreiro': 'bg-red-600',
      'Arqueiro': 'bg-green-600',
      'Mago': 'bg-blue-600',
      'Sacerdote': 'bg-yellow-600',
      'Bárbaro': 'bg-orange-600',
      'Arcano': 'bg-red-600',
      'Mistico': 'bg-pink-600',
      'Feiticeira': 'bg-indigo-600',
      'Mercenário': 'bg-gray-600',
      'Espiritualista': 'bg-cyan-600'
    };
    return colors[classe] || 'bg-gray-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Gerenciar Membros</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-200 font-semibold mb-1">Atenção - Painel Administrativo</p>
              <p className="text-yellow-200 text-sm">
                Use estas ferramentas com cuidado. Promover usuários a admin dá acesso total ao sistema.
                Remover membros é uma ação permanente.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {members.map((member) => (
            <div 
              key={member.id}
              className={`bg-gray-800 rounded-lg p-6 border ${
                member.role === 'admin' 
                  ? 'border-yellow-600/50 bg-yellow-900/10' 
                  : 'border-gray-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{member.nick}</h3>
                    {member.role === 'admin' && (
                      <Crown className="h-5 w-5 text-yellow-500" />
                    )}
                    {member.id === userData?.id && (
                      <span className="px-2 py-1 bg-red-600 rounded-full text-xs text-white">
                        Você
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs text-white ${getClassColor(member.classe)}`}>
                      {member.classe}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-400">
                    <div>
                      <span className="font-semibold">Email:</span> {member.email}
                    </div>
                    <div>
                      <span className="font-semibold">Telefone:</span> {member.telefone}
                    </div>
                    <div>
                      <span className="font-semibold">WhatsApp:</span> {member.whatsapp}
                    </div>
                    <div>
                      <span className="font-semibold">Pontos:</span> {member.pontos}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span>{' '}
                      {member.role === 'admin' ? 'Administrador' : 'Membro'}
                    </div>
                    {member.approvedAt && (
                      <div>
                        <span className="font-semibold">Membro desde:</span>{' '}
                        {member.approvedAt.toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 lg:w-48">
                  {member.role === 'member' ? (
                    <button
                      onClick={() => promoteToAdmin(member.id, member.nick)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition"
                    >
                      <Crown className="h-4 w-4" />
                      Promover a Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => demoteToMember(member.id, member.nick)}
                      disabled={member.id === userData?.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="h-4 w-4" />
                      Tornar Membro
                    </button>
                  )}

                  <button
                    onClick={() => removeMember(member.id, member.nick)}
                    disabled={member.id === userData?.id}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover do Clã
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <UserX className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum membro encontrado</p>
          </div>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

export default function AdminMembersPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminMembersContent />
    </ProtectedRoute>
  );
}

