import dotenv from "dotenv";
import fs from "fs";
import path from "path";

console.log("Load environment variables");

const dotenvPath = path.resolve(".env");

[`${dotenvPath}.local`, dotenvPath].forEach((dotenvFile) => {
  if (fs.existsSync(dotenvFile)) {
    console.log("Load config", dotenvFile);
    dotenv.config({ path: dotenvFile });
  }
});
