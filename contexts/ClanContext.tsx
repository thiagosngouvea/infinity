'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ClanConfig } from '@/types';
import { getClanByDomain, DEFAULT_CLAN, applyClanTheme } from '@/lib/clan';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ClanContextType {
  clan: ClanConfig;
  loading: boolean;
  refreshClan: () => Promise<void>;
}

const ClanContext = createContext<ClanContextType>({
  clan: DEFAULT_CLAN,
  loading: true,
  refreshClan: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ClanProvider({ children }: { children: React.ReactNode }) {
  const [clan, setClan] = useState<ClanConfig>(DEFAULT_CLAN);
  const [loading, setLoading] = useState(true);

  const loadClan = async () => {
    try {
      const hostname = window.location.hostname;
      const params = new URLSearchParams(window.location.search);

      // 1. Query param para dev: localhost:3000?clan=dragao
      const clanParam = params.get('clan');

      // 2. Env var para ambientes de preview/staging: NEXT_PUBLIC_CLAN_SLUG=dragao
      const clanEnv = process.env.NEXT_PUBLIC_CLAN_SLUG;

      let config: ClanConfig;

      if (clanParam || clanEnv) {
        // Busca pelo slug direto no Firestore
        const slug = clanParam || clanEnv!;
        const { getClanBySlug } = await import('@/lib/clan');
        config = await getClanBySlug(slug);
      } else {
        // Produção: detecta pelo domínio
        config = await getClanByDomain(hostname);
      }

      setClan(config);
      applyClanTheme(config.theme);
      document.title = config.name;
    } catch (error) {
      console.error('Erro ao carregar config do clã:', error);
      applyClanTheme(DEFAULT_CLAN.theme);
    } finally {
      setLoading(false);
    }
  };

  const refreshClan = async () => {
    await loadClan();
  };

  useEffect(() => {
    loadClan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ClanContext.Provider value={{ clan, loading, refreshClan }}>
      {children}
    </ClanContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useClan = () => useContext(ClanContext);
