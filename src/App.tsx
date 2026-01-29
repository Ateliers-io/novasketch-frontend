import { Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';

// Placeholder for the Landing Page
const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="container">
      <h1>NovaSketch Project</h1>
      <p>Welcome to the base boilerplate.</p>
      <button onClick={() => navigate(`/room/${Date.now()}`)}>
        Create New Room
      </button>
    </div>
  );
};

// Placeholder for the Whiteboard/Room
const RoomPage = () => {
  return (
    <div className="board-container">
      <h2>Room Component</h2>
      <p>TODO: Implement Whiteboard logic here using Konva & YJS.</p>
    </div>
  );
};

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  );
}

export default App;