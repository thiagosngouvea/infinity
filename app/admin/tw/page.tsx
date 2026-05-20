'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import {
  query,
  getDocs,
  addDoc,
  getDoc,
  updateDoc,
  increment,
  writeBatch,
  orderBy,
  where,
} from 'firebase/firestore';
import { TWSession, TWVote, TWRosterEntry, User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Sword,
  Plus,
  Users,
  ChevronRight,
  CalendarDays,
  Clock,
  Check,
  X,
  Archive,
  Coins,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

function AdminTWContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const { confirm, ConfirmDialog } = useConfirm();

  const [sessions, setSessions] = useState<TWSession[]>([]);
  const [closedSessions, setClosedSessions] = useState<TWSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'closed'>('active');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [pointsForVoting, setPointsForVoting] = useState(5);
  const [pointsForRoster, setPointsForRoster] = useState(20);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const [activeSnap, closedSnap] = await Promise.all([
        getDocs(query(
          clanCol(clan.slug, COLS.twSessions),
          where('closed', '==', false),
          orderBy('date', 'desc')
        )),
        getDocs(query(
          clanCol(clan.slug, COLS.twSessions),
          where('closed', '==', true),
          orderBy('date', 'desc')
        )),
      ]);

      setSessions(activeSnap.docs.map(d => ({
        id: d.id, ...d.data(), date: d.data().date.toDate(), createdAt: d.data().createdAt.toDate(),
      } as TWSession)));
      setClosedSessions(closedSnap.docs.map(d => ({
        id: d.id, ...d.data(), date: d.data().date.toDate(), createdAt: d.data().createdAt.toDate(),
      } as TWSession)));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar sessões TW');
    } finally {
      setLoading(false);
    }
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    setSubmitting(true);
    try {
      const sessionDate = new Date(`${date}T${time}`);
      const docRef = await addDoc(clanCol(clan.slug, COLS.twSessions), {
        title,
        description,
        date: sessionDate,
        active: true,
        closed: false,
        pointsForVoting: Number(pointsForVoting),
        pointsForRoster: Number(pointsForRoster),
        createdBy: userData.id,
        createdAt: new Date(),
      });

      try {
        const membersSnap = await getDocs(query(
          clanCol(clan.slug, COLS.users),
          where('role', 'in', ['member', 'admin', 'super_admin'])
        ));
        const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

        const when = sessionDate.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const batchSize = 450;
        let batch = writeBatch(db);
        let count = 0;

        for (const m of members) {
          if (count > 0 && count % batchSize === 0) {
            await batch.commit();
            batch = writeBatch(db);
          }

          const notifId = crypto.randomUUID();
          batch.set(clanDoc(clan.slug, COLS.notifications, notifId), {
            userId: m.id,
            type: 'tw',
            title: 'Nova TW criada',
            message: `${title} — ${when}`,
            link: `/tw#${docRef.id}`,
            read: false,
            createdAt: new Date(),
          });
          count += 1;
        }

        if (count > 0) await batch.commit();
      } catch (error) {
        console.error('Erro ao criar notificações da TW:', error);
      }

      toast.success('TW criada com sucesso!');
      setShowForm(false);
      resetForm();
      loadSessions();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar TW');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setPointsForVoting(5);
    setPointsForRoster(20);
  };

  const toggleActive = async (session: TWSession) => {
    try {
      await updateDoc(clanDoc(clan.slug, COLS.twSessions, session.id), {
        active: !session.active,
      });
      toast.success(session.active ? 'TW desativada' : 'TW ativada');
      loadSessions();
    } catch (err) {
      toast.error('Erro ao atualizar TW');
    }
  };

  const closeSession = async (session: TWSession) => {
    const confirmed = await confirm({
      title: 'Encerrar TW',
      message: `Tem certeza que deseja encerrar a TW "${session.title}"?\n\nEla será movida para o histórico e os jogadores não poderão mais votar.`,
      confirmText: 'Encerrar',
      cancelText: 'Cancelar',
      type: 'warning',
    });
    if (!confirmed) return;
    try {
      await updateDoc(clanDoc(clan.slug, COLS.twSessions, session.id), {
        active: false,
        closed: true,
      });
      toast.success('TW encerrada e movida para o histórico');
      loadSessions();
    } catch (err) {
      toast.error('Erro ao encerrar TW');
    }
  };

  const deleteSession = async (session: TWSession) => {
    const confirmed = await confirm({
      title: '⚠️ EXCLUIR TW',
      message:
        `ATENÇÃO: você está prestes a excluir a TW "${session.title}".\n\n` +
        `Isso também irá:\n` +
        `• Remover votos e roster desta TW\n` +
        `• Remover os pontos concedidos por esta TW (se existirem)\n\n` +
        `Esta ação NÃO pode ser desfeita.\n\n` +
        `Para confirmar, digite EXCLUIR.`,
      confirmText: 'Sim, Excluir',
      cancelText: 'Cancelar',
      type: 'danger',
      requiresTextConfirmation: true,
      confirmationText: 'EXCLUIR',
    });
    if (!confirmed) return;

    setDeletingId(session.id);
    try {
      const sessionDoc = await getDoc(clanDoc(clan.slug, COLS.twSessions, session.id));
      if (!sessionDoc.exists()) {
        toast.error('TW não encontrada');
        return;
      }

      const sessionData = {
        id: sessionDoc.id,
        ...sessionDoc.data(),
      } as TWSession;
      const pointsForVoting = Number(sessionData.pointsForVoting ?? 0);
      const pointsForRoster = Number(sessionData.pointsForRoster ?? 0);

      const [votesSnap, rosterSnap] = await Promise.all([
        getDocs(query(clanCol(clan.slug, COLS.twVotes), where('twId', '==', session.id))),
        getDocs(query(clanCol(clan.slug, COLS.twRoster), where('twId', '==', session.id))),
      ]);

      const votes = votesSnap.docs.map(d => ({ id: d.id, ...d.data() } as TWVote));
      const roster = rosterSnap.docs.map(d => ({ id: d.id, ...d.data() } as TWRosterEntry));

      const pointsDeltaByUser = new Map<string, number>();

      if (pointsForVoting > 0) {
        votes.forEach(v => {
          if (v.votingPointsAwarded) {
            pointsDeltaByUser.set(v.userId, (pointsDeltaByUser.get(v.userId) ?? 0) - pointsForVoting);
          }
        });
      }

      if (pointsForRoster > 0) {
        roster.forEach(r => {
          if (r.rosterPointsAwarded) {
            pointsDeltaByUser.set(r.userId, (pointsDeltaByUser.get(r.userId) ?? 0) - pointsForRoster);
          }
        });
      }

      if (pointsDeltaByUser.size > 0) {
        const affectedIds = Array.from(pointsDeltaByUser.keys());
        const affectedDocs = await Promise.all(
          affectedIds.map(async (userId) => {
            const snap = await getDoc(clanDoc(clan.slug, COLS.users, userId));
            return { userId, snap };
          })
        );

        const invalid: string[] = [];
        affectedDocs.forEach(({ userId, snap }) => {
          if (!snap.exists()) return;
          const data = snap.data() as User;
          const delta = pointsDeltaByUser.get(userId) ?? 0;
          const afterPoints = Number(data.pontos ?? 0) + delta;
          const afterTotal = Number(data.totalPointsEarned ?? 0) + delta;
          if (afterPoints < 0 || afterTotal < 0) {
            invalid.push(data.nick || userId);
          }
        });

        if (invalid.length > 0) {
          toast.error(
            `Não foi possível excluir: ${invalid.length} jogador(es) ficariam com saldo negativo. Ajuste os pontos antes.`
          );
          return;
        }
      }

      const ops: Array<() => void> = [];

      pointsDeltaByUser.forEach((delta, userId) => {
        if (delta === 0) return;
        ops.push(() => {
          const userRef = clanDoc(clan.slug, COLS.users, userId);
          batch.update(userRef, {
            pontos: increment(delta),
            totalPointsEarned: increment(delta),
          });
        });
      });

      votes.forEach(v => {
        ops.push(() => batch.delete(clanDoc(clan.slug, COLS.twVotes, v.id)));
      });

      roster.forEach(r => {
        ops.push(() => batch.delete(clanDoc(clan.slug, COLS.twRoster, r.id)));
      });

      ops.push(() => batch.delete(clanDoc(clan.slug, COLS.twSessions, session.id)));

      let batch = writeBatch(db);
      let count = 0;
      const commit = async () => {
        await batch.commit();
        batch = writeBatch(db);
        count = 0;
      };

      for (const op of ops) {
        if (count >= 450) await commit();
        op();
        count += 1;
      }
      if (count > 0) await commit();

      toast.success('TW excluída com sucesso');
      await loadSessions();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir TW');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingLogo size={128} fullscreen={false} />
      </div>
    );
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatTime = (d: Date) =>
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const displaySessions = tab === 'active' ? sessions : closedSessions;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
              Voltar ao Admin
            </Link>
            <div className="flex items-center gap-2">
              <Sword className="h-6 w-6 text-rose-400" />
              <h1 className="text-xl font-bold text-white">Gerenciar TW</h1>
            </div>
            <button
              onClick={() => { setShowForm(!showForm); resetForm(); }}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition text-sm"
            >
              <Plus className="h-4 w-4" />
              Nova TW
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Formulário de criação */}
        {showForm && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-8 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
              <Plus className="h-5 w-5 text-rose-400" />
              Nova Sessão TW
            </h2>
            <form onSubmit={createSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                  placeholder="Ex: TW - Semana 20"
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição (opcional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Informações adicionais sobre a TW..."
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hora</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              {/* Points */}
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                <h3 className="text-amber-200 font-semibold mb-3 flex items-center gap-2 text-sm">
                  <Coins className="h-4 w-4" />
                  Sistema de Pontos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Pontos por confirmar presença
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pointsForVoting}
                      onChange={e => setPointsForVoting(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Pontos ao clicar "Vou"</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                      Pontos por estar no roster
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pointsForRoster}
                      onChange={e => setPointsForRoster(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Pontos ao ser selecionado pelo admin</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 text-white font-bold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : <Plus className="h-4 w-4" />}
                  Criar TW
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2.5 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-xl border border-gray-700 w-fit">
          <button
            onClick={() => setTab('active')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'active' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sword className="h-4 w-4" />
            Ativas / Criadas
            {sessions.length > 0 && (
              <span className="bg-white/10 text-xs px-1.5 py-0.5 rounded-full">{sessions.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab('closed')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'closed' ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Archive className="h-4 w-4" />
            Histórico
            {closedSessions.length > 0 && (
              <span className="bg-white/10 text-xs px-1.5 py-0.5 rounded-full">{closedSessions.length}</span>
            )}
          </button>
        </div>

        {/* Lista */}
        {displaySessions.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
            <Sword className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg font-medium">
              {tab === 'active' ? 'Nenhuma TW criada ainda' : 'Nenhuma TW encerrada'}
            </p>
            {tab === 'active' && (
              <p className="text-gray-500 text-sm mt-1">Clique em "Nova TW" para criar a primeira</p>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {displaySessions.map(session => (
              <div
                key={session.id}
                className={`bg-gray-800 rounded-xl border overflow-hidden transition ${
                  session.closed ? 'border-gray-700 opacity-70' : session.active ? 'border-rose-700/50' : 'border-gray-700'
                }`}
              >
                {/* Status bar */}
                {!session.closed && (
                  <div className={`h-1 w-full ${session.active ? 'bg-gradient-to-r from-rose-600 to-red-500' : 'bg-gray-600'}`} />
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white">{session.title}</h3>
                        {session.closed ? (
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">Encerrada</span>
                        ) : session.active ? (
                          <span className="px-2 py-0.5 bg-green-900/40 text-green-300 border border-green-700/40 text-xs rounded-full">Ativa</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-yellow-900/40 text-yellow-300 border border-yellow-700/40 text-xs rounded-full">Pausada</span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(session.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatTime(session.date)}
                        </span>
                      </div>

                      {session.description && (
                        <p className="text-gray-500 text-sm mb-2">{session.description}</p>
                      )}

                      <div className="flex gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3 text-yellow-500" />
                          {session.pointsForVoting} pts por confirmar
                        </span>
                        <span className="flex items-center gap-1">
                          <Coins className="h-3 w-3 text-amber-500" />
                          {session.pointsForRoster} pts no roster
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!session.closed && (
                        <>
                          <button
                            onClick={() => toggleActive(session)}
                            title={session.active ? 'Pausar TW' : 'Ativar TW'}
                            className={`p-2 rounded-lg transition ${
                              session.active
                                ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50'
                                : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                            }`}
                          >
                            {session.active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => closeSession(session)}
                            title="Encerrar TW (move para histórico)"
                            className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white transition"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteSession(session)}
                            disabled={deletingId === session.id}
                            title="Excluir TW"
                            className="p-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-60 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/admin/tw/${session.id}`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition"
                          >
                            <Users className="h-4 w-4" />
                            Gerenciar Roster
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </>
                      )}
                      {session.closed && (
                        <>
                          <button
                            onClick={() => deleteSession(session)}
                            disabled={deletingId === session.id}
                            title="Excluir TW"
                            className="p-2 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 disabled:opacity-60 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <Link
                            href={`/admin/tw/${session.id}`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition"
                          >
                            Ver Roster
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
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

export default function AdminTWPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminTWContent />
    </ProtectedRoute>
  );
}
