import { Routes, Route, useNavigate } from 'react-router-dom';
import Whiteboard from './components/Whiteboard';
import './App.css';

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

const RoomPage = () => {
  return <Whiteboard />;
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