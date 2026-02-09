import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, useAuth } from './contexts';
import { Landing } from './components/pages/Landing';
import { Dashboard } from './components/pages/Dashboard';
import { Login } from './components/pages/Auth/Login';
import Whiteboard from './components/Whiteboard/Whiteboard';

// simple spinner for async auth checks.
const LoadingScreen = () => (
  <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0B0C10]">
    <div className="relative">
      <div className="w-10 h-10 border-3 border-gray-700 border-t-[#66FCF1] rounded-full animate-spin" />
    </div>
    <p className="mt-6 text-gray-400 text-sm">
      Loading...
    </p>
  </div>
);

// standard auth guard. kicks unauthenticated users back to login.
// forces a replace to keep history clean.
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Login />} />

      {/* dashboard temporarily exposed without auth for dev convenience */}
      <Route
        path="/home"
        element={<Dashboard />}
      />

      {/* whiteboard route. exposed for testing. 
          TODO: wrap in ProtectedRoute before shipping to prod. */}
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