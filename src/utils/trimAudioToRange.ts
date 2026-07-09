import { assertAudioHasSignal } from "@/utils/audioSignal";
import { getMediaDuration, needsAudioExtraction, isVideoMediaFile } from "@/utils/voiceMediaUpload";
import {
  buildMp3FileName,
  loadFFmpeg,
  resolveInputExtension,
  shouldStripVideo,
} from "@/utils/transcodeAudioToMp3";

type TrimProgressCallback = (percent: number) => void;

export interface TrimAudioResult {
  file: File;
  duration: number;
  startSeconds: number;
  endSeconds: number;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error === "number") return `FFmpeg exited with code ${error}`;
  return fallback;
}

function pickAudioRecorderMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  throw new Error("This browser cannot record trimmed audio");
}

function buildTrimmedName(originalName: string, mimeType: string): string {
  const base = (originalName.replace(/\.[^.]+$/, "") || "audio").replace(
    /[^a-zA-Z0-9.-]/g,
    "_"
  );
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return `${base}-trimmed.mp3`;
  if (mimeType.includes("wav")) return `${base}-trimmed.wav`;
  if (mimeType.includes("mp4")) return `${base}-trimmed.m4a`;
  return `${base}-trimmed.webm`;
}

/**
 * Seek the media element to `start`, play through `end`, and capture audio via MediaRecorder.
 * Avoids loading the whole file into FFmpeg/WASM — works well for long sources.
 */
async function trimWithMediaRecorder(
  sourceFile: File,
  startSeconds: number,
  endSeconds: number,
  onProgress?: TrimProgressCallback
): Promise<TrimAudioResult> {
  const mimeType = pickAudioRecorderMime();
  const objectUrl = URL.createObjectURL(sourceFile);
  const preferVideo = needsAudioExtraction(sourceFile) || isVideoMediaFile(sourceFile);
  const clipDuration = Math.max(0.5, endSeconds - startSeconds);

  const audioCtxRef: { current: AudioContext | null } = { current: null };

  try {
    return await new Promise<TrimAudioResult>((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        fn();
      };

      const media = document.createElement(preferVideo ? "video" : "audio");
      media.preload = "auto";
      if (media instanceof HTMLVideoElement) {
        media.playsInline = true;
      }
      media.setAttribute("playsinline", "true");
      media.crossOrigin = "anonymous";
      media.src = objectUrl;

      const chunks: BlobPart[] = [];
      let recorder: MediaRecorder | null = null;
      let startedRecording = false;

      const fail = (message: string) => {
        try {
          recorder?.stop();
        } catch {
          // ignore
        }
        media.pause();
        finish(() => reject(new Error(message)));
      };

      const watchdog = setTimeout(
        () => fail("Trimming timed out. Try a shorter selection or convert to MP3 first."),
        Math.ceil(clipDuration * 1000) + 45_000
      );

      const beginCapture = async () => {
        if (startedRecording) return;
        startedRecording = true;

        try {
          // Route through Web Audio so we capture without speaker playback.
          const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (!AudioCtx) throw new Error("Web Audio is not available");

          const audioContext = new AudioCtx();
          audioCtxRef.current = audioContext;
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }

          media.muted = false;
          media.volume = 1;

          const source = audioContext.createMediaElementSource(media);
          const destination = audioContext.createMediaStreamDestination();
          const silentGain = audioContext.createGain();
          silentGain.gain.value = 0;
          source.connect(destination);
          source.connect(silentGain);
          silentGain.connect(audioContext.destination);

          const stream = destination.stream;
          if (stream.getAudioTracks().length === 0) {
            throw new Error("No audio track available to trim");
          }

          recorder = new MediaRecorder(stream, { mimeType });
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onerror = () => fail("Recording failed while trimming");
          recorder.onstop = async () => {
            media.pause();
            try {
              const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
              if (blob.size < 256) {
                fail("Trimmed audio was empty");
                return;
              }
              onProgress?.(92);
              // MediaRecorder WebM often has Infinity duration and breaks upload
              // conversion — normalize the short clip to WAV via Web Audio.
              const webmFile = new File(
                [blob],
                buildTrimmedName(sourceFile.name, blob.type),
                { type: blob.type || "audio/webm" }
              );
              let audioFile: File;
              let duration: number;
              try {
                const normalized = await normalizeRecordedClipToWav(
                  webmFile,
                  clipDuration
                );
                audioFile = normalized.file;
                duration = normalized.duration;
              } catch {
                // Fall back to raw recording with known selection length.
                audioFile = webmFile;
                duration = Math.max(1, Math.floor(clipDuration));
                await assertAudioHasSignal(audioFile, {
                  requireDecodable: false,
                  label: "Trimmed audio",
                });
              }
              onProgress?.(100);
              finish(() =>
                resolve({
                  file: audioFile,
                  duration,
                  startSeconds,
                  endSeconds: startSeconds + duration,
                })
              );
            } catch (err) {
              fail(toErrorMessage(err, "Could not finalize trimmed audio"));
            }
          };

          const stopAtEnd = () => {
            if (recorder && recorder.state === "recording") {
              recorder.stop();
            }
          };

          media.ontimeupdate = () => {
            if (!Number.isFinite(media.currentTime)) return;
            const elapsed = media.currentTime - startSeconds;
            if (elapsed > 0 && clipDuration > 0) {
              onProgress?.(Math.min(95, Math.round((elapsed / clipDuration) * 100)));
            }
            if (media.currentTime >= endSeconds - 0.04) {
              media.pause();
              stopAtEnd();
            }
          };

          media.onended = () => stopAtEnd();

          media.currentTime = startSeconds;
          // Wait for seek to land near start before recording.
          await new Promise<void>((res, rej) => {
            const onSeeked = () => {
              media.removeEventListener("seeked", onSeeked);
              res();
            };
            media.addEventListener("seeked", onSeeked);
            setTimeout(() => {
              media.removeEventListener("seeked", onSeeked);
              // Some formats never fire seeked; continue anyway if close enough.
              if (Math.abs(media.currentTime - startSeconds) < 1.5) res();
              else rej(new Error("Could not seek to the trim start"));
            }, 4000);
          });

          recorder.start(250);
          onProgress?.(5);
          await media.play();
        } catch (err) {
          fail(toErrorMessage(err, "Could not start trim recording"));
        }
      };

      media.onloadedmetadata = () => {
        void beginCapture();
      };
      media.onerror = () => fail("Could not read this file for trimming");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state !== "closed") {
      await ctx.close().catch(() => undefined);
    }
  }
}

