import { ethers } from 'ethers';
import dotenv from 'dotenv';
import contractABI from './ABI.json' assert { type: "json" };  // Import ABI from JSON file

dotenv.config();

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// Initialize provider and contract with imported ABI
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, wallet);

// Function to convert coordinates to blockchain format
const convertCoordinate = (coord) => {
    return Math.round(parseFloat(coord) * 1000000);
};

async function addViolationToBlockchain(carData) {
    try {
        // Convert coordinates to blockchain format
        const latitude = convertCoordinate(carData.location.latitude);
        const longitude = convertCoordinate(carData.location.longitude);

        // Call the smart contract function
        const tx = await contract.addViolationRecord(
            carData["License plate number"],
            carData.Color,
            carData.Brand,
            carData.timestamp,
            latitude,
            longitude
        );

        // Wait for transaction to be mined
        const receipt = await tx.wait();
        console.log('Transaction successful:', receipt.hash);
        return receipt.hash;

    } catch (error) {
        console.error('Error adding violation to blockchain:', error);
        throw error;
    }
}

// Example usage:
const data = {
    "Color": "Light blue",
    "Brand": "McLaren",
    "License plate number": "ALE121",
    "timestamp": "2024-11-16T20:10:17.000Z",
    "location": {
        "latitude": 13.754,
        "longitude": 100.5014
    }
};

// Call the function
addViolationToBlockchain(data)
    .then(hash => console.log('Transaction hash:', hash))
    .catch(error => console.error('Failed:', error));