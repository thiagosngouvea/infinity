/**
 * lib/paths.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers centralizados para caminhos de coleções scoped por clã no Firestore.
 *
 * Estrutura multi-tenant:
 *   /clans/{clanSlug}/users/{userId}
 *   /clans/{clanSlug}/events/{eventId}
 *   /clans/{clanSlug}/eventVotes/{voteId}
 *   /clans/{clanSlug}/attendances/{attendanceId}
 *   /clans/{clanSlug}/raffles/{raffleId}
 *   /clans/{clanSlug}/notifications/{notifId}
 *   /clans/{clanSlug}/items/{itemId}
 *   /clans/{clanSlug}/redemptions/{redemptionId}
 *
 * Uso:
 *   import { clanCol, clanDoc } from '@/lib/paths';
 *   const usersRef = clanCol(clanSlug, 'users');
 *   const userRef  = clanDoc(clanSlug, 'users', userId);
 */

import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

/** Referência para uma coleção dentro do clã */
export const clanCol = (clanSlug: string, col: string) =>
  collection(db, 'clans', clanSlug, col);

/** Referência para um documento dentro do clã */
export const clanDoc = (clanSlug: string, col: string, id: string) =>
  doc(db, 'clans', clanSlug, col, id);

/** Nomes das coleções scoped */
export const COLS = {
  users:         'users',
  events:        'events',
  eventVotes:    'eventVotes',
  attendances:   'attendances',
  raffles:       'raffles',
  notifications: 'notifications',
  items:         'items',
  redemptions:   'redemptions',
} as const;
