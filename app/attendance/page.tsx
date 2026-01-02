'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Attendance } from '@/types';
import toast from 'react-hot-toast';
import { CheckCircle, ArrowLeft, Calendar, Award } from 'lucide-react';
import Link from 'next/link';

function AttendanceContent() {
  const { userData, refreshUserData } = useAuth();
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [canCheckIn, setCanCheckIn] = useState(false);

  useEffect(() => {
    loadAttendances();
  }, [userData]);

  const loadAttendances = async () => {
    if (!userData) return;

    try {
      // Carregar presenças do usuário
      const attendanceQuery = query(
        collection(db, 'attendances'),
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

      // Verificar se pode fazer check-in hoje
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
      const pontos = 10; // 10 pontos por presença

      // Adicionar presença
      await addDoc(collection(db, 'attendances'), {
        userId: userData.id,
        userName: userData.nick,
        date: new Date(),
        pontos,
        createdBy: userData.id,
        createdAt: new Date()
      });

      // Atualizar pontos do usuário
      await updateDoc(doc(db, 'users', userData.id), {
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

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

