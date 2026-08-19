'use client';

import { useCallback, useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Eraser,
  Flag,
  Map,
  MousePointer2,
  Plus,
  Pencil,
  Save,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingLogo from '@/components/LoadingLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import { clanCol, clanDoc, COLS } from '@/lib/paths';
import {
  TWPlan,
  TWPlanGroup,
  TWPlanManualMember,
  TWPlanMarker,
  TWPlanPoint,
  TWPlanRoute,
  TWRosterEntry,
  TWSession,
} from '@/types';

type TacticalMarkerType = 'attack' | 'defense' | 'rally' | 'danger' | 'catapult';
type PlannerTool = 'select' | 'route' | 'group' | TacticalMarkerType;

function CatapultIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 17h18" />
      <path d="m7 17 5-9 4 9" />
      <path d="M10 12 19 4" />
      <path d="m18 3 3-1 1 3-3 1Z" />
      <path d="M5 17v-3h3" />
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="19" r="2" />
    </svg>
  );
}

const EMPTY_PLAN = {
  strategy: '',
  objectives: [] as string[],
  markers: [] as TWPlanMarker[],
  routes: [] as TWPlanRoute[],
  groups: [] as TWPlanGroup[],
};

const MARKER_META: Record<TacticalMarkerType, {
  label: string;
  color: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}> = {
  attack: { label: 'Ataque', color: 'bg-rose-600 border-rose-300', icon: Swords },
  defense: { label: 'Defesa', color: 'bg-sky-600 border-sky-300', icon: Shield },
  rally: { label: 'Reunião', color: 'bg-amber-500 border-amber-200', icon: Flag },
  danger: { label: 'Alerta', color: 'bg-violet-600 border-violet-300', icon: AlertTriangle },
  catapult: { label: 'CT (Catapulta)', color: 'bg-orange-700 border-orange-200', icon: CatapultIcon },
};

const ROUTE_COLORS = ['#fb7185', '#38bdf8', '#fbbf24', '#a78bfa', '#34d399'];
const DEFAULT_ROUTE_WIDTH = 3;
const DEFAULT_MARKER_SIZE = 40;

function percentPoint(event: React.MouseEvent | React.PointerEvent, element: HTMLElement): TWPlanPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function markerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

