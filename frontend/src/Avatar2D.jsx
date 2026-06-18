import { useRef, useEffect } from "react";

// 2D avatar: shows public/avatar.png and overlays an animated mouth that
// opens/closes in sync with Rhubarb cues during audio playback.
//
// MOUTH_POS pins the mouth over the avatar's face. Tweak top/left (% of image)
// if it doesn't line up with your image.
const MOUTH_POS = { top: 38, left: 50, width: 5.5, maxHeight: 4 }; // percentages

const RHUBARB_OPEN = {
  A: 0.05, B: 0.3, C: 0.55, D: 1.0, E: 0.6, F: 0.4, G: 0.25, H: 0.45, X: 0.04,
};

export default function Avatar2D({ lipsync, audioRef, speaking }) {
  const mouthRef = useRef(null);
  const raf = useRef(0);

  useEffect(() => {
    const tick = () => {
      const t = audioRef.current ? audioRef.current.currentTime : 0;
      let open = 0.04;
      if (speaking && lipsync && lipsync.length) {
        for (const cue of lipsync) {
          if (t >= cue.start && t <= cue.end) {
            open = RHUBARB_OPEN[cue.value] ?? 0.04;
            break;
          }
        }
      }
      const el = mouthRef.current;
      if (el) {
        const h = MOUTH_POS.maxHeight * open;
        el.style.height = h + "%";
        el.style.opacity = open > 0.08 ? 1 : 0;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [lipsync, audioRef, speaking]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <img
        src="/avatar.png"
        alt="avatar"
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
        onError={(e) => { e.currentTarget.style.opacity = 0.15; }}
      />
      {/* animated mouth */}
      <div
        ref={mouthRef}
        style={{
          position: "absolute",
          top: MOUTH_POS.top + "%",
          left: MOUTH_POS.left + "%",
          width: MOUTH_POS.width + "%",
          height: "0.3%",
          transform: "translate(-50%, -50%)",
          background: "#5a1018",
          borderRadius: "50%",
          transition: "height 0.05s linear, opacity 0.05s linear",
          opacity: 0,
        }}
      />
    </div>
  );
}
