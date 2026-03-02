"use client";

import { motion } from "framer-motion";
import { Crown, Heart, Github, Twitter, Instagram } from "lucide-react";
import Link from "next/link";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="relative bg-white border-t border-gray-100">
      {/* Simple red accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-passionate to-transparent" />
      
      <div className="container mx-auto px-4 py-16">
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-passionate" />
              <span className="font-royal text-sm font-medium tracking-wider text-gray-800">
                FRIEND OF A WEEK
              </span>
            </div>
            
            <p className="text-sm text-gray-500 leading-relaxed">
              Every King deserves a Queen,<br />
              every Queen deserves a King,<br />
              and every Agatambyi deserves the spotlight.
            </p>
            
            {/* Simple Social Icons */}
            <div className="flex gap-3 pt-4">
              {[
                { icon: Twitter, href: "#", label: "Twitter" },
                { icon: Instagram, href: "#", label: "Instagram" },
                { icon: Github, href: "#", label: "Github" },
              ].map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center
                           hover:bg-passionate/5 transition-colors group"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4 text-gray-400 group-hover:text-passionate transition-colors" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Navigation Columns - Simple */}
          {[
            {
              title: "EXPLORE",
              links: ["Home", "About", "How it Works", "Gallery"],
            },
            {
              title: "COMMUNITY",
              links: ["Stories", "Events", "Blog", "Contact"],
            },
            {
              title: "LEGAL",
              links: ["Privacy", "Terms", "Cookies", "Licenses"],
            },
          ].map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-xs font-semibold tracking-wider text-gray-400">
                {column.title}
              </h3>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-gray-600 hover:text-passionate transition-colors"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar - Ultra Minimal */}
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <p className="text-xs text-gray-400">
            © {currentYear} Friend of a Week. All rights reserved.
          </p>

          {/* Made with love - red accent */}
          <motion.div
            initial={{ opacity: 0.5 }}
            whileHover={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-xs"
          >
            <span className="text-gray-300">made with</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Heart className="w-3 h-3 text-passionate fill-passionate" />
            </motion.div>
            <span className="text-gray-300">by the community</span>
          </motion.div>

          {/* Simple red dot accent */}
          <div className="w-1 h-1 rounded-full bg-passionate/30" />
        </div>
      </div>

      {/* Simple hover effect line */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        viewport={{ once: true }}
        className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r 
                   from-transparent via-passionate/30 to-transparent origin-left"
      />
    </footer>
  );
};