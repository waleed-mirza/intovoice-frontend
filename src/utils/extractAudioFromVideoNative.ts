import { getMediaDuration } from "@/utils/voiceMediaUpload";

type ProgressCallback = (percent: number) => void;
export interface ExtractAudioResult {
  file: File;
  duration: number;
}

type ExtractionStrategy = "webaudio" | "capturestream";

function getCaptureStream(video: HTMLVideoElement): MediaStream | null {
  const withCapture = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  return withCapture.captureStream?.() ?? withCapture.mozCaptureStream?.() ?? null;
}

function buildExtractedFileName(originalName: string, mimeType: string): string {
  const dot = originalName.lastIndexOf(".");
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const sanitized = (base || "audio").replace(/[^a-zA-Z0-9.-]/g, "_");
  const ext = mimeType.includes("mp4") ? "m4a" : "webm";
  return `${sanitized}-audio.${ext}`;
}

function pickAudioRecorderMime(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  throw new Error("This browser cannot record extracted audio");
}

function createRecordStream(
  video: HTMLVideoElement,
  strategy: ExtractionStrategy,
  audioContextRef: { current: AudioContext | null }
): MediaStream {
  if (strategy === "webaudio") {
    video.muted = true;
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;

    const source = audioContext.createMediaElementSource(video);
    const destination = audioContext.createMediaStreamDestination();
    const silentGain = audioContext.createGain();
    silentGain.gain.value = 0;

    source.connect(destination);
    source.connect(silentGain);
    silentGain.connect(audioContext.destination);

    return destination.stream;
  }

  video.muted = false;
  video.volume = 0;

  const stream = getCaptureStream(video);
  if (!stream) {
    throw new Error("captureStream is not supported");
  }

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    throw new Error("No audio track found via captureStream");
  }

  return new MediaStream(audioTracks);
}

async function recordVideoAudio(
  videoFile: File,
  strategy: ExtractionStrategy,
  onProgress?: ProgressCallback
): Promise<ExtractAudioResult> {
  const mimeType = pickAudioRecorderMime();
  const objectUrl = URL.createObjectURL(videoFile);
  const audioContextRef: { current: AudioContext | null } = { current: null };

  try {
    return await new Promise<ExtractAudioResult>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "auto";
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.src = objectUrl;

      let recorder: MediaRecorder | null = null;
      let settled = false;
      let sourceDuration = 0;
      const chunks: Blob[] = [];

      const cleanup = () => {
        video.pause();
        video.onloadedmetadata = null;
        video.onerror = null;
        video.ontimeupdate = null;
        video.onended = null;
        video.removeAttribute("src");
        video.load();
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          void audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };

      const fail = (message: string) => finish(() => reject(new Error(message)));

      video.onerror = () => fail("Could not load video file");

      video.onloadedmetadata = () => {
        void (async () => {
          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            fail("Could not detect video duration");
            return;
          }

          sourceDuration = Math.floor(video.duration);

          let recordStream: MediaStream;
          try {
            recordStream = createRecordStream(video, strategy, audioContextRef);
            if (audioContextRef.current) {
              await audioContextRef.current.resume();
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Could not set up audio extraction";
            fail(message);
            return;
          }

          if (recordStream.getAudioTracks().length === 0) {
            fail("This video has no audio track");
            return;
          }

          try {
            recorder = new MediaRecorder(recordStream, { mimeType });
          } catch {
            fail("Could not start audio recorder");
            return;
          }

          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };

          recorder.onstop = () => {
            void (async () => {
              try {
                if (chunks.length === 0) {
                  fail("Extracted audio was empty");
                  return;
                }

                const blob = new Blob(chunks, { type: mimeType });
                const outputType = mimeType.split(";")[0];
                const audioFile = new File(
                  [blob],
                  buildExtractedFileName(videoFile.name, mimeType),
                  { type: outputType }
                );

                let duration = sourceDuration;
                if (!Number.isFinite(duration) || duration <= 0) {
                  duration = await getMediaDuration(audioFile);
                }

                onProgress?.(100);
                finish(() => resolve({ file: audioFile, duration }));
              } catch {
                fail("Could not package extracted audio");
              }
            })();
          };

          recorder.onerror = () => fail("Audio extraction failed while recording");

          video.ontimeupdate = () => {
            if (video.duration > 0) {
              onProgress?.(Math.min(99, Math.round((video.currentTime / video.duration) * 100)));
            }
          };

          const stopRecorder = () => {
            if (recorder?.state !== "recording") return;
            try {
              recorder.requestData();
            } catch {
              // Some browsers do not support requestData.
            }
            recorder.stop();
          };

          video.onended = () => stopRecorder();

          recorder.start(1000);

          try {
            await video.play();
          } catch {
            fail("Could not play video for audio extraction");
            return;
          }

          window.setTimeout(() => {
            if (!settled) stopRecorder();
          }, Math.ceil(video.duration * 1000) + 5000);
        })();
      };
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getExtractionStrategies(): ExtractionStrategy[] {
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return ["capturestream", "webaudio"];
  }
  return ["webaudio", "capturestream"];
}

export async function extractAudioFromVideoNative(
  videoFile: File,
  onProgress?: ProgressCallback
): Promise<ExtractAudioResult> {
  if (typeof document === "undefined") {
    throw new Error("Audio extraction must run in the browser");
  }

  const errors: string[] = [];

  for (const strategy of getExtractionStrategies()) {
    try {
      onProgress?.(0);
      return await recordVideoAudio(videoFile, strategy, onProgress);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Extraction failed");
    }
  }

  throw new Error(
    Array.from(new Set(errors.filter(Boolean))).join(". ") ||
      "Could not extract audio from this video on your device"
  );
}
