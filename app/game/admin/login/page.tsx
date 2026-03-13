"use client";
// app/admin/login/page.tsx — PIN gate for all admin features

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { adminLogin, isAdminAuthed } from "@/hooks/useAdmin";

export default function AdminLoginPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [pin,      setPin     ] = useState("");
  const [show,     setShow    ] = useState(false);
  const [error,    setError   ] = useState("");
  const [shaking,  setShaking ] = useState(false);
  const [success,  setSuccess ] = useState(false);

  // If already authed, bounce to admin home
  useEffect(() => {
    if (isAdminAuthed()) router.replace("/game/admin");
  }, [router]);

  const handleSubmit = () => {
    if (!pin) return;
    const ok = adminLogin(pin);
    if (ok) {
      setSuccess(true);
      setTimeout(() => router.replace("/game/admin"), 900);
    } else {
      setError("Wrong PIN. Try again.");
      setShaking(true);
      setPin("");
      setTimeout(() => setShaking(false), 600);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="min-h-screen bg-[#0d0d10] text-white flex items-center justify-center px-4">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-red-900/20 rounded-full blur-[140px]"/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-yellow-900/15 rounded-full blur-[100px]"/>
      </div>

      <motion.div
        animate={shaking ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600
                           flex items-center justify-center shadow-2xl shadow-green-500/30">
                <Shield className="w-10 h-10 text-white" />
              </motion.div>
            ) : (
              <motion.div key="lock"
                animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity }}
                className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-rose-700
                           flex items-center justify-center shadow-2xl shadow-red-500/30">
                <Lock className="w-10 h-10 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black mb-1">
            {success ? (
              <span className="text-green-400">Access Granted 👑</span>
            ) : (
              <>
                <span className="text-white">Admin </span>
                <span className="bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">Access</span>
              </>
            )}
          </h1>
          <p className="text-white/35 text-sm">
            {success ? "Redirecting to admin panel..." : "Enter your admin PIN to continue."}
          </p>
        </div>

        {/* PIN input */}
        {!success && (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? "text" : "password"}
                value={pin}
                onChange={e => { setPin(e.target.value); setError(""); }}
                onKeyDown={handleKey}
                placeholder="Enter PIN"
                autoFocus
                inputMode="numeric"
                className="w-full bg-white/8 border border-white/15 rounded-2xl px-5 py-4
                           text-white text-xl font-mono tracking-[0.4em] text-center
                           placeholder-white/15 focus:outline-none focus:border-red-500/60
                           focus:bg-white/10 transition-all"
              />
              <button
                onClick={() => setShow(!show)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                  className="text-red-400 text-sm font-mono text-center">{error}</motion.p>
              )}
            </AnimatePresence>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleSubmit} disabled={!pin}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-rose-600 rounded-2xl
                         font-black text-base shadow-xl shadow-red-500/25
                         flex items-center justify-center gap-2 disabled:opacity-40 transition-all">
              <Crown className="w-5 h-5" /> Enter Admin Panel
            </motion.button>

            <p className="text-center text-white/15 text-[10px] font-mono">
              PIN is set in your .env.local as NEXT_PUBLIC_ADMIN_PIN
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}