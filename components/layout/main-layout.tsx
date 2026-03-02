"use client";

import { ReactNode } from "react";
import { RoyalHeader } from "./royal-header";
import { Footer } from "./footer";
import { motion } from "framer-motion";

interface MainLayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

export const MainLayout = ({ 
  children, 
  showHeader = true, 
  showFooter = true 
}: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-white">
      {showHeader && <RoyalHeader />}
      
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        {children}
      </motion.main>

      {showFooter && <Footer />}
    </div>
  );
};