'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { query, where, getDocs, addDoc, orderBy, deleteDoc, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Event, EventVote, User } from '@/types';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import toast from 'react-hot-toast';
import { Calendar, Plus, Trash2, Check, X, ArrowLeft, Users, Coins, Edit, ImageIcon, Upload } from 'lucide-react';
import Link from 'next/link';
import { useConfirm } from '@/components/ConfirmModal';
import LoadingLogo from '@/components/LoadingLogo';

const eventTypes = ['TW', 'GvG', 'Boss', 'Farm', 'Outro'];

function EventsContent() {
  const { userData, refreshUserData } = useAuth();
  const { clan } = useClan();
  const [events, setEvents] = useState<Event[]>([]);
  const [myVotes, setMyVotes] = useState<{ [eventId: string]: EventVote }>({});
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState<Event['type']>('TW');
  const [pointsForVoting, setPointsForVoting] = useState(5);
  const [pointsForAttendance, setPointsForAttendance] = useState(20);

  // Banner state
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    loadEvents();
  }, [userData]);

  const loadEvents = async () => {
    if (!userData) return;

    try {
      // Carregar eventos ativos
      const eventsQuery = query(
        clanCol(clan.slug, COLS.events),
        where('active', '==', true),
        orderBy('date', 'asc')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate(),
        // Garantir valores padrão para eventos antigos
        pointsForVoting: doc.data().pointsForVoting ?? 5,
        pointsForAttendance: doc.data().pointsForAttendance ?? 20
      } as Event));
      setEvents(eventsList);

      // Carregar meus votos
      const votesQuery = query(
        clanCol(clan.slug, COLS.eventVotes),
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

  // Upload do banner para o Firebase Storage
  const uploadBanner = async (file: File, eventId: string): Promise<string> => {
    const storageRef = ref(storage, `clans/${clan.slug}/events/${eventId}/banner`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const removeBannerSelection = () => {
    setBannerFile(null);
    setBannerPreview(null);
    setBannerUrl('');
    if (bannerInputRef.current) bannerInputRef.current.value = '';
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    try {
      const eventDate = new Date(`${date}T${time}`);
      let finalBannerUrl = bannerUrl;

      if (editingEvent) {
        // Upload do banner se um novo arquivo foi selecionado
        if (bannerFile) {
          setUploadingBanner(true);
          finalBannerUrl = await uploadBanner(bannerFile, editingEvent.id);
          setUploadingBanner(false);
        }

        // Atualizar evento existente
        await updateDoc(clanDoc(clan.slug, COLS.events, editingEvent.id), {
          title,
          description,
          date: eventDate,
          type,
          pointsForVoting: Number(pointsForVoting),
          pointsForAttendance: Number(pointsForAttendance),
          bannerUrl: finalBannerUrl || null,
        });
        toast.success('Evento atualizado com sucesso!');
      } else {
        // Criar novo evento
        const docRef = await addDoc(clanCol(clan.slug, COLS.events), {
          title,
          description,
          date: eventDate,
          type,
          pointsForVoting: Number(pointsForVoting),
          pointsForAttendance: Number(pointsForAttendance),
          createdBy: userData.id,
          createdAt: new Date(),
          active: true,
          bannerUrl: null,
        });

        try {
          const membersSnap = await getDocs(query(
            clanCol(clan.slug, COLS.users),
            where('role', 'in', ['member', 'admin', 'super_admin'])
          ));
          const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

          const when = eventDate.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          const batchSize = 450;
          let batch = writeBatch(db);
          let count = 0;

          for (const m of members) {
            if (count > 0 && count % batchSize === 0) {
              await batch.commit();
              batch = writeBatch(db);
            }

            const notifId = crypto.randomUUID();
            batch.set(clanDoc(clan.slug, COLS.notifications, notifId), {
              userId: m.id,
              type: 'event',
              title: 'Novo evento criado',
              message: `${title} — ${when}`,
              link: `/events#${docRef.id}`,
              read: false,
              createdAt: new Date(),
            });
            count += 1;
          }
          if (count > 0) await batch.commit();
        } catch (error) {
          console.error('Erro ao criar notificações do evento:', error);
        }

        // Upload do banner após criar o evento (precisa do ID)
        if (bannerFile) {
          setUploadingBanner(true);
          finalBannerUrl = await uploadBanner(bannerFile, docRef.id);
          await updateDoc(clanDoc(clan.slug, COLS.events, docRef.id), { bannerUrl: finalBannerUrl });
          setUploadingBanner(false);
        }

        toast.success('Evento criado com sucesso!');
      }

      setShowCreateForm(false);
      setEditingEvent(null);
      setTitle('');
      setDescription('');
      setDate('');
      setTime('');
      setType('TW');
      setPointsForVoting(5);
      setPointsForAttendance(20);
      setBannerFile(null);
      setBannerPreview(null);
      setBannerUrl('');
      loadEvents();
    } catch (error) {
      console.error('Erro ao salvar evento:', error);
      toast.error('Erro ao salvar evento');
      setUploadingBanner(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);

    // Formatar data e hora
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toISOString().split('T')[0];
    const timeStr = eventDate.toTimeString().slice(0, 5);

    setDate(dateStr);
    setTime(timeStr);
    setType(event.type);
    setPointsForVoting(event.pointsForVoting || 5);
    setPointsForAttendance(event.pointsForAttendance || 20);
    setBannerUrl(event.bannerUrl || '');
    setBannerPreview(event.bannerUrl || null);
    setBannerFile(null);
    setShowCreateForm(true);
  };

  const handleCancelEdit = () => {
    setShowCreateForm(false);
    setEditingEvent(null);
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setType('TW');
    setPointsForVoting(5);
    setPointsForAttendance(20);
    setBannerFile(null);
    setBannerPreview(null);
    setBannerUrl('');
  };

  const vote = async (eventId: string, canParticipate: boolean, comment: string = '') => {
    if (!userData) return;

    try {
      const event = events.find(e => e.id === eventId);
      if (!event) return;

      const isFirstVote = !myVotes[eventId];

      // Verificar se já votou
      if (myVotes[eventId]) {
        await deleteDoc(clanDoc(clan.slug, COLS.eventVotes, myVotes[eventId].id));
      }

      // Criar novo voto
      await addDoc(clanCol(clan.slug, COLS.eventVotes), {
        eventId,
        userId: userData.id,
        userName: userData.nick,
        canParticipate,
        comment,
        votingPointsAwarded: isFirstVote, // Marca que já recebeu pontos por votar
        createdAt: new Date()
      });

      // Dar pontos apenas se for o primeiro voto
      if (isFirstVote && event.pointsForVoting > 0) {
        await updateDoc(clanDoc(clan.slug, COLS.users, userData.id), {
          pontos: increment(event.pointsForVoting),
          totalPointsEarned: increment(event.pointsForVoting)
        });
        toast.success(`Voto registrado! +${event.pointsForVoting} pontos`);
        // Atualizar dados do usuário para refletir os novos pontos
        await refreshUserData();
      } else {
        toast.success('Voto atualizado!');
      }

      loadEvents();
    } catch (error) {
      console.error('Erro ao votar:', error);
      toast.error('Erro ao registrar voto');
    }
  };

  const deleteEvent = async (eventId: string) => {
    const confirmed = await confirm({
      title: 'Excluir Evento',
      message: 'Tem certeza que deseja excluir este evento?\n\nTodos os votos relacionados serão mantidos no histórico.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      await deleteDoc(clanDoc(clan.slug, COLS.events, eventId));
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
        <LoadingLogo size={128} fullscreen={false} />
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
            {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white transition"
              >
                <Plus className="h-4 w-4" />
                Criar Evento
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Formulário de Criação/Edição */}
        {showCreateForm && (userData?.role === 'admin' || userData?.role === 'super_admin') && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingEvent ? 'Editar Evento' : 'Criar Novo Evento'}
            </h2>
            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Hora</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Event['type'])}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {eventTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                <h3 className="text-blue-200 font-semibold mb-3 flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Sistema de Pontos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pontos por Confirmar Presença
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pointsForVoting}
                      onChange={(e) => setPointsForVoting(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Pontos ganhos ao confirmar presença (primeira vez)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Pontos por Comparecer
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={pointsForAttendance}
                      onChange={(e) => setPointsForAttendance(Number(e.target.value))}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Pontos ganhos ao comparecer (confirmado por admin)
                    </p>
                  </div>
                </div>
              </div>

              {/* Banner Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Banner do Evento (opcional)
                </label>
                {bannerPreview ? (
                  <div className="relative rounded-lg overflow-hidden border border-gray-600">
                    <img
                      src={bannerPreview}
                      alt="Preview do banner"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => bannerInputRef.current?.click()}
                        className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-white text-sm font-medium hover:bg-white/30 transition"
                      >
                        Trocar
                      </button>
                      <button
                        type="button"
                        onClick={removeBannerSelection}
                        className="px-4 py-2 bg-red-600/80 backdrop-blur-sm rounded-lg text-white text-sm font-medium hover:bg-red-700 transition"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-red-500 hover:bg-gray-700/50 transition cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-gray-500" />
                    <span className="text-sm text-gray-400">Clique para enviar um banner</span>
                    <span className="text-xs text-gray-500">PNG, JPG ou WebP. Recomendado: 1200×400px</span>
                  </button>
                )}
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerSelect}
                  className="hidden"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={uploadingBanner}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {uploadingBanner ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Enviando banner...
                    </>
                  ) : (
                    editingEvent ? 'Salvar Alterações' : 'Criar Evento'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
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
              const now = new Date();
              const eventStart = new Date(event.date);
              const attendanceDeadline = new Date(eventStart.getTime() + 90 * 60 * 1000); // +1h30
              const isAttendanceWindow = now >= eventStart && now <= attendanceDeadline;
              const isAttendanceClosed = now > attendanceDeadline;
              const isBeforeEvent = now < eventStart;

              return (
                <div id={event.id} key={event.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                  {/* Banner do evento */}
                  {event.bannerUrl && (
                    <div className="relative w-full h-48 overflow-hidden">
                      <img
                        src={event.bannerUrl}
                        alt={`Banner - ${event.title}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-800/80 to-transparent" />
                    </div>
                  )}
                  <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-bold text-white">{event.title}</h3>
                        <span className="px-2 py-1 bg-red-600 rounded-full text-xs text-white">
                          {event.type}
                        </span>
                      </div>
                      <p className="text-gray-400 mb-2">{event.description}</p>
                      <p className="text-sm text-gray-500 mb-2">
                        {event.date.toLocaleDateString('pt-BR')} às {event.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div className="flex gap-3 text-sm">
                        <span className="text-green-400 flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {event.pointsForVoting || 0} pts por confirmar
                        </span>
                        <span className="text-yellow-400 flex items-center gap-1">
                          <Coins className="h-4 w-4" />
                          {event.pointsForAttendance || 0} pts por comparecer
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(userData?.role === 'admin' || userData?.role === 'super_admin') && (
                        <>
                          <button
                            onClick={() => handleEditEvent(event)}
                            className="text-yellow-400 hover:text-yellow-300"
                            title="Editar Evento"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <Link
                            href={`/admin/events/${event.id}`}
                            className="text-blue-400 hover:text-blue-300"
                            title="Gerenciar Presença"
                          >
                            <Users className="h-5 w-5" />
                          </Link>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Excluir Evento"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {myVote ? (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <p className="text-white font-semibold flex items-center gap-2">
                        {myVote.canParticipate ? (
                          <>
                            <Check className="h-5 w-5 text-green-500" />
                            {isAttendanceWindow || isAttendanceClosed
                              ? 'Presença marcada!'
                              : 'Você confirmou presença'}
                          </>
                        ) : (
                          <>
                            <X className="h-5 w-5 text-red-500" />
                            Você não poderá participar
                          </>
                        )}
                      </p>
                      {/* Só permite alterar voto antes do evento começar */}
                      {isBeforeEvent && (
                        <button
                          onClick={() => vote(event.id, !myVote.canParticipate)}
                          className="mt-2 text-sm text-red-400 hover:text-red-300"
                        >
                          Alterar voto
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => !isAttendanceClosed && vote(event.id, true)}
                        disabled={isAttendanceClosed}
                        title={isAttendanceClosed ? 'Período de presença encerrado' : undefined}
                        className={`flex-1 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2 ${isAttendanceClosed
                          ? 'bg-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-green-600 hover:bg-green-700'
                          }`}
                      >
                        <Check className="h-5 w-5" />
                        Marcar Presença
                      </button>
                      {/* "Não Posso" só aparece antes do evento começar */}
                      {isBeforeEvent && (
                        <button
                          onClick={() => vote(event.id, false)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2"
                        >
                          <X className="h-5 w-5" />
                          Não Posso
                        </button>
                      )}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ConfirmDialog />
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

