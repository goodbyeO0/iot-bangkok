import getBase64Image from "./utils/base64_imageConverter.js";
import { getImagesFromDirectory } from "./utils/base64_imageConverter.js";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

// Initialize blockchain connection
dotenv.config();
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const contractABI = JSON.parse(
  readFileSync(join(__dirname, "ABI.json"), "utf8")
);

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

// Email configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Function to convert coordinates to blockchain format
const convertCoordinate = (coord) => {
  return Math.round(parseFloat(coord) * 1000000);
};

// Function to add violation to blockchain
async function addViolationToBlockchain(carData) {
  try {
    const latitude = convertCoordinate(carData.location.latitude);
    const longitude = convertCoordinate(carData.location.longitude);

    const tx = await contract.addViolationRecord(
      carData["License plate number"],
      carData.Color,
      carData.Brand,
      carData.timestamp,
      latitude,
      longitude
    );

    const receipt = await tx.wait();
    console.log("Blockchain transaction successful:", receipt.hash);

    // Send email notification after successful blockchain transaction
    try {
      const emailId = await sendViolationEmail(
        carData["License plate number"],
        carData,
        receipt.hash
      );
      console.log("Notification email sent:", emailId);
    } catch (emailError) {
      console.error("Failed to send email notification:", emailError);
      // Continue even if email fails
    }

    return receipt.hash;
  } catch (error) {
    console.error("Error adding violation to blockchain:", error);
    throw error;
  }
}

// Function to send violation email
async function sendViolationEmail(plateNumber, carData, transactionHash) {
  try {
    // Get email from blockchain
    const ownerEmail = await contract.getEmailByPlateNumber(plateNumber);

    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: ownerEmail,
      subject: "Traffic Violation Notice",
      html: `
                <h2>Traffic Violation Notice</h2>
                <p>Dear Vehicle Owner,</p>
                <p>A traffic violation has been recorded for your vehicle:</p>
                <ul>
                    <li>License Plate: ${carData["License plate number"]}</li>
                    <li>Vehicle: ${carData.Brand}</li>
                    <li>Color: ${carData.Color}</li>
                    <li>Time: ${carData.timestamp}</li>
                    <li>Location: ${carData.location.latitude}, ${carData.location.longitude}</li>
                </ul>
                <p>Blockchain Transaction: ${transactionHash}</p>
                <p>Please review this violation and take necessary action.</p>
                <br>
                <p>Best regards,</p>
                <p>Traffic Management System</p>
            `,
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return info.messageId;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

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

    // Add to blockchain after processing
    try {
      const transactionHash = await addViolationToBlockchain(responseData);
      responseData.blockchainTransactionHash = transactionHash;
    } catch (blockchainError) {
      console.error("Blockchain error:", blockchainError);
      // Continue with response even if blockchain fails
    }

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
