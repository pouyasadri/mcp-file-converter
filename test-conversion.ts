import { readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

console.log("Starting local conversion test...");

try {
  const inputPath = join(process.cwd(), "sample.json");
  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "convert_file",
      arguments: {
        inputPath: inputPath,
        targetExtension: ".yaml",
        overwrite: false
      }
    }
  });

  console.log(`Sending request for ${inputPath} to .yaml`);
  // Pipe the request into the server and get the output
  const output = execSync(`echo '${request}' | bun run src/index.ts`, { 
    encoding: 'utf8', 
    stdio: ['pipe', 'pipe', 'ignore'],
    input: request
  });
  
  console.log("Server response received.");

  const outputPath = join(process.cwd(), "sample.yaml");
  const yamlContent = await readFile(outputPath, "utf-8");
  console.log("Converted YAML content:\n" + yamlContent);

  console.log("Test completed successfully!");
} catch (error) {
  console.error("Test failed:", error);
}
