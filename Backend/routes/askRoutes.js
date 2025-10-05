import express from "express";
import Document from "../models/Document.js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// Function to split content into chunks that fit within Gemini's token limits
function splitContentIntoChunks(content, maxChunkSize = 25000) {
  const chunks = [];
  let currentChunk = "";
  const sentences = content.split('. ');
  
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = sentence + '. ';
      } else {
        // If a single sentence is too long, split by words
        const words = sentence.split(' ');
        currentChunk = "";
        for (const word of words) {
          if ((currentChunk + word).length > maxChunkSize) {
            chunks.push(currentChunk);
            currentChunk = word + ' ';
          } else {
            currentChunk += word + ' ';
          }
        }
      }
    } else {
      currentChunk += sentence + '. ';
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Function to clean and prepare content for API
function cleanContent(content) {
  return content
    .replace(/[^\x20-\x7E\n\r]/g, '') // Remove non-printable characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 30000); // Hard limit of 30,000 characters
}

router.post("/", async (req, res) => {
  console.log("📥 Received ask request:", req.body);
  
  try {
    const { question, docId } = req.body;

    // Validate input
    if (!question || !docId) {
      return res.status(400).json({ error: "Question and document ID are required" });
    }

    console.log("🔍 Looking for document:", docId);
    const document = await Document.findById(docId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    console.log("✅ Document found, content length:", document.content.length);
    
    // Check if content is not empty
    if (!document.content || document.content.trim().length === 0) {
      return res.status(400).json({ error: "Document content is empty" });
    }

    // Clean and prepare the content
    const cleanedContent = cleanContent(document.content);
    console.log("🧹 Cleaned content length:", cleanedContent.length);

    // Using Google Gemini API
    const prompt = `You are a document assistant. Answer the user's question based ONLY on the provided text.
If the answer cannot be found in the text, say "I cannot find the answer in the document."

IMPORTANT: The document might be truncated due to length limitations. Answer based on what you can read.

Document content: ${cleanedContent}

Question: ${question}

Answer:`;

    console.log("🚀 Sending request to Google Gemini...");
    console.log("📝 Prompt length:", prompt.length);
    
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    // Add timeout and better error handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 1000,
          temperature: 0.3
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    console.log("📨 Gemini response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("❌ Gemini API error:", response.status, errorText);
      
      let errorMessage = `Gemini API error: ${response.status}`;
      
      if (response.status === 400) {
        if (errorText.includes("content")) {
          errorMessage = "Document content is too long or contains unsupported content. Try uploading a shorter document or one with simpler formatting.";
        } else if (errorText.includes("token")) {
          errorMessage = "Document is too long. Please upload a shorter document (under 10 pages).";
        } else {
          errorMessage = "Bad request. The document might be too long or contain complex formatting.";
        }
      } else if (response.status === 403) {
        errorMessage = "API key rejected. Please check your Google API key and ensure Gemini API is enabled.";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again in a moment.";
      } else if (response.status === 500) {
        errorMessage = "Google API server error. Please try again later.";
      }
      
      return res.status(response.status).json({ 
        error: errorMessage,
        details: `Content length: ${cleanedContent.length} characters`
      });
    }

    const data = await response.json();
    console.log("✅ Gemini response received");
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const answer = data.candidates[0].content.parts[0].text;
      
      // Add a note if content was truncated
      let finalAnswer = answer;
      if (cleanedContent.length < document.content.length) {
        finalAnswer += `\n\n*Note: The document was truncated due to length limitations. Some content may not be available for questioning.*`;
      }
      
      res.json({ 
        answer: finalAnswer,
        model: "gemini-pro",
        contentLength: cleanedContent.length,
        originalLength: document.content.length
      });
    } else {
      console.log("❌ Unexpected response format from Gemini:", data);
      throw new Error("Unexpected response format from Gemini API");
    }

  } catch (error) {
    console.error("💥 Ask error:", error);
    
    // More specific error handling
    if (error.name === 'AbortError') {
      return res.status(408).json({ 
        error: "Request timeout - The AI took too long to respond. Try a shorter document or simpler question." 
      });
    }
    
    if (error.message.includes('fetch failed')) {
      return res.status(503).json({ 
        error: "Cannot connect to Google API. Check your internet connection." 
      });
    }
    
    res.status(500).json({ 
      error: "Error answering question",
      details: error.message 
    });
  }
});

// Alternative endpoint for longer documents (processes in chunks)
router.post("/ask-long", async (req, res) => {
  try {
    const { question, docId } = req.body;

    if (!question || !docId) {
      return res.status(400).json({ error: "Question and document ID are required" });
    }

    const document = await Document.findById(docId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // For very long documents, use a different approach
    const cleanedContent = cleanContent(document.content);
    const contentChunks = splitContentIntoChunks(cleanedContent, 15000);
    
    console.log(`📚 Processing document in ${contentChunks.length} chunks`);
    
    if (contentChunks.length > 3) {
      return res.status(400).json({ 
        error: "Document is too long for processing. Please upload a shorter document (under 5-6 pages).",
        suggestion: "Try splitting your document into smaller parts or focus on a specific section."
      });
    }

    // Use only the first chunk for now (simple approach)
    const firstChunk = contentChunks[0];
    
    const prompt = `Based on this partial document content, answer the question. If unsure, say you need more context.

Partial document content: ${firstChunk}

Question: ${question}

Answer:`;

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.3
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      let answer = data.candidates[0].content.parts[0].text;
      
      if (contentChunks.length > 1) {
        answer += `\n\n*Note: Only part of the document was processed due to length limitations.*`;
      }
      
      res.json({ 
        answer: answer,
        chunksProcessed: 1,
        totalChunks: contentChunks.length
      });
    } else {
      throw new Error("Unexpected response format");
    }

  } catch (error) {
    console.error("Error in ask-long:", error);
    res.status(500).json({ 
      error: "Error processing long document",
      details: error.message 
    });
  }
});

// Test endpoint with sample content
router.post("/test-content", async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const cleanedContent = cleanContent(content);
    
    const prompt = `Please summarize this text in one sentence: ${cleanedContent.substring(0, 1000)}`;
    
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GOOGLE_API_KEY}`;

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      res.json({ 
        success: true,
        message: "Content test passed!",
        contentLength: cleanedContent.length,
        summary: data.candidates[0].content.parts[0].text
      });
    } else {
      const errorText = await response.text();
      res.status(400).json({ 
        success: false,
        error: "Content test failed",
        details: errorText,
        contentLength: cleanedContent.length
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: "Error testing content",
      details: error.message 
    });
  }
});

export default router;