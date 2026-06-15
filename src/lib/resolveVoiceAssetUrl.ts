/**
 * Builds a public asset URL for display/playback.
 * DB may store either a bare S3 key or a legacy full URL — both are supported.
 */
export const resolveVoiceAssetUrl = (value: string | null | undefined): string => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  const base = (process.env.NEXT_PUBLIC_AWS_POST_FILE ?? "").replace(/\/$/, "");
  const path = value.replace(/^\//, "");
  return base ? `${base}/${path}` : `/${path}`;
};
