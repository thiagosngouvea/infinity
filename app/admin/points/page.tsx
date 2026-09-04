'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { db } from '@/lib/firebase';
import {
  collection,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';
import { Attendance, Event, EventVote, PointsAuditEntry, Redemption, TWSession, TWRosterEntry, TWVote, User } from '@/types';
import toast from 'react-hot-toast';
import LoadingLogo from '@/components/LoadingLogo';
import Link from 'next/link';
import { ArrowLeft, Coins, Search, History, SlidersHorizontal } from 'lucide-react';

type HistoryEntry = {
  id: string;
  createdAt: Date;
  label: string;
  deltaPoints: number;
  details?: string;
};

function AdminPointsContent() {
  const { userData } = useAuth();
  const { clan } = useClan();

  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [members, setMembers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [tab, setTab] = useState<'adjust' | 'history'>('adjust');

  const [delta, setDelta] = useState<number>(0);
  const [setAbsoluteMode, setSetAbsoluteMode] = useState(false);
  const [absolutePoints, setAbsolutePoints] = useState<number>(0);
  const [reason, setReason] = useState('');

  const [eventsMap, setEventsMap] = useState<Map<string, Event>>(new Map());
  const [twMap, setTwMap] = useState<Map<string, TWSession>>(new Map());

  const [auditEntries, setAuditEntries] = useState<PointsAuditEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      m.nick?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }, [members, search]);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUser(null);
      setAuditEntries([]);
      setHistory([]);
      return;
    }
    loadUserAndHistory(selectedUserId);
  }, [selectedUserId]);

  const loadBaseData = async () => {
    try {
      const [membersSnap, eventsSnap, twSnap] = await Promise.all([
        getDocs(query(
          clanCol(clan.slug, COLS.users),
          where('role', 'in', ['member', 'admin', 'super_admin'])
        )),
        getDocs(query(clanCol(clan.slug, COLS.events))),
        getDocs(query(clanCol(clan.slug, COLS.twSessions))),
      ]);

      const membersList = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));
      membersList.sort((a, b) => a.nick.localeCompare(b.nick));
      setMembers(membersList);

      const eMap = new Map<string, Event>();
      eventsSnap.docs.forEach(d => {
        const data = d.data();
        eMap.set(d.id, {
          id: d.id,
          ...data,
          date: data.date?.toDate?.() ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
          pointsForVoting: data.pointsForVoting ?? 5,
          pointsForAttendance: data.pointsForAttendance ?? 20,
        } as Event);
      });
      setEventsMap(eMap);

      const tMap = new Map<string, TWSession>();
      twSnap.docs.forEach(d => {
        const data = d.data();
        tMap.set(d.id, {
          id: d.id,
          ...data,
          date: data.date?.toDate?.() ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
        } as TWSession);
      });
      setTwMap(tMap);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadUserAndHistory = async (userId: string) => {
    setLoadingHistory(true);
    try {
      const userDoc = await getDoc(clanDoc(clan.slug, COLS.users, userId));
      if (!userDoc.exists()) {
        toast.error('Usuário não encontrado');
        setSelectedUser(null);
        return;
      }

      const u = { id: userDoc.id, ...userDoc.data() } as User;
      u.totalPointsEarned = (userDoc.data().totalPointsEarned ?? 0) as number;
      setSelectedUser(u);
      setAbsolutePoints(u.pontos ?? 0);

      const [
        legacyAttendancesSnap,
        secureAttendancesSnap,
        eventVotesSnap,
        twVotesSnap,
        twRosterSnap,
        redemptionsSnap,
        auditSnap,
      ] = await Promise.all([
        getDocs(query(clanCol(clan.slug, COLS.attendances), where('userId', '==', userId), limit(300))),
        getDocs(query(collection(
          db,
          'clans', clan.slug,
          COLS.users, userId,
          COLS.attendances,
        ), limit(300))),
        getDocs(query(clanCol(clan.slug, COLS.eventVotes), where('userId', '==', userId), limit(500))),
        getDocs(query(clanCol(clan.slug, COLS.twVotes), where('userId', '==', userId), limit(500))),
        getDocs(query(clanCol(clan.slug, COLS.twRoster), where('userId', '==', userId), limit(500))),
        getDocs(query(clanCol(clan.slug, COLS.redemptions), where('userId', '==', userId), limit(500))),
        getDocs(query(clanCol(clan.slug, COLS.pointsAudit), where('userId', '==', userId), limit(500))),
      ]);

      const attendances = [...secureAttendancesSnap.docs, ...legacyAttendancesSnap.docs].map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          date: data.date?.toDate?.() ? data.date.toDate() : new Date(data.date),
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
        } as Attendance;
      });

      const eventVotes = eventVotesSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
          attendanceConfirmedAt: data.attendanceConfirmedAt?.toDate?.() ? data.attendanceConfirmedAt.toDate() : (data.attendanceConfirmedAt ? new Date(data.attendanceConfirmedAt) : undefined),
        } as EventVote;
      });

      const twVotes = twVotesSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
        } as TWVote;
      });

      const twRoster = twRosterSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          selectedAt: data.selectedAt?.toDate?.() ? data.selectedAt.toDate() : new Date(data.selectedAt),
        } as TWRosterEntry;
      });

      const redemptions = redemptionsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
          deliveredAt: data.deliveredAt?.toDate?.() ? data.deliveredAt.toDate() : (data.deliveredAt ? new Date(data.deliveredAt) : undefined),
        } as Redemption;
      });

      const audits = auditSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate() : new Date(data.createdAt),
        } as PointsAuditEntry;
      }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setAuditEntries(audits);

      const entries: HistoryEntry[] = [];

      audits.forEach(a => {
        entries.push({
          id: `audit:${a.id}`,
          createdAt: a.createdAt,
          label: 'Ajuste manual',
          deltaPoints: a.deltaPoints,
          details: a.reason ? `${a.reason} — por ${a.createdByName}` : `por ${a.createdByName}`,
        });
      });

      attendances.forEach(a => {
        entries.push({
          id: `attendance:${a.id}`,
          createdAt: a.createdAt,
          label: 'Presença diária',
          deltaPoints: a.pontos,
          details: a.date.toLocaleDateString('pt-BR'),
        });
      });

      eventVotes.forEach(v => {
        const ev = eventsMap.get(v.eventId);
        if (v.votingPointsAwarded && ev && ev.pointsForVoting > 0) {
          entries.push({
            id: `event-vote:${v.id}`,
            createdAt: v.createdAt,
            label: `Voto em evento: ${ev.title}`,
            deltaPoints: ev.pointsForVoting,
          });
        }
        if (v.attendancePointsAwarded && v.attended && ev && ev.pointsForAttendance > 0 && v.attendanceConfirmedAt) {
          entries.push({
            id: `event-attendance:${v.id}`,
            createdAt: v.attendanceConfirmedAt,
            label: `Presença confirmada: ${ev.title}`,
            deltaPoints: ev.pointsForAttendance,
          });
        }
      });

      twVotes.forEach(v => {
        const session = twMap.get(v.twId);
        if (v.votingPointsAwarded && session && session.pointsForVoting > 0) {
          entries.push({
            id: `tw-vote:${v.id}`,
            createdAt: v.createdAt,
            label: `TW: presença confirmada (${session.title})`,
            deltaPoints: session.pointsForVoting,
          });
        }
      });

      twRoster.forEach(r => {
        const session = twMap.get(r.twId);
        if (r.rosterPointsAwarded && session && session.pointsForRoster > 0) {
          entries.push({
            id: `tw-roster:${r.id}`,
            createdAt: r.selectedAt,
            label: `TW: selecionado no roster (${session.title})`,
            deltaPoints: session.pointsForRoster,
            details: r.selectedBy,
          });
        }
      });

      redemptions.forEach(r => {
        entries.push({
          id: `redemption:${r.id}`,
          createdAt: r.createdAt,
          label: `Loja: ${r.itemName}`,
          deltaPoints: -Math.abs(r.pointsSpent),
          details: r.status,
        });
      });

      entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setHistory(entries);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingHistory(false);
    }
  };

  const applyAdjustment = async () => {
    if (!userData) return;
    if (!selectedUserId) {
      toast.error('Selecione um player');
      return;
    }

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      toast.error('Informe o motivo');
      return;
    }

    const userRef = clanDoc(clan.slug, COLS.users, selectedUserId);
    const deltaValue = Number(delta);
    const absoluteValue = Number(absolutePoints);

    setProcessing(true);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        if (!snap.exists()) throw new Error('Usuário não encontrado');

        const beforePoints = Number(snap.data().pontos ?? 0);
        const beforeTotal = Number(snap.data().totalPointsEarned ?? 0);

        let deltaPoints = 0;
        if (setAbsoluteMode) {
          deltaPoints = absoluteValue - beforePoints;
        } else {
          deltaPoints = deltaValue;
        }

        if (!Number.isFinite(deltaPoints) || deltaPoints === 0) {
          throw new Error('Delta inválido');
        }

        const afterPoints = beforePoints + deltaPoints;
        const afterTotal = beforeTotal + deltaPoints;

        if (afterPoints < 0) {
          throw new Error('Saldo não pode ficar negativo');
        }

        tx.update(userRef, {
          pontos: afterPoints,
          totalPointsEarned: afterTotal,
        });

        const auditId = crypto.randomUUID();
        const auditRef = clanDoc(clan.slug, COLS.pointsAudit, auditId);
        tx.set(auditRef, {
          userId: selectedUserId,
          userName: snap.data().nick ?? '',
          source: 'manual',
          deltaPoints,
          deltaTotalPointsEarned: deltaPoints,
          beforePoints,
          afterPoints,
          beforeTotalPointsEarned: beforeTotal,
          afterTotalPointsEarned: afterTotal,
          reason: trimmedReason,
          createdBy: userData.id,
          createdByName: userData.nick,
          createdAt: new Date(),
        });
      });

      toast.success('Pontos atualizados e auditados');
      setDelta(0);
      setReason('');
      await loadUserAndHistory(selectedUserId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar pontos';
      toast.error(message);
    } finally {
      setProcessing(false);
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
            <Link href="/admin" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
              Voltar ao Admin
            </Link>
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-amber-400" />
              <h1 className="text-xl font-bold text-white">Gerenciar Pontos</h1>
            </div>
            <div className="w-28" />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-gray-400" />
              <h2 className="text-white font-semibold">Players</h2>
            </div>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nick ou email..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 text-sm mb-4"
            />
            <div className="space-y-1 max-h-[520px] overflow-y-auto">
              {filteredMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedUserId(m.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition ${
                    selectedUserId === m.id
                      ? 'bg-amber-900/20 border-amber-700/40'
                      : 'bg-gray-700 border-gray-700 hover:bg-gray-650'
                  }`}
                >
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <p className="text-white font-semibold text-sm">{m.nick}</p>
                      <p className="text-gray-400 text-xs">{m.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-amber-300 font-bold text-sm">{m.pontos ?? 0}</p>
                      <p className="text-gray-500 text-xs">saldo</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              {!selectedUser ? (
                <div className="text-center py-10">
                  <p className="text-gray-400">Selecione um player para gerenciar pontos</p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">{selectedUser.nick}</h2>
                      <p className="text-gray-400 text-sm">{selectedUser.email}</p>
                      <p className="text-gray-500 text-sm">{selectedUser.classe}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-700 rounded-lg px-4 py-3 border border-gray-600">
                        <p className="text-gray-400 text-xs">Saldo</p>
                        <p className="text-white text-xl font-bold">{selectedUser.pontos ?? 0}</p>
                      </div>
                      <div className="bg-gray-700 rounded-lg px-4 py-3 border border-gray-600">
                        <p className="text-gray-400 text-xs">Total</p>
                        <p className="text-white text-xl font-bold">{selectedUser.totalPointsEarned ?? 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={() => setTab('adjust')}
                      className={`px-4 py-2 rounded-lg font-semibold transition text-sm flex items-center gap-2 ${
                        tab === 'adjust' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      Ajustar
                    </button>
                    <button
                      onClick={() => setTab('history')}
                      className={`px-4 py-2 rounded-lg font-semibold transition text-sm flex items-center gap-2 ${
                        tab === 'history' ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
                      }`}
                    >
                      <History className="h-4 w-4" />
                      Histórico
                    </button>
                  </div>
                </>
              )}
            </div>

            {selectedUser && tab === 'adjust' && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-white font-bold text-lg mb-4">Ajuste de Pontos (com auditoria)</h3>

                <div className="flex items-center gap-2 mb-4">
                  <button
                    onClick={() => setSetAbsoluteMode(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      !setAbsoluteMode ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
                    }`}
                  >
                    Somar/Subtrair
                  </button>
                  <button
                    onClick={() => setSetAbsoluteMode(true)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      setAbsoluteMode ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-650'
                    }`}
                  >
                    Definir saldo
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {!setAbsoluteMode ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Delta (ex: 10 ou -10)</label>
                      <input
                        type="number"
                        value={delta}
                        onChange={e => setDelta(Number(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Novo saldo</label>
                      <input
                        type="number"
                        min={0}
                        value={absolutePoints}
                        onChange={e => setAbsolutePoints(Number(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Motivo</label>
                    <input
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder="Ex: Correção de presença / bônus / ajuste de erro"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <button
                  onClick={applyAdjustment}
                  disabled={processing}
                  className="w-full md:w-auto px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold rounded-lg transition"
                >
                  {processing ? 'Aplicando...' : 'Aplicar ajuste'}
                </button>

                {auditEntries.length > 0 && (
                  <div className="mt-6 border-t border-gray-700 pt-6">
                    <h4 className="text-white font-semibold mb-3">Últimos ajustes manuais</h4>
                    <div className="space-y-2">
                      {auditEntries.slice(0, 5).map(a => (
                        <div key={a.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 flex justify-between items-center">
                          <div>
                            <p className="text-white text-sm font-semibold">{a.reason || 'Ajuste manual'}</p>
                            <p className="text-gray-400 text-xs">
                              {a.createdAt.toLocaleString('pt-BR')} — {a.createdByName}
                            </p>
                          </div>
                          <div className={`font-bold ${a.deltaPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {a.deltaPoints >= 0 ? '+' : ''}{a.deltaPoints}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedUser && tab === 'history' && (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
                <h3 className="text-white font-bold text-lg mb-4">Histórico de Pontos</h3>
                {loadingHistory ? (
                  <div className="flex justify-center py-12">
                    <LoadingLogo size={96} fullscreen={false} />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-gray-400 text-center py-10">Nenhum histórico encontrado</p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 200).map(h => (
                      <div key={h.id} className="bg-gray-700 rounded-lg p-4 border border-gray-600 flex justify-between items-center">
                        <div>
                          <p className="text-white text-sm font-semibold">{h.label}</p>
                          <p className="text-gray-400 text-xs">{h.createdAt.toLocaleString('pt-BR')}{h.details ? ` — ${h.details}` : ''}</p>
                        </div>
                        <div className={`font-bold ${h.deltaPoints >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {h.deltaPoints >= 0 ? '+' : ''}{h.deltaPoints}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminPointsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminPointsContent />
    </ProtectedRoute>
  );
}
