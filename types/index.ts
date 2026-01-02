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
  totalPointsEarned: number; // Total de pontos acumulados (nunca diminui)
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

