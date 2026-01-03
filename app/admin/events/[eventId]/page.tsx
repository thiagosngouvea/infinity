'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event, EventVote } from '@/types';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Clock, Award, Users as UsersIcon } from 'lucide-react';
import Link from 'next/link';

interface VoteWithUser extends EventVote {
  userEmail?: string;
}

function EventAttendanceContent() {
  const params = useParams();
  const router = useRouter();
  const { userData } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [votes, setVotes] = useState<VoteWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const eventId = params.eventId as string;

  useEffect(() => {
    if (userData?.role === 'admin') {
      loadEventData();
    }
  }, [eventId, userData]);

  const loadEventData = async () => {
    try {
      // Carregar evento
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (!eventDoc.exists()) {
        toast.error('Evento não encontrado');
        router.push('/events');
        return;
      }

      const eventData = {
        id: eventDoc.id,
        ...eventDoc.data(),
        date: eventDoc.data().date.toDate()
      } as Event;
      setEvent(eventData);

      // Carregar votos
      const votesQuery = query(
        collection(db, 'eventVotes'),
        where('eventId', '==', eventId)
      );
      const votesSnapshot = await getDocs(votesQuery);
      
      const votesList: VoteWithUser[] = [];
      for (const voteDoc of votesSnapshot.docs) {
        const voteData = voteDoc.data();
        
        // Buscar email do usuário
        const userDoc = await getDoc(doc(db, 'users', voteData.userId));
        const userEmail = userDoc.exists() ? userDoc.data().email : 'Email não encontrado';
        
        votesList.push({
          id: voteDoc.id,
          ...voteData,
          createdAt: voteData.createdAt.toDate(),
          attendanceConfirmedAt: voteData.attendanceConfirmedAt?.toDate(),
          userEmail
        } as VoteWithUser);
      }

      // Ordenar: quem confirmou presença primeiro
      votesList.sort((a, b) => {
        if (a.canParticipate && !b.canParticipate) return -1;
        if (!a.canParticipate && b.canParticipate) return 1;
        return 0;
      });

      setVotes(votesList);
    } catch (error) {
      console.error('Erro ao carregar dados do evento:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const confirmAttendance = async (voteId: string, userId: string, attended: boolean) => {
    if (!event || !userData) return;

    setProcessing(true);
    try {
      const vote = votes.find(v => v.id === voteId);
      if (!vote) return;

      // Se está marcando como presente E ainda não recebeu os pontos de comparecimento
      if (attended && !vote.attendancePointsAwarded && event.pointsForAttendance > 0) {
        // Atualizar pontos do usuário
        await updateDoc(doc(db, 'users', userId), {
          pontos: increment(event.pointsForAttendance),
          totalPointsEarned: increment(event.pointsForAttendance)
        });
      }

      // Atualizar voto
      await updateDoc(doc(db, 'eventVotes', voteId), {
        attended,
        attendanceConfirmedBy: userData.id,
        attendanceConfirmedAt: new Date(),
        attendancePointsAwarded: attended // Marca que recebeu pontos se compareceu
      });

      if (attended) {
        toast.success(`Presença confirmada! +${event.pointsForAttendance} pontos para ${vote.userName}`);
      } else {
        toast.success('Presença removida');
      }
      
      await loadEventData();
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      toast.error('Erro ao confirmar presença');
    } finally {
      setProcessing(false);
    }
  };

  const confirmAllAttendees = async () => {
    if (!event || !userData) return;

    const confirmedVotes = votes.filter(v => v.canParticipate && !v.attended);
    
    if (confirmedVotes.length === 0) {
      toast.error('Nenhum participante para confirmar');
      return;
    }

    const confirmed = confirm(
      `Confirmar presença de ${confirmedVotes.length} participante(s)?\n\n` +
      `Cada um receberá ${event.pointsForAttendance} pontos.\n` +
      `Total: ${confirmedVotes.length * event.pointsForAttendance} pontos distribuídos.`
    );

    if (!confirmed) return;

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      
      confirmedVotes.forEach(vote => {
        // Atualizar voto
        batch.update(doc(db, 'eventVotes', vote.id), {
          attended: true,
          attendanceConfirmedBy: userData.id,
          attendanceConfirmedAt: new Date(),
          attendancePointsAwarded: true
        });

        // Atualizar pontos do usuário
        if (!vote.attendancePointsAwarded && event.pointsForAttendance > 0) {
          batch.update(doc(db, 'users', vote.userId), {
            pontos: increment(event.pointsForAttendance),
            totalPointsEarned: increment(event.pointsForAttendance)
          });
        }
      });

      await batch.commit();
      toast.success(`${confirmedVotes.length} presenças confirmadas!`);
      await loadEventData();
    } catch (error) {
      console.error('Erro ao confirmar presenças:', error);
      toast.error('Erro ao confirmar presenças');
    } finally {
      setProcessing(false);
    }
  };

  if (userData?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Acesso negado</p>
          <Link href="/events" className="text-purple-500 hover:text-purple-400">
            Voltar aos Eventos
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

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-xl mb-4">Evento não encontrado</p>
          <Link href="/events" className="text-purple-500 hover:text-purple-400">
            Voltar aos Eventos
          </Link>
        </div>
      </div>
    );
  }

  const confirmedVotes = votes.filter(v => v.canParticipate);
  const declinedVotes = votes.filter(v => !v.canParticipate);
  const attendedCount = votes.filter(v => v.attended).length;

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/events" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar aos Eventos
            </Link>
            <h1 className="text-xl font-bold text-white">Gerenciar Presença</h1>
            <div className="w-40"></div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Informações do Evento */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-6 mb-8 border border-blue-700">
          <h2 className="text-2xl font-bold text-white mb-2">{event.title}</h2>
          <p className="text-blue-200 mb-3">{event.description}</p>
          <div className="flex flex-wrap gap-4 text-sm text-blue-200">
            <span>📅 {event.date.toLocaleDateString('pt-BR')} às {event.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>🏷️ {event.type}</span>
            <span>✅ {event.pointsForVoting} pts por confirmar</span>
            <span>🎖️ {event.pointsForAttendance} pts por comparecer</span>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <UsersIcon className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-gray-400 text-sm">Total de Votos</p>
                <p className="text-2xl font-bold text-white">{votes.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-gray-400 text-sm">Confirmaram</p>
                <p className="text-2xl font-bold text-white">{confirmedVotes.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <Award className="h-10 w-10 text-yellow-500" />
              <div>
                <p className="text-gray-400 text-sm">Compareceram</p>
                <p className="text-2xl font-bold text-white">{attendedCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-3">
              <XCircle className="h-10 w-10 text-red-500" />
              <div>
                <p className="text-gray-400 text-sm">Não Podem</p>
                <p className="text-2xl font-bold text-white">{declinedVotes.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ação em Massa */}
        {confirmedVotes.some(v => !v.attended) && (
          <div className="mb-6">
            <button
              onClick={confirmAllAttendees}
              disabled={processing}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition"
            >
              {processing ? 'Processando...' : `Confirmar Presença de Todos (${confirmedVotes.filter(v => !v.attended).length})`}
            </button>
          </div>
        )}

        {/* Lista de Participantes que Confirmaram */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-500" />
            Confirmaram Presença ({confirmedVotes.length})
          </h3>

          {confirmedVotes.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Ninguém confirmou presença ainda</p>
          ) : (
            <div className="space-y-2">
              {confirmedVotes.map((vote) => (
                <div 
                  key={vote.id}
                  className={`rounded-lg p-4 border-2 transition ${
                    vote.attended 
                      ? 'bg-green-900/20 border-green-600' 
                      : 'bg-gray-700 border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-white">{vote.userName}</p>
                        {vote.attended && (
                          <span className="px-2 py-1 bg-green-600 rounded-full text-xs text-white flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Compareceu
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">{vote.userEmail}</p>
                      {vote.attended && vote.attendanceConfirmedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Confirmado em {vote.attendanceConfirmedAt.toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!vote.attended ? (
                        <button
                          onClick={() => confirmAttendance(vote.id, vote.userId, true)}
                          disabled={processing}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg text-white text-sm transition font-semibold"
                        >
                          Confirmar Presença
                        </button>
                      ) : (
                        <button
                          onClick={() => confirmAttendance(vote.id, vote.userId, false)}
                          disabled={processing}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 rounded-lg text-white text-sm transition"
                        >
                          Remover Confirmação
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lista de Participantes que Não Podem */}
        {declinedVotes.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-500" />
              Não Podem Participar ({declinedVotes.length})
            </h3>

            <div className="space-y-2">
              {declinedVotes.map((vote) => (
                <div 
                  key={vote.id}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-white">{vote.userName}</p>
                      <p className="text-sm text-gray-400">{vote.userEmail}</p>
                      {vote.comment && (
                        <p className="text-sm text-gray-500 mt-1">"{vote.comment}"</p>
                      )}
                    </div>
                    <XCircle className="h-6 w-6 text-red-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventAttendancePage() {
  return (
    <ProtectedRoute requireAdmin>
      <EventAttendanceContent />
    </ProtectedRoute>
  );
}

