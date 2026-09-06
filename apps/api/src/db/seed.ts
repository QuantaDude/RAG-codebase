import initDB from ".";
import ParseDotEnv from "../utils";


Object.assign(process.env, await ParseDotEnv());

const main = async () => {

  const db = initDB();

  // const data = 

};