function encodeWavFromAudioBuffer(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

/**
 * Re-encode a short MediaRecorder clip to WAV so duration is readable
 * and preparePostAudio / FFmpeg can process it reliably.
 */
async function normalizeRecordedClipToWav(
  recordedFile: File,
  fallbackDuration: number
): Promise<{ file: File; duration: number }> {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : null;
  if (!AudioCtx) {
    throw new Error("Web Audio is not available");
  }

  const context = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData(await recordedFile.arrayBuffer());
    if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
      throw new Error("Decoded trim has no duration");
    }
    const wavBlob = encodeWavFromAudioBuffer(decoded);
    const audioFile = new File(
      [wavBlob],
      buildTrimmedName(recordedFile.name, "audio/wav"),
      { type: "audio/wav" }
    );
    await assertAudioHasSignal(audioFile, {
      requireDecodable: true,
      label: "Trimmed audio",
    });
    const duration = Math.max(
      1,
      Math.floor(decoded.duration) || Math.floor(fallbackDuration)
    );
    return { file: audioFile, duration };
  } finally {
    if (context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
  }
}

/** Decode whole file in Web Audio and slice — fine for shorter sources. */
async function trimWithWebAudio(
  sourceFile: File,
  startSeconds: number,
  endSeconds: number,
  onProgress?: TrimProgressCallback
): Promise<TrimAudioResult> {
  const AudioCtx =
    typeof window !== "undefined"
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : null;
  if (!AudioCtx) {
    throw new Error("This browser cannot trim audio without FFmpeg");
  }

  onProgress?.(10);
  const context = new AudioCtx();
  try {
    const decoded = await context.decodeAudioData(await sourceFile.arrayBuffer());
    onProgress?.(40);

    const sampleRate = decoded.sampleRate;
    const startSample = Math.max(0, Math.floor(startSeconds * sampleRate));
    const endSample = Math.min(decoded.length, Math.ceil(endSeconds * sampleRate));
    const frameCount = endSample - startSample;
    if (frameCount < sampleRate * 0.4) {
      throw new Error("Trim range is too short");
    }

    const sliced = context.createBuffer(decoded.numberOfChannels, frameCount, sampleRate);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      sliced.copyToChannel(decoded.getChannelData(c).subarray(startSample, endSample), c);
    }
    onProgress?.(70);

    const wavBlob = encodeWavFromAudioBuffer(sliced);
    const audioFile = new File([wavBlob], buildTrimmedName(sourceFile.name, "audio/wav"), {
      type: "audio/wav",
    });

    await assertAudioHasSignal(audioFile, {
      requireDecodable: true,
      label: "Trimmed audio",
    });

    const duration = await getMediaDuration(audioFile);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Trimmed audio has no duration");
    }

    onProgress?.(100);
    return {
      file: audioFile,
      duration,
      startSeconds,
      endSeconds: startSeconds + duration,
    };
  } finally {
    if (context.state !== "closed") {
      await context.close().catch(() => undefined);
    }
  }
}

