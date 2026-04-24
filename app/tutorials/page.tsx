'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { getDocs, addDoc, deleteDoc, updateDoc, orderBy, query } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { Tutorial } from '@/types';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Plus, Trash2, Edit, BookOpen, FileText,
  Download, Eye, X, Upload, Pin, Tag, Search, ChevronDown,
  Save, AlertCircle, Video, Play,
} from 'lucide-react';
import Link from 'next/link';

// Import MDEditor CSS — required for the editor appearance
import '@uiw/react-md-editor/markdown-editor.css';

// Dynamic import to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const CATEGORIES = ['Geral', 'Gameplay', 'Build', 'Estratégia', 'Regras', 'Eventos', 'Outro'];

function TutorialsContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal state
  const [viewingTutorial, setViewingTutorial] = useState<Tutorial | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

  // Form state
  const [formType, setFormType] = useState<'markdown' | 'pdf' | 'video'>('markdown');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Geral');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);

  // Upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadTutorials(); }, [userData]);

  const loadTutorials = async () => {
    if (!userData) return;
    try {
      const q = query(
        clanCol(clan.slug, COLS.tutorials),
        orderBy('pinned', 'desc'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() ?? new Date(),
        updatedAt: doc.data().updatedAt?.toDate?.() ?? undefined,
      } as Tutorial));
      setTutorials(list);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar tutoriais');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormTitle(''); setFormDescription(''); setFormCategory('Geral');
    setFormContent(''); setFormPinned(false); setFormType('markdown');
    setPdfFile(null); setVideoFile(null); setUploadProgress(0);
    setEditingTutorial(null);
  };

  const openCreateForm = () => { resetForm(); setShowForm(true); };

  const openEditForm = (t: Tutorial) => {
    setEditingTutorial(t);
    setFormTitle(t.title); setFormDescription(t.description);
    setFormCategory(t.category); setFormContent(t.content ?? '');
    setFormPinned(t.pinned); setFormType(t.type);
    setPdfFile(null); setVideoFile(null);
    setShowForm(true);
  };

  const uploadFile = (file: File, path: string): Promise<{ url: string; name: string }> =>
    new Promise((resolve, reject) => {
      setUploading(true); setUploadProgress(0);
      const task = uploadBytesResumable(ref(storage, path), file);
      task.on('state_changed',
        snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        err => { setUploading(false); reject(err); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploading(false);
          resolve({ url, name: file.name });
        }
      );
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;
    if (!formTitle.trim()) return toast.error('Título obrigatório');
    if (formType === 'markdown' && !formContent.trim()) return toast.error('Conteúdo obrigatório');
    if (formType === 'pdf' && !pdfFile && !editingTutorial?.pdfUrl) return toast.error('Selecione um PDF');
    if (formType === 'video' && !videoFile && !editingTutorial?.videoUrl) return toast.error('Selecione um vídeo');

    try {
      let pdfUrl = editingTutorial?.pdfUrl;
      let pdfFileName = editingTutorial?.pdfFileName;
      let videoUrl = editingTutorial?.videoUrl;
      let videoFileName = editingTutorial?.videoFileName;

      if (formType === 'pdf' && pdfFile) {
        if (editingTutorial?.pdfUrl) {
          try { await deleteObject(ref(storage, editingTutorial.pdfUrl)); } catch (_) { /* ignore */ }
        }
        const r = await uploadFile(pdfFile, `clans/${clan.slug}/tutorials/${Date.now()}_${pdfFile.name}`);
        pdfUrl = r.url; pdfFileName = r.name;
      }

      if (formType === 'video' && videoFile) {
        if (editingTutorial?.videoUrl) {
          try { await deleteObject(ref(storage, editingTutorial.videoUrl)); } catch (_) { /* ignore */ }
        }
        const r = await uploadFile(videoFile, `clans/${clan.slug}/tutorials/${Date.now()}_${videoFile.name}`);
        videoUrl = r.url; videoFileName = r.name;
      }

      const data: Omit<Tutorial, 'id'> = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        type: formType,
        category: formCategory,
        pinned: formPinned,
        createdBy: userData.id,
        createdAt: editingTutorial?.createdAt ?? new Date(),
        updatedAt: new Date(),
        ...(formType === 'markdown' ? { content: formContent } : {}),
        ...(formType === 'pdf' ? { pdfUrl, pdfFileName } : {}),
        ...(formType === 'video' ? { videoUrl, videoFileName } : {}),
      };

      if (editingTutorial) {
        await updateDoc(clanDoc(clan.slug, COLS.tutorials, editingTutorial.id), data as Record<string, unknown>);
        toast.success('Tutorial atualizado!');
      } else {
        await addDoc(clanCol(clan.slug, COLS.tutorials), data);
        toast.success('Tutorial criado!');
      }

      setShowForm(false); resetForm(); loadTutorials();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar tutorial');
    }
  };

  const handleDelete = async (tutorial: Tutorial) => {
    if (!confirm(`Excluir "${tutorial.title}"?`)) return;
    try {
      if (tutorial.type === 'pdf' && tutorial.pdfUrl)
        try { await deleteObject(ref(storage, tutorial.pdfUrl)); } catch (_) { /* ignore */ }
      if (tutorial.type === 'video' && tutorial.videoUrl)
        try { await deleteObject(ref(storage, tutorial.videoUrl)); } catch (_) { /* ignore */ }
      await deleteDoc(clanDoc(clan.slug, COLS.tutorials, tutorial.id));
      toast.success('Tutorial excluído!'); loadTutorials();
    } catch (err) {
      console.error(err); toast.error('Erro ao excluir tutorial');
    }
  };

  const filtered = tutorials.filter(t => {
    const s = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    const c = !selectedCategory || t.category === selectedCategory;
    return s && c;
  });

  const typeIcon = (type: Tutorial['type']) => {
    if (type === 'pdf') return <FileText className="h-5 w-5 text-red-400 shrink-0" />;
    if (type === 'video') return <Video className="h-5 w-5 text-purple-400 shrink-0" />;
    return <BookOpen className="h-5 w-5 text-teal-400 shrink-0" />;
  };

  const actionButton = (t: Tutorial) => {
    if (t.type === 'markdown')
      return <button onClick={() => setViewingTutorial(t)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition"><Eye className="h-3.5 w-3.5" />Ler</button>;
    if (t.type === 'video')
      return <button onClick={() => setViewingTutorial(t)} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition"><Play className="h-3.5 w-3.5" />Assistir</button>;
    return <a href={t.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"><Download className="h-3.5 w-3.5" />Baixar PDF</a>;
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" /> Voltar
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-400" /> Tutoriais &amp; Guias
            </h1>
            {isAdmin ? (
              <button onClick={openCreateForm} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition font-semibold">
                <Plus className="h-4 w-4" /> Novo
              </button>
            ) : <div className="w-20" />}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Buscar tutoriais..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
          </div>
          <div className="relative">
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer">
              <option value="">Todas as categorias</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="h-16 w-16 text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg">Nenhum tutorial encontrado</p>
            {isAdmin && (
              <button onClick={openCreateForm} className="mt-4 flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition font-semibold">
                <Plus className="h-4 w-4" /> Criar primeiro tutorial
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(tutorial => (
              <div key={tutorial.id} className="group bg-gray-800 border border-gray-700 hover:border-teal-600 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-teal-900/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {tutorial.pinned && <Pin className="h-4 w-4 text-yellow-400 shrink-0" />}
                    {typeIcon(tutorial.type)}
                    <h3 className="font-bold text-white text-base truncate">{tutorial.title}</h3>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => openEditForm(tutorial)} className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-lg transition" title="Editar"><Edit className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(tutorial)} className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-teal-900/50 border border-teal-700/50 text-teal-300 text-xs rounded-full">
                  <Tag className="h-3 w-3" />{tutorial.category}
                </span>
                <p className="text-gray-400 text-sm line-clamp-2 flex-1">{tutorial.description}</p>
                <div className="flex items-center justify-between pt-1 border-t border-gray-700/50">
                  <span className="text-xs text-gray-600">{tutorial.createdAt.toLocaleDateString('pt-BR')}</span>
                  {actionButton(tutorial)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Viewer Modal (Markdown & Video) ── */}
      {viewingTutorial && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setViewingTutorial(null); }}>
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-700">
              <div className="flex items-center gap-3">
                {typeIcon(viewingTutorial.type)}
                <div>
                  <h2 className="text-xl font-bold text-white">{viewingTutorial.title}</h2>
                  <p className="text-gray-500 text-sm">{viewingTutorial.category}</p>
                </div>
              </div>
              <button onClick={() => setViewingTutorial(null)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Markdown */}
            {viewingTutorial.type === 'markdown' && (
              <div className="p-6 tutorial-content">
                <ReactMarkdown>{viewingTutorial.content ?? ''}</ReactMarkdown>
              </div>
            )}
            {/* Video */}
            {viewingTutorial.type === 'video' && (
              <div className="p-4">
                <video src={viewingTutorial.videoUrl} controls className="w-full rounded-xl bg-black" style={{ maxHeight: 520 }}>
                  Seu navegador não suporta reprodução de vídeo.
                </video>
                {viewingTutorial.videoFileName && (
                  <p className="text-gray-600 text-xs mt-2 text-center">{viewingTutorial.videoFileName}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create / Edit Form Modal ── */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl my-8 shadow-2xl shadow-black/60">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">{editingTutorial ? 'Editar Tutorial' : 'Novo Tutorial'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de conteúdo</label>
                <div className="flex gap-2">
                  {([
                    { t: 'markdown', label: 'Markdown / Texto', icon: <BookOpen className="h-4 w-4" />, active: 'bg-teal-600 border-teal-600', inactive: 'hover:border-teal-600' },
                    { t: 'video',    label: 'Vídeo',             icon: <Video className="h-4 w-4" />,    active: 'bg-purple-600 border-purple-600', inactive: 'hover:border-purple-600' },
                    { t: 'pdf',      label: 'PDF para Download', icon: <FileText className="h-4 w-4" />, active: 'bg-red-600 border-red-600', inactive: 'hover:border-red-600' },
                  ] as { t: 'markdown'|'pdf'|'video', label: string, icon: React.ReactNode, active: string, inactive: string }[]).map(opt => (
                    <button key={opt.t} type="button" onClick={() => setFormType(opt.t)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-semibold text-sm transition ${formType === opt.t ? `${opt.active} text-white` : `bg-gray-800 border-gray-700 text-gray-400 ${opt.inactive}`}`}>
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título *</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} required
                  placeholder="Ex: Guia de Build para iniciantes"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição breve</label>
                <input type="text" value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Um resumo do que este tutorial aborda"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition" />
              </div>

              {/* Category + Pinned */}
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                  <div className="relative">
                    <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                      className="w-full appearance-none pl-4 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none pb-0.5">
                  <div onClick={() => setFormPinned(!formPinned)}
                    className={`w-10 h-6 rounded-full transition-colors relative ${formPinned ? 'bg-yellow-500' : 'bg-gray-700'}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formPinned ? 'translate-x-5' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm text-gray-300 flex items-center gap-1"><Pin className="h-4 w-4 text-yellow-400" />Fixar</span>
                </label>
              </div>

              {/* ── Markdown Editor ── */}
              {formType === 'markdown' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Conteúdo *</label>
                  <div data-color-mode="dark" className="rounded-xl overflow-hidden border border-gray-700">
                    <MDEditor
                      value={formContent}
                      onChange={val => setFormContent(val ?? '')}
                      height={480}
                      preview="edit"
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Use a toolbar para formatação. Clique no ícone <Eye className="inline h-3 w-3 mx-0.5" /> para ver o preview renderizado.
                  </p>
                </div>
              )}

              {/* ── Video Upload ── */}
              {formType === 'video' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Arquivo de Vídeo *</label>
                  {editingTutorial?.videoFileName && !videoFile && (
                    <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg mb-3">
                      <Video className="h-5 w-5 text-purple-400 shrink-0" />
                      <span className="text-gray-300 text-sm truncate">{editingTutorial.videoFileName}</span>
                      <span className="text-xs text-gray-500 ml-auto shrink-0">atual</span>
                    </div>
                  )}
                  <div onClick={() => videoInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-700 hover:border-purple-600 rounded-xl cursor-pointer transition-colors group">
                    <Upload className="h-10 w-10 text-gray-600 group-hover:text-purple-500 transition-colors" />
                    {videoFile ? (
                      <div className="text-center">
                        <p className="text-white font-semibold">{videoFile.name}</p>
                        <p className="text-gray-500 text-sm">{(videoFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-400 font-medium">Clique para selecionar um vídeo</p>
                        <p className="text-gray-600 text-sm">MP4, WebM, OGG — máx. 200 MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg,video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setVideoFile(f); }} />
                  {uploading && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Enviando vídeo...</span><span>{uploadProgress}%</span></div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── PDF Upload ── */}
              {formType === 'pdf' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Arquivo PDF *</label>
                  {editingTutorial?.pdfFileName && !pdfFile && (
                    <div className="flex items-center gap-2 p-3 bg-gray-800 border border-gray-700 rounded-lg mb-3">
                      <FileText className="h-5 w-5 text-red-400 shrink-0" />
                      <span className="text-gray-300 text-sm truncate">{editingTutorial.pdfFileName}</span>
                      <span className="text-xs text-gray-500 ml-auto shrink-0">atual</span>
                    </div>
                  )}
                  <div onClick={() => pdfInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-700 hover:border-red-600 rounded-xl cursor-pointer transition-colors group">
                    <Upload className="h-10 w-10 text-gray-600 group-hover:text-red-500 transition-colors" />
                    {pdfFile ? (
                      <div className="text-center">
                        <p className="text-white font-semibold">{pdfFile.name}</p>
                        <p className="text-gray-500 text-sm">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-400 font-medium">Clique para selecionar um PDF</p>
                        <p className="text-gray-600 text-sm">máx. 20 MB</p>
                      </div>
                    )}
                  </div>
                  <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }} />
                  {uploading && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1"><span>Enviando PDF...</span><span>{uploadProgress}%</span></div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition">
                  <Save className="h-4 w-4" />{editingTutorial ? 'Salvar Alterações' : 'Publicar Tutorial'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TutorialsPage() {
  return (
    <ProtectedRoute>
      <TutorialsContent />
    </ProtectedRoute>
  );
}
