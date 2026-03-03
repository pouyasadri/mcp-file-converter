import sharp from "sharp";
import { z } from "zod";

const MAX_IMAGE_DIMENSION = 16384;

export const ImageConversionOptionsSchema = z.object({
  width: z.number().int().min(1).max(MAX_IMAGE_DIMENSION).optional(),
  height: z.number().int().min(1).max(MAX_IMAGE_DIMENSION).optional(),
  quality: z.number().int().min(1).max(100).optional(),
});

export type ImageConversionOptions = z.infer<typeof ImageConversionOptionsSchema>;

export async function convertImage(
  inputBuffer: Buffer,
  targetExt: string,
  options?: ImageConversionOptions
): Promise<Buffer> {
  const parsedOptions = ImageConversionOptionsSchema.parse(options || {});

  let image = sharp(inputBuffer);

  // Guard against massive initial files (Image Bombs)
  const metadata = await image.metadata();
  if (
    (metadata.width && metadata.width > MAX_IMAGE_DIMENSION) ||
    (metadata.height && metadata.height > MAX_IMAGE_DIMENSION)
  ) {
    throw new Error(`Image dimensions exceed the maximum allowed limit of ${MAX_IMAGE_DIMENSION}px.`);
  }

  if (parsedOptions.width || parsedOptions.height) {
    image = image.resize({
      width: parsedOptions.width,
      height: parsedOptions.height,
      fit: sharp.fit.inside,
      withoutEnlargement: true,
    });
  }

  const quality = parsedOptions.quality;

  switch (targetExt.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return await image.jpeg({ quality }).toBuffer();
    case ".png":
      return await image.png({ quality }).toBuffer();
    case ".webp":
      return await image.webp({ quality }).toBuffer();
    case ".avif":
      return await image.avif({ quality }).toBuffer();
    case ".tiff":
      return await image.tiff({ quality }).toBuffer();
    default:
      throw new Error(`Unsupported image target extension: ${targetExt}`);
  }
}
