import getBase64Image from "./utils/base64_imageConverter.js";
import { getImagesFromDirectory } from "./utils/base64_imageConverter.js";

import express from "express";
const app = express();
const port = 3005;
let latestCarData = null;

app.get("/api/carData", async (req, res) => {  // 1. Fixed route path (added leading slash)
  try {
    if (!latestCarData) {  // 2. Added check for existing data
      await processImages();
    }
    
    if (!latestCarData) {  // 3. Added check after processing
      throw new Error('Failed to process car data');
    }
    
    res.status(200).json(latestCarData);
  } catch (error) {
    console.error("Error fetching car data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


async function query(data) {
  const response = await fetch(
    "http://localhost:3000/api/v1/prediction/722a1f44-d0d1-42ad-b2c6-01f73fa44fb3",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  const result = await response.json();
  return result;
}

function filenameToUTCDate(filename) {
    // Direct parsing of 20241115_163029 format
    const year = filename.substr(0, 4);
    const month = filename.substr(4, 2);
    const day = filename.substr(6, 2);
    const hour = filename.substr(9, 2);
    const minute = filename.substr(11, 2);
    const second = filename.substr(13, 2);

    return new Date(Date.UTC(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
    ));
}

async function processImages() {
  const imageFiles = await getImagesFromDirectory("./images/imageTest");
  const allResults = [];

  for (const imageFile of imageFiles) {
    try {
      // Directly use the filename as it's already in the correct format
      const timestamp = filenameToUTCDate(imageFile);

      const result = await query({
        question:
          "Please identify the following details of the car in the image: 1. Color 2. Brand 3. License plate number. Format the response as JSON.",
        uploads: [
          {
            data: await getBase64Image(`images/imageTest/${imageFile}`),
            type: "file",
            name: imageFile,
            mime: "image/png",
          },
        ],
      });

      if (!result || !result.text) {
        console.error(`Invalid API response for ${imageFile}:`, result);
        continue;
      }

      const jsonString = result.text.replace(/```json\n|\n```/g, "").trim();
      const parsedResult = JSON.parse(jsonString);
      
      // Add timestamp to the result
      parsedResult.timestamp = timestamp.toISOString();
      parsedResult.filename = imageFile;
      
      allResults.push(parsedResult);
    } catch (error) {
      console.error(`Error processing ${imageFile}:`, error);
    }
  }

  const finalResult = {
    Color: allResults[0].Color,
    Brand:
      allResults.find((r) => 
        r.Brand && 
        r.Brand !== "Unknown" && 
        !r.Brand.toLowerCase().includes("do not know") &&
        !r.Brand.toLowerCase().includes("cannot")
      )?.Brand || "Unknown",
    "License plate number":
      allResults.find(
        (r) =>
          r["License plate number"] && 
          r["License plate number"] !== "Unknown" &&
          !r["License plate number"].toLowerCase().includes("do not know")
      )?.["License plate number"] || "Unknown",
    timestamp: allResults[0].timestamp
  };

  latestCarData = finalResult;
  console.log("Final Result:", JSON.stringify(finalResult, null, 2));
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
