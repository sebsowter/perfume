import { BottleCanvas } from "./BottleCanvas";

function App() {
  const now = new Date(2026, 7, 19);

  return (
    <>
      <BottleCanvas />
      <div
        style={{ position: "relative", padding: "2rem", pointerEvents: "none" }}
      >
        <p>R3F Fragrance Bottle</p>
        <p>Phase 1 / Geometry</p>
        <p>{now.toLocaleDateString()}</p>
      </div>
    </>
  );
}

export default App;
