import { Llama, LlamaChatSession, LlamaContext, LlamaContextSequence } from "node-llama-cpp";

export type DecoderService = {
  createChatContext: (id?: string) => Promise<LlamaContext>;
  saveChatHistory: (session: LlamaChatSession) => void;
  saveChatContext: (sequence: LlamaContextSequence) => void;
};

function createDecoderService(llamaInstance: Llama) {

  const model = llamaInstance.loadModel({
    modelPath: './models/Qwen3-4B-Instruct-2507-Q5_K_M.gguf',
    gpuLayers: 16
  });


}
