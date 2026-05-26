# MCP File Converter

`file-converter-mcp` is a local Model Context Protocol server for file transformation and inspection. It is designed for agent-driven workflows that need deterministic conversions, strict validation, and local-only file access.

The server runs on Bun, speaks stdio MCP, and does not bind to a network port.

## Architecture

The codebase is organized around small, focused modules:

- `src/index.ts` registers MCP tools and handles requests
- `src/converters/image.ts` converts raster image formats through Sharp
- `src/converters/data.ts` converts structured data and markup formats
- `src/tools/inspect.ts` returns file metadata and conversion suggestions
- `src/tools/batch.ts` converts multiple files concurrently
- `src/tools/compress.ts` handles gzip and zip workflows
- `src/tools/pdf.ts` extracts text from PDFs
- `src/tools/routing.ts` defines file families and conversion policy
- `src/tools/preview.ts` computes output paths and preview payloads
- `src/tools/suggest.ts` returns target recommendations directly
- `src/tools/response.ts` centralizes formatted tool output
- `src/types/index.ts` contains Zod schemas used at tool boundaries

The server follows a family-based routing model:

- image files convert only to image formats
- structured files convert only to structured formats
- markup files convert only to markup formats

This policy is enforced before conversion work begins.

## Supported Tooling

### `convert_file`

Convert a single file to a compatible target extension.

Inputs:

- `inputPath` required
- `targetExtension` required
- `overwrite` optional
- `preview` optional
- `width` optional, image only
- `height` optional, image only
- `quality` optional, image only

Behavior:

- validates the source file exists
- normalizes the target extension
- rejects cross-family conversions
- supports preview mode without writing
- uses shared formatting for success and preview responses

### `batch_convert_files`

Convert multiple files in parallel using the same target extension.

Inputs:

- `inputPaths` required
- `targetExtension` required
- `overwrite` optional
- `preview` optional
- `width` optional, image only
- `height` optional, image only
- `quality` optional, image only

Behavior:

- processes files concurrently with `Promise.allSettled`
- returns per-file success/failure results
- supports preview mode
- applies the same family policy as single-file conversion

### `inspect_file`

Return metadata for a file without modifying it.

Returned fields vary by file family:

- image: format, dimensions, channels, color space, alpha support, size, suggested targets
- structured: row count, columns, size, suggested targets
- markup: character count, line count, size, suggested targets

### `suggest_targets`

Return recommended targets for a source file family.

Inputs:

- `inputPath` or `sourceExtension`

Behavior:

- uses the shared routing layer
- returns a structured response with `sourceKind`, `suggestedTargets`, and a message

### `extract_pdf`

Extract plain text from a PDF buffer.

Behavior:

- validates the buffer is non-empty
- checks for a PDF magic header
- returns a descriptive parsing error when extraction fails

### `compress_file` / `decompress_file`

Support gzip and zip compression workflows.

Behavior:

- gzip produces a single `.gz` artifact
- zip stores the file in an archive
- decompression restores files into the target directory

## Examples

### Preview a conversion

Request:

```json
{
  "inputPath": "/data/image.png",
  "targetExtension": ".webp",
  "preview": true
}
```

Response:

```json
{
  "inputPath": "/data/image.png",
  "sourceExtension": ".png",
  "sourceKind": "image",
  "targetExtension": ".webp",
  "targetKind": "image",
  "outputPath": "/data/image.webp",
  "overwrite": false,
  "suggestedTargets": [".webp", ".avif", ".png", ".jpg", ".jpeg", ".tiff"]
}
```

### Suggest targets from a source extension

Request:

```json
{
  "sourceExtension": ".json"
}
```

Response:

```json
{
  "sourceExtension": ".json",
  "sourceKind": "structured",
  "suggestedTargets": [".json", ".yaml", ".csv", ".xlsx", ".toml", ".xml"],
  "message": "Suggested targets for structured data files: .json, .yaml, .csv, .xlsx, .toml, .xml."
}
```

### Inspect a file

Request:

```json
{
  "inputPath": "/data/report.md"
}
```

Response excerpt:

```json
{
  "type": "markup",
  "format": "md",
  "characterCount": 1284,
  "lineCount": 42,
  "suggestedTargets": [".html", ".md"]
}
```

## Validation Model

Zod is the source of truth for tool input schemas.

Runtime validation happens at the tool boundary before any expensive work begins.

Current schemas:

- `ConvertFileSchema`
- `BatchConvertSchema`
- `SuggestTargetsSchema`

## Design Rationale

The project uses a strict family-based policy for a few reasons:

- it prevents invalid conversions from being attempted in the first place
- it keeps routing logic predictable for agents
- it makes error messages actionable by pairing rejection with suggestions
- it allows inspection, preview, and conversion tools to share the same policy source

The model also separates concerns cleanly:

- routing decides what is allowed
- preview decides where output would go
- converters handle the actual transformation
- response formatters keep tool output stable

This structure makes the server easier to extend without spreading format-specific rules across handlers.

## Preview Mode

Preview mode is supported by conversion tools.

When `preview=true`:

- no output file is written
- the planned output path is returned
- source and target families are included
- the same target suggestions used by inspection are included

## Shared Response Formatting

The server uses shared formatters to keep tool output consistent:

- `formatJsonResponse()` for structured JSON text
- `formatConversionSuccessMessage()` for single-file conversions
- `formatBatchConversionMessage()` for batch conversions

This avoids formatting drift between tool handlers and keeps responses stable for agents.

## File Families

### Image

Supported extensions:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`
- `.avif`
- `.tiff`

### Structured

Supported extensions:

- `.json`
- `.yaml`
- `.yml`
- `.csv`
- `.xlsx`
- `.toml`
- `.xml`

### Markup

Supported extensions:

- `.md`
- `.html`

## Suggested Targets

The routing layer exposes suggested output families:

- images: `.webp`, `.avif`, `.png`, `.jpg`, `.jpeg`, `.tiff`
- structured: `.json`, `.yaml`, `.csv`, `.xlsx`, `.toml`, `.xml`
- markup: `.html`, `.md`

Invalid conversion attempts return suggestions in the error response.

## Security and Safety

- file existence is checked before conversion
- image dimensions are bounded to avoid oversized input abuse
- overwrite is opt-in
- preview mode can be used to validate output paths before writing
- all file operations are local to the machine running the server

## Development

Install dependencies:

```bash
bun install
```

Run the server:

```bash
bun start
```

Run tests:

```bash
bun test
```

Type-check:

```bash
bunx tsc --noEmit
```

Run the manual conversion test script:

```bash
bun run test-conversion.ts
```

## MCP Configuration

### Bun

```json
{
  "mcpServers": {
    "file-converter": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/mcp-file-converter/src/index.ts"]
    }
  }
}
```

### Docker

```json
{
  "mcpServers": {
    "file-converter": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "/Users/yourname/Documents:/data",
        "ghcr.io/pouyasadri/mcp-file-converter:main"
      ]
    }
  }
}
```

Inside Docker, mount the local workspace to `/data`.

## Notes

- the server uses stdio, so stdout must remain valid MCP traffic
- conversion logic is intentionally strict about file families
- preview and suggestion tools are intended to reduce failed tool calls
- batch conversion is parallel, but failures are isolated per file

## License

MIT
