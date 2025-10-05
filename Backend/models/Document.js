import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
  filename: String,
  content: String,
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model("Document", documentSchema);