import { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import axios from "axios";
import "./Chat.css";

const API_BASE = "http://localhost:8001";

function Chat() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const photoInputRef = useRef(null);
  const documentInputRef = useRef(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    try {
      const res = await axios.get(`${API_BASE}/message/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages(res.data);
    } catch (err) {
      console.log("Failed to fetch messages", err);
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
    setShowAttachMenu(false);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!text.trim() && !selectedFile) return;

    const formData = new FormData();
    formData.append("text", text.trim());
    if (selectedFile) formData.append("file", selectedFile);

    try {
      await axios.post(`${API_BASE}/message/send`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setText("");
      setSelectedFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (documentInputRef.current) documentInputRef.current.value = "";
      fetchMessages();
    } catch (err) {
      console.log("Failed to send message", err);
    }
  }

  return (
    <div>
      <Navbar />

      <div className="chat-container">
        <div className="chatbox">
          {messages.length === 0 && <p className="chat-empty">No messages yet. Say hello!</p>}
          {messages.map((msg) => (
            <div key={msg._id} className="chat-bubble">
              <span className="sender-label">{msg.senderEmail}</span>
              {msg.text && <p>{msg.text}</p>}
              {msg.fileType === "image" && <img src={`${API_BASE}${msg.fileUrl}`} alt={msg.fileName} />}
              {msg.fileType === "document" && (
                <a href={`${API_BASE}${msg.fileUrl}`} target="_blank" rel="noreferrer" className="document-link">
                  📄 {msg.fileName}
                </a>
              )}
            </div>
          ))}
        </div>

        {selectedFile && (
          <div className="image-preview">
            {selectedFile.type.startsWith("image/") ? (
              <img src={URL.createObjectURL(selectedFile)} alt="preview" />
            ) : (
              <span className="file-chip">📄 {selectedFile.name}</span>
            )}
            <span onClick={() => setSelectedFile(null)}>✕</span>
          </div>
        )}

        <form className="chat-input-row" onSubmit={handleSend}>
          <div className="attach-wrapper">
            <button type="button" className="attach-btn" onClick={() => setShowAttachMenu(!showAttachMenu)}>
              📎
            </button>

            {showAttachMenu && (
              <div className="attach-menu">
                <div className="attach-option" onClick={() => photoInputRef.current.click()}>
                  🖼️ Photo
                </div>
                <div className="attach-option" onClick={() => documentInputRef.current.click()}>
                  📄 Document
                </div>
              </div>
            )}

            <input type="file" accept="image/*" ref={photoInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
            <input type="file" accept=".pdf,.doc,.docx,.txt" ref={documentInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
          </div>

          <input type="text" className="chat-input" placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" className="send-btn">
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default Chat;