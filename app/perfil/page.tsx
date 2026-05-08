'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { clanDoc, clanCol, COLS } from '@/lib/paths';
import { NickHistoryEntry, PlayerClass } from '@/types';
import {
  Shield,
  ArrowLeft,
  User,
  Save,
  Clock,
  ChevronRight,
  Sword,
  Phone,
  MessageCircle,
  Edit3,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import LoadingLogo from '@/components/LoadingLogo';
import toast from 'react-hot-toast';

const PLAYER_CLASSES: PlayerClass[] = [
  'Guerreiro',
  'Arqueiro',
  'Mago',
  'Sacerdote',
  'Bárbaro',
  'Arcano',
  'Mistico',
  'Feiticeira',
  'Mercenário',
  'Espiritualista',
];

const CLASS_COLORS: Record<PlayerClass, string> = {
  Guerreiro:     '#ef4444',
  Arqueiro:      '#22c55e',
  Mago:          '#a855f7',
  Sacerdote:     '#f59e0b',
  Bárbaro:       '#f97316',
  Arcano:        '#06b6d4',
  Mistico:       '#ec4899',
  Feiticeira:    '#8b5cf6',
  Mercenário:    '#64748b',
  Espiritualista:'#14b8a6',
};

// ─── Helper ────────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);

  if (minutes < 1)  return 'agora mesmo';
  if (minutes < 60) return `há ${minutes} min`;
  if (hours   < 24) return `há ${hours}h`;
  if (days    < 30) return `há ${days} dias`;
  return formatDate(date);
}

// ─── Main Component ────────────────────────────────────────────────────────────

