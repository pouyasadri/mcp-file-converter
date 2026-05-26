export type FileKind = "image" | "structured" | "markup" | "unsupported";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".tiff"] as const;
const STRUCTURED_EXTENSIONS = [".json", ".yaml", ".yml", ".csv", ".xlsx", ".toml", ".xml"] as const;
const MARKUP_EXTENSIONS = [".md", ".html"] as const;

const EXTENSION_KIND: Record<string, FileKind> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".avif": "image",
  ".tiff": "image",
  ".json": "structured",
  ".yaml": "structured",
  ".yml": "structured",
  ".csv": "structured",
  ".xlsx": "structured",
  ".toml": "structured",
  ".xml": "structured",
  ".md": "markup",
  ".html": "markup",
};

export function normalizeExtension(extension: string): string {
  const normalized = extension.trim().toLowerCase();
  if (!normalized) return "";
  return normalized.startsWith(".") ? normalized : `.${normalized}`;
}

export function getFileKind(extension: string): FileKind {
  return EXTENSION_KIND[normalizeExtension(extension)] ?? "unsupported";
}

export function getSupportedExtensions(kind: Exclude<FileKind, "unsupported">): readonly string[] {
  if (kind === "image") return IMAGE_EXTENSIONS;
  if (kind === "structured") return STRUCTURED_EXTENSIONS;
  return MARKUP_EXTENSIONS;
}

export function getKindLabel(kind: Exclude<FileKind, "unsupported">): string {
  if (kind === "image") return "image";
  if (kind === "structured") return "structured data";
  return "markup";
}

export function getFamilyConversionError(sourceExt: string, targetExt: string): string {
  const sourceKind = getFileKind(sourceExt);
  const targetKind = getFileKind(targetExt);
  const normalizedSource = normalizeExtension(sourceExt);
  const normalizedTarget = normalizeExtension(targetExt);

  if (sourceKind === "unsupported") {
    return `Unsupported source file type: ${normalizedSource || sourceExt}`;
  }

  if (targetKind === "unsupported") {
    return `Unsupported target file type: ${normalizedTarget || targetExt}`;
  }

  if (sourceKind !== targetKind) {
    return (
      `Cannot convert a ${getKindLabel(sourceKind)} (${normalizedSource}) to a ${getKindLabel(targetKind)} (${normalizedTarget}). ` +
      `Target must be one of: ${getSupportedExtensions(sourceKind).join(", ")}.`
    );
  }

  return "";
}

export function canConvertBetween(sourceExt: string, targetExt: string): boolean {
  return getFamilyConversionError(sourceExt, targetExt) === "";
}
