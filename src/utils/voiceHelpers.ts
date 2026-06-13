/**
 * Shared helpers for the Into Voice panel.
 * Centralised here to avoid duplication across pages and components.
 */

/** Width:height ratio for station cover photos (matches station page header). */
export const STATION_BANNER_ASPECT = 3;

/** Recommended upload size label for station banners. */
export const STATION_BANNER_SIZE_LABEL = "1500×500";

/** Width:height ratio for voice post thumbnails (matches single post player). */
export const VOICE_POST_THUMBNAIL_ASPECT = 16 / 9;

/** Recommended upload size label for voice post thumbnails. */
export const VOICE_POST_THUMBNAIL_SIZE_LABEL = "1280×720";

/** Width:height ratio for tape thumbnails (vertical feed). */
export const TAPE_THUMBNAIL_ASPECT = 9 / 16;

/** Recommended upload size label for tape thumbnails. */
export const TAPE_THUMBNAIL_SIZE_LABEL = "720×1280";

export const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export const formatTimeAgo = (createdAt: string): string => {
  const now = new Date();
  const date = new Date(createdAt);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "Just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export const formatListens = (count: number): string => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M listens`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K listens`;
  return `${count} listens`;
};

/** Display name for categories. Legacy 'Islamic' slug still maps to 'Religious' for any old data. */
export const getCategoryDisplayName = (name: string, slug?: string): string => {
  if (!name && !slug) return "";
  if (slug?.toLowerCase() === "islamic") return "Religious";
  return name || "";
};

export interface VoiceCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

/** Ensures default categories (e.g. Self-Help) are included when the API omits them. */
export const ensureVoiceCategories = (categories: VoiceCategory[]): VoiceCategory[] => {
  const list = categories || [];
  const hasSelfHelp = list.some(
    (c) => c.slug?.toLowerCase() === "self-help" || c.name === "Self-Help"
  );
  if (!hasSelfHelp) {
    return [
      ...list,
      { id: "self-help", name: "Self-Help", slug: "self-help", icon: "self-help" },
    ];
  }
  return list;
};
