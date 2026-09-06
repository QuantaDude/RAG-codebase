import { open } from "node:fs/promises";
import { Buffer } from "node:buffer";

function parseValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;

  const num = Number(value);

  if (!Number.isNaN(num)) {
    return num;
  }

  return value;
}

export default async function ParseDotEnv(): Promise<Record<string, string | number | boolean | undefined>> {

  const keyRegExp = new RegExp('^[a-zA-Z_]+[a-zA-Z0-9_]*$');
  const env: Record<string, string | number | boolean | undefined> = {};
  const file = process.env.BUILD == "release" ? await open('./.env') : await open('./.env.development');
  console.log(process.env.BUILD);
  try {
    const buffer = Buffer.alloc(256);

    const contents = await file.read({ buffer: buffer, length: 256 });
    const lines = contents.buffer.toString().split('\n');
    const keyval_pairs = lines.map((e) => e.split('='));
    keyval_pairs.forEach((pair, idx) => {

      const key = pair[0];
      if (typeof key == "string") {
        if (key.match(keyRegExp)) {
          env[key] = pair[1] ? parseValue(pair[1]) : undefined;
        }
      }
    });
  } finally {

    await file.close();
  }


  return env;
}
