import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ClanConfig, ClanTheme } from '@/types';

// ─── Tema e config padrão (Clã Infinity) ──────────────────────────────────────

export const DEFAULT_THEME: ClanTheme = {
  primary: '#e53e3e',
  primaryHover: '#c53030',
  secondary: '#4a5568',
  accent: '#ed8936',
  background: '#1a202c',
  surface: '#2d3748',
  surfaceHover: '#3d4a5c',
  border: '#4a5568',
  text: '#f7fafc',
  textMuted: '#a0aec0',
};

export const DEFAULT_CLAN: ClanConfig = {
  id: 'infinity',
  slug: 'infinity',
  name: 'Clã Infinity',
  domain: 'infinity-pw.vercel.app',
  logoUrl: '/logo-infinity.png',
  game: 'Perfect World',
  theme: DEFAULT_THEME,
  active: true,
  createdAt: new Date(),
};

// ─── Buscar clan pelo domínio no Firestore ────────────────────────────────────

export async function getClanByDomain(domain: string): Promise<ClanConfig> {
  try {
    // Remove porta (útil no localhost:3000)
    const cleanDomain = domain.split(':')[0];

    const q = query(
      collection(db, 'clans'),
      where('domain', '==', cleanDomain),
      where('active', '==', true)
    );
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const clanDoc = snapshot.docs[0];
      return {
        ...DEFAULT_CLAN,
        id: clanDoc.id,
        ...clanDoc.data(),
      } as ClanConfig;
    }

    // Tenta buscar pelo slug "infinity" se o domínio não foi encontrado
    const fallbackDoc = await getDoc(doc(db, 'clans', 'infinity'));
    if (fallbackDoc.exists()) {
      return { ...DEFAULT_CLAN, id: fallbackDoc.id, ...fallbackDoc.data() } as ClanConfig;
    }

    // Retorna config padrão se não houver nada no Firestore
    return DEFAULT_CLAN;
  } catch (error) {
    console.error('Erro ao buscar config do clã:', error);
    return DEFAULT_CLAN;
  }
}

// ─── Buscar clan pelo slug no Firestore ──────────────────────────────────────

export async function getClanBySlug(slug: string): Promise<ClanConfig> {
  try {
    const clanDoc = await getDoc(doc(db, 'clans', slug));
    if (clanDoc.exists()) {
      return { ...DEFAULT_CLAN, id: clanDoc.id, ...clanDoc.data() } as ClanConfig;
    }
    console.warn(`Clã "${slug}" não encontrado no Firestore. Usando config padrão.`);
    return DEFAULT_CLAN;
  } catch (error) {
    console.error('Erro ao buscar clã pelo slug:', error);
    return DEFAULT_CLAN;
  }
}

// ─── Aplicar tema via CSS Variables ──────────────────────────────────────────

export function applyClanTheme(theme: ClanTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--clan-primary', theme.primary);
  root.style.setProperty('--clan-primary-hover', theme.primaryHover);
  root.style.setProperty('--clan-secondary', theme.secondary);
  root.style.setProperty('--clan-accent', theme.accent);
  root.style.setProperty('--clan-bg', theme.background);
  root.style.setProperty('--clan-surface', theme.surface);
  root.style.setProperty('--clan-surface-hover', theme.surfaceHover);
  root.style.setProperty('--clan-border', theme.border);
  root.style.setProperty('--clan-text', theme.text);
  root.style.setProperty('--clan-text-muted', theme.textMuted);
}

// ─── Salvar config do clã no Firestore ───────────────────────────────────────

export async function saveClanConfig(slug: string, config: Partial<ClanConfig>): Promise<void> {
  await setDoc(doc(db, 'clans', slug), config, { merge: true });
}
