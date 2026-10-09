import Stream from "node:stream";
import fs from "node:fs";
import yz from "yauzl";

export type IndexingService = {
  readZipFile: (file: Buffer) => void;
};

export function CreateCodeIndexingService() {

  async function readZipFile(file: Buffer) {
    yz.open
    const result = await yz.fromBufferPromise(file, { lazyEntries: true });
    console.log(result.fileSize);
    for await (let entry of result.eachEntry()) {
      if (entry.fileName.endsWith('/')) {
        console.log("directory:", entry.fileName);
      } else {
        console.log("file:", entry.fileName);
        const readStream = await result.openReadStreamPromise(entry);
        // await Stream.promises.pipeline(readStream, fs.createWriteStream(entry.fileName));
        readStream.on("data", (data) => {
          console.log(data.toString());
        });
        readStream.on("end", () => { console.log("=======\n=====\n========\nnew file:\n") });
      }
    }
    result.once("end", () => {
      console.log("END OF ZIP FILE.");
      result.close();
    })
  }

  return {
    readZipFile
  } satisfies IndexingService;
}
