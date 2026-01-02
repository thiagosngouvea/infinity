'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Notification } from '@/types';
import { Bell, X } from 'lucide-react';

export default function NotificationBell() {
  const { userData } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (userData) {
      loadNotifications();
      // Recarregar a cada 30 segundos
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [userData]);

  const loadNotifications = async () => {
    if (!userData) return;

    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userData.id),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(notifQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      } as Notification));
      
      setNotifications(list);
      setUnreadCount(list.filter(n => !n.read).length);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true
      });
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar como lida:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read);
      await Promise.all(
        unreadNotifs.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }))
      );
      loadNotifications();
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'raffle_win':
        return '🎉';
      case 'approval':
        return '✅';
      case 'event':
        return '📅';
      default:
        return '📢';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="relative p-2 text-gray-300 hover:text-white transition"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowPanel(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-50 max-h-[500px] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Notificações</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  onClick={() => setShowPanel(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-12 w-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 cursor-pointer transition ${
                        notif.read 
                          ? 'bg-gray-800 hover:bg-gray-750' 
                          : 'bg-gray-700 hover:bg-gray-650'
                      }`}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getNotificationIcon(notif.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white flex items-center gap-2">
                            {notif.title}
                            {!notif.read && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            )}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">{notif.message}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {notif.createdAt.toLocaleDateString('pt-BR')} às{' '}
                            {notif.createdAt.toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

