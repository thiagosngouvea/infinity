'use client';

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Event, EventVote } from '@/types';
import toast from 'react-hot-toast';
import { Calendar, Plus, Trash2, Check, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const eventTypes = ['TW', 'GvG', 'Boss', 'Farm', 'Outro'];

function EventsContent() {
  const { userData } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [myVotes, setMyVotes] = useState<{ [eventId: string]: EventVote }>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<Event['type']>('TW');

  useEffect(() => {
    loadEvents();
  }, [userData]);

  const loadEvents = async () => {
    if (!userData) return;

    try {
      // Carregar eventos ativos
      const eventsQuery = query(
        collection(db, 'events'),
        where('active', '==', true),
        orderBy('date', 'asc')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      } as Event));
      setEvents(eventsList);

      // Carregar meus votos
      const votesQuery = query(
        collection(db, 'eventVotes'),
        where('userId', '==', userData.id)
      );
      const votesSnapshot = await getDocs(votesQuery);
      const votesMap: { [eventId: string]: EventVote } = {};
      votesSnapshot.docs.forEach(doc => {
        const vote = { id: doc.id, ...doc.data() } as EventVote;
        votesMap[vote.eventId] = vote;
      });
      setMyVotes(votesMap);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      const eventDate = new Date(`${date}T${time}`);
      
      await addDoc(collection(db, 'events'), {
        title,
        description,
        date: eventDate,
        type,
        createdBy: userData.id,
        createdAt: new Date(),
        active: true
      });

      toast.success('Evento criado com sucesso!');
      setShowCreateForm(false);
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setType('TW');
      loadEvents();
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      toast.error('Erro ao criar evento');
    }
  };

  const vote = async (eventId: string, canParticipate: boolean, comment: string = '') => {
    if (!userData) return;

    try {
      // Verificar se já votou
      if (myVotes[eventId]) {
        await deleteDoc(doc(db, 'eventVotes', myVotes[eventId].id));
      }

      // Criar novo voto
      await addDoc(collection(db, 'eventVotes'), {
        eventId,
        userId: userData.id,
        userName: userData.nick,
        canParticipate,
        comment,
        createdAt: new Date()
      });

      toast.success('Voto registrado!');
      loadEvents();
    } catch (error) {
      console.error('Erro ao votar:', error);
      toast.error('Erro ao registrar voto');
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Evento excluído!');
      loadEvents();
    } catch (error) {
      console.error('Erro ao excluir evento:', error);
      toast.error('Erro ao excluir evento');
    }
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
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white">Eventos</h1>
            {userData?.role === 'admin' && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition"
              >
                <Plus className="h-4 w-4" />
                Criar Evento
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Formulário de Criação */}
        {showCreateForm && userData?.role === 'admin' && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Criar Novo Evento</h2>
            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Data</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hora</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Event['type'])}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {eventTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition"
                >
                  Criar Evento
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Eventos */}
        {events.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
            <Calendar className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum evento ativo no momento</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {events.map((event) => {
              const myVote = myVotes[event.id];
              
              return (
                <div key={event.id} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{event.title}</h3>
                        <span className="px-2 py-1 bg-purple-600 rounded-full text-xs text-white">
                          {event.type}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-2">{event.description}</p>
                      <p className="text-sm text-gray-500">
                        {event.date.toLocaleDateString('pt-BR')} às {event.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {userData?.role === 'admin' && (
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>

                  {myVote ? (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <p className="text-white font-semibold flex items-center gap-2">
                        {myVote.canParticipate ? (
                          <>
                            <Check className="h-5 w-5 text-green-500" />
                            Você confirmou presença
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-red-500" />
                            Você não poderá participar
                          </>
                        )}
                      </p>
                      <button
                        onClick={() => vote(event.id, !myVote.canParticipate)}
                        className="mt-2 text-sm text-purple-400 hover:text-purple-300"
                      >
                        Alterar voto
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => vote(event.id, true)}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <Check className="h-5 w-5" />
                        Posso Participar
                      </button>
                      <button
                        onClick={() => vote(event.id, false)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <X className="h-5 w-5" />
                        Não Posso
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventsPage() {
  return (
    <ProtectedRoute>
      <EventsContent />
    </ProtectedRoute>
  );
}

