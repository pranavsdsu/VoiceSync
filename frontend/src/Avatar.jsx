import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

// Rhubarb mouth shape -> ReadyPlayerMe Oculus viseme morph target.
// Rhubarb emits A-H plus X (rest). RPM avatars expose viseme_* blendshapes.
const RHUBARB_TO_VISEME = {
  A: "viseme_PP", // closed (m, b, p)
  B: "viseme_kk", // slightly open (k, s, t)
  C: "viseme_I",  // open (eh)
  D: "viseme_aa", // wide open (ah)
  E: "viseme_O",  // rounded (oh)
  F: "viseme_U",  // puckered (oo, w)
  G: "viseme_FF", // f, v
  H: "viseme_TH", // l, th
  X: "viseme_sil", // rest
};

export default function Avatar({ url, lipsync, audioRef, speaking }) {
  const { scene, nodes } = useGLTF(url);
  const meshes = useRef([]);

  useEffect(() => {
    // collect meshes that carry morph targets (head, teeth)
    meshes.current = [];
    scene.traverse((o) => {
      if (o.morphTargetDictionary && o.morphTargetInfluences) {
        meshes.current.push(o);
      }
    });
  }, [scene]);

  useFrame(() => {
    const t = audioRef.current ? audioRef.current.currentTime : 0;
    // find active cue
    let active = "X";
    if (speaking && lipsync && lipsync.length) {
      for (const cue of lipsync) {
        if (t >= cue.start && t <= cue.end) {
          active = cue.value;
          break;
        }
      }
    }
    const target = RHUBARB_TO_VISEME[active] || "viseme_sil";
    for (const mesh of meshes.current) {
      const dict = mesh.morphTargetDictionary;
      for (const name in dict) {
        const idx = dict[name];
        const goal = name === target ? 1 : 0;
        // smooth toward goal
        mesh.morphTargetInfluences[idx] +=
          (goal - mesh.morphTargetInfluences[idx]) * 0.4;
      }
    }
  });

  return <primitive object={scene} position={[0, -1.6, 0]} scale={1.1} />;
}
