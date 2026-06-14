import type { Tape } from "@/types/tapes";
import { feedSourceKey, type TapeFeedSource } from "@/utils/tapeFeedSource";

const CACHE_KEY = "tape_feed_seed";
const MAX_AGE_MS = 5 * 60 * 1000;

export interface TapeFeedSeed {
  sourceKey: string;
  tapes: Tape[];
  page: number;
  hasMore: boolean;
  updatedAt: number;
}

export function setTapeFeedSeed(
  source: TapeFeedSource,
  data: { tapes: Tape[]; page: number; hasMore: boolean }
) {
  if (typeof sessionStorage === "undefined" || data.tapes.length === 0) return;
  const seed: TapeFeedSeed = {
    sourceKey: feedSourceKey(source),
    tapes: data.tapes,
    page: data.page,
    hasMore: data.hasMore,
    updatedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(seed));
  } catch {
    // quota or private mode — feed will fetch instead
  }
}

export function consumeTapeFeedSeed(
  source: TapeFeedSource,
  tapeId?: string
): Omit<TapeFeedSeed, "updatedAt"> | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const seed = JSON.parse(raw) as TapeFeedSeed;
    if (seed.sourceKey !== feedSourceKey(source)) return null;
    if (Date.now() - seed.updatedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (tapeId && !seed.tapes.some((t) => t.id === tapeId)) return null;

    sessionStorage.removeItem(CACHE_KEY);
    return {
      sourceKey: seed.sourceKey,
      tapes: seed.tapes,
      page: seed.page,
      hasMore: seed.hasMore,
    };
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
    return null;
  }
}
