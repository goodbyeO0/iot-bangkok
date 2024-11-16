import getBase64Image from "./utils/base64_imageConverter.js";
import { getImagesFromDirectory } from "./utils/base64_imageConverter.js";

import express from "express";
const app = express();
app.use(express.json());
const port = 3005;
let latestCarData = null;
let locationData = null;

app.post("/api/location", (req, res) => {
  try {
    locationData = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
    };
    console.log("Received location data:", locationData);
    res.status(200).json({ message: "Location data received" });
  } catch (error) {
    console.error("Error processing location data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/carData", async (req, res) => {
  try {
    if (!latestCarData) {
      await processImages();
    }

    if (!latestCarData) {
      throw new Error("Failed to process car data");
    }

    const responseData = {
      ...latestCarData,
      ...(locationData && { location: locationData }),
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching car data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function query(data) {
  const response = await fetch(
    "http://localhost:3000/api/v1/prediction/6b41eae7-02c7-44ed-b947-a043fba9d72e",
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

function directoryNameToUTCDate(dirName) {
  // Remove 'session_' prefix and parse timestamp from format session_YYYYMMDD_HHMMSS
  const timestamp = dirName.replace("session_", ""); // Remove 'session_' prefix
  const year = timestamp.substr(0, 4);
  const month = timestamp.substr(4, 2);
  const day = timestamp.substr(6, 2);
  const hour = timestamp.substr(9, 2);
  const minute = timestamp.substr(11, 2);
  const second = timestamp.substr(13, 2);

  return new Date(
    Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    )
  );
}

async function processImages() {
  const imageFiles = await getImagesFromDirectory(
    "./images/session_20241116_201017"
  );
  const allResults = [];

  // Get directory name and convert to timestamp
  const dirPath = "./images/session_20241116_201017";
  const dirName = dirPath.split("/").pop(); // Gets "session_20241116_201017"
  const timestamp = directoryNameToUTCDate(dirName);

  for (const imageFile of imageFiles) {
    try {
      const result = await query({
        question:
          "Please identify the following details of the car in the image: 1. Color 2. Brand 3. License plate number. Format the response as JSON.",
        uploads: [
          {
            data: await getBase64Image(
              `images/session_20241116_201017/${imageFile}`
            ),
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

      // Use the directory timestamp for all results
      parsedResult.timestamp = timestamp.toISOString();

      allResults.push(parsedResult);
    } catch (error) {
      console.error(`Error processing ${imageFile}:`, error);
    }
  }

  const finalResult = {
    Color: allResults[0].Color,
    Brand:
      allResults.find(
        (r) =>
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
    timestamp: allResults[0].timestamp,
    location: locationData,
  };

  latestCarData = finalResult;
  console.log("Final Result:", JSON.stringify(finalResult, null, 2));
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
