import React, { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, Copy, Check, Server, Terminal, AlertTriangle, Key, RefreshCw } from "lucide-react";
import { getBackendUrl, detectFallbackMode, setCustomBackendUrl, resetBackendHealthCache } from "../lib/filesystem";

interface GeminiCopilotProps {
  onWorkspaceChange: () => void;
  addSystemLog: (type: "info" | "success" | "warn" | "error", source: string, msg: string, details?: string) => void;
  appletsCount: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export function GeminiCopilot({ onWorkspaceChange, addSystemLog, appletsCount }: GeminiCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem("gemini_copilot_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [isServerOnline, setIsServerOnline] = useState<boolean | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [customKey, setCustomKey] = useState(() => localStorage.getItem("custom_gemini_api_key") || "");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persist chat history to localStorage when changed
  useEffect(() => {
    try {
      localStorage.setItem("gemini_copilot_history", JSON.stringify(history));
    } catch (e) {
      console.error("Failed to save chat history to localStorage:", e);
    }
  }, [history]);

  // Check if Express backend is online on load
  const checkServerHealth = async () => {
    try {
      await detectFallbackMode();
      const target = getBackendUrl("/api/list-components");
      const res = await fetch(target, { signal: AbortSignal.timeout(3000) });
      setIsServerOnline(res.ok);
    } catch {
      setIsServerOnline(false);
    }
  };

  useEffect(() => {
    checkServerHealth();
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading, isOpen]);

  // Handle Copy Code to Clipboard
  const handleCopyCode = (code: string, blockId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(blockId);
    setTimeout(() => setCopiedIndex(null), 2000);
    addSystemLog("success", "copilot", "Copied code snippet to clipboard.");
  };

  const sendPrompt = async (userText: string, currentHistory: Message[], customApiKeyOverride?: string) => {
    const newMsg: Message = {
      role: "user",
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedHistory = [...currentHistory, newMsg];
    setHistory(updatedHistory);
    setLoading(true);

    try {
      addSystemLog("info", "copilot", `Sending instruction to Gemini Copilot...`, userText);

      const apiKeyToUse = customApiKeyOverride || customKey || undefined;

      const response = await fetch(getBackendUrl("/api/gemini/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: updatedHistory.slice(-10).map((h) => ({ role: h.role, content: h.content })),
          useTools,
          customApiKey: apiKeyToUse,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `HTTP Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.text,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);

        addSystemLog("success", "copilot", "Gemini Copilot finished response successfully.");

        // If tools are used, trigger scanning in parent in case files were written or deleted!
        if (useTools) {
          onWorkspaceChange();
        }
      } else {
        throw new Error(data.error || "Execution returned failure state.");
      }
    } catch (err: any) {
      console.error("Copilot communication error:", err);
      addSystemLog("error", "copilot", `Copilot failed: ${err.message}`);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error communicating with server:** ${err.message}\n\n*Make sure GEMINI_API_KEY is configured in Settings > Secrets, and that the Express backend container is online.*`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Send Message to backend endpoint
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userText = message;
    setMessage("");
    await sendPrompt(userText, history);
  };

  // Custom renderer for code block parsing and markdown style
  const renderMessageText = (msg: Message, msgIndex: number) => {
    const text = msg.content;
    const isQuotaError = text.toLowerCase().includes("quota exceeded") || text.toLowerCase().includes("resource_exhausted") || text.toLowerCase().includes("rate limits");
    const parts = [];
    const regex = /```(tsx|typescript|javascript|html|css|json|bash)?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let partIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const textBefore = text.substring(lastIndex, match.index);
      if (textBefore) {
        parts.push({ id: `t-${msgIndex}-${partIndex++}`, type: "text", content: textBefore });
      }
      parts.push({
        id: `c-${msgIndex}-${partIndex++}`,
        type: "code",
        language: match[1] || "code",
        content: match[2].trim(),
      });
      lastIndex = regex.lastIndex;
    }

    const textAfter = text.substring(lastIndex);
    if (textAfter) {
      parts.push({ id: `t-${msgIndex}-${partIndex++}`, type: "text", content: textAfter });
    }

    const parsedParts = parts.length > 0 ? parts : [{ id: `t-${msgIndex}-0`, type: "text", content: text }];

    return (
      <div className="space-y-2 text-xs leading-relaxed text-white/90">
        {parsedParts.map((part) => {
          if (part.type === "code") {
            const isCopied = copiedIndex === part.id;
            return (
              <div key={part.id} className="my-2 border border-white/10 rounded-lg overflow-hidden bg-black/60 relative group">
                <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/5 text-[9px] font-mono text-white/40">
                  <span>{part.language.toUpperCase()}</span>
                  <button
                    onClick={() => handleCopyCode(part.content, part.id)}
                    className="p-1 hover:bg-white/5 hover:text-white rounded transition flex items-center gap-1 cursor-pointer"
                    title="Copy Code"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-[10px] font-mono text-emerald-400 max-h-60 scrollbar-thin">
                  <code>{part.content}</code>
                </pre>
              </div>
            );
          }

          // Format bullet points and lines
          const lines = part.content.split("\n").map((line, idx) => {
            if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
              return (
                <li key={idx} className="ml-4 list-disc pl-1 my-0.5">
                  {line.replace(/^[*-\s]+/, "")}
                </li>
              );
            }
            if (line.trim().startsWith("### ")) {
              return <h4 key={idx} className="font-bold text-white/100 text-[11px] mt-2 mb-1">{line.replace("### ", "")}</h4>;
            }
            if (line.trim().startsWith("## ")) {
              return <h4 key={idx} className="font-bold text-emerald-400 text-xs mt-2 mb-1">{line.replace("## ", "")}</h4>;
            }
            return <p key={idx} className="min-h-[1em]">{line}</p>;
          });

          return <div key={part.id} className="space-y-1">{lines}</div>;
        })}
        {isQuotaError && (
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2 text-left">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono text-[10px]">
              <Key className="w-3.5 h-3.5 animate-pulse" />
              <span>CONFIGURE CUSTOM API KEY FALLBACK</span>
            </div>
            <p className="text-[10px] text-white/60 font-sans leading-normal">
              To bypass the shared rate limit, paste your own free Gemini API key below. It stays secure inside your browser's localStorage.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={customKey}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setCustomKey(val);
                  if (val) {
                    localStorage.setItem("custom_gemini_api_key", val);
                  } else {
                    localStorage.removeItem("custom_gemini_api_key");
                  }
                }}
                placeholder="AIzaSy... (paste your key here)"
                className="flex-1 bg-black/60 border border-white/10 rounded px-2.5 py-1.5 text-[10px] font-mono text-emerald-400 placeholder-white/20 focus:outline-none focus:border-emerald-500"
              />
              {customKey && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomKey("");
                    localStorage.removeItem("custom_gemini_api_key");
                  }}
                  className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/20 text-[9px] font-bold rounded cursor-pointer transition"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const lastUserMsg = [...history].reverse().find(m => m.role === "user");
                  if (lastUserMsg) {
                    // Remove current error message from history to keep chat clean
                    setHistory(prev => prev.filter(m => m !== msg));
                    sendPrompt(lastUserMsg.content, history.filter(m => m !== msg && m !== lastUserMsg), customKey);
                  }
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/20 text-[9px] font-bold rounded cursor-pointer transition flex items-center gap-1 uppercase font-mono"
              >
                <span>Save Key & Retry Action</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* FLOATING ACTION TRIGGER TRIGGER */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-tr from-emerald-500 to-indigo-600 rounded-full shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_32px_rgba(16,185,129,0.5)] border border-emerald-400/20 transition-all duration-300 group cursor-pointer hover:scale-105 active:scale-95"
        title="Open Gemini Copilot Panel"
        id="gemini-copilot-floating-btn"
      >
        <Sparkles className="w-5 h-5 text-white group-hover:rotate-12 transition-transform duration-300" />
        {!isOpen && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white/20"></span>
          </span>
        )}
      </button>

      {/* FLOATING CO-PILOT DIALOG PANEL */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 w-96 h-[540px] bg-[#0c1017]/95 border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden z-40 backdrop-blur-md animate-fade-in text-white font-sans"
          id="gemini-copilot-chat-card"
        >
          {/* HEADER BAR */}
          <div className="p-4 bg-gradient-to-r from-[#121824] to-[#0c1017] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wider uppercase font-mono text-white">Gemini Copilot</h3>
                <div className="flex items-center gap-1 text-[9px] font-mono text-white/40">
                  {isServerOnline === true ? (
                    <>
                      <Server className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400">Server Container Connected</span>
                    </>
                  ) : isServerOnline === false ? (
                    <>
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                      <span className="text-amber-400">Offline (Static Environment)</span>
                    </>
                  ) : (
                    <span>Checking Container thread...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Clear your chat conversation history?")) {
                      setHistory([]);
                      localStorage.removeItem("gemini_copilot_history");
                      addSystemLog("info", "copilot", "Chat conversation history cleared.");
                    }
                  }}
                  className="px-2 py-1 hover:bg-red-500/10 text-white/40 hover:text-red-400 rounded-md transition text-[9px] font-mono font-bold select-none cursor-pointer border border-transparent hover:border-red-500/20"
                  title="Clear Chat History"
                >
                  Clear Chat
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/5 text-white/40 hover:text-white rounded-lg transition cursor-pointer"
                title="Close Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PREVIEWS & DIRECTORY SWITCH */}
          <div className="px-4 py-2 bg-black/40 border-b border-white/5 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
              <label className="flex items-center gap-2 cursor-pointer select-none" title="Allow Gemini to list, read, and write files in the local workspace">
                <input
                  type="checkbox"
                  checked={useTools}
                  onChange={(e) => setUseTools(e.target.checked)}
                  className="rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                  disabled={isServerOnline === false}
                />
                <span className={useTools && isServerOnline !== false ? "text-emerald-400" : ""}>Allow Workspace Tools</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className={`p-1 hover:bg-white/5 rounded transition cursor-pointer flex items-center gap-1 ${customKey ? "text-emerald-400" : "text-white/40"}`}
                  title="Configure custom Gemini API Key fallback"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold uppercase">{customKey ? "Active Key" : "Key"}</span>
                </button>
                <span className="text-[9px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/40">
                  {appletsCount} Active Node{appletsCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            
            {showKeyInput && (
              <div className="pt-1.5 pb-1 border-t border-white/5 space-y-1.5 animate-fade-in">
                <div className="flex items-center justify-between text-[9px] font-mono text-white/40">
                  <span>Custom GEMINI_API_KEY Fallback:</span>
                  {customKey && <span className="text-emerald-400 font-bold uppercase">Stored</span>}
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      setCustomKey(val);
                      if (val) {
                        localStorage.setItem("custom_gemini_api_key", val);
                      } else {
                        localStorage.removeItem("custom_gemini_api_key");
                      }
                    }}
                    placeholder="AIzaSy... (leave blank to use shared key)"
                    className="flex-1 bg-black/60 border border-white/10 rounded px-2 py-1 text-[10px] font-mono text-emerald-400 placeholder-white/20 focus:outline-none focus:border-emerald-500"
                  />
                  {customKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomKey("");
                        localStorage.removeItem("custom_gemini_api_key");
                      }}
                      className="px-2 py-1 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/20 text-[9px] font-bold rounded cursor-pointer transition"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* CHAT BUBBLES WINDOW */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
            {history.length === 0 && (
              <div className="p-4 bg-white/5 border border-white/5 rounded-xl space-y-2.5 text-xs text-white/60">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                  Welcome to Gemini Copilot Console!
                </p>
                <p className="text-[11px] leading-relaxed">
                  I am a server-side compiler assistant. I can inspect files, write React code, and configure dashboards.
                </p>
                {isServerOnline === false && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] space-y-2">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      Backend Server Offline or Disconnected
                    </p>
                    <p className="leading-normal text-white/70">
                      If your Express backend is running in its own container mapped to <span className="font-mono text-emerald-400 font-bold">Port 3200</span>, click below to connect or test connection:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const protocol = window.location.protocol.startsWith("http") ? window.location.protocol : "http:";
                          const host = window.location.hostname || "localhost";
                          const target3200 = `${protocol}//${host}:3200`;
                          setCustomBackendUrl(target3200);
                          addSystemLog("info", "copilot", `Set backend target URL to ${target3200}`);
                          await checkServerHealth();
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[9px] rounded transition cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Connect to Port 3200 ({window.location.hostname}:3200)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => checkServerHealth()}
                        className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white font-mono text-[9px] rounded transition cursor-pointer"
                      >
                        Retry Check
                      </button>
                    </div>
                  </div>
                )}
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Example Prompts:</p>
                  <button
                    onClick={() => setMessage("List files in src/components")}
                    className="block w-full text-left text-[10px] bg-white/5 hover:bg-emerald-500/10 border border-white/10 p-1.5 rounded text-emerald-400 font-mono transition"
                    disabled={isServerOnline === false}
                  >
                    &gt; List files in src/components
                  </button>
                  <button
                    onClick={() => setMessage("Create a simple Todo App in src/components/TodoApp.tsx")}
                    className="block w-full text-left text-[10px] bg-white/5 hover:bg-emerald-500/10 border border-white/10 p-1.5 rounded text-emerald-400 font-mono transition"
                    disabled={isServerOnline === false}
                  >
                    &gt; Create a React dynamic Applet
                  </button>
                </div>
              </div>
            )}

            {history.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className="text-[9px] font-mono text-white/30 mb-1 px-1">{msg.role === "user" ? "USER" : "GEMINI"} • {msg.timestamp}</div>
                <div
                  className={`max-w-[85%] p-3 rounded-2xl shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-600/90 to-indigo-700/90 text-white rounded-tr-none border border-indigo-500/20"
                      : "bg-[#161c28]/95 text-white/90 rounded-tl-none border border-white/5"
                  }`}
                >
                  {renderMessageText(msg, idx)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-start">
                <div className="text-[9px] font-mono text-white/30 mb-1 px-1">GEMINI • Processing</div>
                <div className="max-w-[85%] bg-[#161c28]/95 text-white/50 p-3 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
                  <div className="flex space-x-1 items-center py-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">Executing workspace compilation...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM FIELD */}
          <form onSubmit={handleSendMessage} className="p-3 bg-black/60 border-t border-white/5 flex items-center gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isServerOnline === false ? "AI copilot offline..." : "Ask Gemini to build/edit files..."}
              className="flex-1 bg-[#121822] border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 placeholder-white/20"
              disabled={loading || isServerOnline === false}
            />
            <button
              type="submit"
              disabled={!message.trim() || loading || isServerOnline === false}
              className="p-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/5 disabled:text-white/20 text-black rounded-xl transition cursor-pointer select-none shrink-0"
              title="Submit message"
            >
              <Send className="w-4 h-4 text-slate-900" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
