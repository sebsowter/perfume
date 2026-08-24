import { useState } from "react";
import { BottleCanvas } from "./BottleCanvas";
import { BottleViewer } from "./BottleViewer";

type View = "viewer" | "canvas";

function App() {
  const now = new Date(2026, 7, 25);

  const [view, setView] = useState<View>("viewer");

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 10,
          display: "flex",
          gap: "0.5rem",
        }}
      >
        <button onClick={() => setView("viewer")}>Delivery Asset</button>
        <button onClick={() => setView("canvas")}>Master Asset</button>
      </div>

      {view === "viewer" ? <BottleViewer /> : <BottleCanvas />}

      <div
        style={{
          position: "relative",
          padding: "1rem",
          pointerEvents: "none",
        }}
      >
        <p>R3F Fragrance Bottle</p>
        <p>Phase 2 / Branding</p>
        <p>{now.toLocaleDateString()}</p>
        <p>{view === "viewer" ? "Delivery Asset" : "Master Asset"}</p>
      </div>
    </>
  );
}

export default App;
