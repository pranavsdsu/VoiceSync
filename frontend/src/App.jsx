import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Avatar from "./Avatar.jsx";

export default function App() {
  const [status, setStatus] = useState("idle");
  const [log, setLog] = useState([]);
  const [lipsync, setLipsync] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const push = (role, text) => setLog((l) => [...l, { role, text }]);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // pick a mimeType the browser actually supports
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find(
        (m) => MediaRecorder.isTypeSupported(m)
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()); // release mic
        handleAudio(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
      };
      rec.start();
      recRef.current = rec;
      setStatus("recording");
    } catch (err) {
      console.error("mic error", err);
      push("assistant", "⚠️ Mic blocked or unavailable: " + err.message);
      setStatus("idle");
    }
  }

  function stopRec() {
    recRef.current?.stop();
    setStatus("thinking");
  }

  async function handleAudio(blob) {
    try {
      if (!blob.size) { push("assistant", "⚠️ No audio captured."); setStatus("idle"); return; }
      const fd = new FormData();
      fd.append("audio", blob, "in.webm");
      const tr = await fetch("/api/transcribe", { method: "POST", body: fd }).then((r) => r.json());
      if (!tr.text) { push("assistant", "⚠️ Didn't catch that — try again."); setStatus("idle"); return; }
      push("user", tr.text);
      await ask(tr.text);
    } catch (err) {
      console.error("transcribe error", err);
      push("assistant", "⚠️ Transcription failed: " + err.message);
      setStatus("idle");
    }
  }

  async function ask(text) {
    setStatus("thinking");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => r.json());
    push("assistant", res.reply);
    await speak(res.reply);
  }

  async function speak(text) {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then((r) => r.json());
    setLipsync(res.lipsync || []);
    const audio = audioRef.current;
    audio.src = res.audio_url;
    setSpeaking(true);
    setStatus("speaking");
    audio.onended = () => { setSpeaking(false); setStatus("idle"); };
    audio.play();
  }

  function onText(e) {
    e.preventDefault();
    const t = e.target.msg.value.trim();
    if (!t) return;
    e.target.msg.value = "";
    push("user", t);
    ask(t);
  }

  return (
    <div style={{ display: "flex", height: "100vh", color: "#e6e6e6", fontFamily: "system-ui" }}>
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 0, 4], fov: 35 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 4, 3]} intensity={1.4} />
          <directionalLight position={[-3, 1, 2]} intensity={0.5} />
          <Avatar lipsync={lipsync} audioRef={audioRef} speaking={speaking} />
          <OrbitControls enablePan={false} target={[0, 0, 0]} />
        </Canvas>
      </div>

      <div style={{ width: 380, padding: 20, background: "#161a22", display: "flex", flexDirection: "column" }}>
        <h2>VoiceSync</h2>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>status: {status}</div>
        <div style={{ flex: 1, overflowY: "auto", marginBottom: 12 }}>
          {log.map((m, i) => (
            <div key={i} style={{ margin: "8px 0" }}>
              <b style={{ color: m.role === "user" ? "#7cc4ff" : "#9effa0" }}>{m.role}: </b>
              {m.text}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {status === "recording" ? (
            <button onClick={stopRec} style={btn("#e05555")}>⏹ Stop &amp; send</button>
          ) : (
            <button onClick={startRec} style={btn("#3a7afe")}>🎙 Click to record</button>
          )}
        </div>
        <form onSubmit={onText} style={{ display: "flex", gap: 8 }}>
          <input name="msg" placeholder="or type..." style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #333", background: "#0e1116", color: "#fff" }} />
          <button style={btn("#3a7afe")}>Send</button>
        </form>
        <audio ref={audioRef} hidden />
      </div>
    </div>
  );
}

const btn = (bg) => ({
  padding: "10px 16px", borderRadius: 8, border: "none",
  background: bg, color: "#fff", cursor: "pointer", fontWeight: 600,
});
