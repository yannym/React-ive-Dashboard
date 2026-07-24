import React, { useEffect, useRef, useState } from "react";
import { Key } from "lucide-react";

interface FluidScreensaverProps {
  isActive: boolean;
  onExit: () => void;
}

interface Particle {
  x: number;
  y: number;
  px: number; // Previous X for continuous lines
  py: number; // Previous Y
  vx: number;
  vy: number;
  color: string;
  lineWidth: number;
  life: number;
  maxLife: number;
  skipFirstFrame: boolean;
}

// 3D Improved Perlin Noise class for smooth flowing curl potential fields
class PerlinNoise3D {
  private p: Uint8Array;

  constructor() {
    this.p = new Uint8Array(512);
    const src = new Uint8Array(256);
    for (let i = 0; i < 256; i++) src[i] = i;
    // Fisher-Yates Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = src[i];
      src[i] = src[j];
      src[j] = temp;
    }
    for (let i = 0; i < 256; i++) {
      this.p[i] = src[i];
      this.p[i + 256] = src[i];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  public noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const A = this.p[X] + Y;
    const AA = this.p[A & 255] + Z;
    const AB = this.p[(A + 1) & 255] + Z;
    const B = this.p[(X + 1) & 255] + Y;
    const BA = this.p[B & 255] + Z;
    const BB = this.p[(B + 1) & 255] + Z;

    return this.lerp(
      w,
      this.lerp(
        v,
        this.lerp(u, this.grad(this.p[AA & 255], xf, yf, zf), this.grad(this.p[BA & 255], xf - 1, yf, zf)),
        this.lerp(u, this.grad(this.p[AB & 255], xf, yf - 1, zf), this.grad(this.p[BB & 255], xf - 1, yf - 1, zf))
      ),
      this.lerp(
        v,
        this.lerp(u, this.grad(this.p[(AA + 1) & 255], xf, yf, zf - 1), this.grad(this.p[(BA + 1) & 255], xf - 1, yf, zf - 1)),
        this.lerp(u, this.grad(this.p[(AB + 1) & 255], xf, yf - 1, zf - 1), this.grad(this.p[(BB + 1) & 255], xf - 1, yf - 1, zf - 1))
      )
    );
  }
}

