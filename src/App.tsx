import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ThemeProvider, useAuth } from './contexts';
import { Landing } from './components/pages/Landing';
import { Dashboard } from './components/pages/Dashboard';
import { Login } from './components/pages/Auth/Login';
import Whiteboard from './components/Whiteboard/Whiteboard';
import { DBProvider } from './db/DBProvider';

/* --- 1. LOADING SCREEN --- */
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

/* --- 2. PROTECTED ROUTE WRAPPER --- */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;

  return <>{children}</>;
};


/* --- 4. APP ROUTES --- */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Login />} /> {/* Updated to use Login Component */}

      {/* Dashboard - Temporarily unprotected for testing */}
      <Route
        path="/home"
        element={<Dashboard />}
      />

      {/* Route for Whiteboard. 
         Note: In a real app, this should be protected. 
         Currently left unprotected for easy testing if desired, 
         or wrap in <ProtectedRoute> to enforce the new Login flow.
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
      <DBProvider>
        <ThemeProvider>
          <AuthProvider>
            <div className="min-h-screen w-full bg-[#0B0C10] text-[#eceef0]">
              <AppRoutes />
            </div>
          </AuthProvider>
        </ThemeProvider>
        </DBProvider>
    </BrowserRouter>
  );
}

export default App;