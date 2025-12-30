'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { Trophy, ArrowLeft, Medal, Award } from 'lucide-react';
import Link from 'next/link';

function RankingContent() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
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
        createdAt: doc.data().createdAt.toDate()
      } as User));
      setMembers(list);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (position: number) => {
    if (position === 0) return <Trophy className="h-8 w-8 text-yellow-400" />;
    if (position === 1) return <Medal className="h-7 w-7 text-gray-400" />;
    if (position === 2) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-2xl font-bold text-gray-500">#{position + 1}</span>;
  };

  const getRankBg = (position: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-purple-900/50 border-purple-500';
    if (position === 0) return 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 border-yellow-600';
    if (position === 1) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-gray-500';
    if (position === 2) return 'bg-gradient-to-r from-amber-900/30 to-amber-800/30 border-amber-700';
    return 'bg-gray-800 border-gray-700';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const userPosition = members.findIndex(m => m.id === userData?.id);

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Ranking</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Minha Posição */}
        {userPosition >= 0 && (
          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-6 mb-8 border border-purple-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Award className="h-12 w-12 text-purple-300" />
                <div>
                  <p className="text-purple-200 text-sm">Sua Posição</p>
                  <p className="text-3xl font-bold text-white">#{userPosition + 1}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-purple-200 text-sm">Seus Pontos</p>
                <p className="text-3xl font-bold text-white">{userData?.pontos || 0}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ranking */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-400" />
            Ranking de Membros
          </h2>

          {members.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhum membro no ranking ainda</p>
          ) : (
            <div className="space-y-3">
              {members.map((member, index) => {
                const isCurrentUser = member.id === userData?.id;
                
                return (
                  <div
                    key={member.id}
                    className={`rounded-lg p-4 border-2 transition ${getRankBg(index, isCurrentUser)}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 w-12 flex justify-center">
                        {getRankIcon(index)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold text-white truncate">
                            {member.nick}
                          </p>
                          {isCurrentUser && (
                            <span className="px-2 py-1 bg-purple-600 rounded-full text-xs text-white">
                              Você
                            </span>
                          )}
                          {member.role === 'admin' && (
                            <span className="px-2 py-1 bg-red-600 rounded-full text-xs text-white">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-400">{member.classe}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">{member.pontos}</p>
                        <p className="text-xs text-gray-400">pontos</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Informação */}
        <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <p className="text-sm text-gray-400 text-center">
            💡 Ganhe pontos marcando presença diariamente e participando das atividades do clã!
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RankingPage() {
  return (
    <ProtectedRoute>
      <RankingContent />
    </ProtectedRoute>
  );
}

