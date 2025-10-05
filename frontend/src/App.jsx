import Navbar from "./components/Navbar";
import UploadSection from "./components/UploadSection";
import ChatSection from "./components/ChatSection";
import { useState } from "react";

function App() {
  const [uploaded, setUploaded] = useState(false);
  const [uploadedDocId, setUploadedDocId] = useState(null);
  const [uploadedFilename, setUploadedFilename] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-blue-900">
      <Navbar />
      <div className="w-full max-w-4xl mx-auto p-6">
        {!uploaded ? (
          <UploadSection 
            setUploaded={setUploaded} 
            setUploadedDocId={setUploadedDocId}
            setUploadedFilename={setUploadedFilename}
          />
        ) : (
          <ChatSection 
            uploadedDocId={uploadedDocId} 
            filename={uploadedFilename}
          />
        )}
      </div>
    </div>
  );
}

export default App;