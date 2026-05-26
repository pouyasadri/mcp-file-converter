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

export function getSuggestedTargetExtensions(kind: Exclude<FileKind, "unsupported">): readonly string[] {
  if (kind === "image") return [".webp", ".avif", ".png", ".jpg", ".jpeg", ".tiff"];
  if (kind === "structured") return [".json", ".yaml", ".csv", ".xlsx", ".toml", ".xml"];
  return [".html", ".md"];
}

export function getSuggestedTargetMessage(sourceExt: string): string {
  const kind = getFileKind(sourceExt);
  if (kind === "unsupported") return "No conversion suggestions available for this file type.";

  const suggestions = getSuggestedTargetExtensions(kind).join(", ");
  return `Suggested targets for ${getKindLabel(kind)} files: ${suggestions}.`;
}

export interface TargetSuggestions {
  sourceExtension: string;
  sourceKind: FileKind;
  suggestedTargets: readonly string[];
  message: string;
}

export function getTargetSuggestions(sourceExt: string): TargetSuggestions {
  const sourceExtension = normalizeExtension(sourceExt);
  const sourceKind = getFileKind(sourceExtension);

  if (sourceKind === "unsupported") {
    return {
      sourceExtension,
      sourceKind,
      suggestedTargets: [],
      message: "No conversion suggestions available for this file type.",
    };
  }

  const suggestedTargets = getSuggestedTargetExtensions(sourceKind);
  return {
    sourceExtension,
    sourceKind,
    suggestedTargets,
    message: getSuggestedTargetMessage(sourceExtension),
  };
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
      `Target must be one of: ${getSupportedExtensions(sourceKind).join(", ")}. ` +
      `${getSuggestedTargetMessage(sourceExt)}`
    );
  }

  return "";
}

export function canConvertBetween(sourceExt: string, targetExt: string): boolean {
  return getFamilyConversionError(sourceExt, targetExt) === "";
}
