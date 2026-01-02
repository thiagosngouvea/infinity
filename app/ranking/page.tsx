'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Redemption } from '@/types';
import { Trophy, ArrowLeft, Medal, Award, TrendingUp, ShoppingBag, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface MemberWithStats extends User {
  pointsSpent: number;
}

function RankingContent() {
  const { userData } = useAuth();
  const [members, setMembers] = useState<MemberWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => {
    loadRanking();
  }, []);

  const loadRanking = async () => {
    try {
      // Carregar membros - primeiro tenta buscar todos
      const allUsersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['member', 'admin'])
      );
      const snapshot = await getDocs(allUsersQuery);
      const membersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        totalPointsEarned: doc.data().totalPointsEarned || 0
      } as User));

      // Verificar se há usuários sem totalPointsEarned
      const usersWithoutTotal = membersList.filter(m => 
        m.totalPointsEarned === 0 && m.pontos > 0
      );
      setNeedsMigration(usersWithoutTotal.length > 0);

      // Carregar todos os resgates para calcular pontos gastos
      const redemptionsQuery = query(collection(db, 'redemptions'));
      const redemptionsSnapshot = await getDocs(redemptionsQuery);
      const redemptions = redemptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Redemption));

      // Calcular pontos gastos por usuário
      const pointsSpentByUser: { [userId: string]: number } = {};
      redemptions.forEach(redemption => {
        if (redemption.status === 'pending' || redemption.status === 'delivered') {
          if (!pointsSpentByUser[redemption.userId]) {
            pointsSpentByUser[redemption.userId] = 0;
          }
          pointsSpentByUser[redemption.userId] += redemption.pointsSpent;
        }
      });

      // Adicionar pontos gastos aos membros e calcular totalPointsEarned se necessário
      const membersWithStats = membersList.map(member => ({
        ...member,
        pointsSpent: pointsSpentByUser[member.id] || 0,
        // Se não tem totalPointsEarned, calcular temporariamente para exibição
        totalPointsEarned: member.totalPointsEarned || (member.pontos + (pointsSpentByUser[member.id] || 0))
      }));

      // Ordenar por totalPointsEarned
      membersWithStats.sort((a, b) => b.totalPointsEarned - a.totalPointsEarned);

      setMembers(membersWithStats);
    } catch (error) {
      console.error('Erro ao carregar ranking:', error);
      toast.error('Erro ao carregar ranking');
    } finally {
      setLoading(false);
    }
  };

  const migrateUserPoints = async () => {
    if (!userData || userData.role !== 'admin') {
      toast.error('Apenas administradores podem executar esta ação');
      return;
    }

    const confirmed = confirm(
      'Deseja normalizar os dados de pontos?\n\n' +
      'Esta ação irá:\n' +
      '• Calcular totalPointsEarned para todos os usuários\n' +
      '• Baseado em pontos atuais + pontos gastos na loja\n' +
      '• Atualizar o banco de dados\n\n' +
      'Continuar?'
    );

    if (!confirmed) return;

    setMigrating(true);
    try {
      // Carregar todos os usuários
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      // Carregar todos os resgates
      const redemptionsSnapshot = await getDocs(collection(db, 'redemptions'));
      const redemptions = redemptionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Redemption));

      // Calcular pontos gastos por usuário
      const pointsSpentByUser: { [userId: string]: number } = {};
      redemptions.forEach(redemption => {
        if (redemption.status === 'pending' || redemption.status === 'delivered') {
          if (!pointsSpentByUser[redemption.userId]) {
            pointsSpentByUser[redemption.userId] = 0;
          }
          pointsSpentByUser[redemption.userId] += redemption.pointsSpent;
        }
      });

      // Preparar batch de atualizações
      const batch = writeBatch(db);
      let updateCount = 0;

      usersSnapshot.docs.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // Calcular totalPointsEarned
        const currentPoints = userData.pontos || 0;
        const pointsSpent = pointsSpentByUser[userId] || 0;
        const totalPointsEarned = currentPoints + pointsSpent;

        // Atualizar se não tem o campo ou se está zero mas deveria ter valor
        if (userData.totalPointsEarned === undefined || 
            (userData.totalPointsEarned === 0 && totalPointsEarned > 0)) {
          batch.update(doc(db, 'users', userId), {
            totalPointsEarned: totalPointsEarned
          });
          updateCount++;
          console.log(`✅ ${userData.nick}: ${totalPointsEarned} pontos totais`);
        }
      });

      if (updateCount > 0) {
        await batch.commit();
        toast.success(`${updateCount} usuário(s) atualizado(s) com sucesso!`);
        await loadRanking();
        setNeedsMigration(false);
      } else {
        toast.success('Todos os usuários já estão atualizados!');
      }

    } catch (error) {
      console.error('Erro na migração:', error);
      toast.error('Erro ao normalizar dados. Tente novamente.');
    } finally {
      setMigrating(false);
    }
  };

  const getRankIcon = (position: number) => {
    if (position === 0) return <Trophy className="h-8 w-8 text-yellow-400" />;
    if (position === 1) return <Medal className="h-7 w-7 text-gray-400" />;
    if (position === 2) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-2xl font-bold text-gray-500">#{position + 1}</span>;
  };

  const getRankBg = (position: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-red-900/50 border-red-500';
    if (position === 0) return 'bg-gradient-to-r from-yellow-900/30 to-yellow-800/30 border-yellow-600';
    if (position === 1) return 'bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-gray-500';
    if (position === 2) return 'bg-gradient-to-r from-amber-900/30 to-amber-800/30 border-amber-700';
    return 'bg-gray-800 border-gray-700';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
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
            <div className="w-20">
              {userData?.role === 'admin' && needsMigration && (
                <button
                  onClick={migrateUserPoints}
                  disabled={migrating}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg text-white text-sm transition"
                  title="Normalizar pontos dos usuários"
                >
                  <RefreshCw className={`h-4 w-4 ${migrating ? 'animate-spin' : ''}`} />
                  {migrating ? 'Atualizando...' : 'Normalizar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Aviso de Migração Necessária */}
        {userData?.role === 'admin' && needsMigration && (
          <div className="mb-6 bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-200 font-semibold mb-1">Dados de pontos precisam ser normalizados</p>
                <p className="text-yellow-200 text-sm mb-3">
                  Alguns usuários não têm o campo totalPointsEarned. Clique no botão "Normalizar" no topo para calcular e atualizar automaticamente.
                </p>
                <button
                  onClick={migrateUserPoints}
                  disabled={migrating}
                  className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg text-white text-sm transition font-semibold"
                >
                  <RefreshCw className={`h-4 w-4 ${migrating ? 'animate-spin' : ''}`} />
                  {migrating ? 'Normalizando...' : 'Normalizar Dados Agora'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Minha Posição */}
        {userPosition >= 0 && (
          <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-lg p-6 mb-8 border border-red-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Award className="h-12 w-12 text-red-300" />
                <div>
                  <p className="text-red-200 text-sm">Sua Posição</p>
                  <p className="text-3xl font-bold text-white">#{userPosition + 1}</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <p className="text-red-200 text-sm">Pontos Totais</p>
                  <p className="text-3xl font-bold text-white">{userData?.totalPointsEarned || userData?.pontos || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-200 text-sm">Disponível</p>
                  <p className="text-3xl font-bold text-white">{userData?.pontos || 0}</p>
                </div>
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
                const isAdmin = userData?.role === 'admin';
                
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
                            <span className="px-2 py-1 bg-red-600 rounded-full text-xs text-white">
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

                      <div className="flex gap-6">
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <TrendingUp className="h-4 w-4 text-yellow-500" />
                            <p className="text-xs text-gray-400">Total</p>
                          </div>
                          <p className="text-2xl font-bold text-white">{member.totalPointsEarned}</p>
                        </div>
                        
                        {isAdmin && (
                          <div className="text-right">
                            <div className="flex items-center gap-1 justify-end mb-1">
                              <ShoppingBag className="h-4 w-4 text-purple-500" />
                              <p className="text-xs text-gray-400">Gastos</p>
                            </div>
                            <p className="text-2xl font-bold text-purple-400">{member.pointsSpent}</p>
                          </div>
                        )}
                        
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end mb-1">
                            <Trophy className="h-4 w-4 text-green-500" />
                            <p className="text-xs text-gray-400">Disponível</p>
                          </div>
                          <p className="text-2xl font-bold text-green-400">{member.pontos}</p>
                        </div>
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
          <div className="space-y-2">
            <p className="text-sm text-gray-400 text-center">
              💡 Ganhe pontos marcando presença diariamente e participando das atividades do clã!
            </p>
            <p className="text-xs text-gray-500 text-center">
              <span className="text-yellow-500">Total</span>: Pontos acumulados desde sempre • 
              <span className="text-green-500"> Disponível</span>: Pontos para gastar na loja
              {userData?.role === 'admin' && <> • <span className="text-purple-500">Gastos</span>: Total gasto na loja</>}
            </p>
          </div>
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

