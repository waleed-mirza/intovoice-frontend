export const resolveVoiceAssetUrl = (value: string | null | undefined): string => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  const base = process.env.NEXT_PUBLIC_AWS_POST_FILE ?? "";
  return `${base}/${value}`;
};