function PerfilContent() {
  const { userData, user, refreshUserData } = useAuth();
  const { clan } = useClan();

  const [nick, setNick]         = useState(userData?.nick ?? '');
  const [classe, setClasse]     = useState<PlayerClass>(userData?.classe ?? 'Guerreiro');
  const [telefone, setTelefone] = useState(userData?.telefone ?? '');
  const [whatsapp, setWhatsapp] = useState(userData?.whatsapp ?? '');

  const [history, setHistory]     = useState<NickHistoryEntry[]>([]);
  const [saving, setSaving]       = useState(false);
  const [loadingHist, setLoadingHist] = useState(true);
  const [editMode, setEditMode]   = useState(false);

  // ─── Sync form when userData loads ──────────────────────────────────────────
  useEffect(() => {
    if (userData) {
      setNick(userData.nick);
      setClasse(userData.classe);
      setTelefone(userData.telefone ?? '');
      setWhatsapp(userData.whatsapp ?? '');
    }
  }, [userData]);

  // ─── Load nick history ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!userData || !clan.slug) return;
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?.id, clan.slug]);

  const loadHistory = async () => {
    if (!userData) return;
    setLoadingHist(true);
    try {
      // Subcoleção: /clans/{clanSlug}/users/{userId}/nickHistory
      const histCol = collection(
        db,
        'clans', clan.slug,
        COLS.users, userData.id,
        COLS.nickHistory,
      );
      const q = query(histCol, orderBy('changedAt', 'desc'));
      const snap = await getDocs(q);
      const entries: NickHistoryEntry[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        changedAt: d.data().changedAt.toDate(),
      } as NickHistoryEntry));
      setHistory(entries);
    } catch (e) {
      console.error('Erro ao carregar histórico:', e);
    } finally {
      setLoadingHist(false);
    }
  };

  // ─── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!userData || !user) return;
    if (!nick.trim()) {
      toast.error('O nick não pode ser vazio.');
      return;
    }

    setSaving(true);
    try {
      const userRef = clanDoc(clan.slug, COLS.users, userData.id);
      const nickChanged = nick.trim() !== userData.nick;

      // Atualiza documento do usuário
      await updateDoc(userRef, {
        nick: nick.trim(),
        classe,
        telefone: telefone.trim(),
        whatsapp: whatsapp.trim(),
      });

      // Registra histórico se o nick mudou
      if (nickChanged) {
        const histCol = collection(
          db,
          'clans', clan.slug,
          COLS.users, userData.id,
          COLS.nickHistory,
        );
        await addDoc(histCol, {
          nick: nick.trim(),
          previousNick: userData.nick,
          changedAt: new Date(),
          changedBy: user.uid,
        });
        await loadHistory();
      }

      await refreshUserData();
      setEditMode(false);
      toast.success('Perfil atualizado com sucesso!');
    } catch (e) {
      console.error('Erro ao salvar:', e);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (userData) {
      setNick(userData.nick);
      setClasse(userData.classe);
      setTelefone(userData.telefone ?? '');
      setWhatsapp(userData.whatsapp ?? '');
    }
    setEditMode(false);
  };

  if (!userData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingLogo size={128} fullscreen={false} />
      </div>
    );
  }

  const classColor = CLASS_COLORS[userData.classe] ?? '#a0aec0';
  const avatarLetter = userData.nick?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen" style={{ background: 'var(--clan-bg)' }}>

      {/* ─── Navbar ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: 'var(--clan-surface)', borderBottom: '1px solid var(--clan-border)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clan.logoUrl ? (
              <img src={clan.logoUrl} alt={clan.name} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <Shield className="h-8 w-8" style={{ color: 'var(--clan-primary)' }} />
            )}
            <span className="text-lg font-bold" style={{ color: 'var(--clan-text)' }}>{clan.name}</span>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ color: 'var(--clan-text-muted)', background: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--clan-text)';
              (e.currentTarget as HTMLElement).style.background = 'var(--clan-surface-hover)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = 'var(--clan-text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Link>
        </div>
      </nav>

      {/* ─── Page Content ───────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        {/* Hero Card */}
        <div
          className="relative rounded-2xl overflow-hidden p-8"
          style={{
            background: 'linear-gradient(135deg, var(--clan-surface) 0%, var(--clan-surface-hover) 100%)',
            border: '1px solid var(--clan-border)',
          }}
        >
          {/* Glow behind avatar */}
          <div
            className="absolute top-0 left-0 w-64 h-64 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ background: classColor, transform: 'translate(-20%, -30%)' }}
          />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div
              className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-extrabold shadow-lg flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${classColor}33, ${classColor}66)`,
                border: `2px solid ${classColor}88`,
                color: classColor,
              }}
            >
              {avatarLetter}
            </div>

            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-extrabold" style={{ color: 'var(--clan-text)' }}>
                {userData.nick}
              </h1>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                <span
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold"
                  style={{ background: `${classColor}22`, color: classColor, border: `1px solid ${classColor}44` }}
                >
                  <Sword className="h-3 w-3" />
                  {userData.classe}
                </span>
                <span
                  className="text-sm"
                  style={{ color: 'var(--clan-text-muted)' }}
                >
                  {userData.pontos} pontos
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--clan-text-muted)' }}>
                {userData.email}
              </p>
            </div>

            {/* Edit toggle */}
            {!editMode && (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 self-start"
                style={{
                  background: 'var(--clan-primary)',
                  color: 'var(--clan-text)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--clan-primary-hover)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clan-primary)'}
              >
                <Edit3 className="h-4 w-4" />
                Editar
              </button>
            )}
          </div>
        </div>

        {/* ─── Form Card ──────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--clan-surface)',
            border: '1px solid var(--clan-border)',
          }}
        >
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--clan-text)' }}>
            <User className="h-5 w-5" style={{ color: 'var(--clan-primary)' }} />
            Dados Pessoais
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Nick */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                Nick / Nome no jogo
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={nick}
                  onChange={e => setNick(e.target.value)}
                  placeholder="Seu nick"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-primary)'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-border)'}
                />
              ) : (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                >
                  {userData.nick}
                </div>
              )}
            </div>

            {/* Classe */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                Classe
              </label>
              {editMode ? (
                <select
                  value={classe}
                  onChange={e => setClasse(e.target.value as PlayerClass)}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 appearance-none"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-primary)'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-border)'}
                >
                  {PLAYER_CLASSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <div
                  className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CLASS_COLORS[userData.classe] ?? '#a0aec0' }}
                  />
                  {userData.classe}
                </div>
              )}
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone
                </span>
              </label>
              {editMode ? (
                <input
                  type="tel"
                  value={telefone}
                  onChange={e => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-primary)'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-border)'}
                />
              ) : (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: userData.telefone ? 'var(--clan-text)' : 'var(--clan-text-muted)',
                  }}
                >
                  {userData.telefone || '—'}
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </span>
              </label>
              {editMode ? (
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: 'var(--clan-text)',
                  }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-primary)'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--clan-border)'}
                />
              ) : (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: 'var(--clan-surface-hover)',
                    border: '1px solid var(--clan-border)',
                    color: userData.whatsapp ? 'var(--clan-text)' : 'var(--clan-text-muted)',
                  }}
                >
                  {userData.whatsapp || '—'}
                </div>
              )}
            </div>

            {/* E-mail (read-only) */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                E-mail (não editável)
              </label>
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{
                  background: 'var(--clan-surface-hover)',
                  border: '1px solid var(--clan-border)',
                  color: 'var(--clan-text-muted)',
                  opacity: 0.7,
                }}
              >
                {userData.email}
              </div>
            </div>

          </div>

          {/* Action Buttons */}
          {editMode && (
            <div className="flex gap-3 mt-8 pt-6" style={{ borderTop: '1px solid var(--clan-border)' }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                style={{
                  background: 'var(--clan-primary)',
                  color: 'var(--clan-text)',
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.background = 'var(--clan-primary-hover)'; }}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--clan-primary)'}
              >
                {saving ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border-2 animate-spin"
                      style={{ borderColor: 'var(--clan-text)', borderTopColor: 'transparent' }}
                    />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar alterações
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60"
                style={{
                  background: 'var(--clan-surface-hover)',
                  color: 'var(--clan-text-muted)',
                  border: '1px solid var(--clan-border)',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--clan-text)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--clan-text-muted)'}
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* ─── Nick History Card ───────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--clan-surface)',
            border: '1px solid var(--clan-border)',
          }}
        >
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2" style={{ color: 'var(--clan-text)' }}>
            <Clock className="h-5 w-5" style={{ color: 'var(--clan-primary)' }} />
            Histórico de Nomes
          </h2>

          {loadingHist ? (
            <div className="flex justify-center py-8">
              <div
                className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--clan-border)', borderTopColor: 'var(--clan-primary)' }}
              />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <CheckCircle className="h-10 w-10" style={{ color: 'var(--clan-text-muted)', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: 'var(--clan-text-muted)' }}>
                Nenhuma alteração de nick registrada ainda.
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical line */}
              <div
                className="absolute left-5 top-0 bottom-0 w-px"
                style={{ background: 'var(--clan-border)' }}
              />

              <div className="space-y-0">
                {history.map((entry, idx) => (
                  <div key={entry.id} className="relative flex items-start gap-4 pb-6">
                    {/* Node */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10"
                      style={{
                        background: idx === 0 ? 'var(--clan-primary)' : 'var(--clan-surface-hover)',
                        border: `2px solid ${idx === 0 ? 'var(--clan-primary)' : 'var(--clan-border)'}`,
                      }}
                    >
                      <User className="h-4 w-4" style={{ color: idx === 0 ? 'white' : 'var(--clan-text-muted)' }} />
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 rounded-xl p-4 mt-1"
                      style={{
                        background: idx === 0 ? `color-mix(in srgb, var(--clan-primary) 8%, var(--clan-surface-hover))` : 'var(--clan-surface-hover)',
                        border: `1px solid ${idx === 0 ? 'var(--clan-primary)' : 'var(--clan-border)'}`,
                        opacity: idx === 0 ? 1 : 0.75,
                      }}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: 'var(--clan-surface)',
                              color: 'var(--clan-text-muted)',
                              border: '1px solid var(--clan-border)',
                            }}
                          >
                            {entry.previousNick}
                          </span>
                          <ChevronRight className="h-3 w-3" style={{ color: 'var(--clan-text-muted)' }} />
                          <span
                            className="text-sm font-bold"
                            style={{ color: idx === 0 ? 'var(--clan-primary)' : 'var(--clan-text)' }}
                          >
                            {entry.nick}
                          </span>
                          {idx === 0 && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: 'var(--clan-primary)', color: 'white' }}
                            >
                              atual
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium" style={{ color: 'var(--clan-text-muted)' }}>
                            {timeAgo(entry.changedAt)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--clan-text-muted)', opacity: 0.6 }}>
                            {formatDate(entry.changedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default function PerfilPage() {
  return (
    <ProtectedRoute>
      <PerfilContent />
    </ProtectedRoute>
  );
}
