export type UserRole = 'pending' | 'member' | 'admin';

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
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  type: 'TW' | 'GvG' | 'Boss' | 'Farm' | 'Outro';
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
  type: 'raffle_win' | 'approval' | 'event' | 'general';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

