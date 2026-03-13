// hooks/useAdmin.ts
// ─────────────────────────────────────────────────────────────────────────────
// Simple PIN-based admin auth. No server, no JWT.
// The PIN is set in your .env.local:
//   NEXT_PUBLIC_ADMIN_PIN=1234
//
// On first admin action the user is prompted for the PIN.
// If correct it's stored in localStorage as a hashed token.
// All admin pages call `requireAdmin()` — redirects to /admin/login if not authed.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect } from "react";

// Simple deterministic hash (not cryptographic — just obscures the PIN in storage)
function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < pin.length; i++) {
    h ^= pin.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return "fow_admin_" + h.toString(16);
}

const STORAGE_KEY = "fow_admin_token";

export function isAdminAuthed(): boolean {
  if (typeof window === "undefined") return false;
  const pin = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === hashPin(pin);
}

export function adminLogin(pin: string): boolean {
  const correct = process.env.NEXT_PUBLIC_ADMIN_PIN ?? "1234";
  if (pin === correct) {
    localStorage.setItem(STORAGE_KEY, hashPin(pin));
    // Also set legacy flag for any pages checking fow_is_admin
    localStorage.setItem("fow_is_admin", "true");
    return true;
  }
  return false;
}

export function adminLogout(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("fow_is_admin");
}

export function useAdmin() {
  const [authed,  setAuthed ] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setAuthed(isAdminAuthed());
    setChecked(true);
  }, []);

  return { authed, checked };
}