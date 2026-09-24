import yz from "yauzl";

export type IndexingService = {
  readZipFile: (file: Buffer) => void;
};

export function CreateCodeIndexingService() {

  async function readZipFile(file: Buffer) {

    const result = await yz.fromBufferPromise(file, { lazyEntries: true });
    console.log(result.fileSize);
  }

  return {
    readZipFile
  } satisfies IndexingService;
}
