'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { Shield, ArrowLeft, Crown, UserX, UserCheck, Trash2, AlertTriangle, Star, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

function AdminMembersContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { confirm, ConfirmDialog } = useConfirm();

  const filteredMembers = members.filter(m => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      m.nick?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.whatsapp?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const membersQuery = query(
        clanCol(clan.slug, COLS.users),
        where('role', 'in', ['member', 'admin', 'super_admin'])
      );
      const snapshot = await getDocs(membersQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      } as User));
      
      list.sort((a, b) => {
        const order = { super_admin: 0, admin: 1, member: 2, pending: 3 } as Record<string, number>;
        const diff = (order[a.role] ?? 3) - (order[b.role] ?? 3);
        return diff !== 0 ? diff : b.pontos - a.pontos;
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
      await updateDoc(clanDoc(clan.slug, COLS.users, userId), { role: 'admin' });
      toast.success(`${userName} agora é administrador!`);
      loadMembers();
    } catch (error) {
      console.error('Erro ao promover usuário:', error);
      toast.error('Erro ao promover usuário');
    }
  };

  const promoteToSuperAdmin = async (userId: string, userName: string) => {
    const confirmed = await confirm({
      title: '⭐ Promover a Super Admin',
      message: `Promover ${userName} a Super Admin?\n\nEle terá acesso EXCLUSIVO a:\n• Configurações de domínio\n• Inicializar o clã\n• Todas as funções de admin`,
      confirmText: 'Promover',
      cancelText: 'Cancelar',
      type: 'warning'
    });
    if (!confirmed) return;
    try {
      await updateDoc(clanDoc(clan.slug, COLS.users, userId), { role: 'super_admin' });
      toast.success(`${userName} agora é Super Admin!`);
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
      await updateDoc(clanDoc(clan.slug, COLS.users, userId), {
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
      await deleteDoc(clanDoc(clan.slug, COLS.users, userId));
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
        <LoadingLogo size={128} fullscreen={false} />
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
        {/* Barra de Busca */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <input
            id="members-search"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nick, email ou WhatsApp..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

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

        {/* Contador */}
        {search.trim() && (
          <p className="text-sm text-gray-400 mb-3">
            {filteredMembers.length} resultado{filteredMembers.length !== 1 ? 's' : ''} para "{search}"
          </p>
        )}

        <div className="space-y-4">
          {filteredMembers.map((member) => (
            <div 
              key={member.id}
              className={`bg-gray-800 rounded-lg p-6 border ${
                member.role === 'super_admin'
                  ? 'border-purple-500/50 bg-purple-900/10'
                  : member.role === 'admin'
                  ? 'border-yellow-600/50 bg-yellow-900/10'
                  : 'border-gray-700'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-white">{member.nick}</h3>
                    {member.role === 'super_admin' && (
                      <Star className="h-5 w-5 text-purple-400" />
                    )}
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
                      {member.role === 'super_admin' ? 'Super Admin'
                        : member.role === 'admin' ? 'Administrador'
                        : 'Membro'}
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
                  {/* Super Admin só pode ser promovido pelo super_admin logado */}
                  {userData?.role === 'super_admin' && member.role === 'admin' && member.id !== userData?.id && (
                    <button
                      onClick={() => promoteToSuperAdmin(member.id, member.nick)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition"
                    >
                      <Star className="h-4 w-4" />
                      Tornar Super Admin
                    </button>
                  )}

                  {member.role === 'member' ? (
                    <button
                      onClick={() => promoteToAdmin(member.id, member.nick)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition"
                    >
                      <Crown className="h-4 w-4" />
                      Promover a Admin
                    </button>
                  ) : member.role === 'admin' ? (
                    <button
                      onClick={() => demoteToMember(member.id, member.nick)}
                      disabled={member.id === userData?.id}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <UserCheck className="h-4 w-4" />
                      Tornar Membro
                    </button>
                  ) : null /* super_admin não tem botão de rebaixar aqui */}

                  <button
                    onClick={() => removeMember(member.id, member.nick)}
                    disabled={member.id === userData?.id || member.role === 'super_admin'}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={member.role === 'super_admin' ? 'Não é possível remover um Super Admin' : ''}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover do Clã
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <UserX className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {search.trim() ? `Nenhum membro encontrado para "${search}"` : 'Nenhum membro encontrado'}
            </p>
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

