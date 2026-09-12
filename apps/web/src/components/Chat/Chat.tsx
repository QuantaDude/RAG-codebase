import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { QueryResponse } from "@RAG-codebase/types";
export type Message = {
}
export default function Chat() {
  const [chats, SetChatMessages] = useState<{ id: string, sender: "user" | "server", message: string, sent: boolean }[]>([]);

  const [query, setQueryString] = useState("");
  const sendQueryRequest = useRef<boolean>(false);
  async function sendQuery(text: string): Promise<QueryResponse> {

    const response = await fetch("http://localhost:3000/api/chat/1", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: text
      })
    })
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  async function handleSend() {
    const text = query.trim();

    if (!text) {
      return;
    }

    try {
      sendQueryRequest.current = true;

      SetChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          sender: "user",
          message: text,
          sent: false,
        },
      ]);

      const result = await sendQuery(text);

      console.log(result);

      SetChatMessages((currentMessages) => [
        ...currentMessages,
        {
          id: crypto.randomUUID(),
          sender: "server",
          message: result.message,
          sent: true,
        },
      ]);

      setQueryString("");
      sendQueryRequest.current = false;

    } catch (error) {
      sendQueryRequest.current = false;

      SetChatMessages((currentMessages) =>
        currentMessages.filter((val) => val.sent)
      );

      console.error("Failed to send query:", error);
    }
  }
  return (
    <>
      <main id="chat">
        <div id="messages">
          {chats.map((val, idx) => (
            <div key={idx} className={`message-bubble ${val.sender === "user" ? "user" : ""}`}>
              <p>{val.message}</p>
            </div>
          ))}


          {sendQueryRequest.current &&
            <div className='message-bubble loading'>
              <div id="load">
                <div>T</div>
                <div>h</div>
                <div>i</div>
                <div>n</div>
                <div>k</div>
                <div>i</div>
                <div>n</div>
                <div>g</div>
              </div>
            </div>
          }
        </div>
      </main >

      <div id="chat-box-container">
        <div id="chat-box">
          <textarea placeholder="Message CodeBuddy..."
            onChange={(e) => setQueryString(e.target.value)}
            value={query} />
        </div>

        <div id="chat-controls">
          <button onClick={handleSend}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 19V5M6.5 10.5L12 5L17.5 10.5"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

        </div>
      </div>
    </>
  );

}
