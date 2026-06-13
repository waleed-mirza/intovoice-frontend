import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/utils/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  safelist: [
    "bg-voice-primary",
    "hover:bg-voice-primary-hover",
    "text-voice-muted",
    "bg-voice-subtle",
    "bg-voice-track",
    "bg-voice-badge-bg",
    "text-voice-badge-text",
    "ring-voice-ring",
    "border-voice-border-active",
    // Tape immersive feed — defined in src/utils/tapeLayout.ts
    "sm:top-14",
    "sm:bottom-16",
    "lg:left-64",
    "lg:bottom-5",
    "top-[calc(3.5rem+3.75rem+env(safe-area-inset-top,0px))]",
    "bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]",
    "aspect-[9/16]",
    "w-[min(92vw,360px,calc((100dvh-12.5rem)*9/16))]",
    "sm:w-[min(360px,calc((100dvh-10rem)*9/16))]",
    "lg:w-[min(420px,calc((100dvh-8rem)*9/16))]",
    "snap-start",
    "snap-always",
    "snap-stop-always",
    "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]",
  ],
  theme: {
    extend: {
      colors: {
        "voice-primary": "var(--voice-primary)",
        "voice-primary-hover": "var(--voice-primary-hover)",
        "voice-secondary": "var(--voice-secondary)",
        "voice-muted": "var(--voice-muted)",
        "voice-subtle": "var(--voice-subtle)",
        "voice-track": "var(--voice-track)",
        "voice-badge-bg": "var(--voice-badge-bg)",
        "voice-badge-text": "var(--voice-badge-text)",
        "voice-ring": "var(--voice-ring)",
        "voice-dots": "var(--voice-dots)",
        "voice-tab-active-bg": "var(--voice-tab-active-bg)",
        "voice-tab-active-text": "var(--voice-tab-active-text)",
        "voice-border-active": "var(--voice-border-active)",
      },
    },
  },
  plugins: [],
};

export default config;
