'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoadingLogo from '@/components/LoadingLogo';

// Roles que têm acesso de administrador
const ADMIN_ROLES = ['admin', 'super_admin'];

export default function ProtectedRoute({ 
  children,
  requireAdmin = false 
}: { 
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const isAdmin = ADMIN_ROLES.includes(userData?.role ?? '');

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userData?.role === 'pending') {
        router.push('/pending-approval');
      } else if (requireAdmin && !isAdmin) {
        router.push('/dashboard');
      }
    }
  }, [user, userData, loading, requireAdmin, router, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingLogo size={128} fullscreen={false} />
      </div>
    );
  }

  if (!user || userData?.role === 'pending' || (requireAdmin && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
}
