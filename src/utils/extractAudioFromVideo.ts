import { getMediaDuration } from "@/utils/voiceMediaUpload";

type ExtractProgressCallback = (percent: number) => void;

interface ExtractAudioResult {
  file: File;
  duration: number;
}

interface ExtractionFormat {
  outputName: string;
  outputFileName: string;
  mimeType: string;
  args: string[];
}

let ffmpegPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function buildExtractedAudioFileName(originalName: string, ext: string): string {
  const inputExt = getExtension(originalName);
  const base = inputExt ? originalName.slice(0, -inputExt.length) : originalName;
  const sanitized = (base || "video").replace(/[^a-zA-Z0-9.-]/g, "_");
  return `${sanitized}-audio.${ext}`;
}

function getFFmpegBaseUrl(): string {
  if (typeof window === "undefined") {
    throw new Error("Audio extraction must run in the browser");
  }
  return `${window.location.origin}/ffmpeg`;
}

async function loadFFmpeg(): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    const baseURL = getFFmpegBaseUrl();

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    return ffmpeg;
  })().catch((error) => {
    ffmpegPromise = null;
    throw error;
  });

  return ffmpegPromise;
}

function getExtractionFormats(inputName: string, originalName: string): ExtractionFormat[] {
  return [
    {
      outputName: "output.m4a",
      outputFileName: buildExtractedAudioFileName(originalName, "m4a"),
      mimeType: "audio/mp4",
      args: ["-i", inputName, "-vn", "-c:a", "copy", "output.m4a"],
    },
    {
      outputName: "output.webm",
      outputFileName: buildExtractedAudioFileName(originalName, "webm"),
      mimeType: "audio/webm",
      args: ["-i", inputName, "-vn", "-c:a", "libopus", "-b:a", "128k", "output.webm"],
    },
    {
      outputName: "output.mp3",
      outputFileName: buildExtractedAudioFileName(originalName, "mp3"),
      mimeType: "audio/mpeg",
      args: ["-i", inputName, "-vn", "-c:a", "libmp3lame", "-b:a", "192k", "output.mp3"],
    },
  ];
}

async function extractWithFFmpeg(
  videoFile: File,
  onProgress?: ExtractProgressCallback
): Promise<ExtractAudioResult> {
  const ffmpeg = await loadFFmpeg();
  const inputExt = getExtension(videoFile.name) || ".mp4";
  const inputName = `input${inputExt}`;
  const { fetchFile } = await import("@ffmpeg/util");

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(99, Math.round(progress * 100)));
  };

  if (onProgress) {
    ffmpeg.on("progress", progressHandler);
  }

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

    let lastError: Error | null = null;
    for (const format of getExtractionFormats(inputName, videoFile.name)) {
      try {
        await ffmpeg.exec(format.args);
        const outputData = await ffmpeg.readFile(format.outputName);
        const bytes =
          outputData instanceof Uint8Array
            ? outputData
            : new TextEncoder().encode(String(outputData));

        if (bytes.byteLength === 0) {
          throw new Error("Extracted audio file was empty");
        }

        const audioFile = new File([bytes as BlobPart], format.outputFileName, {
          type: format.mimeType,
        });
        const duration = await getMediaDuration(audioFile);

        await ffmpeg.deleteFile(format.outputName);
        onProgress?.(100);
        return { file: audioFile, duration };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        try {
          await ffmpeg.deleteFile(format.outputName);
        } catch {
          // Ignore cleanup errors between attempts
        }
      }
    }

    throw lastError || new Error("Could not extract audio from this video format");
  } finally {
    if (onProgress) {
      ffmpeg.off("progress", progressHandler);
    }
    try {
      await ffmpeg.deleteFile(inputName);
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function extractWithMediaRecorder(videoFile: File): Promise<ExtractAudioResult> {
  const objectUrl = URL.createObjectURL(videoFile);

  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not load video file"));
    });

    const duration = Math.floor(video.duration);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Could not detect video duration");
    }

    const videoWithCapture = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };

    const captureStream =
      videoWithCapture.captureStream?.bind(videoWithCapture) ||
      videoWithCapture.mozCaptureStream?.bind(videoWithCapture);

    if (!captureStream) {
      throw new Error("This browser does not support video stream capture");
    }

    const stream = captureStream();
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("This video has no audio track");
    }

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : null;

    if (!mimeType) {
      throw new Error("This browser cannot record extracted audio");
    }

    const audioStream = new MediaStream(audioTracks);
    const recorder = new MediaRecorder(audioStream, { mimeType });
    const chunks: Blob[] = [];

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = () => reject(new Error("Failed while recording audio from video"));

      recorder.start(250);
      video
        .play()
        .then(() => {
          video.onended = () => {
            if (recorder.state !== "inactive") recorder.stop();
          };
        })
        .catch(reject);

      window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          video.pause();
          recorder.stop();
        }
      }, (duration + 3) * 1000);
    });

    const ext = mimeType.includes("webm") ? "webm" : "m4a";
    const audioFile = new File(
      [blob],
      buildExtractedAudioFileName(videoFile.name, ext),
      { type: mimeType.split(";")[0] }
    );

    return { file: audioFile, duration };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function extractAudioFromVideo(
  videoFile: File,
  onProgress?: ExtractProgressCallback
): Promise<ExtractAudioResult> {
  try {
    return await extractWithFFmpeg(videoFile, onProgress);
  } catch (ffmpegError) {
    console.warn("ffmpeg extraction failed, falling back to browser recorder:", ffmpegError);

    try {
      onProgress?.(0);
      const result = await extractWithMediaRecorder(videoFile);
      onProgress?.(100);
      return result;
    } catch (recorderError) {
      const ffmpegMessage =
        ffmpegError instanceof Error ? ffmpegError.message : "Unknown ffmpeg error";
      const recorderMessage =
        recorderError instanceof Error ? recorderError.message : "Unknown recorder error";
      throw new Error(
        `Failed to extract audio from video. ${ffmpegMessage}. Fallback failed: ${recorderMessage}.`
      );
    }
  }
}
