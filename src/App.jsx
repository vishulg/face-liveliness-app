import LivenessCamera from "./components/LivenessCamera";

function App() {
  return (
    <div className="camera-wrapper">
      <h1 style={{ textAlign: "center" }}>
        Profile Photo Verification
      </h1>
      <LivenessCamera />
    </div>
  );
}

export default App;