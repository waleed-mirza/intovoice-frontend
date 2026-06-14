import type { Metadata } from "next";
import { resolveVoiceAssetUrl } from "./resolveVoiceAssetUrl";

const OG_DESCRIPTION_MAX = 200;
const META_REVALIDATE_SECONDS = 300;

export function getBackendUrl(): string {
  return process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_BACKEND_PROD ?? ""
    : process.env.NEXT_PUBLIC_BACKEND_DEV ?? "";
}

export function getSiteUrl(): string {
  return process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_FRONTEND_URL || "https://into.blog"
    : process.env.NEXT_PUBLIC_FRONTEND_URL_DEV || "http://localhost:3000";
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

interface PostShareMeta {
  title: string;
  description?: string | null;
  thumbnailURL: string;
  stationName: string;
}

interface TapeShareMeta {
  caption: string;
  thumbnailURL: string;
  stationName?: string | null;
  userName: string;
}

async function fetchShareMeta<T>(path: string): Promise<T | null> {
  const base = getBackendUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}${path}`, {
      next: { revalidate: META_REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result as T;
  } catch {
    return null;
  }
}

function buildShareMetadata(options: {
  title: string;
  description: string;
  path: string;
  imageUrl: string;
}): Metadata {
  const { title, description, path, imageUrl } = options;
  const url = `${getSiteUrl()}${path}`;
  const openGraphTitle = title.includes("Into Voice")
    ? title
    : `${title} | Into Voice`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: openGraphTitle,
      description,
      url,
      siteName: "Into Voice",
      type: "website",
      locale: "en_US",
      images: imageUrl
        ? [{ url: imageUrl, alt: title, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: openGraphTitle,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

export async function buildPostShareMetadata(id: string): Promise<Metadata> {
  const meta = await fetchShareMeta<PostShareMeta>(`/voice/post/${id}/meta`);
  if (!meta) {
    return { title: "Post not found" };
  }

  const title = meta.title.trim() || "Voice post";
  const description = truncate(
    meta.description?.trim() || `Listen on Into Voice · ${meta.stationName}`,
    OG_DESCRIPTION_MAX
  );
  const imageUrl = resolveVoiceAssetUrl(meta.thumbnailURL);

  return buildShareMetadata({
    title,
    description,
    path: `/post/${id}`,
    imageUrl,
  });
}

export async function buildTapeShareMetadata(id: string): Promise<Metadata> {
  const meta = await fetchShareMeta<TapeShareMeta>(`/voice/tape/${id}/meta`);
  if (!meta) {
    return { title: "Tape not found" };
  }

  const title = meta.caption.trim() || "Tape";
  const creator =
    meta.stationName?.trim() || meta.userName.trim() || "Into Voice";
  const description = truncate(
    `Short audio on Into Voice · ${creator}`,
    OG_DESCRIPTION_MAX
  );
  const imageUrl = resolveVoiceAssetUrl(meta.thumbnailURL);

  return buildShareMetadata({
    title,
    description,
    path: `/tapes/${id}`,
    imageUrl,
  });
}
