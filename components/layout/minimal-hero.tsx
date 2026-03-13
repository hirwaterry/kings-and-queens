"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { Crown, Users, QrCode } from "lucide-react";

export const MinimalHero = () => {
  return (
    <section className="relative min-h-screen flex items-center">
      {/* Simple background with red gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-passionate/5 via-transparent to-coral/5" />
      
      {/* Simple diagonal line accent */}
      <div className="absolute right-0 top-0 w-1/3 h-full bg-gradient-to-l from-passionate/10 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            {/* Royal Icon */}
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="inline-block mb-6"
            >
              <Crown className="w-12 h-12 text-passionate" />
            </motion.div>

            {/* Main Title */}
            <h1 className="font-royal text-6xl md:text-7xl font-bold mb-4">
              <span className="text-passionate">Friend</span>
              <span className="text-coral"> of</span>
              <br />
              <span className="text-passionate">a Week</span>
            </h1>

            {/* Simple Quote */}
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">
              Every King deserves a Queen, every Queen deserves a King,<br />
              and every <span className="text-passionate font-semibold">Agatambyi</span> deserves the spotlight
            </p>

            {/* Simple Buttons */}
            <div className="flex flex-wrap gap-4">
              <Link href="/game/live">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative px-8 py-4 bg-passionate text-white rounded-xl 
                           font-semibold text-lg shadow-lg shadow-passionate/25
                           hover:shadow-xl hover:shadow-passionate/30 transition-all
                           flex items-center gap-2"
                >
                  <QrCode className="w-5 h-5" />
                  Join Live Pair
                </motion.button>
              </Link>

              <Link href="/game/admin/login">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 border-2 border-passionate/30 text-passionate 
                           rounded-xl font-semibold text-lg hover:bg-passionate/5 
                           transition-all flex items-center gap-2"
                >
                  <Users className="w-5 h-5" />
                  Add List
                </motion.button>
              </Link>
            </div>

            {/* Supported by */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-12 pt-8 border-t border-gray-200"
            >
              <p className="text-sm text-gray-500 mb-3">Supported by</p>
              <div className="flex flex-wrap gap-6">
                <span className="font-semibold text-passionate">Fear Free Family</span>
                <span className="font-semibold text-coral">Kepler College</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right Content - Image Placeholder */}
         {/* Right Content - Image */}
<motion.div
  initial={{ opacity: 0, x: 30 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.6, delay: 0.2 }}
  className="relative hidden lg:block"
>
  <div className="relative max-w-lg mx-auto">
    {/* Image - no frames, slightly larger */}
    <div className="relative w-full aspect-square rounded-3xl overflow-hidden">
      <Image
        src="/three people red black.png"
        alt="Royal connections - friends"
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 0vw, 512px"
        priority
      />
    </div>

    {/* Subtle glow underneath instead of frames */}
    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-3/4 h-12 
                    bg-passionate/20 blur-2xl rounded-full" />
  </div>
</motion.div>
        </div>
      </div>

      {/* Simple footer note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-gray-400"
      >
        ✦ forge royal connections ✦
      </motion.div>
    </section>
  );
};