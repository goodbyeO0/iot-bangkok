import fs from "fs";
import path from "path";

async function getBase64Image(imageLocation) {
  const imagePath = path.resolve(imageLocation);
  return new Promise((resolve, reject) => {
    fs.readFile(imagePath, (err, data) => {
      if (err) {
        return reject(err);
      }
      const base64String = `data:image/png;base64,${data.toString("base64")}`;
      resolve(base64String); // This will be the base64 string
    });
  });
}

export default getBase64Image;
