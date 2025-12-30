'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Clock, Shield } from 'lucide-react';

export default function PendingApproval() {
  const { user, userData, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    } else if (userData && userData.role !== 'pending') {
      router.push('/dashboard');
    }
  }, [user, userData, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Shield className="h-16 w-16 text-purple-500" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Clã Infinity</h1>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700">
          <div className="text-center mb-6">
            <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Aguardando Aprovação</h2>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Nick</p>
              <p className="text-white font-semibold">{userData.nick}</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Classe</p>
              <p className="text-white font-semibold">{userData.classe}</p>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">Email</p>
              <p className="text-white font-semibold">{userData.email}</p>
            </div>
          </div>

          <div className="p-4 bg-yellow-900/30 border border-yellow-700 rounded-lg mb-6">
            <p className="text-sm text-yellow-200">
              Seu cadastro foi enviado com sucesso! Um administrador do clã irá analisar suas informações e aprovar sua conta em breve.
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-lg transition duration-200"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

