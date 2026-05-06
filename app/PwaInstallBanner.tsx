"use client";

declare global {
  interface Window {
    fowInstall?: () => void;
    fowDismissInstall?: () => void;
  }
}

export default function PwaInstallBanner() {
  return (
    <div
      id="fow-install-banner"
      className="fixed z-9999 mx-auto flex max-w-[420px] items-center gap-3 rounded-[20px] border border-red-500/35 px-4 py-4 shadow-[0_0_40px_rgba(239,68,68,0.2),0_8px_32px_rgba(0,0,0,0.6)]"
      style={{
        display: "none",
        bottom: "80px",
        left: "16px",
        right: "16px",
        background: "linear-gradient(135deg, #1a1a24, #13131a)",
      }}
    >
      <img
        src="/icons/web-app-manifest-192x192.png"
        alt="FOW"
        className="h-12 w-12 shrink-0 rounded-xl border border-red-500/30"
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-black text-white">Add FOW to your home screen</p>
        <p className="mt-0.5 font-mono text-[11px] text-white/40">
          Works offline · instant access · no app store needed
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <button
          type="button"
          onClick={() => window.fowInstall?.()}
          className="cursor-pointer whitespace-nowrap rounded-[10px] border-none bg-linear-to-br from-red-500 to-red-600 px-3.5 py-2 text-xs font-bold text-white"
        >
          Install
        </button>
        <button
          type="button"
          onClick={() => window.fowDismissInstall?.()}
          className="cursor-pointer rounded-[10px] border border-white/10 bg-white/6 px-2 py-1.5 text-[11px] text-white/40"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
