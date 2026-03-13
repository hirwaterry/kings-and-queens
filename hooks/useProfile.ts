// hooks/useProfile.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared hook for any page that needs the current player's profile.
//
// HOW IT WORKS (no login required):
//   1. On mount, reads "fow_my_name" from localStorage
//   2. If found → fetches matching player_profile from Supabase
//   3. If not found → sets `needsSetup = true` so the page can redirect to /profile
//   4. Subscribes to realtime changes so XP updates live on any page
//
// USAGE:
//   const { profile, loading, needsSetup } = useProfile();
//   if (needsSetup) { router.push("/profile"); return null; }
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, type DBPlayerProfile } from "@/lib/supabase";

export interface UseProfileReturn {
  profile:     DBPlayerProfile | null;
  loading:     boolean;
  needsSetup:  boolean;   // true = no name in localStorage → send to /profile
  myName:      string;    // lowercased key
  displayName: string;    // original casing
  refresh:     () => void;
}

export function useProfile(): UseProfileReturn {
  const [profile,    setProfile   ] = useState<DBPlayerProfile | null>(null);
  const [loading,    setLoading   ] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [myName,     setMyName    ] = useState("");
  const [displayName,setDisplayName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);

    // Read name from localStorage
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("fow_my_name") ?? ""
      : "";

    if (!stored.trim()) {
      setNeedsSetup(true);
      setLoading(false);
      return;
    }

    const key = stored.trim().toLowerCase();
    setMyName(key);
    setDisplayName(stored.trim());

    const { data } = await supabase
      .from("player_profiles")
      .select("*")
      .eq("name", key)
      .maybeSingle();

    if (data) {
      setProfile(data);
      setNeedsSetup(false);
    } else {
      // Name is stored but no DB row yet (player hasn't been in a session)
      // Still show them the profile page with 0 stats
      setProfile(null);
      setNeedsSetup(false);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: refresh whenever this player's profile updates
  useEffect(() => {
    if (!myName) return;
    const channel = supabase
      .channel(`profile:${myName}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "player_profiles",
        filter: `name=eq.${myName}`,
      }, ({ new: updated }) => {
        setProfile(updated as DBPlayerProfile);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myName]);

  return { profile, loading, needsSetup, myName, displayName, refresh: load };
}

// ── Helper: save name to localStorage (call from profile setup page) ──────────
export function saveMyName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("fow_my_name", name.trim());
}

export function clearMyName(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("fow_my_name");
  localStorage.removeItem("fow_is_admin");
}