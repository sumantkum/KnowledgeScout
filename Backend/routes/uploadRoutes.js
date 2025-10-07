import express from "express";
import { createRequire } from "module";
import Document from "../models/Document.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const file = req.files.file;
    // Check if file is PDF
    if (file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: "Only PDF files are supported" });
    }

    const data = await pdfParse(file.data);

    const newDoc = new Document({
      filename: file.name,
      content: data.text
    });
    
    await newDoc.save();
    res.json({ 
      message: "File uploaded and saved!", 
      id: newDoc._id,
      filename: file.name
    });

  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Error uploading document" });
  }
});

export default router;