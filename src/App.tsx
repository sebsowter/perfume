import { BottleCanvas } from "./BottleCanvas";

function App() {
  const now = new Date(2026, 6, 26);

  return (
    <>
      <BottleCanvas />
      <div
        style={{ position: "relative", padding: "2rem", pointerEvents: "none" }}
      >
        <p>R3F Glossy Gold Test</p>
        <p>{now.toLocaleDateString()}</p>
      </div>
    </>
  );
}

export default App;
