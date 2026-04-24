'use client';

import { useState, useEffect, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import {
  getDocs, addDoc, deleteDoc, updateDoc, orderBy, query
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import { Tutorial } from '@/types';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft, Plus, Trash2, Edit, BookOpen, FileText,
  Download, Eye, X, Upload, Pin, Tag, Search, ChevronDown,
  Save, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

const CATEGORIES = ['Geral', 'Gameplay', 'Build', 'Estratégia', 'Regras', 'Eventos', 'Outro'];

function TutorialsContent() {
  const { userData } = useAuth();
  const { clan } = useClan();
  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Modal states
  const [viewingTutorial, setViewingTutorial] = useState<Tutorial | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

  // Form state
  const [formType, setFormType] = useState<'markdown' | 'pdf'>('markdown');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('Geral');
  const [formContent, setFormContent] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // PDF upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTutorials();
  }, [userData]);

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
    setFormTitle('');
    setFormDescription('');
    setFormCategory('Geral');
    setFormContent('');
    setFormPinned(false);
    setFormType('markdown');
    setPdfFile(null);
    setUploadProgress(0);
    setShowPreview(false);
    setEditingTutorial(null);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setFormTitle(tutorial.title);
    setFormDescription(tutorial.description);
    setFormCategory(tutorial.category);
    setFormContent(tutorial.content ?? '');
    setFormPinned(tutorial.pinned);
    setFormType(tutorial.type);
    setPdfFile(null);
    setShowForm(true);
  };

  const uploadPdf = (file: File): Promise<{ url: string; name: string }> => {
    return new Promise((resolve, reject) => {
      setUploading(true);
      const storageRef = ref(storage, `clans/${clan.slug}/tutorials/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      task.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          setUploading(false);
          reject(error);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploading(false);
          resolve({ url, name: file.name });
        }
      );
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    if (!formTitle.trim()) return toast.error('Título obrigatório');
    if (formType === 'markdown' && !formContent.trim()) return toast.error('Conteúdo obrigatório');
    if (formType === 'pdf' && !pdfFile && !editingTutorial?.pdfUrl) return toast.error('Selecione um PDF');

    try {
      let pdfUrl = editingTutorial?.pdfUrl;
      let pdfFileName = editingTutorial?.pdfFileName;

      if (formType === 'pdf' && pdfFile) {
        // Delete old PDF if editing
        if (editingTutorial?.pdfUrl) {
          try {
            const oldRef = ref(storage, editingTutorial.pdfUrl);
            await deleteObject(oldRef);
          } catch (_) { /* ignore */ }
        }
        const result = await uploadPdf(pdfFile);
        pdfUrl = result.url;
        pdfFileName = result.name;
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
      };

      if (editingTutorial) {
        await updateDoc(clanDoc(clan.slug, COLS.tutorials, editingTutorial.id), data as Record<string, unknown>);
        toast.success('Tutorial atualizado!');
      } else {
        await addDoc(clanCol(clan.slug, COLS.tutorials), data);
        toast.success('Tutorial criado!');
      }

      setShowForm(false);
      resetForm();
      loadTutorials();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar tutorial');
    }
  };

  const handleDelete = async (tutorial: Tutorial) => {
    if (!confirm(`Excluir "${tutorial.title}"?`)) return;
    try {
      if (tutorial.type === 'pdf' && tutorial.pdfUrl) {
        try {
          await deleteObject(ref(storage, tutorial.pdfUrl));
        } catch (_) { /* ignore */ }
      }
      await deleteDoc(clanDoc(clan.slug, COLS.tutorials, tutorial.id));
      toast.success('Tutorial excluído!');
      loadTutorials();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao excluir tutorial');
    }
  };

  const filtered = tutorials.filter(t => {
    const matchesSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navbar */}
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2 text-gray-300 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
              Voltar
            </Link>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-teal-400" />
              Tutoriais &amp; Guias
            </h1>
            {isAdmin && (
              <button
                onClick={openCreateForm}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition font-semibold"
              >
                <Plus className="h-4 w-4" />
                Novo
              </button>
            )}
            {!isAdmin && <div className="w-20" />}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar tutoriais..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            />
          </div>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
            >
              <option value="">Todas as categorias</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Tutorial Cards Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="h-16 w-16 text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg">Nenhum tutorial encontrado</p>
            {isAdmin && (
              <button
                onClick={openCreateForm}
                className="mt-4 flex items-center gap-2 px-5 py-2 bg-teal-600 hover:bg-teal-700 rounded-lg text-white transition font-semibold"
              >
                <Plus className="h-4 w-4" />
                Criar primeiro tutorial
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(tutorial => (
              <div
                key={tutorial.id}
                className="group bg-gray-800 border border-gray-700 hover:border-teal-600 rounded-xl p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-lg hover:shadow-teal-900/20"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {tutorial.pinned && (
                      <Pin className="h-4 w-4 text-yellow-400 shrink-0" />
                    )}
                    {tutorial.type === 'pdf' ? (
                      <FileText className="h-5 w-5 text-red-400 shrink-0" />
                    ) : (
                      <BookOpen className="h-5 w-5 text-teal-400 shrink-0" />
                    )}
                    <h3 className="font-bold text-white text-base truncate">{tutorial.title}</h3>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => openEditForm(tutorial)}
                        className="p-1.5 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-lg transition"
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(tutorial)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Category badge */}
                <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-teal-900/50 border border-teal-700/50 text-teal-300 text-xs rounded-full">
                  <Tag className="h-3 w-3" />
                  {tutorial.category}
                </span>

                {/* Description */}
                <p className="text-gray-400 text-sm line-clamp-2 flex-1">{tutorial.description}</p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-700/50">
                  <span className="text-xs text-gray-600">
                    {tutorial.createdAt.toLocaleDateString('pt-BR')}
                  </span>
                  {tutorial.type === 'markdown' ? (
                    <button
                      onClick={() => setViewingTutorial(tutorial)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ler
                    </button>
                  ) : (
                    <a
                      href={tutorial.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Markdown Reader Modal ── */}
      {viewingTutorial && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setViewingTutorial(null); }}
        >
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8 shadow-2xl shadow-black/50">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-teal-400" />
                <div>
                  <h2 className="text-xl font-bold text-white">{viewingTutorial.title}</h2>
                  <p className="text-gray-500 text-sm">{viewingTutorial.category}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingTutorial(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Markdown Content */}
            <div className="p-6 tutorial-content">
              <ReactMarkdown>{viewingTutorial.content ?? ''}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Form Modal ── */}
      {showForm && isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm(); } }}
        >
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl my-8 shadow-2xl shadow-black/50">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {editingTutorial ? 'Editar Tutorial' : 'Novo Tutorial'}
              </h2>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Type toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de conteúdo</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType('markdown')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-semibold text-sm transition ${formType === 'markdown' ? 'bg-teal-600 border-teal-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-teal-600'}`}
                  >
                    <BookOpen className="h-4 w-4" />
                    Markdown / Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType('pdf')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border font-semibold text-sm transition ${formType === 'pdf' ? 'bg-red-600 border-red-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-red-600'}`}
                  >
                    <FileText className="h-4 w-4" />
                    PDF para Download
                  </button>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Título *</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  required
                  placeholder="Ex: Guia de Build para iniciantes"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição breve</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Um resumo do que este tutorial aborda"
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
                />
              </div>

              {/* Category & Pinned */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Categoria</label>
                  <div className="relative">
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full appearance-none pl-4 pr-10 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition cursor-pointer"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div
                      onClick={() => setFormPinned(!formPinned)}
                      className={`w-10 h-6 rounded-full transition-colors ${formPinned ? 'bg-yellow-500' : 'bg-gray-700'} relative`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${formPinned ? 'translate-x-5' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-sm text-gray-300 flex items-center gap-1">
                      <Pin className="h-4 w-4 text-yellow-400" /> Fixar
                    </span>
                  </label>
                </div>
              </div>

              {/* Markdown Content */}
              {formType === 'markdown' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-gray-300">Conteúdo (Markdown) *</label>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {showPreview ? 'Editor' : 'Preview'}
                    </button>
                  </div>
                  {showPreview ? (
                    <div className="w-full min-h-[300px] bg-gray-800 border border-gray-700 rounded-lg p-4 tutorial-content">
                      {formContent ? <ReactMarkdown>{formContent}</ReactMarkdown> : <p className="text-gray-600 italic">Nada para previsualizar ainda...</p>}
                    </div>
                  ) : (
                    <textarea
                      value={formContent}
                      onChange={e => setFormContent(e.target.value)}
                      rows={14}
                      required
                      placeholder={`# Título do Guia\n\nEscreva seu conteúdo em **Markdown**.\n\n## Seção 1\n\nParágrafo de exemplo.\n\n- Item 1\n- Item 2\n\n\`\`\`\nCódigo de exemplo\n\`\`\``}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition resize-y"
                    />
                  )}
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Suporte completo a Markdown: títulos, listas, código, tabelas, negrito, etc.
                  </p>
                </div>
              )}

              {/* PDF Upload */}
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
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-700 hover:border-teal-600 rounded-xl cursor-pointer transition-colors group"
                  >
                    <Upload className="h-10 w-10 text-gray-600 group-hover:text-teal-500 transition-colors" />
                    {pdfFile ? (
                      <div className="text-center">
                        <p className="text-white font-semibold">{pdfFile.name}</p>
                        <p className="text-gray-500 text-sm">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-400 font-medium">Clique para selecionar um PDF</p>
                        <p className="text-gray-600 text-sm">ou arraste o arquivo aqui</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) setPdfFile(f); }}
                  />
                  {uploading && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Enviando...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
                >
                  <Save className="h-4 w-4" />
                  {editingTutorial ? 'Salvar Alterações' : 'Publicar Tutorial'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition"
                >
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
