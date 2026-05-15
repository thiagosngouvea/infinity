'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import LoadingLogo from '@/components/LoadingLogo';
import {
  getDocs, addDoc, deleteDoc, updateDoc,
  query, where, orderBy,
} from 'firebase/firestore';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { Account0800, Account0800Entry, User } from '@/types';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Plus, Trash2, Edit, KeyRound, Eye, EyeOff,
  X, Save, Search, ChevronDown, User as UserIcon, Shield,
  Copy, Check,
} from 'lucide-react';
import Link from 'next/link';

const CLASSES = ['EP', 'WB', 'WR', 'MG', 'EA', 'SP', 'GU', 'AR', 'BM', 'MX', 'ME', 'Outro'];

const EMPTY_ENTRY = (): Account0800Entry => ({
  nick: '', classe: '', login: '', senha: '',
  reborn: '', meridiano: '', cultivo: '',
  pedra: '', ceu: '', refino: '',
});

function AccountsContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

  const [members, setMembers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account0800[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Viewer state
  const [viewingAccount, setViewingAccount] = useState<Account0800 | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set());
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account0800 | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [entries, setEntries] = useState<Account0800Entry[]>([EMPTY_ENTRY()]);

  useEffect(() => { if (isAdmin) loadData(); else setLoading(false); }, [userData]);

  const loadData = async () => {
    if (!userData) return;
    try {
      // Load members
      const membersSnap = await getDocs(
        query(clanCol(clan.slug, COLS.users), orderBy('nick', 'asc'))
      );
      const membersList = membersSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as User))
        .filter(u => u.role !== 'pending');
      setMembers(membersList);

      // Load accounts
      const acSnap = await getDocs(
        query(clanCol(clan.slug, COLS.accounts0800), orderBy('userNick', 'asc'))
      );
      const acList = acSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: d.data().updatedAt?.toDate?.() ?? new Date(),
      } as Account0800));
      setAccounts(acList);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUserId('');
    setEntries([EMPTY_ENTRY()]);
    setEditingAccount(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = (acc: Account0800) => {
    setEditingAccount(acc);
    setSelectedUserId(acc.userId);
    setEntries(acc.accounts.length > 0 ? [...acc.accounts] : [EMPTY_ENTRY()]);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return toast.error('Selecione um membro');
    const validEntries = entries.filter(en => en.nick.trim() || en.login.trim());
    if (validEntries.length === 0) return toast.error('Adicione ao menos uma conta');

    const member = members.find(m => m.id === selectedUserId);
    if (!member) return;

    try {
      const data = {
        userId: selectedUserId,
        userNick: member.nick,
        accounts: validEntries,
        updatedAt: new Date(),
      };

      if (editingAccount) {
        await updateDoc(
          clanDoc(clan.slug, COLS.accounts0800, editingAccount.id),
          data as Record<string, unknown>
        );
        toast.success('Contas atualizadas!');
      } else {
        await addDoc(clanCol(clan.slug, COLS.accounts0800), {
          ...data, createdAt: new Date(),
        });
        toast.success('Contas cadastradas!');
      }

      setShowForm(false); resetForm(); loadData();
    } catch (err) {
      console.error(err); toast.error('Erro ao salvar');
    }
  };

  const handleDelete = async (acc: Account0800) => {
    if (!confirm(`Excluir contas de "${acc.userNick}"?`)) return;
    try {
      await deleteDoc(clanDoc(clan.slug, COLS.accounts0800, acc.id));
      toast.success('Excluído!'); loadData();
    } catch (err) {
      console.error(err); toast.error('Erro ao excluir');
    }
  };

  const updateEntry = (idx: number, field: keyof Account0800Entry, val: string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, EMPTY_ENTRY()]);

  const removeEntry = (idx: number) => {
    if (entries.length === 1) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  const togglePassword = (idx: number) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(null), 1500);
    } catch { /* ignore */ }
  };

  const filtered = accounts.filter(a =>
    !search || a.userNick.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Acesso restrito a administradores.</p>
          <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition">
            <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return (
    <LoadingLogo />
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" /> Voltar
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-orange-400" /> Contas 0800
            </h1>
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition font-semibold">
              <Plus className="h-4 w-4" /> Cadastrar
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-400">{accounts.length}</p>
            <p className="text-gray-400 text-sm mt-1">Players cadastrados</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-400">
              {accounts.reduce((s, a) => s + a.accounts.length, 0)}
            </p>
            <p className="text-gray-400 text-sm mt-1">Total de contas alt</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
            <p className="text-3xl font-bold text-orange-400">{members.length - accounts.length}</p>
            <p className="text-gray-400 text-sm mt-1">Sem contas cadastradas</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Buscar player..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 transition" />
        </div>

        {/* Cards Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <KeyRound className="h-16 w-16 text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg">Nenhuma conta cadastrada</p>
            <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white transition font-semibold">
              <Plus className="h-4 w-4" /> Cadastrar primeiro
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(acc => {
              const member = members.find(m => m.id === acc.userId);
              return (
                <div key={acc.id}
                  className="group bg-gray-800 border border-gray-700 hover:border-orange-600 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-orange-900/20 cursor-pointer"
                  onClick={() => { setViewingAccount(acc); setRevealedPasswords(new Set()); }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-orange-600/20 border border-orange-600/40 flex items-center justify-center shrink-0">
                        <UserIcon className="h-5 w-5 text-orange-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base">{acc.userNick}</h3>
                        <p className="text-gray-500 text-xs">{member?.classe ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(acc)}
                        className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-lg transition" title="Editar">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(acc)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Mini account list */}
                  <div className="flex flex-wrap gap-1.5">
                    {acc.accounts.slice(0, 5).map((en, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-md font-mono">
                        {en.nick || '?'} <span className="text-orange-400">{en.classe}</span>
                      </span>
                    ))}
                    {acc.accounts.length > 5 && (
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-500 text-xs rounded-md">+{acc.accounts.length - 5}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-700/50">
                    <span className="text-xs text-gray-600">{acc.accounts.length} conta{acc.accounts.length !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-orange-400 font-medium flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Ver detalhes
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Account Detail Modal ── */}
      {viewingAccount && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setViewingAccount(null); }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl my-8 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-600/20 border border-orange-600/40 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Contas de {viewingAccount.userNick}</h2>
                  <p className="text-gray-500 text-sm">{viewingAccount.accounts.length} conta(s) alt</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(viewingAccount)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-sm rounded-lg transition border border-yellow-600/30">
                  <Edit className="h-4 w-4" /> Editar
                </button>
                <button onClick={() => setViewingAccount(null)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    {['#', 'Nick', 'Classe', 'Login', 'Senha', 'Reborn', 'Meridiano', 'Cultivo', 'Pedra', 'Céu', 'Refino'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {viewingAccount.accounts.map((en, idx) => {
                    const revealed = revealedPasswords.has(idx);
                    const copyKey = `${idx}`;
                    return (
                      <tr key={idx} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-3 py-3 text-gray-600 text-xs">{idx + 1}</td>
                        <td className="px-3 py-3 font-semibold text-white whitespace-nowrap">{en.nick || '—'}</td>
                        <td className="px-3 py-3">
                          <span className="px-2 py-0.5 bg-orange-900/40 border border-orange-700/40 text-orange-300 text-xs rounded-md font-bold">{en.classe || '—'}</span>
                        </td>
                        {/* Login with copy */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 group/cell">
                            <span className="text-gray-300 font-mono text-xs">{en.login || '—'}</span>
                            {en.login && (
                              <button onClick={() => copyToClipboard(en.login, `login-${copyKey}`)}
                                className="opacity-0 group-hover/cell:opacity-100 transition p-0.5 text-gray-500 hover:text-orange-400">
                                {copiedCell === `login-${copyKey}` ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Password with reveal + copy */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 group/cell">
                            <span className="text-gray-300 font-mono text-xs">
                              {en.senha ? (revealed ? en.senha : '••••••••') : '—'}
                            </span>
                            {en.senha && (
                              <>
                                <button onClick={() => togglePassword(idx)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition p-0.5 text-gray-500 hover:text-orange-400">
                                  {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                                <button onClick={() => copyToClipboard(en.senha, `senha-${copyKey}`)}
                                  className="opacity-0 group-hover/cell:opacity-100 transition p-0.5 text-gray-500 hover:text-orange-400">
                                  {copiedCell === `senha-${copyKey}` ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-300">{en.reborn || '—'}</td>
                        <td className="px-3 py-3 text-gray-300">{en.meridiano || '—'}</td>
                        <td className="px-3 py-3 text-gray-300">{en.cultivo || '—'}</td>
                        <td className="px-3 py-3 text-gray-300">{en.pedra || '—'}</td>
                        <td className="px-3 py-3 text-gray-300">{en.ceu || '—'}</td>
                        <td className="px-3 py-3 text-gray-300">{en.refino || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Form Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-5xl my-8 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-orange-400" />
                {editingAccount ? `Editando: ${editingAccount.userNick}` : 'Cadastrar Contas 0800'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Member selector */}
              {!editingAccount && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Player *</label>
                  <div className="relative">
                    <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} required
                      className="w-full appearance-none pl-4 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition cursor-pointer">
                      <option value="">Selecione um membro...</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.nick} — {m.classe}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Accounts table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-300">Contas Alt</label>
                  <button type="button" onClick={addEntry}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-sm rounded-lg transition border border-orange-600/30">
                    <Plus className="h-4 w-4" /> Adicionar conta
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/80">
                      <tr>
                        {['Nick', 'Classe', 'Login', 'Senha', 'Reborn', 'Meridiano', 'Cultivo', 'Pedra', 'Céu', 'Refino', ''].map(h => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {entries.map((en, idx) => (
                        <tr key={idx} className="group/row">
                          {/* Nick */}
                          <td className="px-2 py-2">
                            <input value={en.nick} onChange={e => updateEntry(idx, 'nick', e.target.value)}
                              placeholder="Nick"
                              className="w-28 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                          </td>
                          {/* Classe */}
                          <td className="px-2 py-2">
                            <select value={en.classe} onChange={e => updateEntry(idx, 'classe', e.target.value)}
                              className="w-20 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer">
                              <option value="">—</option>
                              {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          {/* Login */}
                          <td className="px-2 py-2">
                            <input value={en.login} onChange={e => updateEntry(idx, 'login', e.target.value)}
                              placeholder="Login / E-mail"
                              className="w-36 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                          </td>
                          {/* Senha */}
                          <td className="px-2 py-2">
                            <input value={en.senha} onChange={e => updateEntry(idx, 'senha', e.target.value)}
                              placeholder="Senha"
                              className="w-28 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                          </td>
                          {/* Progression fields */}
                          {(['reborn', 'meridiano', 'cultivo', 'pedra', 'ceu', 'refino'] as const).map(field => (
                            <td key={field} className="px-2 py-2">
                              <input value={en[field]} onChange={e => updateEntry(idx, field, e.target.value)}
                                placeholder="—"
                                className="w-16 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500" />
                            </td>
                          ))}
                          {/* Remove */}
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => removeEntry(idx)}
                              className="opacity-0 group-hover/row:opacity-100 transition p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button type="submit"
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition">
                  <Save className="h-4 w-4" />{editingAccount ? 'Salvar Alterações' : 'Cadastrar Contas'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <AccountsContent />
    </ProtectedRoute>
  );
}
