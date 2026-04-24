'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, where, getDocs, addDoc, orderBy, updateDoc, increment } from 'firebase/firestore';
import { Attendance } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { CheckCircle, ArrowLeft, Calendar, Award } from 'lucide-react';
import Link from 'next/link';
import LoadingLogo from '@/components/LoadingLogo';

function AttendanceContent() {
  const { userData, refreshUserData } = useAuth();
  const { clan } = useClan();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCheckIn, setCanCheckIn] = useState(false);

  // Verifica se o sistema de presença está ativo (default true caso o campo não exista)
  const attendanceEnabled = clan.attendanceEnabled !== false;

  useEffect(() => {
    if (attendanceEnabled) {
      loadAttendances();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, attendanceEnabled]);

  const loadAttendances = async () => {
    if (!userData) return;

    try {
      const attendanceQuery = query(
        clanCol(clan.slug, COLS.attendances),
        where('userId', '==', userData.id),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(attendanceQuery);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        createdAt: doc.data().createdAt.toDate()
      } as Attendance));
      setAttendances(list);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hasCheckedInToday = list.some(att => {
        const attDate = new Date(att.date);
        attDate.setHours(0, 0, 0, 0);
        return attDate.getTime() === today.getTime();
      });
      setCanCheckIn(!hasCheckedInToday);
    } catch (error) {
      console.error('Erro ao carregar presenças:', error);
      toast.error('Erro ao carregar presenças');
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async () => {
    if (!userData) return;
    try {
      const pontos = 10;
      await addDoc(clanCol(clan.slug, COLS.attendances), {
        userId: userData.id,
        userName: userData.nick,
        date: new Date(),
        pontos,
        createdBy: userData.id,
        createdAt: new Date()
      });
      await updateDoc(clanDoc(clan.slug, COLS.users, userData.id), {
        pontos: increment(pontos),
        totalPointsEarned: increment(pontos)
      });
      toast.success(`Presença registrada! +${pontos} pontos`);
      await refreshUserData();
      loadAttendances();
    } catch (error) {
      console.error('Erro ao registrar presença:', error);
      toast.error('Erro ao registrar presença');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingLogo size={128} fullscreen={false} />
      </div>
    );
  }

  // ─── Sistema desativado ────────────────────────────────────────────────────
  if (!attendanceEnabled) {
    return (
      <div className="min-h-screen bg-gray-900">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
                <ArrowLeft className="h-5 w-5" />
                Voltar
              </Link>
              <h1 className="text-xl font-bold text-white">Presença Diária</h1>
              <div className="w-20"></div>
            </div>
          </div>
        </nav>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center text-center">
          <div className="bg-gray-800 rounded-2xl p-12 border border-gray-700 max-w-md w-full">
            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Funcionalidade Desativada</h2>
            <p className="text-gray-400 mb-8 leading-relaxed">
              O sistema de presença diária está desativado no momento.
              Entre em contato com um administrador do clã para mais informações.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Sistema ativo ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Presença Diária</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Card de Check-in */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-lg p-8 mb-8 text-center">
          <CheckCircle className="h-16 w-16 text-white mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Presença Diária</h2>
          <p className="text-green-100 mb-6">
            Marque sua presença diariamente e ganhe pontos!
          </p>

          {canCheckIn ? (
            <button
              onClick={checkIn}
              className="bg-white hover:bg-gray-100 text-green-700 font-bold py-3 px-8 rounded-lg transition text-lg"
            >
              Marcar Presença (+10 pontos)
            </button>
          ) : (
            <div className="bg-green-700 text-white py-3 px-8 rounded-lg inline-block">
              ✓ Presença já registrada hoje!
            </div>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <Award className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm mb-1">Total de Pontos</p>
            <p className="text-2xl font-bold text-white">{userData?.pontos || 0}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm mb-1">Presenças</p>
            <p className="text-2xl font-bold text-white">{attendances.length}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
            <Calendar className="h-8 w-8 text-blue-500 mx-auto mb-2" />
            <p className="text-gray-400 text-sm mb-1">Este Mês</p>
            <p className="text-2xl font-bold text-white">
              {attendances.filter(att => {
                const attDate = new Date(att.date);
                const now = new Date();
                return attDate.getMonth() === now.getMonth() &&
                  attDate.getFullYear() === now.getFullYear();
              }).length}
            </p>
          </div>
        </div>

        {/* Histórico de Presenças */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="h-6 w-6" />
            Histórico de Presenças
          </h2>

          {attendances.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Nenhuma presença registrada ainda</p>
          ) : (
            <div className="space-y-2">
              {attendances.map((attendance) => (
                <div
                  key={attendance.id}
                  className="bg-gray-700 rounded-lg p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="text-white font-semibold">
                      {attendance.date.toLocaleDateString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-sm text-gray-400">
                      {attendance.date.toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">+{attendance.pontos} pontos</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <ProtectedRoute>
      <AttendanceContent />
    </ProtectedRoute>
  );
}
