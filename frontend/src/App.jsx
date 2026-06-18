import { useRef, useState, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import Avatar from "./Avatar.jsx";

// Swap this for your own ReadyPlayerMe avatar URL (must end in ?morphTargets=Oculus%20Visemes)
const AVATAR_URL =
  "https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb?morphTargets=Oculus%20Visemes";

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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    rec.ondataavailable = (e) => chunksRef.current.push(e.data);
    rec.onstop = () => handleAudio(new Blob(chunksRef.current, { type: "audio/webm" }));
    rec.start();
    recRef.current = rec;
    setStatus("recording");
  }

  function stopRec() {
    recRef.current?.stop();
    setStatus("thinking");
  }

  async function handleAudio(blob) {
    const fd = new FormData();
    fd.append("audio", blob, "in.webm");
    const tr = await fetch("/api/transcribe", { method: "POST", body: fd }).then((r) => r.json());
    if (!tr.text) { setStatus("idle"); return; }
    push("user", tr.text);
    await ask(tr.text);
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
        <Canvas camera={{ position: [0, 0, 3], fov: 35 }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 4, 3]} intensity={1.2} />
          <Suspense fallback={null}>
            <Avatar url={AVATAR_URL} lipsync={lipsync} audioRef={audioRef} speaking={speaking} />
            <Environment preset="city" />
          </Suspense>
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
            <button onClick={stopRec} style={btn("#e05555")}>⏹ Stop</button>
          ) : (
            <button onClick={startRec} style={btn("#3a7afe")}>🎙 Hold to talk</button>
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
