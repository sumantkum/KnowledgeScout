import { useState } from "react";

function ChatSection({ uploadedDocId, filename }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usingLongMode, setUsingLongMode] = useState(false);

  const handleAsk = async (useLongEndpoint = false) => {
    if (!question.trim()) {
      setError("Please enter a question!");
      return;
    }

    if (!uploadedDocId) {
      setError("Please upload a document first!");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");
    setUsingLongMode(useLongEndpoint);

    try {
      console.log("Sending question:", question);
      const endpoint = useLongEndpoint ? "/ask-long" : "/ask";
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          docId: uploadedDocId,
        }),
      });

      const data = await res.json();
      console.log("Response received:", data);

      if (!res.ok) {
        // Handle different types of errors
        if (res.status === 404) {
          throw new Error(
            "Document not found. Please upload the document again."
          );
        } else if (res.status === 400) {
          // If we get a 400 in normal mode, suggest trying long mode
          if (
            !useLongEndpoint &&
            data.error &&
            data.error.includes("too long")
          ) {
            throw new Error(
              `${data.error} Try using the 'Process Long Document' option.`
            );
          }
          throw new Error(data.error || "Invalid request.");
        } else if (res.status === 403) {
          throw new Error(
            "API key issue. Please check your Google API key configuration."
          );
        } else if (res.status === 408) {
          throw new Error(
            "Request timeout. Try using a shorter question or the 'Process Long Document' option."
          );
        } else if (res.status === 429) {
          throw new Error(
            "Too many requests. Please wait a moment and try again."
          );
        } else if (res.status === 503) {
          throw new Error(
            "Cannot connect to AI service. Check your internet connection."
          );
        } else {
          throw new Error(
            data.error || data.details || `Server error: ${res.status}`
          );
        }
      }

      setAnswer(data.answer);
    } catch (err) {
      console.error("Ask error:", err);

      // More user-friendly error messages
      if (err.message.includes("Failed to fetch")) {
        setError(
          "Cannot connect to the server. Make sure the backend is running on port 5000."
        );
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      handleAsk();
    }
  };

  const clearChat = () => {
    setQuestion("");
    setAnswer("");
    setError("");
    setUsingLongMode(false);
  };

  const testDocumentContent = async () => {
    if (!uploadedDocId) {
      setError("Please upload a document first!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`http://localhost:5000/ask/test-content`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docId: uploadedDocId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setError(
          `Document test passed! Content length: ${data.contentLength} characters`
        );
      } else {
        setError(
          `Document test failed: ${data.error}. Content length: ${data.contentLength} characters`
        );
      }
    } catch (err) {
      setError("Test failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-10 bg-white/10 p-8 rounded-2xl backdrop-blur-md shadow-lg border border-white/10">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-white mb-2">
          Ask Your Document Anything
        </h2>
        <p className="text-gray-300 mb-4">Document: {filename}</p>
        <div className="flex justify-center gap-2 flex-wrap">
          <button
            onClick={clearChat}
            className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-500 rounded-lg text-white transition-colors"
          >
            Clear Chat
          </button>
          <button
            onClick={testDocumentContent}
            disabled={loading}
            className="px-4 py-2 text-sm bg-yellow-600 hover:bg-yellow-500 rounded-lg text-white transition-colors disabled:bg-yellow-400"
          >
            Test Document
          </button>
          <button
            onClick={() => handleAsk(true)}
            disabled={loading}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors disabled:bg-purple-400"
          >
            Process Long Document
          </button>
        </div>
        {usingLongMode && (
          <p className="text-yellow-300 text-sm mt-2">
            Using long document processing mode...
          </p>
        )}
      </div>

      {error && (
        <div
          className={`mb-4 p-4 rounded-lg border ${
            error.includes("")
              ? "bg-green-500/20 border-green-500 text-green-300"
              : "bg-red-500/20 border-red-500 text-red-300"
          }`}
        >
          <p>{error}</p>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Type your question here..."
          className="w-full p-3 rounded-xl bg-white/10 border border-white/20 focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-gray-400"
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setError(""); // Clear error when user starts typing
          }}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <button
          onClick={() => handleAsk(false)}
          disabled={loading || !question.trim()}
          className={`px-6 py-3 rounded-xl font-semibold text-white min-w-24 transition-colors ${
            loading || !question.trim()
              ? "bg-blue-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Thinking...
            </div>
          ) : (
            "Ask"
          )}
        </button>
      </div>

      {answer && (
        <div className="mt-6 bg-white/5 p-6 rounded-xl border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-blue-300">
              AI's Answer:
            </h3>
            <span className="text-xs text-gray-400 bg-blue-900/50 px-2 py-1 rounded">
              Powered by Google Gemini
            </span>
          </div>
          <p className="text-gray-200 leading-relaxed whitespace-pre-wrap">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default ChatSection;
