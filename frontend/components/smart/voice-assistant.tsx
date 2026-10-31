"use client";

import { useState } from "react";
import { api } from "../../lib/api";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function recognition(): SpeechRec | null {
  const host = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  window.speechSynthesis.speak(utterance);
}

export function VoiceAssistant() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState("Ask for a room, or say a faculty member is away. I only draft. I never approve.");
  const [busy, setBusy] = useState(false);

  async function ask(spoken: string) {
    const prompt = spoken.trim();
    if (!prompt) return;
    setBusy(true);
    setText(prompt);
    const result = await api<{ reply: string }>("/api/v1/ai/assistant", { method: "POST", body: JSON.stringify({ text: prompt }) });
    const message = result.data?.reply ?? result.error ?? "I could not answer that.";
    setReply(message);
    setBusy(false);
    speak(message);
  }

  function listen() {
    const ear = recognition();
    if (!ear) {
      setReply("This browser has no speech recognition. Type the request instead.");
      return;
    }
    ear.lang = "en-IN";
    ear.interimResults = false;
    ear.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setListening(false);
      void ask(heard);
    };
    ear.onerror = () => setListening(false);
    ear.onend = () => setListening(false);
    setListening(true);
    ear.start();
  }

  return (
    <div className="voice-dock">
      {open && (
        <section className="voice-panel" aria-label="Campus assistant">
          <p className="chip">Campus voice</p>
          <p>{busy ? "Listening to the rules…" : reply}</p>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Or type a request" />
          <div className="voice-actions">
            <button type="button" className="ghost" onClick={listen}>{listening ? "Listening…" : "Speak"}</button>
            <button type="button" className="pill" onClick={() => void ask(text)} disabled={busy}>Send</button>
          </div>
        </section>
      )}
      <button type="button" className="voice-button" aria-label="Open voice assistant" onClick={() => setOpen((value) => !value)}>AI</button>
    </div>
  );
}
