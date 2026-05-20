// ─── White-Label: Config de Clã ───────────────────────────────────────────────

export interface ClanTheme {
  primary: string;
  primaryHover: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  text: string;
  textMuted: string;
}

export interface ClanConfig {
  id: string;
  slug: string;
  name: string;
  domain: string;
  logoUrl?: string;
  game?: string;
  theme: ClanTheme;
  active: boolean;
  attendanceEnabled?: boolean; // Sistema de presença diária ativo ou não
  createdAt: Date;
}

// ─── Auth & Users ──────────────────────────────────────────────────────────────

export type UserRole = 'pending' | 'member' | 'admin' | 'super_admin';

export type PlayerClass = 
  | 'Guerreiro' 
  | 'Arqueiro' 
  | 'Mago' 
  | 'Sacerdote' 
  | 'Bárbaro' 
  | 'Arcano' 
  | 'Mistico' 
  | 'Feiticeira'
  | 'Mercenário'
  | 'Espiritualista';

export interface User {
  id: string;
  email: string;
  nick: string;
  classe: PlayerClass;
  telefone: string;
  whatsapp: string;
  role: UserRole;
  pontos: number;
  totalPointsEarned: number; // Total de pontos acumulados (nunca diminui)
  clanSlug: string;          // Clã ao qual este usuário pertence (imutável)
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface NickHistoryEntry {
  id: string;
  nick: string;          // Nick após a alteração
  previousNick: string;  // Nick antes da alteração
  changedAt: Date;
  changedBy: string;     // uid do usuário que fez a alteração
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: 'TW' | 'GvG' | 'Boss' | 'Farm' | 'Outro';
  pointsForVoting: number; // Pontos por confirmar presença
  pointsForAttendance: number; // Pontos por comparecer (confirmado por admin)
  bannerUrl?: string; // URL do banner do evento (Firebase Storage)
  createdBy: string;
  createdAt: Date;
  active: boolean;
}

export interface EventVote {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  canParticipate: boolean;
  comment?: string;
  attended?: boolean; // Se compareceu (confirmado por admin)
  attendanceConfirmedBy?: string; // ID do admin que confirmou
  attendanceConfirmedAt?: Date; // Data da confirmação
  votingPointsAwarded?: boolean; // Se já recebeu pontos por votar
  attendancePointsAwarded?: boolean; // Se já recebeu pontos por comparecer
  createdAt: Date;
}

export interface Attendance {
  id: string;
  userId: string;
  userName: string;
  date: Date;
  pontos: number;
  createdBy: string;
  createdAt: Date;
}

export type PointsAuditSource =
  | 'manual'
  | 'attendance'
  | 'event_vote'
  | 'event_attendance'
  | 'tw_vote'
  | 'tw_roster'
  | 'redemption';

export interface PointsAuditEntry {
  id: string;
  userId: string;
  userName: string;
  source: PointsAuditSource;
  sourceId?: string;
  deltaPoints: number;
  deltaTotalPointsEarned: number;
  beforePoints: number;
  afterPoints: number;
  beforeTotalPointsEarned: number;
  afterTotalPointsEarned: number;
  reason?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface Raffle {
  id: string;
  title: string;
  description: string;
  prize: string;
  participants: string[]; // user IDs
  winnerId?: string;
  winnerName?: string;
  status: 'open' | 'closed' | 'completed';
  createdBy: string;
  createdAt: Date;
  drawDate?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'raffle_win' | 'approval' | 'event' | 'tw' | 'general';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  pointsCost: number;
  stock: number;
  active: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface Redemption {
  id: string;
  itemId: string;
  itemName: string;
  userId: string;
  userName: string;
  pointsSpent: number;
  status: 'pending' | 'delivered' | 'cancelled';
  createdAt: Date;
  deliveredAt?: Date;
  deliveredBy?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  type: 'markdown' | 'pdf' | 'video';
  content?: string;           // Markdown text (when type === 'markdown')
  pdfUrl?: string;            // Download URL (when type === 'pdf')
  pdfFileName?: string;       // Original file name of the PDF
  videoUrl?: string;          // Download/stream URL (when type === 'video')
  videoFileName?: string;     // Original file name of the video
  category: string;
  pinned: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ─── Contas 0800 ──────────────────────────────────────────────────────────────

export interface Account0800Entry {
  nick: string;       // Nick da conta alt
  classe: string;     // Sigla da classe (EP, WB, MG, etc.)
  login: string;      // Login/email da conta
  senha: string;      // Senha da conta
  reborn: string;     // Nível de reborn
  meridiano: string;  // Meridiano
  cultivo: string;    // Cultivo
  pedra: string;      // Pedra
  ceu: string;        // Nível de céu
  refino: string;     // Refino
}

export interface Account0800 {
  id: string;
  userId: string;         // ID do dono (user)
  userNick: string;       // Nick do dono para exibição
  accounts: Account0800Entry[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Territory War (TW) ───────────────────────────────────────────────────────

export interface TWSession {
  id: string;
  title: string;               // Ex: "TW - Semana 20"
  date: Date;
  description?: string;
  active: boolean;             // TW disponível para votos/roster
  closed: boolean;             // TW encerrada (vira histórico)
  pointsForVoting: number;     // Pontos por confirmar presença
  pointsForRoster: number;     // Pontos por ser selecionado para o roster
  createdBy: string;
  createdAt: Date;
}

export interface TWVote {
  id: string;
  twId: string;
  userId: string;
  userName: string;
  userClass: PlayerClass;
  canParticipate: boolean;
  votingPointsAwarded?: boolean; // Se já recebeu pontos por confirmar
  createdAt: Date;
}

export interface TWRosterEntry {
  id: string;
  twId: string;
  userId: string;
  userName: string;
  userClass: PlayerClass;
  selectedBy: string;          // Admin que selecionou
  selectedAt: Date;
  rosterPointsAwarded?: boolean; // Se já recebeu pontos por estar no roster
}