async function trimWithFFmpeg(
  sourceFile: File,
  startSeconds: number,
  endSeconds: number,
  onProgress?: TrimProgressCallback
): Promise<TrimAudioResult> {
  const clipDuration = endSeconds - startSeconds;
  const ffmpeg = await loadFFmpeg();
  const inputExt = resolveInputExtension(sourceFile);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputName = `trim-in-${id}${inputExt}`;
  const outputName = `trim-out-${id}.mp3`;
  const { fetchFile } = await import("@ffmpeg/util");

  const logs: string[] = [];
  const logHandler = ({ message }: { type: string; message: string }) => {
    if (message?.trim()) logs.push(message.trim());
  };
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(99, Math.round(progress * 100)));
  };

  ffmpeg.on("log", logHandler);
  if (onProgress) ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));

    const stripVideo = shouldStripVideo(sourceFile);
    const seekPrefix: string[] =
      startSeconds > 0.01 ? ["-ss", startSeconds.toFixed(3)] : [];
    const durationArgs = ["-t", Math.max(0.5, clipDuration).toFixed(3)];

    const attempts: string[][] = stripVideo
      ? [
          [
            ...seekPrefix,
            "-i",
            inputName,
            ...durationArgs,
            "-vn",
            "-sn",
            "-dn",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            "-ar",
            "44100",
            "-ac",
            "2",
            outputName,
          ],
          [
            ...seekPrefix,
            "-i",
            inputName,
            ...durationArgs,
            "-vn",
            "-sn",
            "-dn",
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            outputName,
          ],
        ]
      : [
          [
            ...seekPrefix,
            "-i",
            inputName,
            ...durationArgs,
            "-c:a",
            "libmp3lame",
            "-b:a",
            "192k",
            "-ar",
            "44100",
            "-ac",
            "2",
            outputName,
          ],
          [
            ...seekPrefix,
            "-i",
            inputName,
            ...durationArgs,
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            outputName,
          ],
        ];

    let lastError: unknown;
    let succeeded = false;
    for (const args of attempts) {
      try {
        await ffmpeg.exec(args);
        succeeded = true;
        break;
      } catch (error) {
        lastError = error;
        try {
          await ffmpeg.deleteFile(outputName);
        } catch {
          // ignore
        }
      }
    }

    if (!succeeded) {
      const detail = logs.slice(-3).join(" · ");
      throw new Error(
        detail
          ? `Could not trim this file (${detail})`
          : toErrorMessage(lastError, "FFmpeg could not trim this file")
      );
    }

    const outputData = await ffmpeg.readFile(outputName);
    const bytes =
      outputData instanceof Uint8Array
        ? new Uint8Array(outputData)
        : new TextEncoder().encode(String(outputData));

    if (bytes.byteLength < 256) {
      throw new Error("Trimmed audio file was empty");
    }

    const audioFile = new File([bytes], buildMp3FileName(sourceFile.name, "trimmed"), {
      type: "audio/mpeg",
    });

    await assertAudioHasSignal(audioFile, {
      requireDecodable: true,
      label: "Trimmed MP3",
    });

    const duration = await getMediaDuration(audioFile);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Trimmed audio has no duration");
    }

    onProgress?.(100);
    return {
      file: audioFile,
      duration,
      startSeconds,
      endSeconds: startSeconds + duration,
    };
  } finally {
    ffmpeg.off("log", logHandler);
    if (onProgress) ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // ignore
    }
    try {
      await ffmpeg.deleteFile(outputName);
    } catch {
      // ignore
    }
  }
}

/**
 * Trim an audio/video file to [startSeconds, endSeconds).
 * Long sources: MediaRecorder first (avoids WASM memory limits).
 * Short sources: FFmpeg MP3 first, then MediaRecorder, then Web Audio WAV.
 */
export async function trimAudioToRange(
  sourceFile: File,
  startSeconds: number,
  endSeconds: number,
  onProgress?: TrimProgressCallback
): Promise<TrimAudioResult> {
  const start = Math.max(0, startSeconds);
  const end = Math.max(start + 0.5, endSeconds);
  const clipDuration = end - start;

  if (!Number.isFinite(clipDuration) || clipDuration < 0.5) {
    throw new Error("Trim range must be at least half a second");
  }

  const errors: string[] = [];
  const preferNative =
    sourceFile.size > 40 * 1024 * 1024 ||
    // Heuristic: if the user is cutting from far into the file, FFmpeg.wasm
    // often chokes loading the whole container — prefer MediaRecorder.
    start > 90 ||
    end > 180;

  const tryMedia = async () => {
    onProgress?.(2);
    return trimWithMediaRecorder(sourceFile, start, end, onProgress);
  };
  const tryFfmpeg = async () => {
    onProgress?.(5);
    return trimWithFFmpeg(sourceFile, start, end, onProgress);
  };
  const tryWebAudio = async () => {
    onProgress?.(5);
    return trimWithWebAudio(sourceFile, start, end, onProgress);
  };

  const sequence = preferNative
    ? [tryMedia, tryFfmpeg, tryWebAudio]
    : [tryFfmpeg, tryMedia, tryWebAudio];

  for (const attempt of sequence) {
    // Skip Web Audio for huge files — decoding the whole buffer will OOM.
    if (attempt === tryWebAudio && sourceFile.size >= 80 * 1024 * 1024) {
      continue;
    }
    try {
      return await attempt();
    } catch (err) {
      errors.push(toErrorMessage(err, "Trim attempt failed"));
    }
  }

  throw new Error(
    errors.find((m) => m.trim()) ||
      "Could not trim this file. Try converting to MP3 first, or pick a shorter source."
  );
}
