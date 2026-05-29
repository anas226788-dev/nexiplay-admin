'use client';

import { useState, useEffect } from 'react';

export default function SplashScreen() {
    const [show, setShow] = useState(true);
    const [visible, setVisible] = useState(true);
    const [particles, setParticles] = useState<Array<{ style: any }>>([]);

    useEffect(() => {
        // Generate particles only on client side to prevent hydration match
        const newParticles = [...Array(20)].map(() => ({
            style: {
                width: Math.random() * 10 + 2 + 'px',
                height: Math.random() * 10 + 2 + 'px',
                left: Math.random() * 100 + '%',
                top: '100%',
                animation: `particle-move ${Math.random() * 3 + 2}s linear infinite`,
                animationDelay: Math.random() * 2 + 's'
            }
        }));
        setParticles(newParticles);

        // Check if splash has already been shown in this session
        const hasshown = sessionStorage.getItem('nexiplay_splash_shown');
        if (hasshown) {
            setShow(false);
            setVisible(false);
            return;
        }

        // Set flag
        sessionStorage.setItem('nexiplay_splash_shown', 'true');

        // Hide after animation (3.5s total)
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => setShow(false), 500); // Wait for fade out
        }, 3500);

        return () => clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div
            className={`fixed inset-0 z-[9999] bg-[#050505] flex items-center justify-center transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
        >
            {/* Background Particles (CSS based for performance) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {particles.map((particle, i) => (
                    <div
                        key={i}
                        className="absolute rounded-full bg-red-600/20 blur-sm"
                        style={particle.style}
                    />
                ))}
            </div>

            {/* Main Content */}
            <div className="relative text-center animate-float">
                {/* Logo Container */}
                <div className="relative w-32 h-32 mx-auto mb-6">
                    {/* Pulse Glow Effect */}
                    <div className="absolute inset-0 rounded-full bg-red-600/30 blur-2xl animate-pulse-glow" />

                    {/* Logo SVG */}
                    <div className="relative z-10 w-full h-full bg-gradient-to-br from-dark-800 to-black rounded-3xl border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden">
                        {/* Gloss Effect */}
                        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent" />

                        {/* N Icon */}
                        <svg className="w-16 h-16 text-red-600 drop-shadow-[0_0_15px_rgba(229,9,20,0.5)]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M4 4h4l6 8V4h6v16h-4l-6-8v8H4V4z" />
                        </svg>
                    </div>
                </div>

                {/* Text */}
                <div className="space-y-2 opacity-0 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                    <h1 className="text-4xl font-black tracking-tighter text-white">
                        NEXI<span className="text-red-600">PLAY</span>
                    </h1>
                    <p className="text-sm text-gray-400 tracking-widest uppercase">
                        Start Streaming
                    </p>
                </div>

                {/* Loading Indicator */}
                <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-48 h-1 bg-dark-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 w-full animate-[shimmer_2s_infinite] origin-left scale-x-0"
                        style={{ animation: 'loading-bar 3s ease-in-out forwards' }} />
                </div>
            </div>

            <style jsx>{`
        @keyframes loading-bar {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(0.7); }
          100% { transform: scaleX(1); }
        }
      `}</style>
        </div>
    );
}
