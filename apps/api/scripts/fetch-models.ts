import { mkdir, access } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const models = [
  {
    name: "Qwen3-4B-Instruct-2507",
    url: "https://huggingface.co/DhruvalLabs/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q5_K_M.gguf",
    output: "models/Qwen3-4B-Instruct-2507-Q5_K_M.gguf",
  },
  {
    name: "Jina Code Embeddings 0.5B",
    url: "https://huggingface.co/jinaai/jina-code-embeddings-0.5b-GGUF/resolve/main/jina-code-embeddings-0.5b-BF16.gguf",
    output: "models/jina-code-embeddings-0.5b-BF16.gguf",
  },
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(name: string, url: string, output: string): Promise<void> {
  const path = resolve(output);

  if (await exists(path)) {
    console.log(`✓ ${name} already exists`);
    return;
  }

  await mkdir(dirname(path), { recursive: true });

  console.log(`↓ Downloading ${name}...`);

  const response = await fetch(url, {
    redirect: "follow",
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Failed to download ${name}: ${response.status} ${response.statusText}`,
    );
  }

  const file = createWriteStream(path);

  await pipeline(
    response.body as unknown as NodeJS.ReadableStream,
    file,
  );

  console.log(`✓ ${name} downloaded`);
}

async function main() {
  await Promise.all(
    models.map((model) =>
      download(model.name, model.url, model.output),
    ),
  );

  console.log("\nAll models are ready.");
}

main().catch((error) => {
  console.error("\nModel download failed:");
  console.error(error);
  process.exit(1);
});
