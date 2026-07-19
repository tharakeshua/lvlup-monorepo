import { motion } from "framer-motion";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/utils";

export interface AnimatedListProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

const container = {
  hidden: {},
  show: (staggerDelay: number) => ({
    transition: { staggerChildren: staggerDelay },
  }),
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function AnimatedList({ children, staggerDelay = 0.05, className }: AnimatedListProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      custom={staggerDelay}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={cn(className)}>
      {children}
    </motion.div>
  );
}
