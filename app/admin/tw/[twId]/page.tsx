'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, where, getDocs, getDoc, addDoc, deleteDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TWSession, TWVote, TWRosterEntry, User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { ArrowLeft, Sword, Users, Plus, X, Check, Search, UserPlus, Coins, Archive, KeyRound, MapPinned } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

const CLASS_COLORS: Record<string, string> = {
  Guerreiro: 'bg-red-900/40 text-red-300 border-red-700/40',
  Arqueiro: 'bg-green-900/40 text-green-300 border-green-700/40',
  Mago: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  Sacerdote: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
  Bárbaro: 'bg-orange-900/40 text-orange-300 border-orange-700/40',
  Arcano: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
  Mistico: 'bg-cyan-900/40 text-cyan-300 border-cyan-700/40',
  Feiticeira: 'bg-pink-900/40 text-pink-300 border-pink-700/40',
  Mercenário: 'bg-slate-900/40 text-slate-300 border-slate-700/40',
  Espiritualista: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
};

function AddMemberModal({ open, onClose, onAdd, allMembers, rosterUserIds, processing }: {
  open: boolean; onClose: () => void; onAdd: (m: User) => Promise<void>;
  allMembers: User[]; rosterUserIds: Set<string>; processing: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMembers.filter(m => !rosterUserIds.has(m.id) && (!q || m.nick?.toLowerCase().includes(q)));
  }, [search, allMembers, rosterUserIds]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-rose-400" />
            <h2 className="text-lg font-bold text-white">Adicionar ao Roster</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nick..."
              autoFocus className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 text-sm" />
          </div>
        </div>
        <div className="overflow-y-auto max-h-72 p-3 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">{search ? 'Nenhum membro encontrado' : 'Todos os membros já estão no roster'}</p>
          ) : filtered.map(m => (
            <button key={m.id} onClick={() => onAdd(m)} disabled={processing}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 transition text-left group">
              <div>
                <p className="text-white font-semibold text-sm">{m.nick}</p>
                <p className="text-gray-400 text-xs">{m.classe}</p>
              </div>
              <span className="text-xs text-rose-400 opacity-0 group-hover:opacity-100 transition font-semibold">+ Adicionar</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700">
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-white transition">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function AdminTWRosterContent() {
  const params = useParams();
  const twId = params.twId as string;
  const { userData } = useAuth();
  const { clan } = useClan();
  const { confirm, ConfirmDialog } = useConfirm();

  const [session, setSession] = useState<TWSession | null>(null);
  const [votes, setVotes] = useState<TWVote[]>([]);
  const [roster, setRoster] = useState<TWRosterEntry[]>([]);
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const rosterUserIds = useMemo(() => new Set(roster.map(r => r.userId)), [roster]);

  useEffect(() => { loadData(); loadAllMembers(); }, [twId]);

  const loadAllMembers = async () => {
    const snap = await getDocs(query(clanCol(clan.slug, COLS.users), where('role', 'in', ['member', 'admin', 'super_admin'])));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
    list.sort((a, b) => a.nick.localeCompare(b.nick));
    setAllMembers(list);
  };

  const loadData = async () => {
    try {
      const sessionDoc = await getDoc(clanDoc(clan.slug, COLS.twSessions, twId));
      if (!sessionDoc.exists()) { toast.error('TW não encontrada'); return; }
      setSession({ id: sessionDoc.id, ...sessionDoc.data(), date: sessionDoc.data().date.toDate(), createdAt: sessionDoc.data().createdAt.toDate() } as TWSession);

      const [votesSnap, rosterSnap] = await Promise.all([
        getDocs(query(clanCol(clan.slug, COLS.twVotes), where('twId', '==', twId))),
        getDocs(query(clanCol(clan.slug, COLS.twRoster), where('twId', '==', twId))),
      ]);
      setVotes(votesSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt.toDate() } as TWVote)));
      setRoster(rosterSnap.docs.map(d => ({ id: d.id, ...d.data(), selectedAt: d.data().selectedAt.toDate() } as TWRosterEntry)));
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const addToRoster = async (member: User) => {
    if (!userData || !session) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      await addDoc(clanCol(clan.slug, COLS.twRoster), {
        twId, userId: member.id, userName: member.nick, userClass: member.classe,
        selectedBy: userData.id, selectedAt: new Date(),
        rosterPointsAwarded: session.pointsForRoster > 0,
      });
      if (session.pointsForRoster > 0) {
        batch.update(clanDoc(clan.slug, COLS.users, member.id), {
          pontos: increment(session.pointsForRoster),
          totalPointsEarned: increment(session.pointsForRoster),
        });
        await batch.commit();
      }
      toast.success(`${member.nick} adicionado ao roster! +${session.pointsForRoster} pontos`);
      setShowAddModal(false);
      await loadData();
    } catch (err) {
      toast.error('Erro ao adicionar ao roster');
    } finally {
      setProcessing(false);
    }
  };

  const removeFromRoster = async (entry: TWRosterEntry) => {
    if (!session) return;
    const confirmed = await confirm({
      title: 'Remover do Roster',
      message: `Remover ${entry.userName} do roster?\n\nSe já recebeu pontos, eles serão removidos.`,
      confirmText: 'Remover', cancelText: 'Cancelar', type: 'danger',
    });
    if (!confirmed) return;
    setProcessing(true);
    try {
      const batch = writeBatch(db);
      batch.delete(clanDoc(clan.slug, COLS.twRoster, entry.id));
      if (entry.rosterPointsAwarded && session.pointsForRoster > 0) {
        batch.update(clanDoc(clan.slug, COLS.users, entry.userId), {
          pontos: increment(-session.pointsForRoster),
          totalPointsEarned: increment(-session.pointsForRoster),
        });
      }
      await batch.commit();
      toast.success(`${entry.userName} removido do roster`);
      await loadData();
    } catch (err) {
      toast.error('Erro ao remover do roster');
    } finally {
      setProcessing(false);
    }
  };

  // Add voter directly to roster
  const addVoterToRoster = async (vote: TWVote) => {
    const member = allMembers.find(m => m.id === vote.userId);
    if (member) await addToRoster(member);
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><LoadingLogo size={128} fullscreen={false} /></div>;
  if (!session) return null;

  const confirmedVotes = votes.filter(v => v.canParticipate);
  const lendingVotes = votes.filter(v => !v.canParticipate && v.canLendAccount);
  const declinedVotes = votes.filter(v => !v.canParticipate && !v.canLendAccount);

  // Breakdown por classe no roster
  const classCounts: Record<string, number> = {};
  roster.forEach(r => { classCounts[r.userClass] = (classCounts[r.userClass] || 0) + 1; });

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/admin/tw" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" /> Voltar
            </Link>
            <div className="flex items-center gap-2">
              <Sword className="h-6 w-6 text-rose-400" />
              <h1 className="text-xl font-bold text-white truncate max-w-xs">{session.title}</h1>
              {session.closed && <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">Encerrada</span>}
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/tw/${twId}/planning`}
                className="flex items-center gap-2 rounded-lg border border-cyan-700/50 bg-cyan-950/20 px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-900/30">
                <MapPinned className="h-4 w-4" />
                <span className="hidden sm:inline">Planejamento</span>
              </Link>
              {!session.closed && (
                <button onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition text-sm">
                  <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar Manual</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Confirmaram</p>
            <p className="text-3xl font-bold text-white">{confirmedVotes.length}</p>
            <p className="text-green-400 text-xs mt-1">players disponíveis</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">No Roster</p>
            <p className="text-3xl font-bold text-rose-400">{roster.length}</p>
            <p className="text-gray-500 text-xs mt-1">selecionados</p>
          </div>
          <div className="bg-purple-900/20 rounded-xl p-5 border border-purple-700/40">
            <p className="text-purple-300 text-sm mb-1 flex items-center gap-1">
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              Emprestam Conta
            </p>
            <p className="text-3xl font-bold text-purple-300">{lendingVotes.length}</p>
            <p className="text-purple-500 text-xs mt-1">contas disponíveis</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
            <p className="text-gray-400 text-sm mb-1">Não podem</p>
            <p className="text-3xl font-bold text-white">{declinedVotes.length}</p>
            <p className="text-gray-500 text-xs mt-1">ausências</p>
          </div>
          <div className="bg-amber-900/20 rounded-xl p-5 border border-amber-700/40">
            <p className="text-amber-300 text-sm mb-1 flex items-center gap-1"><Coins className="h-3 w-3" />Pts por Roster</p>
            <p className="text-3xl font-bold text-amber-300">{session.pointsForRoster}</p>
            <p className="text-amber-500 text-xs mt-1">por player selecionado</p>
          </div>
        </div>

        {/* Breakdown por Classe no Roster */}
        {roster.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-rose-400" />
              Composição do Roster por Classe
            </h2>
            <div className="flex flex-wrap gap-3">
              {Object.entries(classCounts).sort((a, b) => b[1] - a[1]).map(([cls, count]) => (
                <div key={cls} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold ${CLASS_COLORS[cls] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                  <span>{cls}</span>
                  <span className="bg-white/10 px-2 py-0.5 rounded-full text-base font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Roster Final */}
        <div className="bg-gray-800 rounded-xl border border-rose-700/30 p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sword className="h-5 w-5 text-rose-400" />
            Roster Final ({roster.length})
          </h2>
          {roster.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum player no roster ainda. Selecione abaixo ou adicione manualmente.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {roster.map(entry => (
                <div key={entry.id} className="flex items-center justify-between bg-gray-700/60 rounded-lg px-4 py-3 border border-gray-600">
                  <div>
                    <p className="text-white font-semibold">{entry.userName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CLASS_COLORS[entry.userClass] || 'bg-gray-600 text-gray-300 border-gray-500'}`}>
                      {entry.userClass}
                    </span>
                  </div>
                  {!session.closed && (
                    <button onClick={() => removeFromRoster(entry)} disabled={processing}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50 transition p-1">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Confirmados - para selecionar pro roster */}
        {!session.closed && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Check className="h-5 w-5 text-green-400" />
              Confirmaram Presença ({confirmedVotes.length})
            </h2>
            {confirmedVotes.length === 0 ? (
              <p className="text-gray-500 text-center py-6">Nenhum player confirmou ainda</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {confirmedVotes.map(vote => {
                  const inRoster = rosterUserIds.has(vote.userId);
                  return (
                    <div key={vote.id} className={`flex items-center justify-between rounded-lg px-4 py-3 border transition ${
                      inRoster ? 'bg-rose-900/20 border-rose-700/40' : 'bg-gray-700/60 border-gray-600'
                    }`}>
                      <div>
                        <p className="text-white font-semibold">{vote.userName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CLASS_COLORS[vote.userClass] || 'bg-gray-600 text-gray-300 border-gray-500'}`}>
                          {vote.userClass}
                        </span>
                      </div>
                      {inRoster ? (
                        <span className="flex items-center gap-1 text-xs text-rose-300 font-semibold">
                          <Sword className="h-3 w-3" /> No Roster
                        </span>
                      ) : (
                        <button onClick={() => addVoterToRoster(vote)} disabled={processing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 text-white text-xs font-semibold rounded-lg transition">
                          <Plus className="h-3 w-3" /> Selecionar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Disponibilizaram Conta para Empréstimo */}
        {!session.closed && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-purple-400" />
              Disponibilizaram Conta para Empréstimo ({lendingVotes.length})
            </h2>
            {lendingVotes.length === 0 ? (
              <p className="text-gray-500 text-center py-6">Nenhuma conta disponibilizada para empréstimo ainda</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lendingVotes.map(vote => {
                  const inRoster = rosterUserIds.has(vote.userId);
                  return (
                    <div key={vote.id} className={`flex items-center justify-between rounded-lg px-4 py-3 border transition ${
                      inRoster ? 'bg-rose-900/20 border-rose-700/40' : 'bg-gray-700/60 border-gray-600'
                    }`}>
                      <div>
                        <p className="text-white font-semibold">{vote.userName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${CLASS_COLORS[vote.userClass] || 'bg-gray-600 text-gray-300 border-gray-500'}`}>
                          {vote.userClass}
                        </span>
                      </div>
                      {inRoster ? (
                        <span className="flex items-center gap-1 text-xs text-rose-300 font-semibold">
                          <Sword className="h-3 w-3" /> No Roster
                        </span>
                      ) : (
                        <button onClick={() => addVoterToRoster(vote)} disabled={processing}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-600 text-white text-xs font-semibold rounded-lg transition">
                          <Plus className="h-3 w-3" /> Selecionar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Não podem */}
        {declinedVotes.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 opacity-70">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <X className="h-5 w-5 text-red-400" />
              Não Podem Participar ({declinedVotes.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {declinedVotes.map(vote => (
                <div key={vote.id} className="flex items-center gap-3 bg-gray-700/40 rounded-lg px-4 py-3 border border-gray-600">
                  <X className="h-4 w-4 text-red-400 shrink-0" />
                  <div>
                    <p className="text-white font-semibold">{vote.userName}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${CLASS_COLORS[vote.userClass] || 'bg-gray-600 text-gray-300 border-gray-500'}`}>
                      {vote.userClass}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddMemberModal open={showAddModal} onClose={() => setShowAddModal(false)}
        onAdd={addToRoster} allMembers={allMembers} rosterUserIds={rosterUserIds} processing={processing} />
      <ConfirmDialog />
    </div>
  );
}

export default function AdminTWRosterPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminTWRosterContent />
    </ProtectedRoute>
  );
}
