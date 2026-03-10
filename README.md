# 🔄 MCP File Converter

[![CI/CD](https://github.com/pouyasadri/mcp-file-converter/actions/workflows/ci.yml/badge.svg)](https://github.com/pouyasadri/mcp-file-converter/actions/workflows/ci.yml)
[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue.svg)](https://github.com/pouyasadri/mcp-file-converter/pkgs/container/mcp-file-converter)

A high-performance **Model Context Protocol (MCP)** server designed for seamless file transformations. Empowers AI agents to convert images and structured data formats through simple tool calls.

Built with [Bun](https://bun.sh/) for maximum speed and efficiency.

## ✨ Features

### 🖼️ Image Conversion
Powered by **Sharp**, supporting high-quality transformations between:
- **Formats**: PNG, JPG, WebP, AVIF, TIFF.
- **Auto-optimization**: Intelligent defaults for web-ready assets.

### 📊 Data & Markup Transformation
Effortless switching between common data and markup structures:
- **JSON ↔️ YAML ↔️ CSV ↔️ XLSX (Excel)**
- **Markdown ↔️ HTML**
- Preserves structure and types during conversion.

### 📄 PDF Document Parsing
- **PDF Text Extraction:** Easily read the plain-text content inside any PDF.

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

For manual testing of the conversion logic:
```bash
bun run test-conversion.ts
```

## 📦 CI/CD & Deployment
This project uses GitHub Actions to:
1. Run automated tests on every push.
2. Build and publish a Docker image to **GitHub Container Registry (GHCR)**.

## 📄 License
MIT
