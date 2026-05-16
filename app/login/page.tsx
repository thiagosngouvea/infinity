'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { LogIn, Shield, Swords, Crown, Flame } from 'lucide-react';

/* ── Interactive Canvas Background ───────────────────────────────────────────── */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  opacity: number;
  pulseSpeed: number;
  pulsePhase: number;
}

function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Read CSS variable color once
  const primaryColorRef = useRef({ r: 229, g: 62, b: 62 }); // fallback

  const initParticles = useCallback((w: number, h: number) => {
    const count = Math.floor((w * h) / 12000); // density based on screen size
    const particles: Particle[] = [];
    for (let i = 0; i < Math.min(count, 120); i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        baseRadius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        pulseSpeed: Math.random() * 0.02 + 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Try to read --clan-primary from CSS
    const style = getComputedStyle(document.documentElement);
    const rawColor = style.getPropertyValue('--clan-primary').trim();
    if (rawColor.startsWith('#')) {
      const hex = rawColor.replace('#', '');
      primaryColorRef.current = {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      };
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (particlesRef.current.length === 0) {
        initParticles(canvas.width, canvas.height);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const CONNECT_DIST = 150;
    const MOUSE_RADIUS = 200;
    const MOUSE_FORCE = 0.02;

    const animate = () => {
      timeRef.current += 1;
      const { r, g, b } = primaryColorRef.current;
      const w = canvas.width;
      const h = canvas.height;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      ctx.clearRect(0, 0, w, h);

      const particles = particlesRef.current;

      // Update particles
      for (const p of particles) {
        // Mouse attraction
        const dx = mx - p.x;
        const dy = my - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_FORCE;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }

        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Pulse radius
        p.radius = p.baseRadius + Math.sin(timeRef.current * p.pulseSpeed + p.pulsePhase) * 0.5;

        // Glow near mouse
        const mouseDist = Math.sqrt((mx - p.x) ** 2 + (my - p.y) ** 2);
        const mouseGlow = mouseDist < MOUSE_RADIUS ? (1 - mouseDist / MOUSE_RADIUS) * 0.6 : 0;
        const finalOpacity = Math.min(p.opacity + mouseGlow, 1);

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalOpacity})`;
        ctx.fill();

        // Outer glow for particles near mouse
        if (mouseGlow > 0.1) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${mouseGlow * 0.4})`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.15;

            // Lines near the mouse glow brighter
            const midX = (particles[i].x + particles[j].x) / 2;
            const midY = (particles[i].y + particles[j].y) / 2;
            const midDist = Math.sqrt((mx - midX) ** 2 + (my - midY) ** 2);
            const boost = midDist < MOUSE_RADIUS ? (1 - midDist / MOUSE_RADIUS) * 0.3 : 0;

            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha + boost})`;
            ctx.lineWidth = 0.5 + boost * 2;
            ctx.stroke();
          }
        }
      }

      // Draw a soft glow at mouse position
      if (mx > 0 && my > 0) {
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, MOUSE_RADIUS);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.06)`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.02)`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, MOUSE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

/* ── Pulsing energy rings behind logo ────────────────────────────────────────── */
function EnergyRings() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full login-pulse-ring"
          style={{
            width: `${160 + i * 60}px`,
            height: `${160 + i * 60}px`,
            border: `1px solid var(--clan-primary)`,
            animationDelay: `${i * 0.8}s`,
            opacity: 0.3 - i * 0.08,
          }}
        />
      ))}
    </>
  );
}

/* ── Main Login Page ─────────────────────────────────────────────────────────── */
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { signIn } = useAuth();
  const { clan, loading: clanLoading } = useClan();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Email ou senha incorretos!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(229,62,62,0.15) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 100%, rgba(237,137,54,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 20% 100%, rgba(229,62,62,0.06) 0%, transparent 50%),
          linear-gradient(180deg, #0a0a12 0%, #0d0d1a 40%, #1a0a0a 100%)
        `,
      }}
    >
      {/* ── Background animated effects ──────────────────────────────────────── */}

      {/* Interactive canvas background — reacts to mouse */}
      {mounted && <InteractiveBackground />}
      {/* Rotating energy beam */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="login-energy-beam"
          style={{
            width: '800px',
            height: '800px',
            background: `conic-gradient(from 0deg, transparent 0%, transparent 85%, rgba(229,62,62,0.06) 90%, transparent 100%)`,
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Decorative corner runes */}
      <div className="absolute top-8 left-8 opacity-20 login-float" style={{ animationDelay: '0s' }}>
        <Swords className="w-8 h-8" style={{ color: 'var(--clan-primary)' }} />
      </div>
      <div className="absolute top-8 right-8 opacity-20 login-float" style={{ animationDelay: '2s' }}>
        <Crown className="w-8 h-8" style={{ color: 'var(--clan-accent)' }} />
      </div>
      <div className="absolute bottom-8 left-8 opacity-20 login-float" style={{ animationDelay: '4s' }}>
        <Flame className="w-8 h-8" style={{ color: 'var(--clan-accent)' }} />
      </div>
      <div className="absolute bottom-8 right-8 opacity-20 login-float" style={{ animationDelay: '1s' }}>
        <Shield className="w-8 h-8" style={{ color: 'var(--clan-primary)' }} />
      </div>

      {/* Horizontal decorative lines */}
      <div
        className="absolute top-0 left-0 w-full h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--clan-primary) 50%, transparent 100%)',
          opacity: 0.3,
        }}
      />
      <div
        className="absolute bottom-0 left-0 w-full h-px"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--clan-primary) 50%, transparent 100%)',
          opacity: 0.3,
        }}
      />

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-md w-full">

        {/* ── Logo + Clan Name ───────────────────────────────────────────────── */}
        <div className="text-center mb-10 relative">
          {/* Energy rings behind logo */}
          <div className="relative flex justify-center mb-6">
            <div className="relative">
              <EnergyRings />
              <div className={mounted ? 'login-logo-entrance' : 'opacity-0'}>
                {clanLoading ? (
                  <div
                    className="w-28 h-28 rounded-2xl animate-pulse"
                    style={{ backgroundColor: 'var(--clan-surface)' }}
                  />
                ) : clan.logoUrl ? (
                  <img
                    src={clan.logoUrl}
                    alt={clan.name}
                    className="w-28 h-28 rounded-2xl object-cover login-glow-pulse"
                    style={{
                      border: '2px solid rgba(229,62,62,0.4)',
                    }}
                  />
                ) : (
                  <div
                    className="w-28 h-28 rounded-2xl flex items-center justify-center login-glow-pulse"
                    style={{
                      backgroundColor: 'var(--clan-primary)',
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <Shield className="h-14 w-14 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clan name with letter-spacing reveal */}
          <h1
            className="text-4xl font-black text-white tracking-wider login-title-reveal"
            style={{
              textShadow: '0 0 40px rgba(229,62,62,0.3), 0 2px 10px rgba(0,0,0,0.5)',
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
            }}
          >
            {clanLoading ? (
              <span
                className="inline-block w-48 h-10 rounded animate-pulse"
                style={{ backgroundColor: 'var(--clan-surface)' }}
              />
            ) : (
              clan.name
            )}
          </h1>

          {/* Decorative sword slash line */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <div
              className="h-px flex-1 max-w-16"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--clan-primary))',
                opacity: 0.6,
              }}
            />
            <Swords className="w-4 h-4" style={{ color: 'var(--clan-primary)', opacity: 0.6 }} />
            <div
              className="h-px flex-1 max-w-16"
              style={{
                background: 'linear-gradient(270deg, transparent, var(--clan-primary))',
                opacity: 0.6,
              }}
            />
          </div>

          {clan.game && !clanLoading && (
            <p
              className="text-sm mt-2 uppercase tracking-widest font-medium login-slide-down"
              style={{ color: 'var(--clan-text-muted)', animationDelay: '0.8s' }}
            >
              {clan.game}
            </p>
          )}
        </div>

        {/* ── Login Card with glassmorphism ───────────────────────────────────── */}
        <div
          className="login-card-entrance relative rounded-2xl p-8 border login-border-glow overflow-hidden"
          style={{
            backgroundColor: 'rgba(20, 20, 35, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 login-shimmer rounded-2xl pointer-events-none" />

          {/* Top accent line */}
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3"
            style={{
              background: 'linear-gradient(90deg, transparent, var(--clan-primary), transparent)',
            }}
          />

          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3 login-input-reveal-1">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--clan-primary), var(--clan-accent))',
                  boxShadow: '0 4px 15px rgba(229,62,62,0.3)',
                }}
              >
                <LogIn className="h-5 w-5 text-white" />
              </div>
              <span>Entrar na sua conta</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email field */}
              <div className="login-input-reveal-2">
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--clan-text-muted)' }}>
                  Email
                </label>
                <div className="relative group">
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 border outline-none transition-all duration-300"
                    style={{
                      backgroundColor: 'rgba(10, 10, 20, 0.6)',
                      borderColor: 'var(--clan-border)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--clan-primary)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(229,62,62,0.15)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--clan-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="guerreiro@email.com"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="login-input-reveal-3">
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--clan-text-muted)' }}>
                  Senha
                </label>
                <div className="relative group">
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl text-white placeholder-gray-600 border outline-none transition-all duration-300"
                    style={{
                      backgroundColor: 'rgba(10, 10, 20, 0.6)',
                      borderColor: 'var(--clan-border)',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = 'var(--clan-primary)';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(229,62,62,0.15)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'var(--clan-border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Submit button */}
              <div className="login-input-reveal-4 pt-1">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full relative text-white font-bold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                  style={{
                    background: 'linear-gradient(135deg, var(--clan-primary), var(--clan-primary-hover))',
                    boxShadow: '0 4px 20px rgba(229,62,62,0.3)',
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.boxShadow = '0 6px 30px rgba(229,62,62,0.5)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(229,62,62,0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* Button shimmer effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                      backgroundSize: '200% 100%',
                      animation: 'loginShimmer 2s ease-in-out infinite',
                    }}
                  />
                  <span className="relative z-10 flex items-center justify-center gap-2 text-sm tracking-wider uppercase">
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <Swords className="w-4 h-4" />
                        Entrar no Clã
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--clan-border))' }} />
              <Crown className="w-3 h-3" style={{ color: 'var(--clan-text-muted)', opacity: 0.5 }} />
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(270deg, transparent, var(--clan-border))' }} />
            </div>

            {/* Register link */}
            <div className="text-center">
              <p style={{ color: 'var(--clan-text-muted)' }} className="text-sm">
                Novo guerreiro?{' '}
                <Link
                  href="/register"
                  className="font-bold transition-all duration-300 relative"
                  style={{ color: 'var(--clan-primary)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'var(--clan-accent)';
                    e.currentTarget.style.textShadow = '0 0 20px rgba(237,137,54,0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--clan-primary)';
                    e.currentTarget.style.textShadow = 'none';
                  }}
                >
                  Junte-se ao clã
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="text-center mt-8">
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--clan-text-muted)', opacity: 0.4 }}
          >
            ⚔ Sistema de Gerenciamento de Clã ⚔
          </p>
        </div>
      </div>
    </div>
  );
}
