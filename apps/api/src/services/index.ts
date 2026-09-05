export type CodeItem = {
  id: number;
  name: string;
  kind: "function";
  parameters: {
    name: string;
    type: string;
  }[];
  returnType: string;
  code: string;
};


