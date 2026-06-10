import type { Area } from "react-easy-crop";

/** Maximum zoom needed for the image to fully cover the crop frame. */
export function computeCoverZoom(
  mediaWidth: number,
  mediaHeight: number,
  cropAspect: number
): number {
  const imageAspect = mediaWidth / mediaHeight;
  if (imageAspect > cropAspect) {
    return imageAspect / cropAspect;
  }
  return cropAspect / imageAspect;
}

/** Largest crop rect (fixed aspect) that fits entirely inside the displayed image. */
export function getCropSizeFittingMedia(
  mediaWidth: number,
  mediaHeight: number,
  cropAspect: number
): { width: number; height: number } {
  const heightFromWidth = mediaWidth / cropAspect;
  if (heightFromWidth <= mediaHeight) {
    return { width: mediaWidth, height: heightFromWidth };
  }
  return { width: mediaHeight * cropAspect, height: mediaHeight };
}

const createImage = (url: string): Promise<HTMLImageElement> =>  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  mimeType = "image/jpeg",
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to create cropped image"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}
