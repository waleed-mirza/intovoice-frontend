/**
 * Into Voice – JS color tokens
 *
 * Single source of truth for hex values used inside JS/TSX:
 *   • inline `style={{ background: ... }}` gradient strings
 *   • component color props  (e.g. <Waveform color={voice.waveform} />)
 *
 * CSS-class-based colors are controlled via CSS variables in globals.css
 * and Tailwind custom colors in tailwind.config.js (voice-* palette).
 *
 * To retheme the entire voice panel change values HERE and in globals.css.
 */

const voice = {
  /** Progress-bar fill color (also Waveform component prop) */
  fill: "#111827",

  /** Progress-bar track color (empty portion of range/gradient) */
  track: "#d1d5db",

  /** Gradient string helpers */
  progressGradient: (pct: number) =>
    `linear-gradient(to right, #111827 ${pct}%, #d1d5db ${pct}%)`,

  playerGradient: (pct: number) =>
    `linear-gradient(to right, #111827 ${pct}%, #4b5563 ${pct}%)`,
} as const;

export default voice;
