'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { UserPlus, Shield } from 'lucide-react';
import { PlayerClass } from '@/types';

const classes: PlayerClass[] = [
  'Guerreiro',
  'Arqueiro',
  'Mago',
  'Sacerdote',
  'Bárbaro',
  'Arcano',
  'Mistico',
  'Feiticeira',
  'Mercenário',
  'Espiritualista'
];

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nick, setNick] = useState('');
  const [classe, setClasse] = useState<PlayerClass>('Guerreiro');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { clan, loading: clanLoading } = useClan();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await register(email, password, {
        nick,
        classe,
        telefone,
        whatsapp,
        email
      });
      toast.success('Cadastro realizado! Aguarde aprovação do admin.');
      router.push('/pending-approval');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Este email já está em uso!');
      } else {
        toast.error('Erro ao realizar cadastro!');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: 'linear-gradient(135deg, var(--clan-bg) 0%, #1a0a0a 50%, var(--clan-bg) 100%)' }}
    >
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {clanLoading ? (
              <div className="w-20 h-20 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--clan-surface)' }} />
            ) : clan.logoUrl ? (
              <img src={clan.logoUrl} alt={clan.name} className="w-20 h-20 rounded-2xl object-cover shadow-2xl" />
            ) : (
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl" style={{ backgroundColor: 'var(--clan-primary)' }}>
                <Shield className="h-10 w-10 text-white" />
              </div>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">{clan.name}</h1>
          {clan.game && <p className="text-sm" style={{ color: 'var(--clan-text-muted)' }}>{clan.game}</p>}
        </div>

        <div
          className="rounded-2xl shadow-2xl p-8 border"
          style={{ backgroundColor: 'var(--clan-surface)', borderColor: 'var(--clan-border)' }}
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <UserPlus className="h-6 w-6" style={{ color: 'var(--clan-primary)' }} />
            Cadastro de Membro
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="seu@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nick no Jogo *
                </label>
                <input
                  type="text"
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="SeuNick"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Classe *
                </label>
                <select
                  value={classe}
                  onChange={(e) => setClasse(e.target.value as PlayerClass)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {classes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Telefone *
                </label>
                <input
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="(11) 98888-8888"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  WhatsApp *
                </label>
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="(11) 98888-8888"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-6"
              style={{ backgroundColor: 'var(--clan-primary)' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = 'var(--clan-primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'var(--clan-primary)')}
            >
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p style={{ color: 'var(--clan-text-muted)' }}>
              Já tem uma conta?{' '}
              <Link href="/login" className="font-semibold" style={{ color: 'var(--clan-primary)' }}>Faça login</Link>
            </p>
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <p className="text-sm text-gray-300">
              <strong>Importante:</strong> Após o cadastro, sua conta precisará ser aprovada por um administrador do clã antes de ter acesso completo ao sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

