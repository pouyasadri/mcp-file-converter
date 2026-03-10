# AGENTS.md — Coding Agent Guidelines

This file provides instructions for AI coding agents (and human contributors) working in this
repository. Follow these guidelines to keep code consistent and correct.

---

## Project Overview

`file-converter-mcp` is a Model Context Protocol (MCP) server for file format conversion.
It exposes a single `convert_file` tool that converts images (PNG/JPG/WebP/AVIF/TIFF) and
data files (JSON/YAML/CSV). The server communicates over **stdio** and is designed to run
locally via Bun or inside Docker.

- **Runtime:** Bun (not Node.js — do not use `node` or `ts-node`)
- **Language:** TypeScript 5, ESNext, ESM modules
- **True entry point:** `src/index.ts` (not the root `index.ts` stub)

---

## Commands

### Install dependencies
```bash
bun install
```

### Start the MCP server
```bash
bun start
# equivalent to:
bun run src/index.ts
```

### Run all tests
```bash
bun test
```

### Run a single test file
```bash
bun test tests/data.test.ts
bun test tests/image.test.ts
bun test tests/mcp.test.ts
bun test tests/basic.test.ts
```

### Run a single test by name
```bash
bun test --test-name-pattern "should convert JSON to YAML"
```

### Manual end-to-end test
```bash
bun run test-conversion.ts
```

### Type-check only (no emit)
```bash
bunx tsc --noEmit
```

There is no build step — Bun transpiles TypeScript directly at runtime. There is no
configured ESLint or Prettier; do not add linting scripts without discussing it first.

---

## Repository Structure

```
src/
  index.ts          # MCP server definition — registers tools and handles requests
  converters/
    data.ts         # convertData() — JSON/YAML/CSV bi-directional conversion
    image.ts        # convertImage() — image format conversion via Sharp
  types/
    index.ts        # Zod schemas and inferred TypeScript types (source of truth)
  tools/            # Reserved for future tool modules (currently empty)
tests/
  basic.test.ts     # Environment/utility sanity checks
  data.test.ts      # Unit tests for convertData()
  image.test.ts     # Unit tests for convertImage()
  mcp.test.ts       # Zod schema validation for MCP input
docs/
  Agents.md         # Domain-level agent role description
  Skills.md         # MCP service capability documentation
```

---

## TypeScript Configuration

`tsconfig.json` enables strict settings. Key constraints:

- **`strict: true`** — all strict checks are active.
- **`verbatimModuleSyntax: true`** — use `import type` for type-only imports.
- **`noUncheckedIndexedAccess: true`** — array/object index access yields `T | undefined`;
  always guard or assert before use.
- **`noImplicitOverride: true`** — add the `override` keyword when overriding class members.
- **`noEmit: true`** — TypeScript is used for type-checking only; Bun handles transpilation.
- `noUnusedLocals` and `noUnusedParameters` are **disabled** — unused declarations are allowed.

---

## Code Style

### Imports
- Use the `node:` protocol prefix for all Node/Bun built-ins:
  ```typescript
  import { readFile, writeFile } from "node:fs/promises";
  import { extname, join, dirname, basename } from "node:path";
  ```
- Use explicit `.js` extensions for `@modelcontextprotocol/sdk` imports (required for ESM
  bundler resolution):
  ```typescript
  import { Server } from "@modelcontextprotocol/sdk/server/index.js";
  ```
- Use `import type` for any import that is only used as a type:
  ```typescript
  import type { Sharp } from "sharp";
  ```
- Group imports: external packages first, then `node:` built-ins, then local modules.

### Naming Conventions
- `camelCase` for variables, function parameters, and function names.
- `PascalCase` for types, interfaces, Zod schema constants, and class names.
- Schema constants follow the pattern `<Name>Schema` (e.g., `ConvertFileSchema`).
- Inferred types follow the pattern `<Name>` derived from schema (e.g., `ConvertFileArgs`).
- Module-level constants (non-schema) use `SCREAMING_SNAKE_CASE`:
  ```typescript
  const MAX_IMAGE_DIMENSION = 16384;
  ```

