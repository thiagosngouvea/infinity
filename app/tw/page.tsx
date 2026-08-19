'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import {
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  increment,
  writeBatch,
  orderBy,
} from 'firebase/firestore';
import { TWSession, TWVote, User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Sword, Check, X, Users, Coins, Clock,
  CalendarDays, Trophy, Plus, Archive, Edit, ChevronDown, ChevronUp,
  KeyRound, MapPinned,
} from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

// Cores por classe
const CLASS_COLORS: Record<string, string> = {
  Guerreiro: '#ef4444',
  Arqueiro: '#22c55e',
  Mago: '#3b82f6',
  Sacerdote: '#f59e0b',
  Bárbaro: '#f97316',
  Arcano: '#8b5cf6',
  Mistico: '#06b6d4',
  Feiticeira: '#ec4899',
  Mercenário: '#64748b',
  Espiritualista: '#10b981',
};

function TWContent() {
  const { userData, refreshUserData } = useAuth();
  const { clan } = useClan();
  const { confirm, ConfirmDialog } = useConfirm();
  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
  const canViewPlanning = isAdmin || userData?.isPTLeader === true;

  const [activeSessions, setActiveSessions] = useState<TWSession[]>([]);
  const [closedSessions, setClosedSessions] = useState<TWSession[]>([]);
  const [myVotes, setMyVotes] = useState<{ [twId: string]: TWVote }>({});
  const [sessionCounts, setSessionCounts] = useState<{ [twId: string]: { yes: number; roster: number } }>({});
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [editingVoteId, setEditingVoteId] = useState<string | null>(null);

  // Admin: create/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<TWSession | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formPtsVote, setFormPtsVote] = useState(5);
  const [formPtsRoster, setFormPtsRoster] = useState(20);
  const [formPtsLending, setFormPtsLending] = useState(10);

  const resetForm = () => {
    setEditingSession(null);
    setFormTitle(''); setFormDesc(''); setFormDate(''); setFormTime('');
    setFormPtsVote(5); setFormPtsRoster(20); setFormPtsLending(10);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (s: TWSession) => {
    setEditingSession(s);
    setFormTitle(s.title);
    setFormDesc(s.description || '');
    const d = new Date(s.date);
    setFormDate(d.toISOString().split('T')[0]);
    setFormTime(d.toTimeString().slice(0, 5));
    setFormPtsVote(s.pointsForVoting);
    setFormPtsRoster(s.pointsForRoster);
    setFormPtsLending(s.pointsForLending ?? 0);
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    setSubmitting(true);
    try {
      const date = new Date(`${formDate}T${formTime}`);
      if (editingSession) {
        await updateDoc(clanDoc(clan.slug, COLS.twSessions, editingSession.id), {
          title: formTitle, description: formDesc, date,
          pointsForVoting: Number(formPtsVote), pointsForRoster: Number(formPtsRoster),
          pointsForLending: Number(formPtsLending),
        });
        toast.success('TW atualizada!');
      } else {
        const docRef = await addDoc(clanCol(clan.slug, COLS.twSessions), {
          title: formTitle, description: formDesc, date,
          active: true, closed: false,
          pointsForVoting: Number(formPtsVote), pointsForRoster: Number(formPtsRoster),
          pointsForLending: Number(formPtsLending),
          createdBy: userData.id, createdAt: new Date(),
        });

        try {
          const membersSnap = await getDocs(query(
            clanCol(clan.slug, COLS.users),
            where('role', 'in', ['member', 'admin', 'super_admin'])
          ));
          const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

          const when = date.toLocaleString('pt-BR', {
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
              message: `${formTitle} — ${when}`,
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

        toast.success('TW criada!');
      }
      setShowForm(false); resetForm(); loadData();
    } catch { toast.error('Erro ao salvar TW'); }
    finally { setSubmitting(false); }
  };

  const closeSession = async (s: TWSession) => {
    const ok = await confirm({
      title: 'Encerrar TW', message: `Encerrar "${s.title}"? Ela irá para o histórico.`,
      confirmText: 'Encerrar', cancelText: 'Cancelar', type: 'warning',
    });
    if (!ok) return;
    try {
      await updateDoc(clanDoc(clan.slug, COLS.twSessions, s.id), { active: false, closed: true });
      toast.success('TW encerrada'); loadData();
    } catch { toast.error('Erro'); }
  };

  const toggleActive = async (s: TWSession) => {
    try {
      await updateDoc(clanDoc(clan.slug, COLS.twSessions, s.id), { active: !s.active });
      toast.success(s.active ? 'TW pausada' : 'TW ativada'); loadData();
    } catch { toast.error('Erro'); }
  };

  useEffect(() => {
    if (userData) loadData();
  }, [userData]);

  const loadData = async () => {
    if (!userData) return;
    try {
      // Carregar sessões ativas
      const activeQ = query(
        clanCol(clan.slug, COLS.twSessions),
        where('active', '==', true),
        where('closed', '==', false),
        orderBy('date', 'asc')
      );
      const activeSnap = await getDocs(activeQ);
      const active = activeSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date.toDate(),
        createdAt: d.data().createdAt.toDate(),
      } as TWSession));
      setActiveSessions(active);

      // Carregar sessões encerradas (histórico)
      const closedQ = query(
        clanCol(clan.slug, COLS.twSessions),
        where('closed', '==', true),
        orderBy('date', 'desc')
      );
      const closedSnap = await getDocs(closedQ);
      const closed = closedSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        date: d.data().date.toDate(),
        createdAt: d.data().createdAt.toDate(),
      } as TWSession));
      setClosedSessions(closed);

      // Carregar meus votos
      const votesQ = query(
        clanCol(clan.slug, COLS.twVotes),
        where('userId', '==', userData.id)
      );
      const votesSnap = await getDocs(votesQ);
      const votesMap: { [twId: string]: TWVote } = {};
      votesSnap.docs.forEach(d => {
        const v = { id: d.id, ...d.data() } as TWVote;
        votesMap[v.twId] = v;
      });
      setMyVotes(votesMap);

      // Carregar contagens de confirmados e roster por sessão
      const allSessionIds = [...active, ...closed].map(s => s.id);
      const counts: { [twId: string]: { yes: number; roster: number } } = {};

      await Promise.all(
        allSessionIds.map(async (twId) => {
          const [votesSnap, rosterSnap] = await Promise.all([
            getDocs(query(clanCol(clan.slug, COLS.twVotes), where('twId', '==', twId), where('canParticipate', '==', true))),
            getDocs(query(clanCol(clan.slug, COLS.twRoster), where('twId', '==', twId))),
          ]);
          counts[twId] = { yes: votesSnap.size, roster: rosterSnap.size };
        })
      );
      setSessionCounts(counts);
    } catch (error) {
      console.error('Erro ao carregar TW:', error);
      toast.error('Erro ao carregar dados de TW');
    } finally {
      setLoading(false);
    }
  };

  const vote = async (twId: string, canParticipate: boolean, canLendAccount = false) => {
    if (!userData || voting) return;

    const session = activeSessions.find(s => s.id === twId);
    if (!session) return;

    setVoting(twId);
    try {
      const existing = myVotes[twId];
      const isFirstVote = !existing;
      setEditingVoteId(null);

      // Remover voto anterior se existir
      if (existing) {
        await deleteDoc(clanDoc(clan.slug, COLS.twVotes, existing.id));
      }

      const ptsLending = session.pointsForLending ?? 0;

      // Criar novo voto
      await addDoc(clanCol(clan.slug, COLS.twVotes), {
        twId,
        userId: userData.id,
        userName: userData.nick,
        userClass: userData.classe,
        canParticipate,
        canLendAccount,
        votingPointsAwarded: isFirstVote && canParticipate && session.pointsForVoting > 0,
        lendingPointsAwarded: isFirstVote && canLendAccount && ptsLending > 0,
        createdAt: new Date(),
      });

      // Dar pontos se for primeira confirmação positiva ou empréstimo de conta
      if (isFirstVote && canParticipate && session.pointsForVoting > 0) {
        await updateDoc(clanDoc(clan.slug, COLS.users, userData.id), {
          pontos: increment(session.pointsForVoting),
          totalPointsEarned: increment(session.pointsForVoting),
        });
        toast.success(`Presença confirmada! +${session.pointsForVoting} pontos`);
        await refreshUserData();
      } else if (isFirstVote && canLendAccount && ptsLending > 0) {
        await updateDoc(clanDoc(clan.slug, COLS.users, userData.id), {
          pontos: increment(ptsLending),
          totalPointsEarned: increment(ptsLending),
        });
        toast.success(`Conta disponibilizada! +${ptsLending} pontos extras`);
        await refreshUserData();
      } else if (canParticipate) {
        toast.success('Presença confirmada!');
      } else if (canLendAccount) {
        toast.success('Conta disponibilizada para empréstimo!');
      } else {
        toast.success('Voto registrado');
      }

      await loadData();
    } catch (error) {
      console.error('Erro ao votar:', error);
      toast.error('Erro ao registrar voto');
    } finally {
      setVoting(null);
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

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <div className="flex items-center gap-2">
              <Sword className="h-6 w-6 text-rose-400" />
              <h1 className="text-xl font-bold text-white">Territory War</h1>
            </div>
            {isAdmin ? (
              <button
                onClick={() => { resetForm(); setShowForm(v => !v); }}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition text-sm"
              >
                <Plus className="h-4 w-4" />
                Nova TW
              </button>
            ) : <div className="w-24" />}
          </div>
        </div>
      </nav>

      {/* Admin: Create/Edit Form */}
      {isAdmin && showForm && (
        <div className="border-b border-gray-700 bg-gray-800/80">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-rose-400" />
              {editingSession ? 'Editar TW' : 'Nova TW'}
            </h2>
            <form onSubmit={submitForm} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Título</label>
                  <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                    placeholder="Ex: TW – Semana 20"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Descrição (opcional)</label>
                  <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
                    placeholder="Informações adicionais..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Data</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Hora</label>
                  <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pts confirmar</label>
                  <input type="number" min="0" value={formPtsVote} onChange={e => setFormPtsVote(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pts roster</label>
                  <input type="number" min="0" value={formPtsRoster} onChange={e => setFormPtsRoster(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Pts emprestar</label>
                  <input type="number" min="0" value={formPtsLending} onChange={e => setFormPtsLending(Number(e.target.value))}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition">
                  {submitting ? 'Salvando...' : (editingSession ? 'Salvar Alterações' : 'Criar TW')}
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Tabs */}
        <div className="flex gap-2 mb-8 bg-gray-800 p-1 rounded-xl border border-gray-700 w-fit">
          <button
            onClick={() => setTab('active')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'active'
                ? 'bg-rose-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sword className="h-4 w-4" />
            Ativas
            {activeSessions.length > 0 && (
              <span className="bg-rose-500/30 text-rose-200 text-xs px-1.5 py-0.5 rounded-full">
                {activeSessions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition ${
              tab === 'history'
                ? 'bg-gray-600 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="h-4 w-4" />
            Histórico
            {closedSessions.length > 0 && (
              <span className="bg-gray-600/50 text-gray-300 text-xs px-1.5 py-0.5 rounded-full">
                {closedSessions.length}
              </span>
            )}
          </button>
        </div>

        {/* ── ATIVAS ── */}
        {tab === 'active' && (
          <>
            {activeSessions.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <Sword className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-medium">Nenhuma TW ativa no momento</p>
                {isAdmin ? (
                  <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition mx-auto">
                    <Plus className="h-4 w-4" /> Criar primeira TW
                  </button>
                ) : (
                  <p className="text-gray-500 text-sm mt-1">Aguarde o admin criar uma nova sessão</p>
                )}
              </div>
            ) : (
              <div className="grid gap-6">
                {activeSessions.map(session => {
                  const myVote = myVotes[session.id];
                  const counts = sessionCounts[session.id] || { yes: 0, roster: 0 };
                  const isVoting = voting === session.id;

                  return (
                    <div
                      id={session.id}
                      key={session.id}
                      className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-lg"
                    >
                      {/* Header */}
                      <div className="bg-gradient-to-r from-rose-800/60 to-red-900/60 px-6 py-4 border-b border-rose-700/40">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-600/30 rounded-lg">
                              <Sword className="h-6 w-6 text-rose-300" />
                            </div>
                            <div>
                              <h2 className="text-xl font-bold text-white">{session.title}</h2>
                              <div className="flex items-center gap-3 mt-1 text-sm text-rose-200">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-4 w-4" />
                                  {formatDate(session.date)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatTime(session.date)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-green-500/20 border border-green-500/40 rounded-full text-green-300 text-xs font-semibold">
                              {session.active ? 'ATIVA' : 'PAUSADA'}
                            </span>
                            {isAdmin && (
                              <>
                                <button onClick={() => openEdit(session)} title="Editar"
                                  className="p-1.5 rounded-lg bg-gray-700/60 text-yellow-400 hover:bg-gray-700 transition">
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button onClick={() => toggleActive(session)} title={session.active ? 'Pausar' : 'Ativar'}
                                  className="p-1.5 rounded-lg bg-gray-700/60 text-gray-300 hover:bg-gray-700 transition">
                                  {session.active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                </button>
                                <button onClick={() => closeSession(session)} title="Encerrar (mover para histórico)"
                                  className="p-1.5 rounded-lg bg-gray-700/60 text-gray-400 hover:bg-gray-700 transition">
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        {session.description && (
                          <p className="text-rose-100/70 text-sm mt-3">{session.description}</p>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 divide-x divide-gray-700 border-b border-gray-700">
                        <div className="px-6 py-4 flex items-center gap-3">
                          <Users className="h-5 w-5 text-green-400" />
                          <div>
                            <p className="text-gray-400 text-xs">Confirmados</p>
                            <p className="text-white font-bold text-lg">{counts.yes}</p>
                          </div>
                        </div>
                        <div className="px-6 py-4 flex items-center gap-3">
                          <Sword className="h-5 w-5 text-rose-400" />
                          <div>
                            <p className="text-gray-400 text-xs">Roster</p>
                            <p className="text-white font-bold text-lg">{counts.roster}</p>
                          </div>
                        </div>
                      </div>

                      {/* Points */}
                      <div className="px-6 py-3 flex flex-wrap gap-4 text-sm border-b border-gray-700 bg-gray-800/50">
                        <span className="flex items-center gap-1.5 text-yellow-300">
                          <Coins className="h-4 w-4" />
                          {session.pointsForVoting} pts por confirmar
                        </span>
                        <span className="flex items-center gap-1.5 text-amber-300">
                          <Coins className="h-4 w-4" />
                          {session.pointsForRoster} pts no roster
                        </span>
                        {session.pointsForLending !== undefined && session.pointsForLending > 0 && (
                          <span className="flex items-center gap-1.5 text-purple-300">
                            <Coins className="h-4 w-4" />
                            {session.pointsForLending} pts por emprestar conta
                          </span>
                        )}
                      </div>

                      {/* Vote Area */}
                      <div className="px-6 py-5">
                        {myVote && editingVoteId !== session.id ? (
                          <div className={`rounded-lg p-4 border-2 transition-all ${
                            myVote.canParticipate
                              ? 'bg-green-950/20 border-green-600/60'
                              : myVote.canLendAccount
                                ? 'bg-purple-950/20 border-purple-600/60'
                                : 'bg-red-950/20 border-red-900/60'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="text-white font-semibold flex items-center gap-2 text-sm sm:text-base">
                                {myVote.canParticipate ? (
                                  <>
                                    <Check className="h-5 w-5 text-green-400 shrink-0" />
                                    <span>Você confirmou presença</span>
                                  </>
                                ) : myVote.canLendAccount ? (
                                  <>
                                    <KeyRound className="h-5 w-5 text-purple-400 shrink-0" />
                                    <span>Você disponibilizou sua conta para empréstimo</span>
                                  </>
                                ) : (
                                  <>
                                    <X className="h-5 w-5 text-red-400 shrink-0" />
                                    <span>Você não pode participar</span>
                                  </>
                                )}
                              </div>
                              <button
                                onClick={() => setEditingVoteId(session.id)}
                                disabled={isVoting}
                                className="text-xs text-rose-400 hover:text-rose-300 transition underline underline-offset-2 disabled:opacity-50 font-semibold ml-2"
                              >
                                Alterar
                              </button>
                            </div>
                            {myVote.votingPointsAwarded && (
                              <p className="text-xs text-yellow-300 mt-2 flex items-center gap-1">
                                <Coins className="h-3.5 w-3.5" />
                                +{session.pointsForVoting} pontos de presença recebidos
                              </p>
                            )}
                            {myVote.lendingPointsAwarded && (
                              <p className="text-xs text-purple-300 mt-2 flex items-center gap-1">
                                <Coins className="h-3.5 w-3.5" />
                                +{session.pointsForLending} pontos de empréstimo recebidos
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-gray-300 text-sm font-medium">Você vai participar desta TW?</p>
                              {myVote && editingVoteId === session.id && (
                                <button
                                  onClick={() => setEditingVoteId(null)}
                                  className="text-xs text-gray-500 hover:text-gray-300 transition"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <button
                                onClick={() => vote(session.id, true, false)}
                                disabled={isVoting}
                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md"
                              >
                                {isVoting ? (
                                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <Check className="h-5 w-5 shrink-0" />
                                )}
                                Vou!
                              </button>
                              <button
                                onClick={() => vote(session.id, false, true)}
                                disabled={isVoting}
                                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md"
                              >
                                <KeyRound className="h-5 w-5 shrink-0" />
                                Emprestar Conta
                              </button>
                              <button
                                onClick={() => vote(session.id, false, false)}
                                disabled={isVoting}
                                className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-750 disabled:bg-gray-700 text-gray-300 hover:text-white font-bold py-3 px-4 rounded-lg transition border border-gray-700"
                              >
                                <X className="h-5 w-5 shrink-0" />
                                Não posso
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Planejamento compartilhado e gestão do roster */}
                      {(canViewPlanning || isAdmin) && <div className="grid gap-2 px-6 pb-4 sm:grid-cols-2">
                        {canViewPlanning && <Link href={`/tw/${session.id}/planning`}
                          className="flex items-center justify-center gap-2 rounded-lg border border-cyan-700/50 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-900/20">
                          <MapPinned className="h-4 w-4" />
                          {isAdmin ? 'Planejar estratégia' : 'Ver estratégia'}
                        </Link>}
                        {isAdmin && (
                          <Link href={`/admin/tw/${session.id}`}
                            className="flex items-center justify-center gap-2 rounded-lg border border-rose-700/50 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-900/20">
                            <Users className="h-4 w-4" />
                            Gerenciar Roster
                          </Link>
                        )}
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'history' && (
          <>
            {closedSessions.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center border border-gray-700">
                <Trophy className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-medium">Nenhuma TW encerrada ainda</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {closedSessions.map(session => {
                  const myVote = myVotes[session.id];
                  const counts = sessionCounts[session.id] || { yes: 0, roster: 0 };

                  return (
                    <div
                      id={session.id}
                      key={session.id}
                      className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden opacity-80 hover:opacity-100 transition"
                    >
                      <div className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-gray-700 rounded-lg">
                            <Sword className="h-5 w-5 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{session.title}</h3>
                            <p className="text-gray-500 text-sm">
                              {formatDate(session.date)} às {formatTime(session.date)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Confirmados</p>
                            <p className="text-white font-bold">{counts.yes}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-gray-500 text-xs">Roster</p>
                            <p className="text-white font-bold">{counts.roster}</p>
                          </div>
                          {myVote && (
                            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              myVote.canParticipate
                                ? 'bg-green-900/30 text-green-300'
                                : 'bg-red-900/30 text-red-300'
                            }`}>
                              {myVote.canParticipate ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              {myVote.canParticipate ? 'Confirmei' : 'Não fui'}
                            </span>
                          )}
                          {canViewPlanning && <Link href={`/tw/${session.id}/planning`}
                            className="flex items-center gap-1.5 rounded-lg border border-cyan-800/50 bg-cyan-950/20 px-3 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-900/30 hover:text-cyan-300">
                            <MapPinned className="h-3.5 w-3.5" />
                            Estratégia
                          </Link>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

export default function TWPage() {
  return (
    <ProtectedRoute>
      <TWContent />
    </ProtectedRoute>
  );
}
