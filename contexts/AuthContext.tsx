'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { clanDoc, COLS } from '@/lib/paths';
import { User } from '@/types';
import { useClan } from '@/contexts/ClanContext';
import toast from 'react-hot-toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (
    email: string,
    password: string,
    userData: Omit<User, 'id' | 'role' | 'pontos' | 'totalPointsEarned' | 'createdAt' | 'clanSlug'>
  ) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { clan } = useClan();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ─── Carrega dados do usuário (scoped pelo clã) ────────────────────────────

  const loadUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    const userRef = clanDoc(clan.slug, COLS.users, firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    // ✅ Encontrado no path do clã — retorna normalmente
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }

    // 🔄 Não encontrado — tenta migrar do path raiz antigo (/users/{uid})
    const legacyRef = doc(db, 'users', firebaseUser.uid);
    const legacyDoc = await getDoc(legacyRef).catch(() => null);

    if (legacyDoc && legacyDoc.exists()) {
      const legacyData = legacyDoc.data();

      // Copia os dados antigos para o novo path, adicionando clanSlug
      const migratedData = {
        ...legacyData,
        clanSlug: clan.slug,
      };

      await setDoc(userRef, migratedData);
      console.info(`[Auth] Conta ${firebaseUser.uid} migrada para /clans/${clan.slug}/users/`);

      return { id: firebaseUser.uid, ...migratedData } as User;
    }

    // ❌ Não existe em nenhum lugar — conta não pertence a este clã
    return null;
  };

  const refreshUserData = async () => {
    if (!user) return;
    const data = await loadUserData(user);
    setUserData(data);
  };

  // ─── Listener de autenticação ─────────────────────────────────────────────

  useEffect(() => {
    // Só inicia o listener quando o clã estiver carregado
    if (!clan.slug) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const data = await loadUserData(firebaseUser);

        if (!data) {
          // Usuário está autenticado no Firebase Auth, mas não tem registro
          // neste clã — faz logout silencioso
          await firebaseSignOut(auth);
          setUserData(null);
          toast.error('Esta conta não pertence a este clã.');
        } else {
          setUserData(data);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clan.slug]);

  // ─── Login ────────────────────────────────────────────────────────────────

  const signIn = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    // Valida se o usuário pertence a este clã
    const data = await loadUserData(credential.user);
    if (!data) {
      await firebaseSignOut(auth);
      throw new Error('Esta conta não pertence a este clã.');
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────────

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUserData(null);
  };

  // ─── Registro ─────────────────────────────────────────────────────────────

  const register = async (
    email: string,
    password: string,
    userData: Omit<User, 'id' | 'role' | 'pontos' | 'totalPointsEarned' | 'createdAt' | 'clanSlug'>
  ) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Salva o usuário no path scoped do clã
    const userRef = clanDoc(clan.slug, COLS.users, userCredential.user.uid);
    await setDoc(userRef, {
      ...userData,
      email,
      clanSlug: clan.slug,
      role: 'pending',
      pontos: 0,
      totalPointsEarned: 0,
      createdAt: new Date(),
    });
  };

  // ─── Context value ────────────────────────────────────────────────────────

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      signIn,
      signOut,
      register,
      refreshUserData,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
