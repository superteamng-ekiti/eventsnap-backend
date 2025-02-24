import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { PythonShell } from "python-shell";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import cors from "cors";
import { uploadRouter } from "./routes/upload.js";
import { PinataSDK } from "pinata-web3";
import {
  PINATA_APIKey,
  PINATA_GATEWAY,
  PINATA_JWT
} from "./globals.environment.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(
  cors({
    origin: "*"
  })
);

app.use(express.json());
app.use(bodyParser.json({ limit: "10mb" }));

app.use("/api", uploadRouter);

// Python interpreter
const PYTHON_PATH = path.join(__dirname, ".venv", "bin", "python3");
// The face_recognition script
const SCRIPT_PATH = path.join(__dirname, "face_rec.py");
// Face match threshold
const MATCH_THRESHOLD = 0.6;

// Allowed extensions: you can add or remove as needed
const ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".heic",
  ".gif",
  ".bmp",
  ".webp"
];

export const pinata = new PinataSDK({
  pinataJwt: PINATA_JWT,
  pinataGateway: PINATA_GATEWAY,
  pinataGatewayKey: PINATA_APIKey
});

app.get("/compare-faces", async (req, res) => {
  try {
    const selfieUrl = req.query.selfie_url;
    const eventUrl = req.query.image_url;

    console.log([selfieUrl, eventUrl]);

    if (!selfieUrl || !eventUrl) {
      return res
        .status(400)
        .json({ error: "Please provide selfie_url and image_url" });
    }

    // 1) Validate the extension
    if (!isValidImageExtension(selfieUrl) || !isValidImageExtension(eventUrl)) {
      return res
        .status(400)
        .json({ error: "Invalid image extension. Must be png/jpg/heic, etc." });
    }

    // 3) Download the images to temp files
    const tempSelfiePath = await downloadImageToTempFile(selfieUrl, "selfie");
    const tempEventPath = await downloadImageToTempFile(eventUrl, "event");

    // 4) Run the Python script
    const results = await PythonShell.run(SCRIPT_PATH, {
      pythonPath: PYTHON_PATH,
      args: [tempSelfiePath, tempEventPath]
    });

    // 5) Clean up temp files
    fs.unlinkSync(tempSelfiePath);
    fs.unlinkSync(tempEventPath);

    // 6) Check Python output
    if (!results || results.length === 0) {
      return res.status(500).send("No output from Python");
    }
    const output = results[0];
    console.log("Python Output:", output);

    if (output === "NO_SELFIE") {
      return res.send("No face found in the selfie image");
    } else if (output === "NO_COMPARE") {
      return res.send("No face found in the event image");
    }

    // 7) Parse distance & respond
    const distance = parseFloat(output);
    const isMatch = distance < MATCH_THRESHOLD;
    return res.json({ distance, isMatch });
  } catch (error) {
    console.error("Error in /compare-faces:", error);
    return res.status(500).send("Error processing request");
  }
});

/**
 * Checks if the URL ends with a known valid image extension.
 */
function isValidImageExtension(url) {
  const lowerUrl = url.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lowerUrl.endsWith(ext));
}

async function downloadImageToTempFile(imageUrl, prefix) {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer"
  });
  const tempFilePath = path.join(os.tmpdir(), `${prefix}-${Date.now()}.jpg`);
  fs.writeFileSync(tempFilePath, Buffer.from(response.data));
  return tempFilePath;
}

app.listen(3000, async () => {
  console.log("Server running on http://localhost:3000");
});
