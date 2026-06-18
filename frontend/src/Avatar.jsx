import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Rhubarb mouth shape -> mouth geometry (openness 0..1, width scale).
// Fully procedural: no external GLB, works offline. Drives a primitive head.
const RHUBARB_TO_MOUTH = {
  A: { open: 0.05, width: 0.9 }, // closed (m,b,p)
  B: { open: 0.25, width: 1.0 }, // slight (k,s,t)
  C: { open: 0.5, width: 1.05 }, // open (eh)
  D: { open: 0.9, width: 1.1 },  // wide (ah)
  E: { open: 0.55, width: 0.7 }, // rounded (oh)
  F: { open: 0.35, width: 0.55 }, // puckered (oo,w)
  G: { open: 0.2, width: 0.95 }, // f,v
  H: { open: 0.4, width: 0.85 }, // l,th
  X: { open: 0.04, width: 0.9 }, // rest
};

export default function Avatar({ lipsync, audioRef, speaking }) {
  const mouth = useRef();
  const head = useRef();

  useFrame((_, delta) => {
    const t = audioRef.current ? audioRef.current.currentTime : 0;
    let shape = RHUBARB_TO_MOUTH.X;
    if (speaking && lipsync && lipsync.length) {
      for (const cue of lipsync) {
        if (t >= cue.start && t <= cue.end) {
          shape = RHUBARB_TO_MOUTH[cue.value] || RHUBARB_TO_MOUTH.X;
          break;
        }
      }
    }
    if (mouth.current) {
      // smooth toward target openness/width
      const m = mouth.current;
      m.scale.y += (shape.open * 6 - m.scale.y) * 0.5;
      m.scale.x += (shape.width - m.scale.x) * 0.4;
    }
    if (head.current) {
      // subtle idle bob
      head.current.rotation.y = Math.sin(Date.now() / 1500) * 0.12;
    }
  });

  return (
    <group ref={head} position={[0, 0, 0]}>
      {/* head */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#f1c9a5" roughness={0.6} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.35, 0.25, 0.85]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.35, 0.25, 0.85]}>
        <sphereGeometry args={[0.12, 32, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* mouth (scaled by viseme) */}
      <mesh ref={mouth} position={[0, -0.4, 0.85]} scale={[0.9, 0.3, 1]}>
        <sphereGeometry args={[0.22, 32, 16]} />
        <meshStandardMaterial color="#7a2230" roughness={0.4} />
      </mesh>
    </group>
  );
}
