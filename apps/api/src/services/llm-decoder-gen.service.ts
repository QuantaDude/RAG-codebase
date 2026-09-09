import { ChatHistoryItem, Llama, LlamaChatSession, LlamaContext, LlamaContextSequence } from "node-llama-cpp";
import fs from "node:fs/promises";

export type DecoderService = {
  createChatContext: (id?: string) => Promise<{ context: LlamaContext, session: LlamaChatSession }>;
  saveChatHistory: (id: string, session: LlamaChatSession) => Promise<void>;
  saveChatContext: (id: string, sequence: LlamaContextSequence) => Promise<number>;
};

async function createDecoderService(llamaInstance: Llama) {

  //need LRU cache map and timeout to remove the least recently used
  const model = await llamaInstance.loadModel({
    modelPath: './models/Qwen3-4B-Instruct-2507-Q5_K_M.gguf',
    gpuLayers: 16
  });

  async function saveChatContext(id: string, sequence: LlamaContextSequence): Promise<number> {
    return (await sequence.saveStateToFile(`./chats/${id}-state.bin`)).fileSize;

  }
  async function saveChatHistory(id: string, session: LlamaChatSession): Promise<void> {

    const chatHistory: ChatHistoryItem[] = session.getChatHistory();

    await fs.writeFile(`./chats/${id}-history.json`, JSON.stringify(chatHistory), "utf8");

  }

  async function createChatContext(id?: string): Promise<{ context: LlamaContext, session: LlamaChatSession }> {

    const context = await model.createContext();
    const sequence = context.getSequence();

    id && id != "" ? await sequence.loadStateFromFile(`./chats/${id}-state.bin`, { acceptRisk: true }) : undefined;

    const session = new LlamaChatSession({ contextSequence: sequence });

    const history = id && id.length != 0 ? JSON.parse(await fs.readFile(`./chats/${id}-history.json`, "utf8")) : undefined;


    session.setChatHistory(history ?? []);

    return { context, session };
  }


  return {
    saveChatContext,
    saveChatHistory,
    createChatContext
  } satisfies DecoderService;
}

export { createDecoderService };