function PlanningContent() {
  const { twId } = useParams<{ twId: string }>();
  const { userData } = useAuth();
  const { clan } = useClan();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const mapPanRef = useRef<{ pointerId: number; x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const dirtyRef = useRef(false);

  const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
  const [session, setSession] = useState<TWSession | null>(null);
  const [roster, setRoster] = useState<TWRosterEntry[]>([]);
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [updatedByName, setUpdatedByName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [tool, setTool] = useState<PlannerTool>('select');
  const [markerLabel, setMarkerLabel] = useState('');
  const [markerSize, setMarkerSize] = useState(DEFAULT_MARKER_SIZE);
  const [pendingGroup, setPendingGroup] = useState<TWPlanGroup | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupObjective, setGroupObjective] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupManualMembers, setGroupManualMembers] = useState<TWPlanManualMember[]>([]);
  const [manualMemberNick, setManualMemberNick] = useState('');
  const [manualMemberClass, setManualMemberClass] = useState('');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [draftRoute, setDraftRoute] = useState<TWPlanPoint[]>([]);
  const [routeLabel, setRouteLabel] = useState('Rota principal');
  const [routeColor, setRouteColor] = useState(ROUTE_COLORS[0]);
  const [routeWidth, setRouteWidth] = useState(DEFAULT_ROUTE_WIDTH);
  const [mapZoom, setMapZoom] = useState(1);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'map' | 'strategy' | 'roster'>('map');

  const canEdit = Boolean(isAdmin && !session?.closed);

  useEffect(() => {
    const viewport = mapViewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY < 0 ? 0.25 : -0.25;
      const rect = viewport.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;

      setMapZoom(current => {
        const next = Math.max(1, Math.min(5, Number((current + direction).toFixed(2))));
        if (next === current) return current;
        const scale = next / current;
        const nextScrollLeft = (viewport.scrollLeft + pointerX) * scale - pointerX;
        const nextScrollTop = (viewport.scrollTop + pointerY) * scale - pointerY;
        requestAnimationFrame(() => {
          viewport.scrollLeft = nextScrollLeft;
          viewport.scrollTop = nextScrollTop;
        });
        return next;
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [loading]);

  const startMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = mapViewportRef.current;
    if (tool !== 'select' || mapZoom <= 1 || !viewport || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    mapPanRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
      scrollTop: viewport.scrollTop,
    };
  };

  const moveMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const viewport = mapViewportRef.current;
    const pan = mapPanRef.current;
    if (!viewport || !pan || pan.pointerId !== event.pointerId) return;
    viewport.scrollLeft = pan.scrollLeft - (event.clientX - pan.x);
    viewport.scrollTop = pan.scrollTop - (event.clientY - pan.y);
  };

  const stopMapPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mapPanRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    mapPanRef.current = null;
  };

  const loadData = useCallback(async () => {
    try {
      const [sessionSnap, rosterSnap] = await Promise.all([
        getDoc(clanDoc(clan.slug, COLS.twSessions, twId)),
        getDocs(query(clanCol(clan.slug, COLS.twRoster), where('twId', '==', twId))),
      ]);

      if (!sessionSnap.exists()) {
        toast.error('TW não encontrada');
        return;
      }

      const sessionData = sessionSnap.data();
      setSession({
        id: sessionSnap.id,
        ...sessionData,
        date: sessionData.date?.toDate?.() ?? new Date(sessionData.date),
        createdAt: sessionData.createdAt?.toDate?.() ?? new Date(sessionData.createdAt),
      } as TWSession);

      const rosterData = rosterSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          selectedAt: data.selectedAt?.toDate?.() ?? new Date(data.selectedAt),
        } as TWRosterEntry;
      });
      rosterData.sort((a, b) => a.userName.localeCompare(b.userName));
      setRoster(rosterData);

    } catch (error) {
      console.error(error);
      toast.error('Não foi possível carregar o planejamento');
    } finally {
      setLoading(false);
    }
  }, [clan.slug, twId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const planRef = clanDoc(clan.slug, COLS.twPlans, twId);
    return onSnapshot(planRef, snapshot => {
      // Preserve um rascunho local ainda não publicado pelo administrador.
      if (dirtyRef.current) return;

      if (!snapshot.exists()) {
        setPlan(EMPTY_PLAN);
        setUpdatedAt(null);
        setUpdatedByName('');
        return;
      }

      const data = snapshot.data() as Omit<TWPlan, 'id' | 'updatedAt'> & { updatedAt?: { toDate?: () => Date } };
      setPlan({
        strategy: data.strategy ?? '',
        objectives: data.objectives ?? [],
        markers: (data.markers ?? []).filter(marker => marker.type !== 'member'),
        routes: data.routes ?? [],
        groups: data.groups ?? [],
      });
      setUpdatedAt(data.updatedAt?.toDate?.() ?? null);
      setUpdatedByName(data.updatedByName ?? '');
    }, error => {
      console.error(error);
      toast.error('Não foi possível acompanhar o planejamento em tempo real');
    });
  }, [clan.slug, twId]);

  const setPlanDirty = useCallback((updater: (current: typeof EMPTY_PLAN) => typeof EMPTY_PLAN) => {
    setPlan(current => updater(current));
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  const savePlan = async () => {
    if (!canEdit || !userData) return;
    setSaving(true);
    try {
      await setDoc(clanDoc(clan.slug, COLS.twPlans, twId), {
        twId,
        ...plan,
        updatedBy: userData.id,
        updatedByName: userData.nick,
        updatedAt: serverTimestamp(),
      });
      dirtyRef.current = false;
      setDirty(false);
      setUpdatedAt(new Date());
      setUpdatedByName(userData.nick);
      toast.success('Planejamento publicado para o clã');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar o planejamento');
    } finally {
      setSaving(false);
    }
  };

  const addMarker = (point: TWPlanPoint) => {
    if (tool === 'select' || tool === 'route') return;

    if (tool === 'group') {
      if (!pendingGroup) {
        toast('Selecione uma PT primeiro');
        setMobilePanel('roster');
        return;
      }
      setPlanDirty(current => ({
        ...current,
        markers: current.markers.some(marker => marker.type === 'group' && marker.groupId === pendingGroup.id)
          ? current.markers.map(marker => marker.type === 'group' && marker.groupId === pendingGroup.id
            ? { ...marker, label: pendingGroup.name, ...point }
            : marker)
          : [...current.markers, {
              id: crypto.randomUUID(),
              type: 'group',
              label: pendingGroup.name,
              groupId: pendingGroup.id,
              ...point,
            }],
      }));
      setPendingGroup(null);
      setTool('select');
      return;
    }

    setPlanDirty(current => ({
      ...current,
      markers: [...current.markers, {
        id: crypto.randomUUID(),
        type: tool,
        label: markerLabel.trim() || MARKER_META[tool].label,
        size: markerSize,
        ...point,
      }],
    }));
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    if (tool === 'select') {
      setSelectedMarkerId(null);
      setPendingGroup(null);
      return;
    }
    if (!canEdit) return;
    const point = percentPoint(event, mapRef.current);
    if (tool === 'route') {
      setDraftRoute(current => [...current, point]);
      return;
    }
    addMarker(point);
  };

  const finishRoute = () => {
    if (draftRoute.length < 2) {
      toast.error('Marque pelo menos dois pontos para criar a rota');
      return;
    }
    setPlanDirty(current => ({
      ...current,
      routes: [...current.routes, {
        id: crypto.randomUUID(),
        label: routeLabel.trim() || `Rota ${current.routes.length + 1}`,
        color: routeColor,
        width: routeWidth,
        points: draftRoute,
      }],
    }));
    setDraftRoute([]);
    setRouteLabel(`Rota ${plan.routes.length + 2}`);
    setRouteColor(ROUTE_COLORS[(plan.routes.length + 1) % ROUTE_COLORS.length]);
    setTool('select');
  };

  const removeMarker = (id: string) => {
    setPlanDirty(current => ({ ...current, markers: current.markers.filter(marker => marker.id !== id) }));
    setSelectedMarkerId(null);
  };

  const resizeMarker = (id: string, size: number) => {
    setPlanDirty(current => ({
      ...current,
      markers: current.markers.map(marker => marker.id === id ? { ...marker, size } : marker),
    }));
  };

  const renameMarker = (id: string, label: string) => {
    setPlanDirty(current => ({
      ...current,
      markers: current.markers.map(marker => marker.id === id ? { ...marker, label } : marker),
    }));
  };

  const handleMarkerPointerMove = (event: React.PointerEvent<HTMLButtonElement>, markerId: string) => {
    if (draggingMarkerId !== markerId || !mapRef.current) return;
    const point = percentPoint(event, mapRef.current);
    setPlanDirty(current => ({
      ...current,
      markers: current.markers.map(marker => marker.id === markerId ? { ...marker, ...point } : marker),
    }));
  };

  const addObjective = () => {
    const value = objectiveDraft.trim();
    if (!value) return;
    setPlanDirty(current => ({ ...current, objectives: [...current.objectives, value] }));
    setObjectiveDraft('');
  };

  const openCreateGroup = () => {
    setEditingGroupId(null);
    setGroupName('');
    setGroupObjective('');
    setGroupMemberIds([]);
    setGroupManualMembers([]);
    setManualMemberNick('');
    setManualMemberClass('');
    setShowGroupForm(true);
  };

  const openEditGroup = (group: TWPlanGroup) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setGroupObjective(group.objective);
    setGroupMemberIds(group.memberIds);
    setGroupManualMembers(group.manualMembers ?? []);
    setManualMemberNick('');
    setManualMemberClass('');
    setShowGroupForm(true);
  };

  const toggleGroupMember = (memberId: string) => {
    if (groupMemberIds.includes(memberId)) {
      setGroupMemberIds(current => current.filter(id => id !== memberId));
      return;
    }
    setGroupMemberIds(current => [...current, memberId]);
  };

  const addManualGroupMember = () => {
    const nick = manualMemberNick.trim();
    if (!nick) {
      toast.error('Informe o nick do jogador');
      return;
    }
    setGroupManualMembers(current => [...current, {
      id: crypto.randomUUID(),
      nick,
      userClass: manualMemberClass.trim(),
    }]);
    setManualMemberNick('');
    setManualMemberClass('');
  };

  const saveGroup = () => {
    const name = groupName.trim();
    const objective = groupObjective.trim();
    if (!name || !objective) {
      toast.error('Informe o nome e o objetivo da PT');
      return;
    }
    if (groupMemberIds.length === 0 && groupManualMembers.length === 0) {
      toast.error('Selecione pelo menos um jogador para a PT');
      return;
    }

    const group: TWPlanGroup = {
      id: editingGroupId ?? crypto.randomUUID(),
      name,
      objective,
      memberIds: groupMemberIds,
      manualMembers: groupManualMembers,
    };
    setPlanDirty(current => ({
      ...current,
      groups: editingGroupId
        ? current.groups.map(item => item.id === editingGroupId ? group : item)
        : [...current.groups, group],
      markers: current.markers.map(marker => marker.groupId === group.id ? { ...marker, label: group.name } : marker),
    }));
    setShowGroupForm(false);
    setEditingGroupId(null);
    const alreadyPositioned = plan.markers.some(marker => marker.type === 'group' && marker.groupId === group.id);
    if (alreadyPositioned) {
      setPendingGroup(null);
      setTool('select');
      toast.success(`${name} atualizada`);
    } else {
      setPendingGroup(group);
      setTool('group');
      setMobilePanel('map');
      toast.success(`${name} pronta. Clique no mapa para posicionar.`);
    }
  };

  const removeGroup = (group: TWPlanGroup) => {
    setPlanDirty(current => ({
      ...current,
      groups: current.groups.filter(item => item.id !== group.id),
      markers: current.markers.filter(marker => marker.groupId !== group.id),
    }));
    if (pendingGroup?.id === group.id) {
      setPendingGroup(null);
      setTool('select');
    }
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950"><LoadingLogo size={128} fullscreen={false} /></div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#080d16] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0c1320]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={isAdmin ? `/admin/tw/${twId}` : '/tw'} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30">
              <Map className="h-5 w-5 text-rose-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold sm:text-base">Sala de estratégia</h1>
                {session.closed && <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">Encerrada</span>}
              </div>
              <p className="truncate text-xs text-slate-500">{session.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-xs text-slate-400">{dirty ? 'Alterações não publicadas' : updatedAt ? 'Planejamento publicado' : 'Ainda não publicado'}</p>
              {updatedAt && <p className="text-[10px] text-slate-600">{updatedByName} · {updatedAt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
            {canEdit ? (
              <button onClick={savePlan} disabled={saving || !dirty} className="flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-bold shadow-lg shadow-rose-950/30 transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 sm:px-5">
                {saving ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{saving ? 'Publicando...' : 'Publicar plano'}</span>
              </button>
            ) : (
              <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Modo consulta</span>
            )}
          </div>
        </div>
      </header>

      <div className="border-b border-white/5 bg-[#0a101b] lg:hidden">
        <div className="grid grid-cols-3 p-2">
          {(['map', 'strategy', 'roster'] as const).map(tab => (
            <button key={tab} onClick={() => setMobilePanel(tab)} className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mobilePanel === tab ? 'bg-white/10 text-white' : 'text-slate-500'}`}>
              {tab === 'map' ? 'Mapa' : tab === 'strategy' ? 'Estratégia' : `PTs (${plan.groups.length})`}
            </button>
          ))}
        </div>
      </div>

      <main className="mx-auto grid max-w-[1800px] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_310px]">
        <aside className={`${mobilePanel === 'strategy' ? 'block' : 'hidden'} min-h-[calc(100vh-7.5rem)] border-r border-white/10 bg-[#0b121e] p-4 lg:block lg:min-h-[calc(100vh-4rem)]`}>
          <div className="mb-6 flex items-center gap-2">
            <CircleDot className="h-4 w-4 text-rose-400" />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Plano da batalha</h2>
          </div>

          <label className="mb-2 block text-xs font-semibold text-slate-400">Estratégia geral</label>
          <textarea
            value={plan.strategy}
            onChange={event => setPlanDirty(current => ({ ...current, strategy: event.target.value }))}
            disabled={!canEdit}
            rows={7}
            placeholder="Descreva a abertura, prioridades, plano B e condições de recuo..."
            className="w-full resize-none rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-700 focus:border-rose-500/50 disabled:opacity-80"
          />

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400">Objetivos</label>
              <span className="text-[10px] text-slate-600">{plan.objectives.length} itens</span>
            </div>
            <div className="space-y-2">
              {plan.objectives.map((objective, index) => (
                <div key={`${objective}-${index}`} className="group flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-[10px] font-bold text-rose-300">{index + 1}</span>
                  <p className="flex-1 text-xs leading-relaxed text-slate-300">{objective}</p>
                  {canEdit && <button onClick={() => setPlanDirty(current => ({ ...current, objectives: current.objectives.filter((_, itemIndex) => itemIndex !== index) }))} className="text-slate-700 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>}
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <input value={objectiveDraft} onChange={event => setObjectiveDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addObjective(); }} placeholder="Novo objetivo..." className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-700 focus:border-rose-500/50" />
                <button onClick={addObjective} className="rounded-lg bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"><Plus className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-white/5 pt-5">
            <p className="mb-3 text-xs font-semibold text-slate-400">Rotas publicadas</p>
            {plan.routes.length === 0 ? <p className="text-xs text-slate-700">Nenhuma rota desenhada.</p> : (
              <div className="space-y-2">
                {plan.routes.map(route => (
                  <div key={route.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: route.color }} />
                    <span className="flex-1 truncate text-xs text-slate-300">{route.label}</span>
                    {canEdit && <button onClick={() => setPlanDirty(current => ({ ...current, routes: current.routes.filter(item => item.id !== route.id) }))} className="text-slate-600 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        <section className={`${mobilePanel === 'map' ? 'block' : 'hidden'} min-w-0 bg-[#080d16] p-3 sm:p-5 lg:block`}>
          {canEdit && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-[#0e1725] p-2 shadow-xl">
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={() => { setTool('select'); setDraftRoute([]); setPendingGroup(null); }} title="Selecionar e mover" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${tool === 'select' ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><MousePointer2 className="h-4 w-4" /><span className="hidden sm:inline">Mover</span></button>
                {(Object.entries(MARKER_META) as [TacticalMarkerType, typeof MARKER_META.attack][]).map(([type, meta]) => {
                  const Icon = meta.icon;
                  return <button key={type} onClick={() => { setTool(type); setPendingGroup(null); setDraftRoute([]); }} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${tool === type ? 'bg-white/10 text-white ring-1 ring-white/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" /><span className="hidden sm:inline">{meta.label}</span></button>;
                })}
                <button onClick={() => { setTool('route'); setPendingGroup(null); }} title="Traçar rota com direção" className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${tool === 'route' ? 'bg-white/10 text-white ring-1 ring-white/20' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><ArrowRight className="h-4 w-4" /><span className="hidden sm:inline">Rota</span></button>
                <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
                {tool !== 'select' && tool !== 'group' && (
                  <input value={tool === 'route' ? routeLabel : markerLabel} onChange={event => tool === 'route' ? setRouteLabel(event.target.value) : setMarkerLabel(event.target.value)} placeholder="Nome da ordem" className="min-w-[130px] flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-600 focus:border-rose-500/50" />
                )}
                {tool !== 'select' && tool !== 'route' && tool !== 'group' && (
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] font-semibold text-slate-400" title="Tamanho do pin">
                    Pin
                    <input type="range" min="24" max="72" step="4" value={markerSize} onChange={event => setMarkerSize(Number(event.target.value))} className="h-1 w-20 cursor-pointer accent-rose-500" aria-label="Tamanho do pin" />
                    <span className="w-7 text-right text-white">{markerSize}px</span>
                  </label>
                )}
                {tool === 'select' && selectedMarkerId && (() => {
                  const selectedMarker = plan.markers.find(marker => marker.id === selectedMarkerId);
                  if (!selectedMarker) return null;
                  return (
                    <>
                      <input value={selectedMarker.label} onChange={event => renameMarker(selectedMarker.id, event.target.value)} maxLength={40} aria-label="Nome do pin selecionado" className="min-w-[140px] flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-rose-500/50" />
                      <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] font-semibold text-slate-400" title="Tamanho do pin selecionado">
                        Tamanho
                        <input type="range" min="24" max="72" step="4" value={selectedMarker.size ?? DEFAULT_MARKER_SIZE} onChange={event => resizeMarker(selectedMarker.id, Number(event.target.value))} className="h-1 w-24 cursor-pointer accent-rose-500" aria-label="Tamanho do pin selecionado" />
                        <span className="w-7 text-right text-white">{selectedMarker.size ?? DEFAULT_MARKER_SIZE}px</span>
                      </label>
                    </>
                  );
                })()}
                {tool === 'route' && (
                  <>
                    <div className="flex gap-1 px-1">{ROUTE_COLORS.map(color => <button key={color} onClick={() => setRouteColor(color)} className={`h-5 w-5 rounded-full border-2 transition ${routeColor === color ? 'scale-110 border-white' : 'border-transparent'}`} style={{ backgroundColor: color }} aria-label={`Cor ${color}`} />)}</div>
                    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-[10px] font-semibold text-slate-400" title="Espessura da linha">
                      Linha
                      <input type="range" min="1" max="8" step="1" value={routeWidth} onChange={event => setRouteWidth(Number(event.target.value))} className="h-1 w-20 cursor-pointer accent-emerald-500" aria-label="Espessura da linha da rota" />
                      <span className="w-5 text-right text-white">{routeWidth}px</span>
                    </label>
                    <button onClick={finishRoute} disabled={draftRoute.length < 2} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-800 disabled:text-slate-600"><Check className="h-3.5 w-3.5" />Concluir ({draftRoute.length})</button>
                    {draftRoute.length > 0 && <button onClick={() => setDraftRoute([])} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white"><Eraser className="h-4 w-4" /></button>}
                  </>
                )}
              </div>
              <p className="px-2 pt-2 text-[10px] text-slate-600">
                {tool === 'select' ? 'Arraste os marcadores para reposicionar.' : tool === 'route' ? 'Clique na ordem do caminho: a seta apontará para o último ponto.' : tool === 'group' ? `Clique no mapa para posicionar ${pendingGroup?.name ?? 'a PT selecionada'}.` : `Clique no mapa para adicionar: ${MARKER_META[tool].label}.`}
              </p>
            </div>
          )}

          <div className="mb-3 flex items-center justify-end gap-2 px-1">
            <span className="text-[10px] font-semibold text-slate-500" title="Use Ctrl + roda do mouse sobre o mapa">Zoom · Ctrl + roda</span>
            <button onClick={() => setMapZoom(current => Math.max(1, Number((current - 0.25).toFixed(2))))} disabled={mapZoom <= 1} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:text-slate-700" aria-label="Diminuir zoom">−</button>
            <input type="range" min="1" max="5" step="0.25" value={mapZoom} onChange={event => setMapZoom(Number(event.target.value))} className="h-1 w-24 cursor-pointer accent-sky-500" aria-label="Zoom do mapa" />
            <button onClick={() => setMapZoom(current => Math.min(5, Number((current + 0.25).toFixed(2))))} disabled={mapZoom >= 5} className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-sm font-bold text-slate-300 hover:bg-white/10 disabled:text-slate-700" aria-label="Aumentar zoom">+</button>
            <span className="w-10 text-right text-[10px] font-bold text-white">{Math.round(mapZoom * 100)}%</span>
          </div>

          <div
            ref={mapViewportRef}
            onPointerDown={startMapPan}
            onPointerMove={moveMapPan}
            onPointerUp={stopMapPan}
            onPointerCancel={stopMapPan}
            className={`max-h-[calc(100vh-10rem)] overflow-auto rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40 ${tool === 'select' && mapZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            <div
              ref={mapRef}
              onClick={handleMapClick}
              className={`relative aspect-[1024/772] w-full select-none overflow-hidden ${canEdit && tool !== 'select' ? 'cursor-crosshair' : ''}`}
              style={{ width: `${mapZoom * 100}%` }}
            >
              <Image src="/Mapa_TW.png" alt="Mapa da Territorial War" fill priority sizes="(min-width: 1280px) 60vw, 100vw" draggable={false} className="absolute inset-0 object-cover" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10" />

              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  {ROUTE_COLORS.map((color, index) => (
                    <marker key={color} id={`route-arrow-${index}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                    </marker>
                  ))}
                </defs>
                {plan.routes.map(route => <polyline key={route.id} points={route.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="rgba(0,0,0,.75)" strokeWidth={(route.width ?? DEFAULT_ROUTE_WIDTH) + 1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />)}
                {plan.routes.map(route => {
                  const colorIndex = Math.max(0, ROUTE_COLORS.indexOf(route.color));
                  return <polyline key={`${route.id}-color`} points={route.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={route.color} strokeWidth={route.width ?? DEFAULT_ROUTE_WIDTH} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" markerEnd={`url(#route-arrow-${colorIndex})`} />;
                })}
                {draftRoute.length > 0 && <polyline points={draftRoute.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={routeColor} strokeWidth={routeWidth} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" markerEnd={`url(#route-arrow-${Math.max(0, ROUTE_COLORS.indexOf(routeColor))})`} />}
              </svg>

              {draftRoute.map((point, index) => <span key={index} className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${point.x}%`, top: `${point.y}%`, backgroundColor: routeColor }} />)}

              {plan.markers.map(marker => {
                const isGroup = marker.type === 'group';
                const groupData = isGroup ? plan.groups.find(group => group.id === marker.groupId) : null;
                const meta = isGroup ? null : MARKER_META[marker.type as TacticalMarkerType];
                const Icon = meta?.icon;
                const selected = selectedMarkerId === marker.id;
                return (
                  <button
                    key={marker.id}
                    onClick={event => { event.stopPropagation(); setSelectedMarkerId(marker.id); setTool('select'); }}
                    onPointerDown={event => {
                      event.stopPropagation();
                      if (!canEdit) return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDraggingMarkerId(marker.id);
                      setSelectedMarkerId(marker.id);
                    }}
                    onPointerMove={event => handleMarkerPointerMove(event, marker.id)}
                    onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); setDraggingMarkerId(null); }}
                    className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 touch-none ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                    style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                    title={groupData ? `${groupData.name}: ${groupData.objective}` : marker.label}
                  >
                    <span className={`relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-white shadow-[0_2px_8px_rgba(0,0,0,.8)] sm:h-10 sm:w-10 ${isGroup ? 'bg-cyan-700 border-cyan-200' : meta?.color} ${selected ? 'ring-4 ring-white/70' : ''}`} style={marker.size ? { width: marker.size, height: marker.size } : undefined}>
                      {isGroup ? <Users className="h-4 w-4 sm:h-5 sm:w-5" style={marker.size ? { width: marker.size * 0.45, height: marker.size * 0.45 } : undefined} /> : Icon ? <Icon className="h-4 w-4" style={marker.size ? { width: marker.size * 0.45, height: marker.size * 0.45 } : undefined} /> : null}
                      <span className="absolute -bottom-1 h-2 w-2 rotate-45 border-b border-r border-inherit bg-inherit" />
                    </span>
                    <span className={`absolute left-1/2 top-full mt-2 min-w-max -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[9px] font-bold text-white shadow-lg sm:text-[10px] ${selected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}>
                      <span className="block whitespace-nowrap">{marker.label}</span>
                      {groupData && <span className={`mt-0.5 max-w-48 whitespace-normal text-left text-[8px] font-normal leading-tight text-cyan-200 ${selected ? 'block' : 'hidden group-hover:block'}`}>{groupData.objective}</span>}
                    </span>
                  </button>
                );
              })}

              {selectedMarkerId && canEdit && (() => {
                const marker = plan.markers.find(item => item.id === selectedMarkerId);
                if (!marker) return null;
                return <button onClick={event => { event.stopPropagation(); removeMarker(marker.id); }} className="absolute z-20 -translate-x-1/2 rounded-full bg-rose-600 p-1.5 text-white shadow-xl transition hover:bg-rose-500" style={{ left: `${marker.x}%`, top: `calc(${marker.y}% - ${(marker.size ?? DEFAULT_MARKER_SIZE) / 2 + 14}px)` }} title="Remover marcador"><Trash2 className="h-3.5 w-3.5" /></button>;
              })()}

              {plan.markers.length === 0 && plan.routes.length === 0 && !canEdit && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
                  <div className="rounded-2xl border border-white/10 bg-black/70 px-6 py-5 text-center shadow-2xl">
                    <Map className="mx-auto mb-2 h-7 w-7 text-slate-500" />
                    <p className="text-sm font-semibold text-slate-300">Planejamento ainda não publicado</p>
                    <p className="mt-1 text-xs text-slate-600">A estratégia aparecerá aqui quando estiver pronta.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[10px] text-slate-600">
            {(Object.entries(MARKER_META) as [TacticalMarkerType, typeof MARKER_META.attack][]).map(([type, meta]) => <span key={type} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${meta.color.split(' ')[0]}`} />{meta.label}</span>)}
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-cyan-700 ring-1 ring-cyan-200" />PT</span>
          </div>
        </section>

        <aside className={`${mobilePanel === 'roster' ? 'block' : 'hidden'} min-h-[calc(100vh-7.5rem)] border-l border-white/10 bg-[#0b121e] p-4 lg:block lg:min-h-[calc(100vh-4rem)]`}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">PTs da TW</h2>
              <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-500">{plan.groups.length}</span>
            </div>
            {canEdit && !showGroupForm && (
              <button onClick={openCreateGroup} className="flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-cyan-500">
                <Plus className="h-3.5 w-3.5" /> Nova PT
              </button>
            )}
          </div>
          <p className="mb-4 text-[10px] leading-relaxed text-slate-600">Monte os grupos com quantos jogadores precisar e posicione cada PT como uma unidade no mapa.</p>

          {showGroupForm && canEdit ? (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold text-white">{editingGroupId ? 'Editar PT' : 'Nova PT'}</p>
                <span className="text-[10px] font-bold text-slate-500">{groupMemberIds.length + groupManualMembers.length} selecionados</span>
              </div>
              <div className="space-y-2.5">
                <input value={groupName} onChange={event => setGroupName(event.target.value)} maxLength={30} placeholder="Nome da PT (ex: PT Catapulta)" className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-500/50" />
                <textarea value={groupObjective} onChange={event => setGroupObjective(event.target.value)} rows={3} maxLength={180} placeholder="Objetivo da PT no combate..." className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs leading-relaxed text-white outline-none placeholder:text-slate-700 focus:border-cyan-500/50" />
              </div>

              <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Jogadores do roster</p>
              {roster.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 p-4 text-center">
                  <p className="text-xs text-slate-600">O roster ainda está vazio.</p>
                  <Link href={`/admin/tw/${twId}`} className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-400">Gerenciar roster <ChevronRight className="h-3 w-3" /></Link>
                </div>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                  {roster.map(member => {
                    const selected = groupMemberIds.includes(member.userId);
                    return (
                      <button key={member.id} onClick={() => toggleGroupMember(member.userId)} className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition ${selected ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-transparent bg-white/[0.025] hover:bg-white/5'}`}>
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-cyan-400 bg-cyan-500 text-white' : 'border-slate-700'}`}>{selected && <Check className="h-3 w-3" />}</span>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[8px] font-black text-white">{markerInitials(member.userName)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-slate-300">{member.userName}</span>
                          <span className="block truncate text-[9px] text-slate-600">{member.userClass}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 border-t border-white/5 pt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Adicionar manualmente</p>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
                  <input value={manualMemberNick} onChange={event => setManualMemberNick(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addManualGroupMember(); }} maxLength={30} placeholder="Nick *" className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-500/50" />
                  <input value={manualMemberClass} onChange={event => setManualMemberClass(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addManualGroupMember(); }} maxLength={30} placeholder="Classe (opcional)" className="min-w-0 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs text-white outline-none placeholder:text-slate-700 focus:border-cyan-500/50" />
                  <button type="button" onClick={addManualGroupMember} className="rounded-lg bg-white/10 p-2 text-cyan-300 transition hover:bg-white/15" title="Adicionar jogador manual"><Plus className="h-4 w-4" /></button>
                </div>
                {groupManualMembers.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {groupManualMembers.map(member => (
                      <div key={member.id} className="flex items-center gap-2 rounded-lg bg-white/[0.035] px-2.5 py-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-950 text-[8px] font-black text-cyan-200">{markerInitials(member.nick)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-semibold text-slate-300">{member.nick}</span>
                          <span className="block truncate text-[9px] text-slate-600">{member.userClass || 'Sem classe informada'}</span>
                        </span>
                        <button type="button" onClick={() => setGroupManualMembers(current => current.filter(item => item.id !== member.id))} className="p-1 text-slate-600 hover:text-rose-400" title="Remover jogador"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => { setShowGroupForm(false); setEditingGroupId(null); }} className="rounded-lg border border-white/10 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5">Cancelar</button>
                <button onClick={saveGroup} className="rounded-lg bg-cyan-600 py-2 text-xs font-bold text-white transition hover:bg-cyan-500">Salvar PT</button>
              </div>
            </div>
          ) : plan.groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
              <Users className="mx-auto mb-2 h-7 w-7 text-slate-700" />
              <p className="text-xs font-semibold text-slate-500">Nenhuma PT montada</p>
              <p className="mt-1 text-[10px] text-slate-700">Crie uma PT com nome, objetivo e seus jogadores.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plan.groups.map(group => {
                const marker = plan.markers.find(item => item.type === 'group' && item.groupId === group.id);
                const members = roster.filter(member => group.memberIds.includes(member.userId));
                const manualMembers = group.manualMembers ?? [];
                return (
                  <div key={group.id} className="rounded-xl border border-white/5 bg-white/[0.025] p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20"><Users className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-bold text-white">{group.name}</p>
                          {marker && <CircleDot className="h-3 w-3 shrink-0 text-cyan-400" />}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{members.length + manualMembers.length} jogadores</p>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button onClick={() => openEditGroup(group)} title="Editar PT" className="rounded-md p-1.5 text-slate-600 transition hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => removeGroup(group)} title="Excluir PT" className="rounded-md p-1.5 text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg bg-black/15 p-2.5">
                      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-400/70"><Target className="h-3 w-3" /> Objetivo</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{group.objective}</p>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {members.map(member => <span key={member.userId} title={member.userClass} className="rounded-md bg-white/5 px-1.5 py-1 text-[9px] text-slate-400">{member.userName}</span>)}
                      {manualMembers.map(member => <span key={member.id} title={member.userClass || 'Adicionado manualmente'} className="rounded-md bg-cyan-500/10 px-1.5 py-1 text-[9px] text-cyan-300">{member.nick}{member.userClass ? ` · ${member.userClass}` : ''}</span>)}
                    </div>

                    {canEdit && (
                      <button onClick={() => { setPendingGroup(group); setTool('group'); setMobilePanel('map'); }} className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition ${marker ? 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20' : 'bg-cyan-600 text-white hover:bg-cyan-500'}`}>
                        {marker ? <CircleDot className="h-3.5 w-3.5" /> : <Map className="h-3.5 w-3.5" />}
                        {marker ? 'Reposicionar no mapa' : 'Posicionar no mapa'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

export default function TWPlanningPage() {
  return <ProtectedRoute requirePlanningAccess><PlanningContent /></ProtectedRoute>;
}
