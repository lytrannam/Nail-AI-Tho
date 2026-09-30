"use client";

import { useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export default function SupportChat({ lang }: { lang: "vi" | "en" }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);

  const askQuestion = async () => {
    const q = question.trim();
    if (!q || asking) return;

    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setAsking(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, lang }),
      });
      const data = await res.json();

      const answer =
        data.answer ||
        data.error ||
        (lang === "vi" ? "Không thể trả lời lúc này." : "Could not answer right now.");

      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text:
            lang === "vi"
              ? "Có lỗi xảy ra, thử lại nhé."
              : "Something went wrong, try again.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="support-chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={lang === "vi" ? "Hỏi trợ lý AI" : "Ask the AI assistant"}
        aria-expanded={open}
      >
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <div
          className="support-chat-panel"
          role="dialog"
          aria-label={lang === "vi" ? "Hỏi trợ lý AI" : "Ask the AI assistant"}
        >
          <div className="support-chat-header">
            <strong>
              🤖 {lang === "vi" ? "Hỏi trợ lý AI" : "Ask the AI assistant"}
            </strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={lang === "vi" ? "Đóng" : "Close"}
            >
              ✕
            </button>
          </div>

          {messages.length > 0 && (
            <div className="support-chat-messages">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === "user"
                      ? "support-chat-msg is-user"
                      : "support-chat-msg is-assistant"
                  }
                >
                  {m.text}
                </div>
              ))}
            </div>
          )}

          <div className="support-chat-inputRow">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") askQuestion();
              }}
              placeholder={
                lang === "vi"
                  ? "Ví dụ: Sao camera không mở được?"
                  : "e.g. Why won't the camera open?"
              }
            />
            <button type="button" onClick={askQuestion} disabled={asking}>
              {asking ? "..." : lang === "vi" ? "Hỏi" : "Ask"}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .support-chat-fab {
          position: fixed;
          right: 20px;
          bottom: 24px;
          z-index: 30;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: none;
          background: var(--accent);
          color: white;
          font-size: 22px;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
        }
        .support-chat-panel {
          position: fixed;
          right: 20px;
          bottom: 84px;
          z-index: 30;
          width: min(340px, calc(100vw - 40px));
          max-height: 60vh;
          display: flex;
          flex-direction: column;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18);
          overflow: hidden;
        }
        .support-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }
        .support-chat-header button {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: var(--foreground-soft);
        }
        .support-chat-messages {
          padding: 12px 14px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .support-chat-msg {
          max-width: 85%;
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.5;
        }
        .support-chat-msg.is-user {
          align-self: flex-end;
          background: var(--accent);
          color: white;
        }
        .support-chat-msg.is-assistant {
          align-self: flex-start;
          background: var(--background);
          color: var(--foreground);
        }
        .support-chat-inputRow {
          display: flex;
          gap: 8px;
          padding: 12px 14px;
          border-top: 1px solid var(--border);
        }
        .support-chat-inputRow input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--border);
          box-sizing: border-box;
          font-size: 13px;
        }
        .support-chat-inputRow button {
          padding: 10px 18px;
          border-radius: 999px;
          border: none;
          background: var(--accent);
          color: white;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .support-chat-inputRow button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1099px) {
          .support-chat-fab {
            bottom: calc(80px + env(safe-area-inset-bottom));
          }
          .support-chat-panel {
            bottom: calc(140px + env(safe-area-inset-bottom));
          }
        }
      `}</style>
    </>
  );
}
