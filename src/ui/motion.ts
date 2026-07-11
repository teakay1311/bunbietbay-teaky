import type { Variants } from 'motion/react';

export const pageStaggerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.02 } },
} satisfies Variants;

export const fadeUpVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { ease: 'easeOut', duration: 0.2 } },
} satisfies Variants;
