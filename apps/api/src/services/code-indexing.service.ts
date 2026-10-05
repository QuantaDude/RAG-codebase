import Stream from "node:stream";
import yz from "yauzl";

export type IndexingService = {
  readZipFile: (file: Buffer) => void;
};

export function CreateCodeIndexingService() {

  async function readZipFile(file: Buffer) {

    const result = await yz.fromBufferPromise(file, { lazyEntries: true });
    console.log(result.fileSize);
    for await (let entry of result.eachEntry()) {
      if (entry.fileName.endsWith('/')) {
        console.log("directory:", entry.fileName);
      } else {
        console.log("file:", entry.fileName);
        const readStream = await result.openReadStreamPromise(entry);
         //await Stream.promises.pipeline(readStream, somewhere);
      }
    }
  }

  return {
    readZipFile
  } satisfies IndexingService;
}
