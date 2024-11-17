# Traffic Light Violation Detection System

A system that captures and processes traffic light violations using a Raspberry Pi camera and blockchain technology.

## Components

### 1. Camera Module (test_camera.py)

- Controls a Raspberry Pi camera and LED traffic lights
- Captures image sequences when vehicles run red lights
- Features:
  - Green/Red light simulation
  - Automatic image capture sequence
  - Location tracking
  - API communication

### 2. Backend Server (api.js)

- Processes captured images and manages violation data
- Integrates with blockchain for violation recording
- Key features:
  - AI-powered vehicle detection (color, brand, license plate)
  - Blockchain integration for violation records
  - Email notifications to vehicle owners
  - Violation analysis and statistics
  - RESTful API endpoints

## Setup

1. Install dependencies: npm install express ethers nodemailer cors dotenv
2. Configure environment variables:

- Create a `.env` file with:
  - `RPC_URL`: Blockchain RPC URL
  - `PRIVATE_KEY`: Wallet private key
  - `CONTRACT_ADDRESS`: Smart contract address
  - `EMAIL_USER`: Gmail address
  - `EMAIL_PASSWORD`: Gmail app password

3. Connect hardware:

- Connect Raspberry Pi camera
- Connect LEDs:
  - Green LED to GPIO 17
  - Red LED to GPIO 27

## Usage

1. Start the backend server: node api.js
2. Run the camera module: python test_camera.py

## API Endpoints

- `POST /api/location`: Submit location data
- `GET /api/carData`: Retrieve processed vehicle data
- `GET /api/violations`: Get all recorded violations
- `GET /api/violations/analysis`: Get AI-powered violation analysis
