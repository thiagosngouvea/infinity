'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, where, getDocs, getDoc, updateDoc, increment, writeBatch, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event, EventVote, User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Award, Users as UsersIcon, UserPlus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';

interface VoteWithUser extends EventVote {
  userEmail?: string;
}

// ─── Modal de Adição Manual ───────────────────────────────────────────────────
interface AddManualModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (member: User) => Promise<void>;
  allMembers: User[];
  votedUserIds: Set<string>;
  processing: boolean;
}

function AddManualModal({ open, onClose, onAdd, allMembers, votedUserIds, processing }: AddManualModalProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMembers.filter(m => {
      if (votedUserIds.has(m.id)) return false; // já tem voto
      if (!q) return true;
      return m.nick?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    });
  }, [search, allMembers, votedUserIds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-400" />
            <h2 className="text-lg font-bold text-white">Adicionar Presença Manual</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="manual-attendance-search"
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nick ou email..."
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition text-sm"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Membros que já têm registro neste evento não aparecem aqui.
          </p>
        </div>

        {/* Member List */}
        <div className="overflow-y-auto max-h-72 p-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              {search ? 'Nenhum membro encontrado' : 'Todos os membros já têm registro neste evento'}
            </p>
          ) : (
            filtered.map(member => (
              <button
                key={member.id}
                onClick={() => onAdd(member)}
                disabled={processing}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-left group"
              >
                <div>
                  <p className="text-white font-semibold text-sm">{member.nick}</p>
                  <p className="text-gray-400 text-xs">{member.email}</p>
                </div>
                <span className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition font-semibold">
                  + Adicionar
                </span>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-white transition">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
function EventAttendanceContent() {
  const params = useParams();
  const router = useRouter();
  const { userData } = useAuth();
  const { clan } = useClan();
  const { confirm, ConfirmDialog } = useConfirm();

  const [event, setEvent] = useState<Event | null>(null);
  const [votes, setVotes] = useState<VoteWithUser[]>([]);
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const eventId = params.eventId as string;

  // IDs dos membros que já têm algum registro de voto
  const votedUserIds = useMemo(() => new Set(votes.map(v => v.userId)), [votes]);

  useEffect(() => {
    if (userData?.role === 'admin' || userData?.role === 'super_admin') {
      loadEventData();
      loadAllMembers();
    }
  }, [eventId, userData]);

  const loadAllMembers = async () => {
    try {
      const snap = await getDocs(
        query(clanCol(clan.slug, COLS.users), where('role', 'in', ['member', 'admin', 'super_admin']))
      );
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      list.sort((a, b) => a.nick.localeCompare(b.nick));
      setAllMembers(list);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    }
  };

  const loadEventData = async () => {
    try {
      const eventDoc = await getDoc(clanDoc(clan.slug, COLS.events, eventId));
      if (!eventDoc.exists()) {
        toast.error('Evento não encontrado');
        router.push('/events');
        return;
      }

      const eventData = {
        id: eventDoc.id,
        ...eventDoc.data(),
        date: eventDoc.data().date.toDate(),
        pointsForVoting: eventDoc.data().pointsForVoting ?? 5,
        pointsForAttendance: eventDoc.data().pointsForAttendance ?? 20
      } as Event;
      setEvent(eventData);

      const votesQuery = query(
        clanCol(clan.slug, COLS.eventVotes),
        where('eventId', '==', eventId)
      );
      const votesSnapshot = await getDocs(votesQuery);

      const votesList: VoteWithUser[] = [];
      for (const voteDoc of votesSnapshot.docs) {
        const voteData = voteDoc.data();
        const userDoc = await getDoc(clanDoc(clan.slug, COLS.users, voteData.userId));
        const userEmail = userDoc.exists() ? userDoc.data().email : 'Email não encontrado';

        votesList.push({
          id: voteDoc.id,
          ...voteData,
          createdAt: voteData.createdAt.toDate(),
          attendanceConfirmedAt: voteData.attendanceConfirmedAt?.toDate(),
          userEmail
        } as VoteWithUser);
      }

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

  // ─── Adicionar presença manual ───────────────────────────────────────────
  const addManualAttendance = async (member: User) => {
    if (!event || !userData) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      const now = new Date();

      // Cria o EventVote marcando direto como compareceu
      const voteRef = await addDoc(clanCol(clan.slug, COLS.eventVotes), {
        eventId,
        userId: member.id,
        userName: member.nick,
        canParticipate: true,
        attended: true,
        attendanceConfirmedBy: userData.id,
        attendanceConfirmedAt: now,
        attendancePointsAwarded: event.pointsForAttendance > 0,
        votingPointsAwarded: false, // não votou, não ganha pts de voto
        createdAt: now,
        manualEntry: true, // marcador de entrada manual
      });

      // Dá os pontos de comparecimento
      if (event.pointsForAttendance > 0) {
        batch.update(clanDoc(clan.slug, COLS.users, member.id), {
          pontos: increment(event.pointsForAttendance),
          totalPointsEarned: increment(event.pointsForAttendance),
        });
      }

      await batch.commit();

      toast.success(`✅ ${member.nick} adicionado! +${event.pointsForAttendance} pontos`);
      setShowAddModal(false);
      await loadEventData();
    } catch (error) {
      console.error('Erro ao adicionar presença manual:', error);
      toast.error('Erro ao adicionar presença');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Confirmar / remover presença ────────────────────────────────────────
  const confirmAttendance = async (voteId: string, userId: string, attended: boolean) => {
    if (!event || !userData) return;

    setProcessing(true);
    try {
      const vote = votes.find(v => v.id === voteId);
      if (!vote) return;

      if (attended && !vote.attendancePointsAwarded && event.pointsForAttendance > 0) {
        await updateDoc(clanDoc(clan.slug, COLS.users, userId), {
          pontos: increment(event.pointsForAttendance),
          totalPointsEarned: increment(event.pointsForAttendance)
        });
      } else if (!attended && vote.attendancePointsAwarded && event.pointsForAttendance > 0) {
        await updateDoc(clanDoc(clan.slug, COLS.users, userId), {
          pontos: increment(-event.pointsForAttendance),
          totalPointsEarned: increment(-event.pointsForAttendance)
        });
      }

      await updateDoc(clanDoc(clan.slug, COLS.eventVotes, voteId), {
        attended,
        attendanceConfirmedBy: userData.id,
        attendanceConfirmedAt: new Date(),
        attendancePointsAwarded: attended
      });

      if (attended) {
        toast.success(`Presença confirmada! +${event.pointsForAttendance} pontos para ${vote.userName}`);
      } else {
        toast.success(`Presença removida! -${event.pointsForAttendance} pontos de ${vote.userName}`);
      }

      await loadEventData();
    } catch (error) {
      console.error('Erro ao confirmar presença:', error);
      toast.error('Erro ao confirmar presença');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Confirmar todos ─────────────────────────────────────────────────────
  const confirmAllAttendees = async () => {
    if (!event || !userData) return;

    const confirmedVotes = votes.filter(v => v.canParticipate && !v.attended);

    if (confirmedVotes.length === 0) {
      toast.error('Nenhum participante para confirmar');
      return;
    }

    const confirmed = await confirm({
      title: '✅ Confirmar Presença em Massa',
      message: `Confirmar presença de ${confirmedVotes.length} participante(s)?\n\n🎖️ Cada um receberá ${event.pointsForAttendance} pontos.\n💰 Total: ${confirmedVotes.length * event.pointsForAttendance} pontos distribuídos.\n\nEsta ação irá atualizar todos os participantes que confirmaram presença e ainda não foram marcados como presentes.`,
      confirmText: 'Confirmar Todos',
      cancelText: 'Cancelar',
      type: 'success'
    });

    if (!confirmed) return;

    setProcessing(true);
    try {
      const batch = writeBatch(db);

      confirmedVotes.forEach(vote => {
        batch.update(clanDoc(clan.slug, COLS.eventVotes, vote.id), {
          attended: true,
          attendanceConfirmedBy: userData.id,
          attendanceConfirmedAt: new Date(),
          attendancePointsAwarded: true
        });

        if (!vote.attendancePointsAwarded && event.pointsForAttendance > 0) {
          batch.update(clanDoc(clan.slug, COLS.users, vote.userId), {
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

  // ─── Guards ──────────────────────────────────────────────────────────────
  if (userData?.role !== 'admin' && userData?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-xl mb-4">Acesso negado</p>
          <Link href="/events" className="text-red-500 hover:text-red-400">
            Voltar aos Eventos
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-xl mb-4">Evento não encontrado</p>
          <Link href="/events" className="text-red-500 hover:text-red-400">
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
            <button
              id="btn-add-manual-attendance"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Presença
            </button>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-bold text-white">{vote.userName}</p>
                        {vote.attended && (
                          <span className="px-2 py-1 bg-green-600 rounded-full text-xs text-white flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Compareceu
                          </span>
                        )}
                        {(vote as any).manualEntry && (
                          <span className="px-2 py-1 bg-blue-700 rounded-full text-xs text-white flex items-center gap-1">
                            <UserPlus className="h-3 w-3" />
                            Manual
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

      {/* Modal de adição manual */}
      <AddManualModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addManualAttendance}
        allMembers={allMembers}
        votedUserIds={votedUserIds}
        processing={processing}
      />

      <ConfirmDialog />
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
