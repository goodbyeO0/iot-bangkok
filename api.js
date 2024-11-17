import getBase64Image from "./utils/base64_imageConverter.js";
import { getImagesFromDirectory } from "./utils/base64_imageConverter.js";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import express from "express";
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
const port = 3005;
let latestCarData = null;
let locationData = null;

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

app.get("/api/violations", async (req, res) => {
    try {
        // Get all plate numbers with violations
        const plateNumbers = await contract.getAllPlateNumbersWithViolations();
        
        // Create array to store all violation data
        const allViolations = [];

        // Get violations for each plate number
        for (const plateNumber of plateNumbers) {
            try {
                // Get violations for this plate number
                const violations = await contract.getAllViolationsForPlateNumber(plateNumber);
                
                // Get email for this plate number
                const ownerEmail = await contract.getEmailByPlateNumber(plateNumber);

                // Format violations data
                const formattedViolations = violations.map(violation => ({
                    plateNumber: plateNumber,
                    ownerEmail: ownerEmail,
                    color: violation.color,
                    brand: violation.brand,
                    timestamp: violation.timestamp,
                    isPaid: violation.isPaid,
                    fineAmount: violation.fineAmount.toString(), // Convert BigNumber to string
                    location: {
                        latitude: parseFloat(violation.latitude.toString()) / 1000000, // Convert back from blockchain format
                        longitude: parseFloat(violation.longitude.toString()) / 1000000
                    }
                }));

                allViolations.push(...formattedViolations);
            } catch (error) {
                console.error(`Error processing violations for plate ${plateNumber}:`, error);
                // Continue with next plate number
            }
        }

        // Sort violations by timestamp (most recent first)
        allViolations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Create summary statistics
        const summary = {
            totalViolations: allViolations.length,
            totalUnpaidViolations: allViolations.filter(v => !v.isPaid).length,
            totalFineAmount: allViolations.reduce((sum, v) => sum + parseInt(v.fineAmount), 0),
            uniquePlateNumbers: plateNumbers.length
        };

        res.status(200).json({
            summary,
            violations: allViolations
        });

    } catch (error) {
        console.error("Error fetching violations:", error);
        res.status(500).json({ 
            error: "Failed to fetch violations",
            details: error.message 
        });
    }
});

// Add new endpoint for violation analysis
app.get("/api/violations/analysis", async (req, res) => {
    try {
        // First get all violations data
        const plateNumbers = await contract.getAllPlateNumbersWithViolations();
        const allViolations = [];

        // Collect violations data
        for (const plateNumber of plateNumbers) {
            try {
                const violations = await contract.getAllViolationsForPlateNumber(plateNumber);
                const formattedViolations = violations.map(violation => ({
                    plateNumber: plateNumber,
                    timestamp: violation.timestamp,
                    location: {
                        latitude: parseFloat(violation.latitude.toString()) / 1000000,
                        longitude: parseFloat(violation.longitude.toString()) / 1000000
                    }
                }));
                allViolations.push(...formattedViolations);
            } catch (error) {
                console.error(`Error processing violations for plate ${plateNumber}:`, error);
            }
        }

        // Format data for AI analysis
        const analysisData = {
            totalViolations: allViolations.length,
            violations: allViolations.map(v => ({
                time: new Date(v.timestamp).toLocaleTimeString(),
                date: new Date(v.timestamp).toLocaleDateString(),
                location: `${v.location.latitude}, ${v.location.longitude}`
            }))
        };

        // Query Flowise AI for analysis
        const aiResponse = await fetch(
            "http://localhost:3000/api/v1/prediction/722a1f44-d0d1-42ad-b2c6-01f73fa44fb3",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: `Please analyze this traffic violation data and provide:
                        1. Violation trends
                        2. Peak times for violations
                        3. Hotspot locations for red-light running
                        4. Suggested preventative measures
                        
                        Data: ${JSON.stringify(analysisData, null, 2)}`,
                    uploads: []
                })
            }
        );

        const analysis = await aiResponse.json();

        // Format and send response
        res.status(200).json({
            rawData: analysisData,
            analysis: analysis.text
        });

    } catch (error) {
        console.error("Error analyzing violations:", error);
        res.status(500).json({
            error: "Failed to analyze violations",
            details: error.message
        });
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
