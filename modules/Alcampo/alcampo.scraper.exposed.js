import fs from "fs";

export async function exposeReadFile(page) {
  await page.exposeFunction("readFile", async (filePath) => {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
  });
}

export async function exposeWriteFile(page) {
  await page.exposeFunction("writeFile", async (filePath, data) => {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, () => {
        resolve();
      });
    });
  });
}