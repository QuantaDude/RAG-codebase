import { Llama } from "node-llama-cpp";
import { CodeItem } from "../types";
import { ChunkInsert } from "../db/schemas/codebase";

export type EncoderService = {
  indexFile: (code: CodeItem[], codebaseId: string) => Promise<ChunkInsert[]>;
}

export default async function createEncoderService(llama: Llama) {

  const model = await llama.loadModel({
    modelPath: "./models/jina-code-embeddings-0.5b-BF16.gguf",
    gpuLayers: 0,
  });

  function toEmbeddingDocument(item: CodeItem): string {
    const parameters =
      item.parameters.length === 0
        ? "none"
        : item.parameters
          .map(p => `${p.name} (${p.type})`)
          .join(", ");

    return `
    Function name: ${item.name}
    Type: ${item.kind}
    Parameters: ${parameters}
    Return type: ${item.returnType}

    Code:
    ${item.code}
    `;
  }


  async function indexFile(code: CodeItem[], codebaseId: string): Promise<ChunkInsert[]> {
    const index: ChunkInsert[] = [];

    const context = await model.createEmbeddingContext();

    for (const item of code) {
      const document = toEmbeddingDocument(item);

      const embedding = await context.getEmbeddingFor(document);

      index.push({
        ...item,
        codebaseId: codebaseId,
        embedding: embedding.vector,
      });
    }

    return index;
  }

  return { indexFile } satisfies EncoderService;
}
