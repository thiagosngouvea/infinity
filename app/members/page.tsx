'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { Users, ArrowLeft, Shield, Crown, Phone, MessageCircle } from 'lucide-react';
import Link from 'next/link';

function MembersContent() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'admin' | 'member'>('all');

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const membersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['member', 'admin']),
        orderBy('pontos', 'desc')
      );
      const snapshot = await getDocs(membersQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        approvedAt: doc.data().approvedAt?.toDate()
      } as User));
      setMembers(list);
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    if (filter === 'all') return true;
    return member.role === filter;
  });

  const getClassColor = (classe: string) => {
    const colors: { [key: string]: string } = {
      'Guerreiro': 'bg-red-600',
      'Arqueiro': 'bg-green-600',
      'Mago': 'bg-blue-600',
      'Sacerdote': 'bg-yellow-600',
      'Bárbaro': 'bg-orange-600',
      'Arcano': 'bg-purple-600',
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
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
            <h1 className="text-xl font-bold text-white">Membros do Clã</h1>
            {userData?.role === 'admin' && (
              <Link
                href="/admin/members"
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition text-sm"
              >
                <Shield className="h-4 w-4" />
                Gerenciar
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <Users className="h-10 w-10 text-purple-500" />
              <div>
                <p className="text-gray-400 text-sm">Total de Membros</p>
                <p className="text-2xl font-bold text-white">{members.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <Crown className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="text-gray-400 text-sm">Administradores</p>
                <p className="text-2xl font-bold text-white">
                  {members.filter(m => m.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <Shield className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-gray-400 text-sm">Membros Ativos</p>
                <p className="text-2xl font-bold text-white">
                  {members.filter(m => m.role === 'member').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              filter === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Todos ({members.length})
          </button>
          <button
            onClick={() => setFilter('admin')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              filter === 'admin'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Admins ({members.filter(m => m.role === 'admin').length})
          </button>
          <button
            onClick={() => setFilter('member')}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              filter === 'member'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Membros ({members.filter(m => m.role === 'member').length})
          </button>
        </div>

        {/* Lista de Membros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMembers.map((member) => (
            <div 
              key={member.id}
              className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-purple-500 transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white">{member.nick}</h3>
                    {member.role === 'admin' && (
                      <Crown className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs text-white ${getClassColor(member.classe)}`}>
                    {member.classe}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Shield className="h-4 w-4" />
                  <span>{member.pontos} pontos</span>
                </div>
                
                {(userData?.role === 'admin' || member.id === userData?.id) && (
                  <>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Phone className="h-4 w-4" />
                      <span>{member.telefone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <MessageCircle className="h-4 w-4" />
                      <span>{member.whatsapp}</span>
                    </div>
                  </>
                )}
              </div>

              {member.approvedAt && (
                <div className="pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-500">
                    Membro desde {member.approvedAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredMembers.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum membro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MembersPage() {
  return (
    <ProtectedRoute>
      <MembersContent />
    </ProtectedRoute>
  );
}

