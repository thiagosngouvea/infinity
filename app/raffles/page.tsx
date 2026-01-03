'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, getDocs, addDoc, updateDoc, doc, arrayUnion, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Raffle } from '@/types';
import toast from 'react-hot-toast';
import { Gift, Plus, ArrowLeft, Users, Trophy, Clock } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import RaffleWheel from '@/components/RaffleWheel';

function RafflesContent() {
  const { userData } = useAuth();
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');

  // Wheel state
  const [showWheel, setShowWheel] = useState(false);
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null);
  const [participantNames, setParticipantNames] = useState<{ [key: string]: string }>({});
  const [isProcessingResult, setIsProcessingResult] = useState(false);

  useEffect(() => {
    loadRaffles();
  }, []);

  const loadRaffles = async () => {
    try {
      const rafflesQuery = query(collection(db, 'raffles'));
      const snapshot = await getDocs(rafflesQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        drawDate: doc.data().drawDate ? doc.data().drawDate.toDate() : undefined
      } as Raffle));
      
      // Ordenar: abertos primeiro, depois fechados, depois completos
      list.sort((a, b) => {
        const statusOrder = { open: 0, closed: 1, completed: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
      
      setRaffles(list);
    } catch (error) {
      console.error('Erro ao carregar sorteios:', error);
      toast.error('Erro ao carregar sorteios');
    } finally {
      setLoading(false);
    }
  };

  const createRaffle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      await addDoc(collection(db, 'raffles'), {
        title,
        description,
        prize,
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
      loadRaffles();
    } catch (error) {
      console.error('Erro ao criar sorteio:', error);
      toast.error('Erro ao criar sorteio');
    }
  };

  const participate = async (raffleId: string) => {
    if (!userData) return;

    try {
      await updateDoc(doc(db, 'raffles', raffleId), {
        participants: arrayUnion(userData.id)
      });

      toast.success('Participação registrada!');
      loadRaffles();
    } catch (error) {
      console.error('Erro ao participar:', error);
      toast.error('Erro ao participar do sorteio');
    }
  };

  const drawWinner = async (raffle: Raffle) => {
    if (!userData || raffle.participants.length === 0) return;

    const confirmed = await confirm({
      title: '🎁 Realizar Sorteio',
      message: `Realizar sorteio de "${raffle.title}"?\n\n🎲 ${raffle.participants.length} participante(s)\n🏆 Prêmio: ${raffle.prize}\n\nUm vencedor será escolhido aleatoriamente e receberá uma notificação.`,
      confirmText: 'Sortear Agora',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmed) return;

    try {
      // Resetar estado de processamento
      setIsProcessingResult(false);
      
      // Carregar nomes dos participantes
      const names: { [key: string]: string } = {};
      for (const userId of raffle.participants) {
        const usersQuery = query(collection(db, 'users'), where('__name__', '==', userId));
        const usersSnapshot = await getDocs(usersQuery);
        const userDataDoc = usersSnapshot.docs[0]?.data();
        names[userId] = userDataDoc?.nick || 'Usuário';
      }
      
      setParticipantNames(names);
      setSelectedRaffle(raffle);
      setShowWheel(true);
    } catch (error) {
      console.error('Erro ao preparar sorteio:', error);
      toast.error('Erro ao preparar sorteio');
    }
  };

  const handleWheelComplete = async (winnerId: string) => {
    // Proteção contra múltiplas execuções
    if (isProcessingResult) {
      console.log('⚠️ Já está processando resultado, ignorando chamada duplicada');
      return;
    }
    
    if (!selectedRaffle) {
      console.log('⚠️ Nenhum sorteio selecionado');
      return;
    }

    console.log('🎰 Processando vencedor:', winnerId);
    setIsProcessingResult(true);

    try {
      const winnerName = participantNames[winnerId];

      // Verificar se o sorteio já não foi completado (proteção contra duplicação)
      const currentRaffle = raffles.find(r => r.id === selectedRaffle.id);
      if (currentRaffle?.status === 'completed') {
        console.log('⚠️ Sorteio já foi completado, ignorando duplicação');
        setShowWheel(false);
        setSelectedRaffle(null);
        setIsProcessingResult(false);
        return;
      }

      console.log('💾 Salvando resultado do sorteio...');
      
      // Atualizar sorteio
      await updateDoc(doc(db, 'raffles', selectedRaffle.id), {
        winnerId,
        winnerName,
        status: 'completed',
        drawDate: new Date()
      });

      console.log('📨 Enviando notificação para o vencedor:', winnerId);
      
      // Criar notificação APENAS para o vencedor
      await addDoc(collection(db, 'notifications'), {
        userId: winnerId,
        type: 'raffle_win',
        title: 'Você Ganhou!',
        message: `Parabéns! Você ganhou o sorteio: ${selectedRaffle.title} - ${selectedRaffle.prize}`,
        read: false,
        createdAt: new Date()
      });

      console.log('✅ Sorteio finalizado com sucesso!');
      toast.success(`Sorteio realizado! Vencedor: ${winnerName}`);
      
      // Fechar modal e recarregar
      setTimeout(() => {
        setShowWheel(false);
        setSelectedRaffle(null);
        setIsProcessingResult(false);
        loadRaffles();
      }, 1000);
    } catch (error) {
      console.error('❌ Erro ao salvar resultado:', error);
      toast.error('Erro ao salvar resultado do sorteio');
      setIsProcessingResult(false);
    }
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
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Sorteios</h1>
            {userData?.role === 'admin' && (
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
        {showCreateForm && userData?.role === 'admin' && (
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
              const isWinner = raffle.winnerId === userData?.id;

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
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 mb-4">
                    <Users className="h-5 w-5" />
                    <span>{raffle.participants.length} participante(s)</span>
                  </div>

                  {isCompleted ? (
                    <div className={`rounded-lg p-4 ${
                      isWinner 
                        ? 'bg-gradient-to-r from-yellow-600 to-yellow-700' 
                        : 'bg-gray-700'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-white" />
                        <div>
                          <p className="text-white font-semibold">
                            {isWinner ? '🎉 Você Ganhou!' : `Vencedor: ${raffle.winnerName}`}
                          </p>
                          {raffle.drawDate && (
                            <p className="text-sm text-gray-300">
                              Sorteado em {raffle.drawDate.toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
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
                      
                      {userData?.role === 'admin' && raffle.participants.length > 0 && (
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
      
      {/* Modal de Roleta */}
      {showWheel && selectedRaffle && (
        <RaffleWheel
          isOpen={showWheel}
          participants={selectedRaffle.participants}
          participantNames={participantNames}
          onComplete={handleWheelComplete}
          prize={selectedRaffle.prize}
        />
      )}
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

