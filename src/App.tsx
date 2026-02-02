import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, useAuth } from './contexts';
import { Landing } from './components/pages/Landing';
import Whiteboard from './components/Whiteboard/Whiteboard'; // Make sure path matches your file structure!
import { Plus, LogOut, LayoutGrid, User as UserIcon } from 'lucide-react';

/* --- 1. GRAPHITE LOADING SCREEN --- */
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0B0C10]">
    <div className="relative">
      <div className="w-12 h-12 border-4 border-[#1F2833] border-t-[#66FCF1] rounded-full animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 bg-[#66FCF1] rounded-full animate-pulse" />
      </div>
    </div>
    <p className="mt-6 text-[#66FCF1] font-mono text-xs tracking-[0.2em] animate-pulse">
      INITIALIZING SYSTEM...
    </p>
  </div>
);

/* --- 2. PROTECTED ROUTE WRAPPER --- */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return <>{children}</>;
};

/* --- 3. DASHBOARD COMPONENT --- */
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#0B0C10] text-[#eceef0] p-6 md:p-12 font-sans">
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1F2833] rounded-lg border border-[#262e35]">
            <LayoutGrid className="text-[#66FCF1] w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Workspace</h1>
            <p className="text-xs text-gray-500 font-mono">SECURE SESSION ACTIVE</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right hidden md:block">
            <div className="text-sm font-bold text-white">{user?.name}</div>
            <div className="text-xs font-mono text-gray-500">{user?.email}</div>
          </div>
          <button onClick={logout} className="p-2 text-gray-500 hover:text-[#fb7185] transition-all">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        <div 
          onClick={() => navigate(`/board/${Math.random().toString(36).substr(2, 9)}`)}
          className="group aspect-video rounded-2xl border border-[#262e35] bg-[#1a2026]/40 hover:bg-[#1a2026] hover:border-[#66FCF1]/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-lg shadow-black/20"
        >
           <Plus className="w-12 h-12 text-[#66FCF1] group-hover:scale-110 transition-transform" />
           <span className="font-bold text-white">Create New Board</span>
        </div>
      </main>
    </div>
  );
};

/* --- 4. APP ROUTES --- */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Landing />} />

      {/* Protected Dashboard */}
      <Route 
        path="/home" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      
      {/* --- TESTING CONFIGURATION ---
         I removed <ProtectedRoute> wrapper here so you can 
         click "Start Sketching" and go straight to the board 
         without logging in.
      */}
      <Route
        path="/board/:id"
        element={<Whiteboard />} 
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <div className="min-h-screen w-full bg-[#0B0C10] text-[#eceef0]">
            <AppRoutes />
          </div>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;