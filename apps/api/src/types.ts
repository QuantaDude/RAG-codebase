type CodeItem = {
  // id: number;
  name: string;
  kind: "function" | "class" | "method";
  parameters: {
    name: string;
    type: string;
  }[];
  returnType: string;
  code: string;
};

type IndexedCodeItem = CodeItem & {
  embedding: number[];
};

export type { CodeItem, IndexedCodeItem };
