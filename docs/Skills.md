# Skills

## Core Capability: Universal File Conversion
The `file-converter` MCP service provides a robust interface for transforming files between various formats.

### 1. Image Processing
Powered by `sharp`, supporting high-performance transformations:
- **Input Formats:** PNG, JPEG, WebP, AVIF, TIFF.
- **Output Formats:** JPEG, PNG, WebP, AVIF, TIFF.
- **Features:** Automatic color space handling and buffer-based processing.

### 2. Data Interchange
Native support for common configuration and data formats:
- **JSON:** Standard data exchange format.
- **YAML/YML:** Human-readable configuration format.
- **CSV:** Tabular data with automatic header parsing.
- **XLSX:** Excel spreadsheet reading and writing.
- **TOML:** Configuration format for modern dev tools.
- **XML:** Standard markup for structured data.

### 3. Document Processing
- **PDF Text Extraction:** Reads raw text from PDF documents.
- **Markup Conversion:** Markdown `↔` HTML bi-directional conversion.

### 4. Advanced Utilities
- **Batch Conversion:** Process multiple files in parallel with failure reporting.
- **File Inspection:** Extract metadata (dimensions, rows, columns) without conversion.
- **Archiving:** Compress and decompress files using Gzip (.gz) and Zip (.zip).

### 5. File System Management
- **Surgical Overwrites:** Replace existing files precisely when requested.
- **Safe Copies:** Create new files without disturbing the source.
- **Path Resolution:** Handles absolute paths and resolves extensions automatically.
