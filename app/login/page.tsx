'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { LogIn, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { clan, loading: clanLoading } = useClan();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Email ou senha incorretos!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, var(--clan-bg) 0%, #1a0a0a 50%, var(--clan-bg) 100%)' }}
    >
      <div className="max-w-md w-full">
        {/* Logo + nome do clã */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {clanLoading ? (
              <div className="w-24 h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--clan-surface)' }} />
            ) : clan.logoUrl ? (
              <img
                src={clan.logoUrl}
                alt={clan.name}
                className="w-24 h-24 rounded-2xl object-cover shadow-2xl ring-2 ring-white/20"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-2xl"
                style={{ backgroundColor: 'var(--clan-primary)' }}
              >
                <Shield className="h-12 w-12 text-white" />
              </div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white">
            {clanLoading ? (
              <span className="inline-block w-40 h-8 rounded animate-pulse" style={{ backgroundColor: 'var(--clan-surface)' }} />
            ) : (
              clan.name
            )}
          </h1>
          {clan.game && !clanLoading && (
            <p className="text-sm mt-1" style={{ color: 'var(--clan-text-muted)' }}>
              {clan.game}
            </p>
          )}
        </div>

        {/* Card de login */}
        <div
          className="rounded-2xl shadow-2xl p-8 border"
          style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}
        >
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <LogIn className="h-5 w-5" style={{ color: 'var(--clan-primary)' }} />
            Entrar na sua conta
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-500 border outline-none transition focus:ring-2"
                style={{
                  backgroundColor: 'var(--clan-bg)',
                  borderColor: 'var(--clan-border)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--clan-primary)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--clan-border)')}
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--clan-text-muted)' }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg text-white placeholder-gray-500 border outline-none transition"
                style={{
                  backgroundColor: 'var(--clan-bg)',
                  borderColor: 'var(--clan-border)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--clan-primary)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--clan-border)')}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--clan-primary)' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = 'var(--clan-primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--clan-primary)')}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p style={{ color: 'var(--clan-text-muted)' }} className="text-sm">
              Não tem uma conta?{' '}
              <Link
                href="/register"
                className="font-semibold transition"
                style={{ color: 'var(--clan-primary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--clan-accent)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--clan-primary)')}
              >
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>

        {/* Rodapé sutil */}
        <p className="text-center text-xs mt-6" style={{ color: 'var(--clan-text-muted)' }}>
          Sistema de Gerenciamento de Clã
        </p>
      </div>
    </div>
  );
}
