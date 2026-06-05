'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, getDocs, addDoc, updateDoc, arrayUnion, onSnapshot, deleteDoc } from 'firebase/firestore';
import { Raffle } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { Gift, Plus, ArrowLeft, Users, Trophy, Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

function RafflesContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [winnersCount, setWinnersCount] = useState(1);

  useEffect(() => {
    if (!clan?.slug) return;

    setLoading(true);
    const rafflesQuery = query(clanCol(clan.slug, COLS.raffles));

    const unsubscribe = onSnapshot(rafflesQuery, (snapshot) => {
      const list = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
          drawDate: data.drawDate ? data.drawDate.toDate() : undefined,
          drawStartedAt: data.drawStartedAt ? data.drawStartedAt.toDate() : undefined
        } as Raffle;
      });

      // Ordenar: abertos primeiro, depois sorteando, depois fechados, depois completos
      list.sort((a, b) => {
        const statusOrder = { open: 0, drawing: 1, closed: 2, completed: 3 };
        return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      });

      setRaffles(list);
      setLoading(false);
    }, (error) => {
      console.error('Erro ao carregar sorteios:', error);
      toast.error('Erro ao carregar sorteios');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clan?.slug]);

  const createRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      await addDoc(clanCol(clan.slug, COLS.raffles), {
        title,
        description,
        prize,
        winnersCount: Number(winnersCount) || 1,
        participants: [],
        status: 'open',
        createdBy: userData.id,
        createdAt: new Date()
      });

      toast.success('Sorteio criado com sucesso!');
      setShowCreateForm(false);
      setTitle('');
      setDescription('');
      setPrize('');
      setWinnersCount(1);
    } catch (error) {
      console.error('Erro ao criar sorteio:', error);
      toast.error('Erro ao criar sorteio');
    }
  };

  const participate = async (raffleId: string) => {
    if (!userData) return;

    try {
      await updateDoc(clanDoc(clan.slug, COLS.raffles, raffleId), {
        participants: arrayUnion(userData.id)
      });

      toast.success('Participação registrada!');
    } catch (error) {
      console.error('Erro ao participar:', error);
      toast.error('Erro ao participar do sorteio');
    }
  };

  const drawWinner = async (raffle: Raffle) => {
    if (!userData || raffle.participants.length === 0) return;

    const confirmed = await confirm({
      title: '🎁 Realizar Sorteio',
      message: `Realizar sorteio de "${raffle.title}"?\n\n🎲 ${raffle.participants.length} participante(s)\n👥 Ganhadores a sortear: ${raffle.winnersCount || 1}\n🏆 Prêmio: ${raffle.prize}\n\nOs vencedores serão escolhidos aleatoriamente e o sorteio iniciará ao vivo para todos online.`,
      confirmText: 'Sortear Agora',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmed) return;

    try {
      // Carregar nomes dos participantes
      const names: { [key: string]: string } = {};
      const membersSnap = await getDocs(clanCol(clan.slug, COLS.users));
      
      const COOL_FAKE_NAMES = [
        'ShadowHunter', 'Phoenix_PW', 'ViperX', 'Titan_WB', 'GhostRider', 'BlazeMage', 'StormSacer', 'GoldHunter', 'RogueWarrior', 'Rex_MG',
        'SniperArqueiro', 'ZeusGod', 'OdinKing', 'ThorHammer', 'LokiTrick', 'AresWar', 'HadesUnder', 'AnubisGuard', 'RaSun', 'NeonKnight',
        'SpecterGhost', 'WraithMistico', 'ReaperDeath', 'DoomSlayer', 'AlphaLeader', 'OmegaEnd', 'KratosGodOfWar', 'GokuSSJ', 'VegetaPrince', 'LinkHero',
        'ZeldaPrincess', 'MarioPlumber', 'LuigiGreen', 'SonicSpeed', 'TailsFox', 'KnucklesRed', 'DanteDevil', 'VergilBlade', 'NeroArm', 'LeonSpecial',
        'ChrisRedfield', 'ClaireRed', 'JillValentine', 'AdaWong', 'WeskerUro', 'NemesisSTARS', 'CloudStrife', 'SephirothAngel', 'TifaLockhart', 'AerithFlower'
      ];

      for (const userId of raffle.participants) {
        if (userId.startsWith('fake_')) {
          const index = parseInt(userId.split('_')[1]) || 0;
          names[userId] = COOL_FAKE_NAMES[index] || `FakePlayer_${index}`;
        } else {
          const userDoc = membersSnap.docs.find(d => d.id === userId);
          names[userId] = userDoc?.data()?.nick || 'Usuário';
        }
      }

      // Escolher os vencedores sem repetições
      const wantedWinnersCount = raffle.winnersCount || 1;
      const actualWinnersCount = Math.min(wantedWinnersCount, raffle.participants.length);

      const selectedWinnerIds: string[] = [];
      const selectedWinnerNames: string[] = [];
      const pool = [...raffle.participants];

      for (let i = 0; i < actualWinnersCount; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const wId = pool[idx];
        const wName = names[wId] || 'Usuário';
        selectedWinnerIds.push(wId);
        selectedWinnerNames.push(wName);
        pool.splice(idx, 1);
      }

      // Atualizar no Firestore para disparar a roleta em tempo real
      await updateDoc(clanDoc(clan.slug, COLS.raffles, raffle.id), {
        status: 'drawing',
        winnerId: selectedWinnerIds[0] || '',
        winnerName: selectedWinnerNames[0] || 'Usuário',
        winnerIds: selectedWinnerIds,
        winnerNames: selectedWinnerNames,
        drawnBy: userData.id,
        drawStartedAt: new Date()
      });

      toast.success('Sorteio ao vivo iniciado!');
    } catch (error) {
      console.error('Erro ao iniciar sorteio:', error);
      toast.error('Erro ao iniciar sorteio');
    }
  };

  const resetRaffle = async (raffle: Raffle) => {
    const confirmed = await confirm({
      title: '🔄 Resetar Sorteio',
      message: `Tem certeza que deseja cancelar e resetar o sorteio "${raffle.title}" de volta para aberto?`,
      confirmText: 'Sim, Resetar',
      cancelText: 'Não',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await updateDoc(clanDoc(clan.slug, COLS.raffles, raffle.id), {
        status: 'open',
        winnerId: null,
        winnerName: null,
        winnerIds: null,
        winnerNames: null,
        drawnBy: null,
        drawStartedAt: null
      });
      toast.success('Sorteio resetado com sucesso!');
    } catch (error) {
      console.error('Erro ao resetar sorteio:', error);
      toast.error('Erro ao resetar sorteio');
    }
  };

  const deleteRaffle = async (raffle: Raffle) => {
    const confirmed = await confirm({
      title: '🗑️ Excluir Sorteio',
      message: `Tem certeza que deseja excluir o sorteio "${raffle.title}" permanentemente? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await deleteDoc(clanDoc(clan.slug, COLS.raffles, raffle.id));
      toast.success('Sorteio excluído com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir sorteio:', error);
      toast.error('Erro ao excluir sorteio');
    }
  };

  const redrawRaffle = async (raffle: Raffle) => {
    if (!userData || raffle.participants.length === 0) return;

    const previousWinnersText = raffle.winnerNames && raffle.winnerNames.length > 0
      ? raffle.winnerNames.join(', ')
      : raffle.winnerName || 'Nenhum';

    const confirmed = await confirm({
      title: '🔄 Refazer Sorteio',
      message: `Tem certeza que deseja refazer o sorteio de "${raffle.title}"? \n\nOs vencedores anteriores (${previousWinnersText}) serão substituídos por novos sorteados ao vivo para todos os membros online.`,
      confirmText: 'Refazer Agora',
      cancelText: 'Cancelar',
      type: 'warning'
    });

    if (!confirmed) return;

    try {
      // Carregar nomes dos participantes
      const names: { [key: string]: string } = {};
      const membersSnap = await getDocs(clanCol(clan.slug, COLS.users));

      const COOL_FAKE_NAMES = [
        'ShadowHunter', 'Phoenix_PW', 'ViperX', 'Titan_WB', 'GhostRider', 'BlazeMage', 'StormSacer', 'GoldHunter', 'RogueWarrior', 'Rex_MG',
        'SniperArqueiro', 'ZeusGod', 'OdinKing', 'ThorHammer', 'LokiTrick', 'AresWar', 'HadesUnder', 'AnubisGuard', 'RaSun', 'NeonKnight',
        'SpecterGhost', 'WraithMistico', 'ReaperDeath', 'DoomSlayer', 'AlphaLeader', 'OmegaEnd', 'KratosGodOfWar', 'GokuSSJ', 'VegetaPrince', 'LinkHero',
        'ZeldaPrincess', 'MarioPlumber', 'LuigiGreen', 'SonicSpeed', 'TailsFox', 'KnucklesRed', 'DanteDevil', 'VergilBlade', 'NeroArm', 'LeonSpecial',
        'ChrisRedfield', 'ClaireRed', 'JillValentine', 'AdaWong', 'WeskerUro', 'NemesisSTARS', 'CloudStrife', 'SephirothAngel', 'TifaLockhart', 'AerithFlower'
      ];

      for (const userId of raffle.participants) {
        if (userId.startsWith('fake_')) {
          const index = parseInt(userId.split('_')[1]) || 0;
          names[userId] = COOL_FAKE_NAMES[index] || `FakePlayer_${index}`;
        } else {
          const userDoc = membersSnap.docs.find(d => d.id === userId);
          names[userId] = userDoc?.data()?.nick || 'Usuário';
        }
      }

      // Escolher os vencedores sem repetições
      const wantedWinnersCount = raffle.winnersCount || 1;
      const actualWinnersCount = Math.min(wantedWinnersCount, raffle.participants.length);

      const selectedWinnerIds: string[] = [];
      const selectedWinnerNames: string[] = [];
      const pool = [...raffle.participants];

      for (let i = 0; i < actualWinnersCount; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        const wId = pool[idx];
        const wName = names[wId] || 'Usuário';
        selectedWinnerIds.push(wId);
        selectedWinnerNames.push(wName);
        pool.splice(idx, 1);
      }

      // Atualizar o Firestore para status 'drawing' com os novos vencedores
      await updateDoc(clanDoc(clan.slug, COLS.raffles, raffle.id), {
        status: 'drawing',
        winnerId: selectedWinnerIds[0] || '',
        winnerName: selectedWinnerNames[0] || 'Usuário',
        winnerIds: selectedWinnerIds,
        winnerNames: selectedWinnerNames,
        drawnBy: userData.id,
        drawStartedAt: new Date()
      });

      toast.success('Sorteio reiniciado ao vivo!');
    } catch (error) {
      console.error('Erro ao refazer sorteio:', error);
      toast.error('Erro ao refazer sorteio');
    }
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
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Sorteios</h1>
            {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition"
              >
                <Plus className="h-4 w-4" />
                Criar Sorteio
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Formulário de Criação */}
        {showCreateForm && (userData?.role === 'admin' || userData?.role === 'super_admin') && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Criar Novo Sorteio</h2>
            <form onSubmit={createRaffle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: Sorteio de Item Raro"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Descreva o sorteio..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Prêmio</label>
                <input
                  type="text"
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: Espada Lendária +12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade de Ganhadores</label>
                <input
                  type="number"
                  value={winnersCount}
                  onChange={(e) => setWinnersCount(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                  min={1}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: 1"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition"
                >
                  Criar Sorteio
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Sorteios */}
        {raffles.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <Gift className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum sorteio disponível no momento</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {raffles.map((raffle) => {
              const isParticipating = raffle.participants.includes(userData?.id || '');
              const isCompleted = raffle.status === 'completed';
              const isWinner = raffle.winnerIds?.includes(userData?.id || '') || raffle.winnerId === userData?.id;

              return (
                <div 
                  key={raffle.id} 
                  className={`bg-gray-800 rounded-lg p-6 border ${
                    isCompleted 
                      ? 'border-gray-600' 
                      : 'border-gray-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{raffle.title}</h3>
                        {isCompleted && (
                          <span className="px-2 py-1 bg-green-600 rounded-full text-xs text-white">
                            Finalizado
                          </span>
                        )}
                        {raffle.status === 'drawing' && (
                          <span className="px-2 py-1 bg-yellow-600 rounded-full text-xs text-white animate-pulse">
                            ⚡ Sorteando ao Vivo
                          </span>
                        )}
                        {raffle.status === 'open' && (
                          <span className="px-2 py-1 bg-blue-600 rounded-full text-xs text-white">
                            Aberto
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 mb-2">{raffle.description}</p>
                      <div className="flex items-center gap-2 text-yellow-400">
                        <Trophy className="h-5 w-5" />
                        <span className="font-semibold">{raffle.prize}</span>
                      </div>
                      <div className="text-xs text-gray-450 mt-2 flex items-center gap-1.5">
                        <span className="text-gray-450">Ganhadores configurados:</span>
                        <span className="text-gray-200 font-semibold">{raffle.winnersCount || 1}</span>
                      </div>
                    </div>
                    {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                      <button
                        onClick={() => deleteRaffle(raffle)}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-700/50 transition flex-shrink-0"
                        title="Excluir Sorteio"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Users className="h-5 w-5" />
                    <span>{raffle.participants.length} participante(s)</span>
                  </div>

                  {isCompleted ? (
                    <div className="space-y-2">
                      <div className={`rounded-lg p-4 ${
                        isWinner 
                          ? 'bg-gradient-to-r from-yellow-600 to-yellow-700' 
                          : 'bg-gray-700'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-6 w-6 text-white flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold">
                              {isWinner ? '🎉 Você Ganhou!' : 'Sorteio Finalizado'}
                            </p>
                            <div className="mt-1.5 text-sm text-gray-200">
                              {raffle.winnerNames && raffle.winnerNames.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <span className="text-gray-300 font-medium text-xs">Ganhadores sorteados:</span>
                                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                                    {raffle.winnerNames.map((wName, idx) => {
                                      const wId = raffle.winnerIds?.[idx];
                                      const isThisUserWinner = wId === userData?.id;
                                      return (
                                        <span 
                                          key={idx} 
                                          className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                                            isThisUserWinner 
                                              ? 'bg-yellow-500 text-gray-950 font-bold border border-yellow-300 shadow-sm' 
                                              : 'bg-gray-800 text-gray-305'
                                          }`}
                                        >
                                          {wName} {isThisUserWinner && ' (Você!)'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : (
                                <span>Vencedor: {raffle.winnerName}</span>
                              )}
                            </div>
                            {raffle.drawDate && (
                              <p className="text-xs text-gray-400 mt-2">
                                Sorteado em {raffle.drawDate.toLocaleDateString('pt-BR')} às {raffle.drawDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      {(userData?.role === 'admin' || userData?.role === 'super_admin') && raffle.participants.length > 0 && (
                        <button
                          onClick={() => redrawRaffle(raffle)}
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <Trophy className="h-5 w-5" />
                          Refazer Sorteio
                        </button>
                      )}
                    </div>
                  ) : raffle.status === 'drawing' ? (
                    <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-lg p-4 text-center">
                      <p className="text-yellow-400 font-semibold animate-pulse mb-2">
                        🎲 O sorteio está acontecendo ao vivo neste momento!
                      </p>
                      {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                        <button
                          onClick={() => resetRaffle(raffle)}
                          className="mt-2 w-full bg-red-900/50 hover:bg-red-900 text-red-200 text-sm font-semibold py-2 rounded-lg transition"
                        >
                          Cancelar / Resetar Sorteio
                        </button>
                      )}
                    </div>
                  ) : raffle.status === 'open' ? (
                    <>
                      {isParticipating ? (
                        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 text-center">
                          <p className="text-green-400 font-semibold">
                            ✓ Você está participando deste sorteio!
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => participate(raffle.id)}
                          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <Gift className="h-5 w-5" />
                          Participar do Sorteio
                        </button>
                      )}
                      
                      {(userData?.role === 'admin' || userData?.role === 'super_admin') && raffle.participants.length > 0 && (
                        <button
                          onClick={() => drawWinner(raffle)}
                          className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <Trophy className="h-5 w-5" />
                          Realizar Sorteio
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="bg-gray-700 rounded-lg p-4 text-center">
                      <Clock className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-400">Sorteio encerrado</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <ConfirmDialog />
    </div>
  );
}

export default function RafflesPage() {
  return (
    <ProtectedRoute>
      <RafflesContent />
    </ProtectedRoute>
  );
}

