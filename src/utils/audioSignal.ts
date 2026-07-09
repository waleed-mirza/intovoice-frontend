/** Peak amplitude below this is treated as silence (failed conversion/extraction). */
export const SILENCE_PEAK_THRESHOLD = 0.001;

/** Reject tiny blobs that cannot be real encoded audio. */
export const MIN_AUDIO_BYTES = 256;

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

export function assertAudioFileNonEmpty(file: Blob, label = "Audio file"): void {
  if (!(file.size > MIN_AUDIO_BYTES)) {
    throw new Error(`${label} was empty or too small`);
  }
}

/**
 * Decode and require a non-silent peak.
 * When `requireDecodable` is true, decode failures also throw (use after FFmpeg MP3).
 * When false, undecodable formats are allowed through (some mobile WebM variants).
 */
export async function assertAudioHasSignal(
  blob: Blob,
  options?: { requireDecodable?: boolean; label?: string }
): Promise<void> {
  assertAudioFileNonEmpty(blob, options?.label ?? "Audio file");

  const AudioCtx = getAudioContextConstructor();
  if (!AudioCtx) {
    if (options?.requireDecodable) {
      throw new Error("This browser cannot verify converted audio");
    }
    return;
  }

  const context = new AudioCtx();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) {
      throw new Error("Converted audio has no duration");
    }

    let peak = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      // Sample evenly for long files so we stay responsive.
      const step = Math.max(1, Math.floor(data.length / 250_000));
      for (let i = 0; i < data.length; i += step) {
        const abs = Math.abs(data[i]);
        if (abs > peak) peak = abs;
        if (peak >= SILENCE_PEAK_THRESHOLD) return;
      }
    }

    throw new Error("Converted audio was silent");
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Converted audio was silent" ||
        error.message === "Converted audio has no duration" ||
        error.message.includes("empty or too small") ||
        error.message.includes("cannot verify"))
    ) {
      throw error;
    }
    if (options?.requireDecodable) {
      throw new Error("Converted audio could not be decoded — conversion may have failed");
    }
  } finally {
    if (context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
  }
}
