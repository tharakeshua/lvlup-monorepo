import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "../../hooks/use-reduced-motion";

export interface CelebrationBurstProps {
  /** Whether to trigger the celebration animation */
  trigger: boolean;
  /** Duration in ms before particles disappear (default 2000) */
  duration?: number;
  /** Number of particles to emit (default 24) */
  particleCount?: number;
  /** Type of celebration effect */
  variant?: "confetti" | "stars" | "sparkle";
  /** Called when the animation finishes */
  onComplete?: () => void;
  className?: string;
}

const CONFETTI_COLORS = [
  "#FFD700",
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
];

const STAR_COLORS = ["#FFD700", "#FFA500", "#FF8C00", "#FFDF00", "#F0E68C"];
const SPARKLE_COLORS = ["#E8DAEF", "#D5F5E3", "#FADBD8", "#D6EAF8", "#FCF3CF"];

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  velocityX: number;
  velocityY: number;
  shape: "rect" | "circle";
}

function pickColor(colors: string[]): string {
  return colors[Math.floor(Math.random() * colors.length)] as string;
}

function generateParticles(count: number, variant: string): Particle[] {
  const colors =
    variant === "stars" ? STAR_COLORS : variant === "sparkle" ? SPARKLE_COLORS : CONFETTI_COLORS;

  const result: Particle[] = [];
  for (let i = 0; i < count; i++) {
    result.push({
      id: i,
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      color: pickColor(colors),
      size: variant === "sparkle" ? Math.random() * 6 + 3 : Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      velocityX: (Math.random() - 0.5) * 300,
      velocityY: -(Math.random() * 200 + 100),
      shape: Math.random() > 0.5 ? "rect" : "circle",
    });
  }
  return result;
}

export function CelebrationBurst({
  trigger,
  duration = 2000,
  particleCount = 24,
  variant = "confetti",
  onComplete,
  className,
}: CelebrationBurstProps) {
  const reduced = useReducedMotion();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isActive, setIsActive] = useState(false);

  const handleComplete = useCallback(() => {
    onComplete?.();
  }, [onComplete]);

  useEffect(() => {
    if (!trigger || reduced) {
      if (trigger && reduced) {
        handleComplete();
      }
      return;
    }

    setParticles(generateParticles(particleCount, variant));
    setIsActive(true);

    const timer = setTimeout(() => {
      setIsActive(false);
      setParticles([]);
      handleComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [trigger, reduced, particleCount, variant, duration, handleComplete]);

  if (reduced || !isActive) return null;

  const durationSec = duration / 1000;

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
      }}
    >
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{
              x: "50vw",
              y: "40vh",
              scale: 0,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: `calc(50vw + ${p.velocityX}px)`,
              y: `calc(40vh + ${p.velocityY}px)`,
              scale: [0, 1.2, 1],
              rotate: p.rotation,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: durationSec,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              width: p.size,
              height: p.shape === "rect" ? p.size * 0.6 : p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === "circle" ? "50%" : "2px",
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
