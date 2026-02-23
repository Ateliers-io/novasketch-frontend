/**
 * PageNotFound — Generic 404 page for unmatched routes.
 *
 * Shown when a user navigates to any URL that doesn't match
 * a known route (e.g., /hii/di, /random/path, etc).
 */

import { useNavigate, useLocation } from 'react-router-dom';
import {
    Sparkles,
    ArrowLeft,
    Home,
    AlertTriangle,
    Search,
} from 'lucide-react';

export const PageNotFound = () => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0B0C10] relative overflow-hidden">

            {/* Background Glow Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-red-500 rounded-full mix-blend-overlay filter blur-[180px] opacity-[0.04]" />
                <div className="absolute bottom-1/3 right-1/4 w-[350px] h-[350px] bg-[#66FCF1] rounded-full mix-blend-overlay filter blur-[150px] opacity-[0.04]" />
            </div>

            {/* Floating Grid Background */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, #66FCF1 1px, transparent 1px)',
                    backgroundSize: '32px 32px',
                }}
            />

            {/* Main Content */}
            <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto px-6 text-center">

                {/* Error Icon */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 rounded-2xl bg-[#1F2833] border border-red-500/20 flex items-center justify-center shadow-xl shadow-red-500/5">
                        <AlertTriangle className="w-10 h-10 text-red-400" />
                    </div>
                    {/* Decorative corners */}
                    <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-red-500/30 rounded-tl-md" />
                    <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-red-500/30 rounded-tr-md" />
                    <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-red-500/30 rounded-bl-md" />
                    <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-red-500/30 rounded-br-md" />
                </div>

                {/* 404 Label */}
                <span className="text-6xl font-bold text-[#66FCF1]/20 mb-2 font-mono">404</span>

                {/* Heading */}
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
                    Page Not Found
                </h1>

                {/* Subtext */}
                <p className="text-gray-400 mb-4 leading-relaxed">
                    The page you're looking for doesn't exist.
                    Check the URL or head back to the landing page.
                </p>

                {/* URL Display */}
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F2833] border border-white/10 mb-8">
                    <Search className="w-3.5 h-3.5 text-[#45A29E] flex-shrink-0" />
                    <span className="text-xs font-mono text-red-400 break-all">
                        {location.pathname}
                    </span>
                </div>

                {/* Hint */}
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-[#66FCF1]/5 border border-[#66FCF1]/10 mb-10 text-left w-full">
                    <Sparkles className="w-4 h-4 text-[#66FCF1] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#8b9bb4] leading-relaxed">
                        <span className="text-[#66FCF1] font-medium">Tip:</span>{' '}
                        Valid pages include{' '}
                        <span className="font-mono text-gray-400">/</span>,{' '}
                        <span className="font-mono text-gray-400">/home</span>,{' '}
                        <span className="font-mono text-gray-400">/auth</span>, and{' '}
                        <span className="font-mono text-gray-400">/board/:id</span>
                    </p>
                </div>

                {/* Action Button */}
                <button
                    onClick={() => navigate('/')}
                    className="group h-12 px-8 rounded-xl bg-[#66FCF1] hover:bg-white text-black font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#66FCF1]/20"
                >
                    <Home className="w-4 h-4" />
                    Go to Landing Page
                </button>

                {/* Back Link */}
                <button
                    onClick={() => navigate(-1)}
                    className="mt-8 text-sm text-[#45A29E] hover:text-[#66FCF1] transition-colors flex items-center gap-1.5"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Go back
                </button>
            </div>
        </div>
    );
};

export default PageNotFound;
