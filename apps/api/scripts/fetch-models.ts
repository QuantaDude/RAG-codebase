
import {
  access,
  mkdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

type Model = {
  name: string;
  url: string;
  filename: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const modelsDir = resolve(appRoot, "models");

const MAX_ATTEMPTS = 6;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 30_000;

const models: Model[] = [
  {
    name: "Qwen3-4B-Instruct-2507",
    url: "https://huggingface.co/DhruvalLabs/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-Q5_K_M.gguf",
    filename: "Qwen3-4B-Instruct-2507-Q5_K_M.gguf",
  },
{
  name: "Jina Code Embeddings 0.5B",
  url: "https://huggingface.co/jinaai/jina-code-embeddings-0.5b-GGUF/resolve/main/jina-code-embeddings-0.5b-BF16.gguf",
  filename: "jina-code-embeddings-0.5b-BF16.gguf",
},
];

const headers = {
  "accept-encoding": "identity",
  "user-agent": "RAG-codebase-model-downloader/1.0",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileSize(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

function parseSize(value: string | null): number | undefined {
  if (!value) return undefined;

  const size = Number(value);

  return Number.isSafeInteger(size) && size >= 0
  ? size
  : undefined;
}

function parseContentRange(
  value: string | null,
): { start: number; total?: number } | undefined {
  if (!value) return undefined;

  const match = /^bytes (\d+)-\d+\/(\d+|\*)$/i.exec(value);

  if (!match) return undefined;

  return {
    start: Number(match[1]),
    total: match[2] === "*" ? undefined : Number(match[2]),
  };
}

async function getRemoteSize(url: string): Promise<number | undefined> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers,
    });

    if (!response.ok) return undefined;

    return parseSize(response.headers.get("content-length"));
  } catch {
    // HEAD may be unsupported or temporarily unavailable.
    // The actual GET request can still succeed.
    return undefined;
  }
}

async function download(
  model: Model,
): Promise<void> {
  const output = resolve(modelsDir, model.filename);
  const partial = `${output}.part`;

  await mkdir(dirname(output), { recursive: true });

  const remoteSize = await getRemoteSize(model.url);
  let existingSize = await fileSize(output);

  if (
    existingSize !== undefined &&
    remoteSize !== undefined &&
    existingSize === remoteSize
  ) {
    console.log(`✓ ${model.name} already exists and has the expected size`);
    return;
  }

  // Recover an incomplete file left by the previous downloader.
  if (existingSize !== undefined) {
    const partialSize = await fileSize(partial);

    if (
      partialSize === undefined &&
      (remoteSize === undefined || existingSize < remoteSize)
    ) {
      await rename(output, partial);
      console.log(`↻ Recovering partial download: ${model.name}`);
    } else {
      await rm(output, { force: true });
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      let offset = (await fileSize(partial)) ?? 0;

      if (remoteSize !== undefined && offset > remoteSize) {
        await rm(partial, { force: true });
        offset = 0;
      }

      if (remoteSize !== undefined && offset === remoteSize) {
        await rename(partial, output);
        console.log(`✓ ${model.name} downloaded`);
        return;
      }

      console.log(
        `↓ ${model.name}: attempt ${attempt}/${MAX_ATTEMPTS}` +
        (offset > 0 ? `, resuming at ${offset} bytes` : ""),
      );

      const requestHeaders: Record<string, string> = { ...headers };

      if (offset > 0) {
        requestHeaders.Range = `bytes=${offset}-`;
      }

      const response = await fetch(model.url, {
        redirect: "follow",
        headers: requestHeaders,
      });

      // Some servers respond with 416 if the partial file is already
      // complete, even when HEAD did not reveal the total size.
      if (response.status === 416) {
        const match = /^bytes \*\/(\d+)$/i.exec(
          response.headers.get("content-range") ?? "",
        );

        const total = match ? Number(match[1]) : undefined;

        if (total !== undefined && offset === total) {
          await rename(partial, output);
          console.log(`✓ ${model.name} downloaded`);
          return;
        }

        await rm(partial, { force: true });
        throw new Error("Range not satisfiable; restarting download");
      }

      if (!response.ok || !response.body) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      const isPartialResponse = response.status === 206;

      if (isPartialResponse) {
        const range = parseContentRange(
          response.headers.get("content-range"),
        );

        if (!range || range.start !== offset) {
          await rm(partial, { force: true });
          throw new Error(
            "Server returned an invalid Content-Range; restarting",
          );
        }
      }

      // A 200 response means the server ignored Range. Start over rather
      // than appending the whole file to the existing partial download.
      const writeMode =
      isPartialResponse && offset > 0 ? "a" : "w";

      const range = isPartialResponse
      ? parseContentRange(response.headers.get("content-range"))
      : undefined;

      const expectedSize =
      range?.total ??
      (isPartialResponse
      ? remoteSize
      : parseSize(response.headers.get("content-length")) ?? remoteSize);

      await pipeline(
        response.body as unknown as NodeJS.ReadableStream,
        createWriteStream(partial, { flags: writeMode }),
      );

      const downloadedSize = await fileSize(partial);

      if (downloadedSize === undefined) {
        throw new Error("Downloaded file was not created");
      }

      if (
        expectedSize !== undefined &&
        downloadedSize !== expectedSize
      ) {
        throw new Error(
          `Incomplete download: received ${downloadedSize} bytes, ` +
          `expected ${expectedSize}`,
        );
      }

      // The final filename is only published after a successful transfer.
      await rename(partial, output);

      console.log(
        `✓ ${model.name} downloaded (${(
          downloadedSize /
          1024 /
          1024
        ).toFixed(1)} MiB)`,
      );

      return;
    } catch (error) {
      const message =
      error instanceof Error ? error.message : String(error);

      console.error(`✗ ${model.name}: ${message}`);

      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `${model.name} failed after ${MAX_ATTEMPTS} attempts. ` +
          `Any partial download was retained for the next run.`,
          { cause: error },
        );
      }

      const delay = Math.min(
        INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1),
                             MAX_RETRY_DELAY_MS,
      );

      console.log(`Retrying in ${(delay / 1000).toFixed(0)} seconds...`);
      await sleep(delay);
    }
  }
}

async function main(): Promise<void> {
  console.log(`Models directory: ${modelsDir}\n`);

  // Download one large model at a time to reduce simultaneous network load.
  for (const model of models) {
    await download(model);
  }

  console.log("\n✓ All models are ready.");
}

main().catch((error: unknown) => {
  console.error("\nModel setup failed:");
  console.error(error);
  process.exitCode = 1;
});
