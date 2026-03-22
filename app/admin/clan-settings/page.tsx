'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { ClanConfig, ClanTheme } from '@/types';
import { DEFAULT_CLAN, DEFAULT_THEME, applyClanTheme } from '@/lib/clan';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useClan } from '@/contexts/ClanContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Shield, Upload, Save, Palette, Globe, ImageIcon,
  RefreshCw, ArrowLeft, CheckCircle, Eye,
} from 'lucide-react';
import Link from 'next/link';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ColorFieldProps {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}

// ─── Componente de campo de cor ───────────────────────────────────────────────

function ColorField({ label, description, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-700/50 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 font-mono">{value}</span>
        <div className="relative">
          <div
            className="w-9 h-9 rounded-lg border-2 border-gray-600 cursor-pointer shadow-inner"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

function ClanSettingsContent() {
  const { clan, refreshClan } = useClan();
  const { userData } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'theme' | 'domain'>('info');

  // ─── Form State ─────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [game, setGame] = useState('');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [theme, setTheme] = useState<ClanTheme>(DEFAULT_THEME);

  // ─── Carregar config atual ───────────────────────────────────────────────────
  useEffect(() => {
    if (clan) {
      setName(clan.name);
      setGame(clan.game || '');
      setDomain(clan.domain);
      setLogoUrl(clan.logoUrl || '');
      setTheme(clan.theme ?? DEFAULT_THEME);
    }
  }, [clan]);

  // ─── Preview do tema em tempo real ──────────────────────────────────────────
  useEffect(() => {
    applyClanTheme(theme);
  }, [theme]);

  const updateTheme = (key: keyof ClanTheme, value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Upload de Logo ──────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local imediato
    const localUrl = URL.createObjectURL(file);
    setLogoPreview(localUrl);

    setUploadingLogo(true);
    try {
      const storageRef = ref(storage, `clans/${clan.slug}/logo`);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setLogoUrl(downloadUrl);
      toast.success('Logo enviada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao enviar logo');
      setLogoPreview(null);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ─── Salvar configurações ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('O nome do clã é obrigatório');
      return;
    }
    if (!domain.trim()) {
      toast.error('O domínio é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const config: Omit<ClanConfig, 'id' | 'createdAt'> & { updatedAt: Date; updatedBy: string } = {
        slug: clan.slug,
        name: name.trim(),
        game: game.trim(),
        domain: domain.trim().toLowerCase(),
        logoUrl,
        theme,
        active: true,
        updatedAt: new Date(),
        updatedBy: userData?.id || '',
      };

      await setDoc(doc(db, 'clans', clan.slug), config, { merge: true });
      await refreshClan();
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // ─── Resetar tema para o padrão ──────────────────────────────────────────────
  const handleResetTheme = () => {
    setTheme(DEFAULT_THEME);
    toast('Tema resetado para o padrão', { icon: '🎨' });
  };

  // ─── Inicializar clã no Firestore (primeira vez) ──────────────────────────────
  const handleInitializeClan = async () => {
    setSaving(true);
    try {
      // Extrai o id e createdAt do DEFAULT_CLAN para não enviar ao Firestore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...clanData } = DEFAULT_CLAN;
      await setDoc(doc(db, 'clans', 'infinity'), {
        ...clanData,
        createdAt: new Date(),
      }, { merge: true });
      await refreshClan();
      toast.success('Clã inicializado no Firestore!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao inicializar clã');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'info' as const, label: 'Informações', icon: Shield },
    { id: 'theme' as const, label: 'Tema & Cores', icon: Palette },
    { id: 'domain' as const, label: 'Domínio', icon: Globe },
  ];

  const currentLogo = logoPreview || logoUrl;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--clan-bg)' }}>
      {/* Navbar */}
      <nav className="border-b" style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center"
                style={{ backgroundColor: 'var(--clan-primary)' }}>
                {currentLogo ? (
                  <img src={currentLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Shield className="h-5 w-5 text-white" />
                )}
              </div>
              <div>
                <span className="text-sm font-bold text-white">{name || 'Clã'}</span>
                <p className="text-xs" style={{ color: 'var(--clan-text-muted)' }}>Configurações White-Label</p>
              </div>
            </div>
            <Link href="/admin" className="flex items-center gap-2 text-sm transition"
              style={{ color: 'var(--clan-text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--clan-text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--clan-text-muted)')}
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
              <Palette className="h-8 w-8" style={{ color: 'var(--clan-primary)' }} />
              Personalização do Clã
            </h1>
            <p style={{ color: 'var(--clan-text-muted)' }}>
              Configure a identidade visual e as informações do seu clã
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleInitializeClan}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition"
              style={{ borderColor: 'var(--clan-border)', color: 'var(--clan-text-muted)' }}
              title="Inicializa o documento do clã no Firestore (use na primeira vez)"
            >
              <RefreshCw className={`h-4 w-4 ${saving ? 'animate-spin' : ''}`} />
              Inicializar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-white font-semibold text-sm transition"
              style={{ backgroundColor: 'var(--clan-primary)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--clan-primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--clan-primary)')}
            >
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar Tudo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Tabs */}
          <div className="lg:col-span-2">
            {/* Tab Navigation */}
            <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ backgroundColor: 'var(--clan-surface)' }}>
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition"
                  style={
                    activeTab === id
                      ? { backgroundColor: 'var(--clan-primary)', color: '#fff' }
                      : { color: 'var(--clan-text-muted)' }
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* ─── Tab: Informações ──────────────────────────────────────── */}
            {activeTab === 'info' && (
              <div className="rounded-xl p-6 border space-y-6"
                style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}>
                <h2 className="text-lg font-bold text-white">Informações do Clã</h2>

                {/* Logo */}
                <div>
                  <label className="block text-sm font-medium text-white mb-3">Logo do Clã</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden"
                      style={{ borderColor: 'var(--clan-border)', backgroundColor: 'var(--clan-bg)' }}>
                      {currentLogo ? (
                        <img src={currentLogo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        <ImageIcon className="h-8 w-8" style={{ color: 'var(--clan-text-muted)' }} />
                      )}
                    </div>
                    <div>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition text-white"
                        style={{ borderColor: 'var(--clan-primary)', backgroundColor: 'transparent' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--clan-primary)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {uploadingLogo ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingLogo ? 'Enviando...' : 'Enviar Logo'}
                      </button>
                      <p className="text-xs mt-1" style={{ color: 'var(--clan-text-muted)' }}>
                        PNG, JPG ou SVG. Recomendado: 200×200px
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Nome do Clã <span style={{ color: 'var(--clan-primary)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ex: Clã Infinity"
                    className="w-full rounded-lg px-4 py-2.5 text-white placeholder-gray-500 border outline-none focus:ring-2 transition"
                    style={{
                      backgroundColor: 'var(--clan-bg)',
                      borderColor: 'var(--clan-border)',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--clan-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--clan-border)')}
                  />
                </div>

                {/* Jogo */}
                <div>
                  <label className="block text-sm font-medium text-white mb-1">Jogo</label>
                  <input
                    type="text"
                    value={game}
                    onChange={e => setGame(e.target.value)}
                    placeholder="Ex: Perfect World, Ragnarok, Tibia..."
                    className="w-full rounded-lg px-4 py-2.5 text-white placeholder-gray-500 border outline-none transition"
                    style={{
                      backgroundColor: 'var(--clan-bg)',
                      borderColor: 'var(--clan-border)',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--clan-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--clan-border)')}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--clan-text-muted)' }}>
                    Aparece em textos de contexto no sistema
                  </p>
                </div>
              </div>
            )}

            {/* ─── Tab: Tema & Cores ────────────────────────────────────── */}
            {activeTab === 'theme' && (
              <div className="rounded-xl p-6 border"
                style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-white">Tema & Cores</h2>
                  <button
                    onClick={handleResetTheme}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition"
                    style={{ color: 'var(--clan-text-muted)', backgroundColor: 'var(--clan-bg)' }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Resetar
                  </button>
                </div>

                <div className="space-y-0">
                  <ColorField
                    label="Cor Principal"
                    description="Botões, badges de destaque e ícones ativos"
                    value={theme.primary}
                    onChange={v => updateTheme('primary', v)}
                  />
                  <ColorField
                    label="Cor Principal (hover)"
                    description="Tom mais escuro da cor principal ao passar o mouse"
                    value={theme.primaryHover}
                    onChange={v => updateTheme('primaryHover', v)}
                  />
                  <ColorField
                    label="Cor de Destaque"
                    description="Tags, badges secundários e texto de ênfase"
                    value={theme.accent}
                    onChange={v => updateTheme('accent', v)}
                  />
                  <ColorField
                    label="Fundo do App"
                    description="Background principal de todas as páginas"
                    value={theme.background}
                    onChange={v => updateTheme('background', v)}
                  />
                  <ColorField
                    label="Superfície (cards)"
                    description="Background de cards, painéis e modais"
                    value={theme.surface}
                    onChange={v => updateTheme('surface', v)}
                  />
                  <ColorField
                    label="Superfície (hover)"
                    description="Tom mais claro da superfície ao interagir"
                    value={theme.surfaceHover}
                    onChange={v => updateTheme('surfaceHover', v)}
                  />
                  <ColorField
                    label="Bordas"
                    description="Cor das bordas e divisores"
                    value={theme.border}
                    onChange={v => updateTheme('border', v)}
                  />
                  <ColorField
                    label="Texto Principal"
                    description="Cor do texto padrão"
                    value={theme.text}
                    onChange={v => updateTheme('text', v)}
                  />
                  <ColorField
                    label="Texto Secundário"
                    description="Legendas, descrições e textos de suporte"
                    value={theme.textMuted}
                    onChange={v => updateTheme('textMuted', v)}
                  />
                </div>

                <div className="mt-4 p-3 rounded-lg flex items-center gap-2 text-sm"
                  style={{ backgroundColor: 'var(--clan-bg)', color: 'var(--clan-text-muted)' }}>
                  <Eye className="h-4 w-4 shrink-0" />
                  As cores são aplicadas em tempo real — veja o resultado enquanto edita!
                </div>
              </div>
            )}

            {/* ─── Tab: Domínio ──────────────────────────────────────────── */}
            {activeTab === 'domain' && (
              <div className="rounded-xl p-6 border space-y-6"
                style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}>
                <h2 className="text-lg font-bold text-white">Configuração de Domínio</h2>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Domínio do Clã <span style={{ color: 'var(--clan-primary)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={domain}
                    onChange={e => setDomain(e.target.value)}
                    placeholder="Ex: cla-infinity.com ou infinity-pw.vercel.app"
                    className="w-full rounded-lg px-4 py-2.5 text-white placeholder-gray-500 border outline-none font-mono text-sm transition"
                    style={{
                      backgroundColor: 'var(--clan-bg)',
                      borderColor: 'var(--clan-border)',
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'var(--clan-primary)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'var(--clan-border)')}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--clan-text-muted)' }}>
                    Sem https:// — apenas o domínio puro
                  </p>
                </div>

                {/* Guia passo a passo */}
                <div className="rounded-xl border p-5 space-y-4"
                  style={{ borderColor: 'var(--clan-border)', backgroundColor: 'var(--clan-bg)' }}>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="h-4 w-4" style={{ color: 'var(--clan-primary)' }} />
                    Como adicionar um domínio na Vercel
                  </h3>
                  <ol className="space-y-3">
                    {[
                      {
                        step: 1,
                        title: 'Acesse o projeto na Vercel',
                        desc: 'Em vercel.com → seu projeto → Settings → Domains',
                      },
                      {
                        step: 2,
                        title: 'Adicione o domínio do clã',
                        desc: 'Digite o domínio (ex: cla-dragao.com) e clique em "Add"',
                      },
                      {
                        step: 3,
                        title: 'Configure o DNS',
                        desc: 'No painel do registrador do domínio, adicione o registro CNAME apontado pela Vercel (cname.vercel-dns.com)',
                      },
                      {
                        step: 4,
                        title: 'Salve aqui',
                        desc: 'Coloque o mesmo domínio no campo acima e salve. O sistema vai carregar as cores e logo corretas automaticamente!',
                      },
                    ].map(({ step, title, desc }) => (
                      <li key={step} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white mt-0.5"
                          style={{ backgroundColor: 'var(--clan-primary)' }}>
                          {step}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--clan-text-muted)' }}>{desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg border"
                  style={{ borderColor: 'var(--clan-primary)', backgroundColor: 'var(--clan-primary)22' }}>
                  <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--clan-primary)' }} />
                  <div>
                    <p className="text-sm font-medium text-white">SSL automático</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--clan-text-muted)' }}>
                      A Vercel provisiona HTTPS automaticamente para todos os domínios adicionados. Nenhuma configuração extra necessária.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="space-y-4">
            <div className="rounded-xl p-5 border sticky top-6"
              style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}>
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: 'var(--clan-primary)' }} />
                Preview
              </h3>

              {/* Mini-preview do sistema */}
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--clan-border)' }}>
                {/* Fake navbar */}
                <div className="px-3 py-2 flex items-center gap-2"
                  style={{ backgroundColor: 'var(--clan-surface-hover)' }}>
                  <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center"
                    style={{ backgroundColor: 'var(--clan-primary)' }}>
                    {currentLogo ? (
                      <img src={currentLogo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Shield className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <span className="text-xs font-bold text-white truncate">{name || 'Clã'}</span>
                </div>
                {/* Fake content */}
                <div className="p-3 space-y-2" style={{ backgroundColor: 'var(--clan-bg)' }}>
                  <div className="h-8 rounded-lg"
                    style={{ background: `linear-gradient(to right, var(--clan-primary), var(--clan-primary-hover))` }} />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-10 rounded-md" style={{ backgroundColor: 'var(--clan-surface)' }} />
                    <div className="h-10 rounded-md" style={{ backgroundColor: 'var(--clan-surface)' }} />
                  </div>
                  <div className="h-2 rounded w-3/4" style={{ backgroundColor: 'var(--clan-surface)' }} />
                  <div className="h-2 rounded w-1/2" style={{ backgroundColor: 'var(--clan-surface)' }} />
                </div>
              </div>

              {/* Paleta de cores */}
              <div className="mt-4">
                <p className="text-xs mb-2" style={{ color: 'var(--clan-text-muted)' }}>Paleta de cores</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    theme.primary, theme.accent, theme.background,
                    theme.surface, theme.surfaceHover, theme.border,
                    theme.text, theme.textMuted,
                  ].map((color, i) => (
                    <div key={i} title={color}
                      className="w-6 h-6 rounded-md border"
                      style={{ backgroundColor: color, borderColor: 'var(--clan-border)' }}
                    />
                  ))}
                </div>
              </div>

              {/* Info do clã */}
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--clan-text-muted)' }}>Slug</span>
                  <span className="font-mono text-white">{clan.slug}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--clan-text-muted)' }}>Domínio</span>
                  <span className="font-mono text-white truncate max-w-[120px]">{domain || '—'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'var(--clan-text-muted)' }}>Jogo</span>
                  <span className="text-white">{game || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Export com proteção de rota (admin only) ─────────────────────────────────

export default function ClanSettingsPage() {
  return (
    <ProtectedRoute requireAdmin>
      <ClanSettingsContent />
    </ProtectedRoute>
  );
}
