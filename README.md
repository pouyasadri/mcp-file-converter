# 🔄 MCP File Converter

[![CI/CD](https://github.com/pouyasadri/mcp-file-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/pouyasadri/mcp-file-converter/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue.svg)](https://github.com/pouyasadri/mcp-file-converter/pkgs/container/mcp-file-converter)

A high-performance **Model Context Protocol (MCP)** server designed for seamless file transformations. Empowers AI agents to convert files through simple tool calls.

Built with [Bun](https://bun.sh/) for maximum speed and efficiency.

## ✨ Features

### 🖼️ Image Conversion
Powered by **Sharp**, supporting high-quality transformations between:
- **Formats**: PNG, JPG, WebP, AVIF, TIFF.
- **Auto-optimization**: Intelligent defaults for web-ready assets.

### 📊 Structured Data & Markup Transformation
Effortless switching between common structured formats:
- **JSON ↔️ YAML ↔️ CSV ↔️ XLSX (Excel) ↔️ TOML ↔️ XML**
- **Markdown ↔️ HTML**
- Conversion policy is family-based: images convert only to images, structured data only to structured data, and markup only to markup.
- Preserves structure and types during conversion where the target format allows it.

### 🛠️ Utilities & Archiving
Advanced tools for file management:
- **Batch Conversion:** Process entire folders/lists in parallel.
- **File Inspection:** Instant metadata and format-aware summaries for images, structured data, and markup.
- **File Inspection:** Instant metadata, suggested targets, and format-aware summaries for images, structured data, and markup.
- **Preview Mode:** See the planned output path before writing anything.
- **Smart Suggestions:** Invalid conversion requests return suggested targets for the detected file family.
- **Gzip & Zip**: Native compression/decompression.
- **PDF Text Extraction:** Read plain-text from PDFs.

## 🔀 Conversion Policy

Supported file families:
- **Image:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.tiff`
- **Structured:** `.json`, `.yaml`, `.yml`, `.csv`, `.xlsx`, `.toml`, `.xml`
- **Markup:** `.md`, `.html`

Cross-family conversion is intentionally blocked. For example, an image cannot be converted to JSON, and structured data cannot be converted to WebP.

The shared routing layer is used by conversion, batch conversion, and inspection so the server makes consistent decisions everywhere.

When a conversion is invalid, the server now suggests valid target formats for the source file family, such as WebP/AVIF for images or YAML/JSON for structured files.
Inspection results also include suggested target formats so an agent can pick the next conversion without another lookup.

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) installed locally.
- OR Docker for containerized usage.

### Installation
```bash
git clone https://github.com/pouyasadri/mcp-file-converter.git
cd mcp-file-converter
bun install
```

### Running Locally
```bash
bun start
```

## 🛠️ MCP Configuration

### Claude Desktop
Add this to your `claude_desktop_config.json`:

#### Using Bun (Local)
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

#### Using Docker (Recommended)
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
> [!IMPORTANT]
> Change `/Users/yourname/Documents` to the local directory you want the AI to access. Inside the container, this will be mapped to `/data`.

## 🧪 Development & Testing

Run the test suite using Bun's native test runner:
```bash
bun test
```

## 📦 CI/CD & Deployment
This project uses GitHub Actions to:
1. Run automated tests on every push.
2. Build and publish a Docker image to **GitHub Container Registry (GHCR)**.

## 📄 License
MIT
