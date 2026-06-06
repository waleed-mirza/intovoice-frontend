import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
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