### Types and Validation
- **Zod is the single source of truth** for both runtime validation and TypeScript types.
  Always define a Zod schema first and infer the TypeScript type from it:
  ```typescript
  export const MySchema = z.object({ ... });
  export type MyArgs = z.infer<typeof MySchema>;
  ```
- Call `Schema.parse()` at the boundary of any public function to validate inputs at runtime.
- Avoid redundant manual type guards when Zod can provide them.
- Use `any` only in `catch` clauses (`error: any`) to safely access `.message`. Do not use
  `any` elsewhere without a comment explaining why.

### Functions and Structure
- Prefer plain `async` named functions over classes for converter logic.
- Use **dispatch tables** (`Record<string, Handler>`) instead of `switch` statements for
  format routing:
  ```typescript
  const formatHandlers: Record<string, FormatHandler> = {
    ".jpg": (img, opts) => img.jpeg({ quality: opts.quality }),
    ".png": (img) => img.png(),
  };
  ```
- Keep converter modules focused: one module per conversion domain (`data.ts`, `image.ts`).
- Label multi-phase logic with inline comments (e.g., `// 1. Parse phase`, `// 2. Stringify phase`).

### Error Handling
- In converter functions, wrap each phase in its own `try/catch` and rethrow with a
  descriptive message that names the format and phase:
  ```typescript
  try {
    parsedData = parser(content);
  } catch (error: any) {
    throw new Error(`Failed to parse ${sourceExt} file: ${error.message}`);
  }
  ```
- In the MCP request handler (`src/index.ts`), catch all errors and return them as MCP
  error responses — **do not rethrow** from the handler:
  ```typescript
  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error during conversion: ${error.message}` }],
      isError: true,
    };
  }
  ```
- Fatal server startup errors are caught with `.catch()` on the top-level runner and call
  `process.exit(1)`.
- Throw plain `Error` objects with descriptive messages. Do not throw strings or custom
  error subclasses unless there is a specific need.

### Comments
- Use `//` for all inline and block comments. Avoid `/* */` block comments.
- Comment the "why", not the "what". Reserve step-label comments for multi-phase logic.

---

## Testing Guidelines

- Test runner: **`bun test`** (Jest-compatible API, zero configuration required).
- Test files live in `tests/` and are named `*.test.ts`.
- Import from `bun:test`: `import { describe, test, expect } from "bun:test";`
- Group related cases in `describe()` blocks; use `test()` for individual assertions.
- All async tests use `async/await`.
- **Error path testing:** use `expect(asyncFn()).rejects.toThrow("substring")` (consistent
  with existing tests in this codebase — note: no `await`).
- Construct test input buffers inline:
  ```typescript
  const buf = Buffer.from(rawString, "utf-8");
  ```
- For image tests, generate buffers programmatically with `sharp({ create: { ... } })` —
  do not commit binary fixture files.
- No mocking framework is used; test converters against real data.
- When adding a new converter, add a corresponding `tests/<domain>.test.ts` file that covers
  happy-path conversions, unsupported format errors, and malformed input errors.

---

## Domain Notes for AI Agents

- This MCP server uses **stdio transport** — it must not bind to a port or emit anything
  to stdout except valid MCP JSON messages. Use `console.error` (stderr) for debug output.
- File access in Docker runs inside `/data` — always handle absolute paths and never
  hard-code host paths.
- Always verify the source file exists before attempting conversion (see `src/index.ts`
  handler for the pattern).
- Security: image converters enforce a `MAX_IMAGE_DIMENSION` guard (16384px) to prevent
  image-bomb attacks — preserve this guard in all image-related changes.
- The `src/tools/` directory is reserved for future tool module extraction. Place new MCP
  tools there when the server gains additional capabilities.

### File Conversion Specialist Guidelines

As an agent using this server, observe the following responsibilities and interactions:
- **Identify the correct path**: Route correctly based on file content (images vs structured data).
- **Proactive suggestions**: Suggest the appropriate target format if the user is unsure (e.g., "WebP" for web optimization).
- **Sensitive data caution**: Ensure that sensitive data files (like `.env` or configurations) are handled appropriately safely.
- **Safe operations**: Default to non-destructive copies unless the user explicitly asks to overwrite.
- **Clear feedback**: Provide the user with clear information about the outputs and file paths created after conversion.
