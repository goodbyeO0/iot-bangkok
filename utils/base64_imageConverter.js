import fs from "fs";
import path from "path";

async function getBase64Image(imageLocation) {
  const imagePath = path.resolve(imageLocation);
  return new Promise((resolve, reject) => {
    fs.readFile(imagePath, (err, data) => {
      if (err) {
        return reject(err);
      }
      // Determine the mime type based on file extension
      const ext = path.extname(imageLocation).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 
                      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 
                      'image/png'; // default to png
      
      const base64String = `data:${mimeType};base64,${data.toString("base64")}`;
      resolve(base64String);
    });
  });
}

// New function to get all images from a directory
function getImagesFromDirectory(dirPath) {
  return new Promise((resolve, reject) => {
    fs.readdir(dirPath, (err, files) => {
      if (err) {
        return reject(err);
      }
      // Filter for image files
      const imageFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.png', '.jpg', '.jpeg'].includes(ext);
      });
      resolve(imageFiles);
    });
  });
}

export { getBase64Image, getImagesFromDirectory };
export default getBase64Image;
