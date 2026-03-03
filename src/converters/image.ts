import sharp from "sharp";

export async function convertImage(inputBuffer: Buffer, targetExt: string): Promise<Buffer> {
  const image = sharp(inputBuffer);
  switch (targetExt.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return await image.jpeg().toBuffer();
    case ".png":
      return await image.png().toBuffer();
    case ".webp":
      return await image.webp().toBuffer();
    case ".avif":
      return await image.avif().toBuffer();
    case ".tiff":
      return await image.tiff().toBuffer();
    default:
      throw new Error(`Unsupported image target extension: ${targetExt}`);
  }
}