export function FluidScreensaver({ isActive, onExit }: FluidScreensaverProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction & Fade-out State
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [fadeRadius, setFadeRadius] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hasInteracted, setHasInteracted] = useState(false);

  // Keep references to access inside the animation loop without re-triggering effects
  const stateRef = useRef({
    isFadingOut: false,
    fadeRadius: 0,
    mousePos: { x: 0, y: 0 },
    prevMousePos: { x: 0, y: 0 },
    hasInteracted: false,
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Sync state refs
  useEffect(() => {
    stateRef.current.isFadingOut = isFadingOut;
    stateRef.current.fadeRadius = fadeRadius;
    stateRef.current.mousePos = mousePos;
    stateRef.current.hasInteracted = hasInteracted;
  }, [isFadingOut, fadeRadius, mousePos, hasInteracted]);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    // Reset interaction states on mount
    setIsFadingOut(false);
    setFadeRadius(0);
    setHasInteracted(false);
    stateRef.current.isFadingOut = false;
    stateRef.current.fadeRadius = 0;
    stateRef.current.hasInteracted = false;

    // Setup dimensions
    const resizeCanvas = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      stateRef.current.width = width;
      stateRef.current.height = height;

      // Dark background fill on resize to clear initial garbage
      ctx.fillStyle = "#06050b";
      ctx.fillRect(0, 0, width, height);
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize 3D Perlin Noise for vector potential
    const perlin = new PerlinNoise3D();

    // Palette HSL colors (matches the gorgeous high-contrast pinks, purples, blues, peaches in screenshot)
    const palettes = [
      "hsla(22, 95%, 65%, ",   // Peach / Warm Coral
      "hsla(325, 95%, 60%, ",  // Vibrant Hot Pink
      "hsla(270, 92%, 65%, ",  // Neon Electric Purple
      "hsla(230, 95%, 62%, ",  // Deep Indigo/Royal Blue
      "hsla(190, 95%, 55%, ",  // Bright Cyan / Lagoon
    ];

    // Helper to spawn a particle
    const spawnParticle = (pObj: Partial<Particle> = {}): Particle => {
      const rx = pObj.x !== undefined ? pObj.x : Math.random() * window.innerWidth;
      const ry = pObj.y !== undefined ? pObj.y : Math.random() * window.innerHeight;

      // Band-based colors so adjacent paths match color waves (creates solid flowing bands of peach/pink/cyan like screenshot)
      const bandIndex = Math.floor((ry / window.innerHeight) * palettes.length);
      const colorBase = palettes[Math.max(0, Math.min(palettes.length - 1, bandIndex))];

      return {
        x: rx,
        y: ry,
        px: rx,
        py: ry,
        vx: 0,
        vy: 0,
        color: `${colorBase}${(Math.random() * 0.45 + 0.5).toFixed(2)})`, // Dynamic transparency
        lineWidth: Math.random() * 1.3 + 0.6, // Fine, high-detail lines
        life: 0,
        maxLife: Math.floor(Math.random() * 160) + 120, // Long life for elegant swirls
        skipFirstFrame: true,
      };
    };

    // Particles array (highly dense for rich topographic mapping)
    const maxParticles = 1600;
    const particles: Particle[] = [];
    for (let i = 0; i < maxParticles; i++) {
      particles.push(spawnParticle());
    }

    // High performance velocity field grid
    const cols = 60;
    const rows = 40;
    const numCells = cols * rows;
    const gridVx = new Float32Array(numCells);
    const gridVy = new Float32Array(numCells);

    let time = 0;
    let animationFrameId: number;

    const loop = () => {
      const w = stateRef.current.width;
      const h = stateRef.current.height;

      // 1. Render extremely transparent dark overlay to keep flowing lines visible as glowing neon trails
      ctx.fillStyle = "rgba(6, 5, 11, 0.035)"; // Slow fade matches deep indigo-midnight screenshot background
      ctx.fillRect(0, 0, w, h);

      time += 0.0018; // Slowly morph the flow potential field over time

      // 2. Generate Divergence-Free Curl Velocity Grid
      // Mathematically guarantees particles circulate in concentric isolines rather than converging or dispersing
      const scaleX = 0.0022;
      const scaleY = 0.0022;
      const noiseZ = time;

      const eps = 0.05; // Delta offset for partial derivative calculus

      for (let r = 0; r < rows; r++) {
        const yCoord = (r / rows) * h;
        for (let c = 0; c < cols; c++) {
          const xCoord = (c / cols) * w;

          // Multi-frequency octaves to create intricate micro-flows
          const getPotential = (x: number, y: number) => {
            const p1 = perlin.noise(x * scaleX, y * scaleY, noiseZ);
            const p2 = perlin.noise(x * scaleX * 2.5, y * scaleY * 2.5, noiseZ * 1.5) * 0.45;
            return p1 + p2;
          };

          // Curl formula: vx = d/dy, vy = -d/dx
          const potY1 = getPotential(xCoord, yCoord + eps);
          const potY0 = getPotential(xCoord, yCoord - eps);
          const potX1 = getPotential(xCoord + eps, yCoord);
          const potX0 = getPotential(xCoord - eps, yCoord);

          const idx = r * cols + c;
          gridVx[idx] = (potY1 - potY0) / (2 * eps) * 35.0; // Scaled velocity multipliers
          gridVy[idx] = -(potX1 - potX0) / (2 * eps) * 35.0;
        }
      }

      // 3. Inject Mouse Vortices (Circular drag field centered at mouse)
      if (stateRef.current.hasInteracted) {
        const mx = stateRef.current.mousePos.x;
        const my = stateRef.current.mousePos.y;

        const maxDist = Math.max(w, h) * 0.18; // Dynamic mouse gravity circle
        const maxDistSq = maxDist * maxDist;

        for (let r = 0; r < rows; r++) {
          const yCoord = (r / rows) * h;
          const dy = yCoord - my;
          for (let c = 0; c < cols; c++) {
            const xCoord = (c / cols) * w;
            const dx = xCoord - mx;
            const distSq = dx * dx + dy * dy;

            if (distSq < maxDistSq) {
              const dist = Math.sqrt(distSq);
              // Gaussian swirl force falloff
              const force = Math.exp(-distSq / (maxDistSq * 0.45)) * 12.0;

              // Swirl vectors perpendicular to radial distance (-dy, dx)
              const swirlX = -dy / (dist + 0.1);
              const swirlY = dx / (dist + 0.1);

              const idx = r * cols + c;
              gridVx[idx] += swirlX * force;
              gridVy[idx] += swirlY * force;
            }
          }
        }
      }

      // 4. Update and Draw continuous stream particles
      ctx.globalCompositeOperation = "screen"; // Additive blending for vivid, glowing wires

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Cache previous positions
        p.px = p.x;
        p.py = p.y;

        // Bilinear interpolation on velocity grid for ultra-smooth movement
        const gridX = (p.x / w) * (cols - 1);
        const gridY = (p.y / h) * (rows - 1);

        const x0 = Math.floor(gridX);
        const x1 = Math.min(cols - 1, x0 + 1);
        const y0 = Math.floor(gridY);
        const y1 = Math.min(rows - 1, y0 + 1);

        const tx = gridX - x0;
        const ty = gridY - y0;

        let vx = 0;
        let vy = 0;

        if (x0 >= 0 && x1 < cols && y0 >= 0 && y1 < rows) {
          const v00_x = gridVx[y0 * cols + x0];
          const v01_x = gridVx[y0 * cols + x1];
          const v10_x = gridVx[y1 * cols + x0];
          const v11_x = gridVx[y1 * cols + x1];

          const v00_y = gridVy[y0 * cols + x0];
          const v01_y = gridVy[y0 * cols + x1];
          const v10_y = gridVy[y1 * cols + x0];
          const v11_y = gridVy[y1 * cols + x1];

          // Bilinear interpolate X & Y velocities
          vx = (1 - ty) * ((1 - tx) * v00_x + tx * v01_x) + ty * ((1 - tx) * v10_x + tx * v11_x);
          vy = (1 - ty) * ((1 - tx) * v00_y + tx * v01_y) + ty * ((1 - tx) * v10_y + tx * v11_y);
        }

        // Apply velocities with a smooth inertia damping factor
        p.vx = p.vx * 0.88 + vx * 0.12;
        p.vy = p.vy * 0.88 + vy * 0.12;

        // Speed limiters to prevent chaotic particle jumps
        const velocityMagnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxVelocity = 4.5;
        if (velocityMagnitude > maxVelocity) {
          p.vx = (p.vx / velocityMagnitude) * maxVelocity;
          p.vy = (p.vy / velocityMagnitude) * maxVelocity;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Reset particle if it is expired, out of bounds, or moving too slowly
        const outOfBounds = p.x < 0 || p.x > w || p.y < 0 || p.y > h;
        if (p.life >= p.maxLife || outOfBounds) {
          particles[i] = spawnParticle();
          continue;
        }

        // Draw particle trail segments (skipping first frame of new particles to prevent long horizontal jump lines)
        if (p.skipFirstFrame) {
          p.skipFirstFrame = false;
          continue;
        }

        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // 5. DRAW THE EXPANDING ERASING FADE-OUT MASK (if fading out is active)
      if (stateRef.current.isFadingOut) {
        const mx = stateRef.current.mousePos.x;
        const my = stateRef.current.mousePos.y;

        // Rapid expansion outwards mimicking dragging eraser
        const nextRadius = stateRef.current.fadeRadius + Math.max(25, w * 0.038);
        setFadeRadius(nextRadius);
        stateRef.current.fadeRadius = nextRadius;

        // Clear existing drawing within expanding sphere using composite operation
        ctx.globalCompositeOperation = "destination-out";

        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, nextRadius);
        grad.addColorStop(0, "rgba(0, 0, 0, 1.0)");       // Complete erase at mouse focus
        grad.addColorStop(0.75, "rgba(0, 0, 0, 0.8)");     // Progressive fade
        grad.addColorStop(1, "rgba(0, 0, 0, 0.0)");       // Smooth edge

        ctx.beginPath();
        ctx.arc(mx, my, nextRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw dynamic overlay at cursor to visualize drag pressure
        ctx.globalCompositeOperation = "screen";
        ctx.beginPath();
        ctx.arc(mx, my, 50, 0, Math.PI * 2);
        const mouseGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 50);
        mouseGrad.addColorStop(0, "rgba(255, 255, 255, 0.35)");
        mouseGrad.addColorStop(0.5, "rgba(162, 82, 255, 0.12)");
        mouseGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = mouseGrad;
        ctx.fill();

        // Fully terminate screensaver once circle expanded past screen diagonal
        const screenDiagonal = Math.sqrt(w * w + h * h);
        if (nextRadius > screenDiagonal * 1.4) {
          cancelAnimationFrame(animationFrameId);
          window.removeEventListener("resize", resizeCanvas);
          onExit();
          return;
        }
      }

      // Restore composite operation
      ctx.globalCompositeOperation = "source-over";

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [isActive, onExit]);

  // Handle interaction triggers
  const handleInteraction = (clientX: number, clientY: number) => {
    if (!isActive) return;

    // Start fading out on the very first touch/move
    if (!isFadingOut) {
      setIsFadingOut(true);
      setFadeRadius(0);
      setHasInteracted(true);

      stateRef.current.isFadingOut = true;
      stateRef.current.fadeRadius = 0;
      stateRef.current.hasInteracted = true;
    }

    setMousePos({ x: clientX, y: clientY });
    stateRef.current.mousePos = { x: clientX, y: clientY };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handleInteraction(e.clientX, e.clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches && e.touches[0]) {
      handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  if (!isActive) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onClick={(e) => handleInteraction(e.clientX, e.clientY)}
      className={`fixed inset-0 z-[9999] overflow-hidden select-none cursor-none transition-colors duration-100 ${
        isFadingOut ? 'bg-transparent' : 'bg-[#06050b]'
      }`}
      style={{ touchAction: "none" }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

      {/* Absolute Header HUD overlay */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between font-mono text-white/30 text-[10px] pointer-events-none select-none animate-pulse">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold tracking-wider">TOPOGRAPHIC COCKPIT SCREENSAVER</span>
        </div>
        <div className="text-right">
          <span>MOVE OR TAP SCREEN TO DISSOLVE</span>
        </div>
      </div>
    </div>
  );
}

export default FluidScreensaver;
