'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event, Notification } from '@/types';
import { Shield, Trophy, Calendar, Gift, Bell, LogOut, Users, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NotificationBell from '@/components/NotificationBell';

function DashboardContent() {
  const { userData, signOut } = useAuth();
  const router = useRouter();
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userData]);

  const loadData = async () => {
    if (!userData) return;

    try {
      // Carregar eventos ativos
      const eventsQuery = query(
        collection(db, 'events'),
        where('active', '==', true),
        orderBy('date', 'asc'),
        limit(5)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const events = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as Event));
      setUpcomingEvents(events);

      // Carregar notificações não lidas
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userData.id),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const notifSnapshot = await getDocs(notifQuery);
      const notifs = notifSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      } as Notification));
      setNotifications(notifs);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-purple-500" />
              <span className="text-xl font-bold text-white">Clã Infinity</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">{userData?.nick}</span>
              {userData?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
                >
                  <Users className="h-4 w-4" />
                  Admin
                </Link>
              )}
              <NotificationBell />
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white transition"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Bem-vindo, {userData?.nick}!
          </h1>
          <p className="text-gray-400">
            {userData?.classe} • {userData?.pontos} pontos
          </p>
        </div>

        {/* Cards de Ação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link
            href="/events"
            className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg p-6 hover:from-blue-700 hover:to-blue-900 transition cursor-pointer"
          >
            <Calendar className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Eventos</h3>
            <p className="text-blue-200 text-sm">Votar em eventos</p>
          </Link>

          <Link
            href="/attendance"
            className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-6 hover:from-green-700 hover:to-green-900 transition cursor-pointer"
          >
            <CheckCircle className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Presença</h3>
            <p className="text-green-200 text-sm">Marcar presença</p>
          </Link>

          <Link
            href="/raffles"
            className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg p-6 hover:from-purple-700 hover:to-purple-900 transition cursor-pointer"
          >
            <Gift className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Sorteios</h3>
            <p className="text-purple-200 text-sm">Participar de sorteios</p>
          </Link>

          <Link
            href="/ranking"
            className="bg-gradient-to-br from-yellow-600 to-yellow-800 rounded-lg p-6 hover:from-yellow-700 hover:to-yellow-900 transition cursor-pointer"
          >
            <Trophy className="h-10 w-10 text-white mb-3" />
            <h3 className="text-xl font-bold text-white mb-1">Ranking</h3>
            <p className="text-yellow-200 text-sm">Ver classificação</p>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Próximos Eventos */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Próximos Eventos
            </h2>
            {upcomingEvents.length === 0 ? (
              <p className="text-gray-400">Nenhum evento ativo no momento</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-1">{event.title}</h3>
                    <p className="text-sm text-gray-400 mb-2">{event.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {event.date.toLocaleDateString('pt-BR')} às {event.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs px-2 py-1 bg-purple-600 rounded-full text-white">
                        {event.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notificações */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Bell className="h-6 w-6" />
              Notificações
              {notifications.length > 0 && (
                <span className="ml-2 px-2 py-1 bg-red-600 rounded-full text-xs">
                  {notifications.length}
                </span>
              )}
            </h2>
            {notifications.length === 0 ? (
              <p className="text-gray-400">Nenhuma notificação nova</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="bg-gray-700 rounded-lg p-4">
                    <h3 className="font-semibold text-white mb-1">{notif.title}</h3>
                    <p className="text-sm text-gray-400">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}

