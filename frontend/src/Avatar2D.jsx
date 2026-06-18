import { useRef, useEffect } from "react";

// Image-based avatar with: (1) subtle idle motion (breathing + sway) so it
// feels alive, and (2) an SVG mouth overlay whose lips open/close in sync
// with Rhubarb cues during audio playback.
//
// MOUTH_POS pins the mouth onto the avatar's face (percent of the image box).
const MOUTH_POS = { top: 21.5, left: 49, width: 7, height: 4 }; // percentages

// Rhubarb mouth shape -> how open (0..1) and how wide (0..1) the mouth is.
const RHUBARB_SHAPE = {
  A: { open: 0.06, wide: 0.85 }, // m,b,p (closed)
  B: { open: 0.3, wide: 1.0 },   // k,s,t
  C: { open: 0.55, wide: 1.05 }, // eh
  D: { open: 1.0, wide: 1.1 },   // ah (wide)
  E: { open: 0.6, wide: 0.7 },   // oh (round)
  F: { open: 0.35, wide: 0.5 },  // oo,w (pucker)
  G: { open: 0.22, wide: 0.95 }, // f,v
  H: { open: 0.45, wide: 0.85 }, // l,th
  X: { open: 0.04, wide: 0.85 }, // rest
};

export default function Avatar2D({ lipsync, audioRef, speaking }) {
  const upperRef = useRef(null); // upper lip path
  const lowerRef = useRef(null); // lower lip path
  const cavityRef = useRef(null); // mouth interior
  const raf = useRef(0);
  const cur = useRef({ open: 0.04, wide: 0.85 });

  useEffect(() => {
    const tick = () => {
      const t = audioRef.current ? audioRef.current.currentTime : 0;
      let target = RHUBARB_SHAPE.X;
      if (speaking && lipsync && lipsync.length) {
        for (const cue of lipsync) {
          if (t >= cue.start && t <= cue.end) {
            target = RHUBARB_SHAPE[cue.value] || RHUBARB_SHAPE.X;
            break;
          }
        }
      }
      // smooth toward target
      cur.current.open += (target.open - cur.current.open) * 0.45;
      cur.current.wide += (target.wide - cur.current.wide) * 0.35;

      const open = cur.current.open; // 0..1
      const wide = cur.current.wide; // ~0.5..1.1
      // SVG viewBox is 100x60, mouth centered at (50,30)
      const halfW = 32 * wide;
      const gap = 22 * open; // vertical opening
      if (upperRef.current && lowerRef.current && cavityRef.current) {
        const cx = 50, cy = 30;
        upperRef.current.setAttribute(
          "d",
          `M ${cx - halfW} ${cy} Q ${cx} ${cy - 6 - gap * 0.4} ${cx + halfW} ${cy} Q ${cx} ${cy - gap * 0.5} ${cx - halfW} ${cy} Z`
        );
        lowerRef.current.setAttribute(
          "d",
          `M ${cx - halfW} ${cy} Q ${cx} ${cy + 6 + gap} ${cx + halfW} ${cy} Q ${cx} ${cy + gap * 0.6} ${cx - halfW} ${cy} Z`
        );
        cavityRef.current.setAttribute("cx", cx);
        cavityRef.current.setAttribute("cy", cy + gap * 0.25);
        cavityRef.current.setAttribute("rx", halfW * 0.8);
        cavityRef.current.setAttribute("ry", Math.max(0.5, gap * 0.7));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [lipsync, audioRef, speaking]);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes vs-breathe {
          0%   { transform: translateY(0) rotate(0deg) scale(1); }
          25%  { transform: translateY(-4px) rotate(-0.6deg) scale(1.004); }
          50%  { transform: translateY(0) rotate(0deg) scale(1.008); }
          75%  { transform: translateY(-3px) rotate(0.6deg) scale(1.004); }
          100% { transform: translateY(0) rotate(0deg) scale(1); }
        }
      `}</style>
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "inline-block",
          animation: "vs-breathe 5s ease-in-out infinite",
          transformOrigin: "50% 90%",
        }}
      >
        <img
          src="/avatar_new.png"
          alt="avatar"
          style={{ height: "100%", width: "auto", display: "block" }}
          onError={(e) => { e.currentTarget.style.opacity = 0.15; }}
        />
        {/* SVG animated mouth */}
        <svg
          viewBox="0 0 100 60"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            top: MOUTH_POS.top + "%",
            left: MOUTH_POS.left + "%",
            width: MOUTH_POS.width + "%",
            height: MOUTH_POS.height + "%",
            transform: "translate(-50%, -50%)",
            overflow: "visible",
          }}
        >
          {/* mouth cavity (dark interior) */}
          <ellipse ref={cavityRef} cx="50" cy="30" rx="20" ry="1" fill="#3a0d12" />
          {/* lips */}
          <path ref={upperRef} d="M 18 30 Q 50 24 82 30 Q 50 30 18 30 Z" fill="#9c3b48" />
          <path ref={lowerRef} d="M 18 30 Q 50 36 82 30 Q 50 30 18 30 Z" fill="#7a2230" />
        </svg>
      </div>
    </div>
  );
}
