import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';

export const GROWY_EASE = [0.16, 1, 0.3, 1] as const;

export const GrowyMotionRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);

const staggerContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: GROWY_EASE,
    },
  },
};

export const StaggerSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  inView?: boolean;
}> = ({ children, className = '', inView = false }) => {
  if (inView) {
    return (
      <motion.div
        className={className}
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={className}
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <motion.div className={className} variants={staggerItemVariants}>
    {children}
  </motion.div>
);

export const ScrollReveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}> = ({ children, className = '', delay = 0, y = 16 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.12 }}
    transition={{ duration: 0.48, delay, ease: GROWY_EASE }}
  >
    {children}
  </motion.div>
);

export const ViewTransition: React.FC<{
  viewKey: string;
  children: React.ReactNode;
}> = ({ viewKey, children }) => (
  <AnimatePresence mode="wait" initial={true}>
    <motion.div
      key={viewKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: GROWY_EASE },
      }}
      exit={{
        opacity: 0,
        y: -6,
        transition: { duration: 0.14, ease: GROWY_EASE },
      }}
    >
      {children}
    </motion.div>
  </AnimatePresence>
);

export const AnimatedNumber: React.FC<{
  value: number;
  format: (n: number) => string;
  durationMs?: number;
}> = ({ value, format, durationMs = 520 }) => {
  const safeTarget = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safeTarget);
  const currentRef = useRef(safeTarget);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      currentRef.current = safeTarget;
      setDisplay(safeTarget);
      return;
    }

    const from = currentRef.current === safeTarget ? 0 : currentRef.current;
    if (Math.abs(safeTarget - from) < 0.001) {
      currentRef.current = safeTarget;
      setDisplay(safeTarget);
      return;
    }

    let frameId = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (safeTarget - from) * eased;
      currentRef.current = next;
      setDisplay(next);
      if (t < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        currentRef.current = safeTarget;
        setDisplay(safeTarget);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [safeTarget, durationMs]);

  return <>{format(display)}</>;
};
