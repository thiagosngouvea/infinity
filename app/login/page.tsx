'use client';

import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClan } from '@/contexts/ClanContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { LogIn, Star as StarIcon, Sparkles, Infinity } from 'lucide-react';

/* ── Cosmic Universe Canvas Background ───────────────────────────────────────── */
interface Star {
  x: number; y: number; vx: number; vy: number;
  radius: number; baseRadius: number; opacity: number;
  twinkleSpeed: number; twinklePhase: number;
  color: [number, number, number]; // RGB
}
interface ShootingStar {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; length: number;
}

function CosmicBackground({ explodingRef }: { explodingRef: MutableRefObject<boolean> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const starsRef = useRef<Star[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);
  const explodeStartRef = useRef<number>(0);

  const STAR_COLORS: [number, number, number][] = [
    [255, 255, 255], [200, 220, 255], [180, 200, 255],
    [255, 200, 200], [220, 180, 255], [200, 255, 255],
    [229, 62, 62],   // clan red accent
  ];

  // Gaussian-ish random: sum of randoms gives bell curve centered at 0.5
  const centerRand = () => (Math.random() + Math.random() + Math.random()) / 3;

  const initStars = useCallback((w: number, h: number) => {
    const count = 400;
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      const isBright = Math.random() < 0.15;
      // 70% of stars center-biased, 30% fully random for coverage
      const centered = Math.random() < 0.7;
      const sx = centered ? centerRand() * w : Math.random() * w;
      const sy = centered ? centerRand() * h : Math.random() * h;
      stars.push({
        x: sx, y: sy,
        vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15,
        radius: isBright ? Math.random() * 2.5 + 1.5 : Math.random() * 1.5 + 0.3,
        baseRadius: isBright ? Math.random() * 2.5 + 1.5 : Math.random() * 1.5 + 0.3,
        opacity: isBright ? Math.random() * 0.4 + 0.6 : Math.random() * 0.4 + 0.1,
        twinkleSpeed: Math.random() * 0.03 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      });
    }
    starsRef.current = stars;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (starsRef.current.length === 0) initStars(canvas.width, canvas.height);
    };
    const onMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouseRef.current = { x: -1000, y: -1000 }; };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseleave', onLeave);

    const MOUSE_R = 220;

    // Draw ∞ symbol using bezier curves with strong pulsing glow
    function drawInfinity(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, alpha: number, lw: number, blur: number) {
      ctx.save();
      ctx.strokeStyle = `rgba(229, 62, 62, ${alpha})`;
      ctx.lineWidth = lw;
      ctx.shadowColor = `rgba(229, 62, 62, ${Math.min(alpha * 2, 1)})`;
      ctx.shadowBlur = blur;
      ctx.beginPath();
      // Left loop
      ctx.moveTo(cx, cy);
      ctx.bezierCurveTo(cx - size * 0.1, cy - size * 0.55, cx - size, cy - size * 0.55, cx - size, cy);
      ctx.bezierCurveTo(cx - size, cy + size * 0.55, cx - size * 0.1, cy + size * 0.55, cx, cy);
      // Right loop
      ctx.bezierCurveTo(cx + size * 0.1, cy - size * 0.55, cx + size, cy - size * 0.55, cx + size, cy);
      ctx.bezierCurveTo(cx + size, cy + size * 0.55, cx + size * 0.1, cy + size * 0.55, cx, cy);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Draw nebula cloud
    function drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color.replace(')', `, ${alpha * 0.3})`).replace('rgb', 'rgba'));
      grad.addColorStop(0.5, color.replace(')', `, ${alpha * 0.1})`).replace('rgb', 'rgba'));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const animate = () => {
      const t = timeRef.current += 1;
      const w = canvas.width, h = canvas.height;
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      const cx = w / 2, cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const isExploding = explodingRef.current;
      if (isExploding && explodeStartRef.current === 0) explodeStartRef.current = t;
      const explodeT = isExploding ? (t - explodeStartRef.current) : 0;
      const explodeProgress = Math.min(explodeT / 90, 1); // ~1.5s at 60fps

      // Nebula clouds (slow drift) — fade out during explosion
      const nebulaFade = 1 - explodeProgress;
      if (nebulaFade > 0) {
        drawNebula(ctx, w * 0.2 + Math.sin(t * 0.002) * 30, h * 0.3, 250, 'rgb(100, 40, 150)', 0.4 * nebulaFade);
        drawNebula(ctx, w * 0.8 + Math.cos(t * 0.0015) * 20, h * 0.7, 200, 'rgb(229, 62, 62)', 0.25 * nebulaFade);
        drawNebula(ctx, w * 0.5 + Math.sin(t * 0.001) * 40, h * 0.15, 180, 'rgb(40, 80, 180)', 0.3 * nebulaFade);
      }

      // Mouse nebula glow (not during explosion)
      if (mx > 0 && my > 0 && !isExploding) {
        drawNebula(ctx, mx, my, MOUSE_R, 'rgb(229, 62, 62)', 0.35);
      }

      // Stars
      const stars = starsRef.current;
      for (const s of stars) {
        if (isExploding) {
          // EXPLOSION: blast stars outward from center
          const dx = s.x - cx, dy = s.y - cy;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (3 + explodeProgress * 15) / Math.max(dist * 0.01, 0.5);
          s.vx += (dx / dist) * force * 0.3;
          s.vy += (dy / dist) * force * 0.3;
          s.x += s.vx;
          s.y += s.vy;
          // Stars grow brighter during explosion
          s.radius = s.baseRadius * (1 + explodeProgress * 3);
        } else {
          // Normal: gentle mouse repulsion
          const dx = s.x - mx, dy = s.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_R && dist > 0) {
            const push = (1 - dist / MOUSE_R) * 0.08;
            s.vx += (dx / dist) * push;
            s.vy += (dy / dist) * push;
          }
          s.vx *= 0.98; s.vy *= 0.98;
          s.x += s.vx; s.y += s.vy;
          if (s.x < -5) s.x = w + 5;
          if (s.x > w + 5) s.x = -5;
          if (s.y < -5) s.y = h + 5;
          if (s.y > h + 5) s.y = -5;
        }

        // Twinkle
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
        if (!isExploding) s.radius = s.baseRadius * (0.7 + twinkle * 0.5);
        const distToCenter = Math.sqrt((s.x - cx) ** 2 + (s.y - cy) ** 2);
        const nearMouse = !isExploding && distToCenter < MOUSE_R ? (1 - Math.sqrt((s.x - mx) ** 2 + (s.y - my) ** 2) / MOUSE_R) * 0.5 : 0;
        const explodeBright = isExploding ? Math.min(explodeProgress * 2, 1) : 0;
        const alpha = Math.min(s.opacity * twinkle + Math.max(nearMouse, 0) + explodeBright, 1);
        const [r, g, b] = s.color;

        // Star glow
        if (s.baseRadius > 1.5 || nearMouse > 0.1 || isExploding) {
          const glowR = s.radius * (3 + (nearMouse > 0 ? nearMouse * 4 : 0) + explodeBright * 5);
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
          grad.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.5})`);
          grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }
        // Star core
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
      }

      // Connect nearby stars with faint constellation lines (not during explosion)
      if (!isExploding) {
        for (let i = 0; i < stars.length; i++) {
          if (stars[i].baseRadius < 1.2) continue;
          for (let j = i + 1; j < stars.length; j++) {
            if (stars[j].baseRadius < 1.2) continue;
            const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 120) {
              const a = (1 - d / 120) * 0.08;
              ctx.beginPath();
              ctx.moveTo(stars[i].x, stars[i].y);
              ctx.lineTo(stars[j].x, stars[j].y);
              ctx.strokeStyle = `rgba(200,220,255,${a})`;
              ctx.lineWidth = 0.4;
              ctx.stroke();
            }
          }
        }
      }

      // Shooting stars (not during explosion)
      if (!isExploding) {
        if (Math.random() < 0.008) {
          shootingStarsRef.current.push({
            x: Math.random() * w, y: Math.random() * h * 0.4,
            vx: (Math.random() * 4 + 3) * (Math.random() < 0.5 ? 1 : -1),
            vy: Math.random() * 2 + 1,
            life: 0, maxLife: Math.random() * 40 + 30, length: Math.random() * 60 + 40,
          });
        }
        shootingStarsRef.current = shootingStarsRef.current.filter(ss => {
          ss.x += ss.vx; ss.y += ss.vy; ss.life++;
          const progress = ss.life / ss.maxLife;
          const alpha = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
          const grad = ctx.createLinearGradient(ss.x, ss.y, ss.x - ss.vx * (ss.length / 5), ss.y - ss.vy * (ss.length / 5));
          grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.9})`);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.beginPath();
          ctx.moveTo(ss.x, ss.y);
          ctx.lineTo(ss.x - ss.vx * (ss.length / 5), ss.y - ss.vy * (ss.length / 5));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          return ss.life < ss.maxLife;
        });
      }

      // Infinity symbol
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.025);
      if (isExploding) {
        // Explosion: infinity symbol grows massive and bright, then fades
        const easeOut = 1 - Math.pow(1 - explodeProgress, 3);
        const infSize = 140 + easeOut * 400;
        const infAlpha = Math.max(0.8 - explodeProgress * 0.8, 0);
        const infLw = 4 + easeOut * 6;
        const infBlur = 60 + easeOut * 80;
        drawInfinity(ctx, cx, cy, infSize, infAlpha, infLw, infBlur);
      } else {
        // Normal pulsing — subtle, not overpowering the form
        const outerAlpha = 0.06 + pulse * 0.08;
        drawInfinity(ctx, cx, cy, 140 + Math.sin(t * 0.008) * 12, outerAlpha, 1.5 + pulse * 1, 15 + pulse * 12);
        const midAlpha = 0.08 + pulse * 0.1;
        drawInfinity(ctx, cx, cy, 100 + Math.cos(t * 0.01) * 8, midAlpha, 1.5 + pulse * 0.5, 10 + pulse * 10);
        const innerAlpha = 0.1 + pulse * 0.12;
        drawInfinity(ctx, cx, cy, 60 + Math.sin(t * 0.012) * 5, innerAlpha, 1 + pulse * 0.5, 8 + pulse * 8);
      }

      // Central flash during explosion
      if (isExploding && explodeProgress > 0.1) {
        const flashAlpha = Math.min((explodeProgress - 0.1) * 1.5, 0.7);
        const flashR = explodeProgress * Math.max(w, h) * 1.2;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashR);
        grad.addColorStop(0, `rgba(255,255,255,${flashAlpha})`);
        grad.addColorStop(0.3, `rgba(229,200,255,${flashAlpha * 0.5})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, flashR, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [initStars]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
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
            width: `${110 + i * 50}px`,
            height: `${110 + i * 50}px`,
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
  const [exploding, setExploding] = useState(false);
  const explodingRef = useRef(false);
  const { signIn } = useAuth();
  const { clan, loading: clanLoading } = useClan();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      // Trigger galaxy explosion!
      explodingRef.current = true;
      setExploding(true);
      // Wait for explosion animation to play, then navigate
      await new Promise(resolve => setTimeout(resolve, 1800));
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
      className="relative h-screen flex items-center justify-center px-4 overflow-hidden"
      style={{
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(80,40,180,0.12) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 100%, rgba(229,62,62,0.08) 0%, transparent 50%),
          radial-gradient(ellipse at 20% 80%, rgba(40,80,180,0.06) 0%, transparent 50%),
          linear-gradient(180deg, #050510 0%, #0a0a1a 40%, #0d0818 100%)
        `,
      }}
    >
      {/* ── Cosmic Background — universe + infinity ─────────────────────────── */}
      {mounted && <CosmicBackground explodingRef={explodingRef} />}

      {/* White flash overlay for explosion transition */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          zIndex: 50,
          backgroundColor: 'white',
          opacity: exploding ? 1 : 0,
          transitionDelay: exploding ? '0.8s' : '0s',
        }}
      />

      {/* Floating cosmic icons in corners */}
      <div className="absolute top-8 left-8 opacity-15 login-float" style={{ animationDelay: '0s' }}>
        <StarIcon className="w-7 h-7" style={{ color: 'rgba(200,220,255,0.8)' }} />
      </div>
      <div className="absolute top-8 right-8 opacity-15 login-float" style={{ animationDelay: '2s' }}>
        <Infinity className="w-8 h-8" style={{ color: 'var(--clan-primary)' }} />
      </div>
      <div className="absolute bottom-8 left-8 opacity-15 login-float" style={{ animationDelay: '4s' }}>
        <Sparkles className="w-7 h-7" style={{ color: 'rgba(220,180,255,0.8)' }} />
      </div>
      <div className="absolute bottom-8 right-8 opacity-15 login-float" style={{ animationDelay: '1s' }}>
        <StarIcon className="w-6 h-6" style={{ color: 'rgba(200,255,255,0.7)' }} />
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
      <div className={`relative z-10 max-w-sm w-full ${exploding ? 'login-explode-fade' : ''}`}>

        {/* ── Logo + Clan Name ───────────────────────────────────────────────── */}
        <div className="text-center mb-5 relative">
          {/* Energy rings behind logo */}
          <div className="relative flex justify-center mb-4">
            <div className="relative">
              <EnergyRings />
              <div className={mounted ? 'login-logo-entrance' : 'opacity-0'}>
                {clanLoading ? (
                  <div
                    className="w-20 h-20 rounded-2xl animate-pulse"
                    style={{ backgroundColor: 'var(--clan-surface)' }}
                  />
                ) : clan.logoUrl ? (
                  <img
                    src={clan.logoUrl}
                    alt={clan.name}
                    className="w-20 h-20 rounded-2xl object-cover login-glow-pulse"
                    style={{
                      border: '2px solid rgba(229,62,62,0.4)',
                    }}
                  />
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center login-glow-pulse"
                    style={{
                      backgroundColor: 'var(--clan-primary)',
                      border: '2px solid rgba(255,255,255,0.2)',
                    }}
                  >
                    <Infinity className="h-10 w-10 text-white" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clan name with letter-spacing reveal */}
          <h1
            className="text-3xl font-black text-white tracking-wider login-title-reveal"
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

          {/* Decorative infinity line */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <div
              className="h-px flex-1 max-w-16"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(200,220,255,0.5))',
                opacity: 0.6,
              }}
            />
            <Infinity className="w-5 h-5" style={{ color: 'var(--clan-primary)', opacity: 0.6 }} />
            <div
              className="h-px flex-1 max-w-16"
              style={{
                background: 'linear-gradient(270deg, transparent, rgba(200,220,255,0.5))',
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
          className="login-card-entrance relative rounded-2xl p-6 border login-border-glow overflow-hidden"
          style={{
            backgroundColor: 'rgba(10, 10, 25, 0.92)',
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
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3 login-input-reveal-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, var(--clan-primary), var(--clan-accent))',
                  boxShadow: '0 4px 15px rgba(229,62,62,0.3)',
                }}
              >
                <LogIn className="h-4 w-4 text-white" />
              </div>
              <span>Entrar na sua conta</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                        <Infinity className="w-4 h-4" />
                        Acessar
                      </>
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--clan-border))' }} />
              <Sparkles className="w-3 h-3" style={{ color: 'rgba(200,220,255,0.5)' }} />
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(270deg, transparent, var(--clan-border))' }} />
            </div>

            {/* Register link */}
            <div className="text-center">
              <p style={{ color: 'var(--clan-text-muted)' }} className="text-sm">
                Novo no clã?{' '}
                <Link
                  href="/register"
                  className="font-bold transition-all duration-300 relative"
                  style={{ color: 'var(--clan-primary)' }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = 'rgba(200,220,255,1)';
                    e.currentTarget.style.textShadow = '0 0 20px rgba(200,220,255,0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'var(--clan-primary)';
                    e.currentTarget.style.textShadow = 'none';
                  }}
                >
                  Cadastre-se
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="text-center mt-5">
          <p
            className="text-xs uppercase tracking-widest"
            style={{ color: 'var(--clan-text-muted)', opacity: 0.4 }}
          >
            ✦ Ao Infinito e Além ✦
          </p>
        </div>
      </div>
    </div>
  );
}
