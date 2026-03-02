"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Crown } from "lucide-react";
import { useState, useEffect } from "react";

export const RoyalHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const navLinks = [
    { href: "/", label: "Home", num: "01" },
    { href: "/about", label: "About", num: "02" },
    { href: "/live", label: "Live Pair", num: "03" },
  ];

  return (
    <>
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-red-50"
            : "bg-white/80 backdrop-blur-sm border-b border-gray-100"
        }`}
      >
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16 md:h-[72px]">

            {/* Logo */}
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 group z-10"
            >
              <motion.div
                animate={{ rotate: menuOpen ? 180 : 0 }}
                transition={{ duration: 0.4, type: "spring" }}
              >
                <Crown className="w-5 h-5 text-passionate group-hover:scale-110 transition-transform" />
              </motion.div>
              <span className="font-royal text-lg font-semibold text-gray-800 tracking-wide">
                Friend of a Week
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-600 hover:text-passionate transition-colors relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-passionate group-hover:w-full transition-all duration-300" />
                </Link>
              ))}
              <Link href="/signin">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-passionate text-white rounded-lg text-sm font-medium
                           shadow-sm hover:shadow-md hover:shadow-passionate/20 transition-all"
                >
                  Github
                </motion.button>
              </Link>
            </nav>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden relative z-50 w-10 h-10 flex flex-col items-center justify-center gap-[5px] group"
              aria-label="Toggle menu"
            >
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
                className="block w-6 h-[1.5px] bg-passionate origin-center"
              />
              <motion.span
                animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
                className="block w-4 h-[1.5px] bg-passionate self-end"
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3 }}
                className="block w-6 h-[1.5px] bg-passionate origin-center"
              />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Mobile Full-Screen Overlay Menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm md:hidden"
              onClick={() => setMenuOpen(false)}
            />

            {/* Menu Panel — slides in from top-right */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, clipPath: "circle(0% at calc(100% - 40px) 36px)" }}
              animate={{ opacity: 1, clipPath: "circle(150% at calc(100% - 40px) 36px)" }}
              exit={{ opacity: 0, clipPath: "circle(0% at calc(100% - 40px) 36px)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-40 bg-white md:hidden flex flex-col"
            >
              {/* Decorative top stripe */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-passionate via-coral to-passionate/40" />

              {/* Background texture */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(220,38,38,0.04)_0%,_transparent_60%)]" />

              <div className="flex flex-col justify-center flex-1 px-8 pt-20 pb-10 relative">

                {/* Nav Items */}
                <nav className="flex flex-col gap-1">
                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 40 }}
                      transition={{ delay: 0.15 + i * 0.08, duration: 0.4, ease: "easeOut" }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setMenuOpen(false)}
                        className="group flex items-baseline gap-4 py-4 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-[10px] font-mono text-passionate/40 tracking-widest w-5">
                          {link.num}
                        </span>
                        <span className="font-royal text-4xl font-bold text-gray-800 group-hover:text-passionate transition-colors duration-200 tracking-tight">
                          {link.label}
                        </span>
                        <motion.span
                          initial={{ opacity: 0, x: -8 }}
                          whileHover={{ opacity: 1, x: 0 }}
                          className="text-passionate text-2xl ml-auto"
                        >
                          →
                        </motion.span>
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                {/* CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.45, duration: 0.4 }}
                  className="mt-10"
                >
                  <Link href="/signin" onClick={() => setMenuOpen(false)}>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-4 bg-passionate text-white rounded-2xl text-base font-semibold
                               shadow-lg shadow-passionate/25 flex items-center justify-center gap-2"
                    >
                      <Crown className="w-4 h-4" />
                      Sign in with Github
                    </motion.button>
                  </Link>
                </motion.div>

                {/* Bottom tagline */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="mt-8 text-center text-xs text-gray-400 tracking-widest uppercase"
                >
                  ✦ forge royal connections ✦
                </motion.p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};