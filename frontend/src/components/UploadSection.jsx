import { useState } from "react";

function UploadSection({ setUploaded, setUploadedDocId, setUploadedFilename }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first!");
      return;
    }

    // Check file type
    if (file.type !== "application/pdf") {
      setError("Only PDF files are supported!");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      if (data.id) {
        setUploadedDocId(data.id);
        setUploadedFilename(data.filename || file.name);
        setUploaded(true);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Error uploading file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-16 text-center">
      <div className="p-8 bg-white/10 backdrop-blur-md rounded-2xl shadow-lg border border-white/10">
        <h2 className="text-2xl font-semibold mb-4 text-white">
          Upload Your Document
        </h2>
        <p className="text-gray-300 mb-6">
          Upload a PDF file. Our AI will process it for intelligent Q&A.
        </p>

        <div className="flex justify-center mb-6">
          <input
            type="file"
            accept=".pdf"
            className="text-sm text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0
            file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
            onChange={(e) => {
              setFile(e.target.files[0]);
              setError("");
            }}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={loading}
          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
            loading
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500"
          } text-white`}
        >
          {loading ? "Processing..." : "Upload & Continue"}
        </button>
      </div>
    </div>
  );
}

export default UploadSection;
