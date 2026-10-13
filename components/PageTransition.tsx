"use client";

import React from "react";
import { motion } from "motion/react";

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      className="min-h-screen w-full flex flex-col"
    >
      {children}
    </motion.div>
  );
}
