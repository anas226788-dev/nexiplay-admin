'use client';

import { useEffect, useRef, useState } from 'react';

export default function RREmbedPlayerPage() {
    const [streamData, setStreamData] = useState<{
        title: string;
        format: string;
        playbackUrl: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [inputKey, setInputKey] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);

    const loadStream = (overrideKey?: string) => {
        setLoading(true);
        setError('');

        const params = new URLSearchParams(window.location.search);
        const slug = params.get('slug');
        const id = params.get('id');
        const season = params.get('season') || '1';
        const episode = params.get('episode') || params.get('ep') || '1';

        if (!slug && !id) {
            setError('Missing anime slug or id in parameters.');
            setLoading(false);
            return;
        }

        const apiKey = overrideKey || params.get('apiKey') || params.get('key');
        const keyParam = apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : '';

        const apiUrl = id
            ? `/api/v1/anime/stream?id=${encodeURIComponent(id)}&season=${season}&episode=${episode}${keyParam}`
            : `/api/v1/anime/stream?slug=${encodeURIComponent(slug!)}&season=${season}&episode=${episode}${keyParam}`;

        fetch(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setStreamData({
                        title: data.title,
                        format: data.format,
                        playbackUrl: data.playbackUrl
                    });
                } else {
                    setError(data.error || 'Failed to load RR stream.');
                }
            })
            .catch(err => {
                setError(err.message || 'Network error while loading stream.');
            })
            .finally(() => {
                setLoading(false);
            });
    };

    useEffect(() => {
        loadStream();
    }, []);

    // HLS video attachment if direct stream
    useEffect(() => {
        if (!streamData || streamData.format !== 'hls_stream' || !videoRef.current) return;
        const video = videoRef.current;
        const src = streamData.playbackUrl;

        // Native HLS support (Safari / iOS)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
            video.play().catch(() => {});
        } else {
            const win = window as any;
            const initHls = () => {
                if (win.Hls && win.Hls.isSupported()) {
                    const hls = new win.Hls({
                        enableWorker: true,
                        backBufferLength: 90
                    });
                    hls.loadSource(src);
                    hls.attachMedia(video);
                    hls.on(win.Hls.Events.MANIFEST_PARSED, () => {
                        video.play().catch(() => {});
                    });
                    hls.on(win.Hls.Events.ERROR, (_event: any, data: any) => {
                        if (data.fatal) {
                            if (data.type === win.Hls.ErrorTypes.NETWORK_ERROR) {
                                hls.startLoad();
                            } else if (data.type === win.Hls.ErrorTypes.MEDIA_ERROR) {
                                hls.recoverMediaError();
                            } else {
                                hls.destroy();
                            }
                        }
                    });
                } else {
                    video.src = src;
                }
            };

            if (win.Hls) {
                initHls();
            } else {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';
                script.onload = initHls;
                document.head.appendChild(script);
            }
        }
    }, [streamData]);

    const handleKeySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputKey.trim();
        if (!trimmed) return;
        const url = new URL(window.location.href);
        url.searchParams.set('apiKey', trimmed);
        window.history.replaceState({}, '', url.toString());
        loadStream(trimmed);
    };

    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden m-0 p-0 select-none">
            {loading && (
                <div className="flex flex-col items-center gap-3 text-white">
                    <div className="w-10 h-10 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                    <span className="text-xs font-semibold tracking-wider text-gray-400">Loading RR Nexiplay Stream...</span>
                </div>
            )}

            {error && (
                <div className="p-6 max-w-md w-full mx-4 bg-[#111118] border border-red-500/30 rounded-2xl text-center text-white shadow-2xl">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 text-xl font-bold">
                        ✕
                    </div>
                    <p className="text-xs font-bold text-red-400 mb-4">{error}</p>

                    {error.toLowerCase().includes('api key') ? (
                        <form onSubmit={handleKeySubmit} className="space-y-3">
                            <input
                                type="text"
                                value={inputKey}
                                onChange={(e) => setInputKey(e.target.value)}
                                placeholder="আপনার API Key টি এখানে পেস্ট করুন..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/80 border border-white/20 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500 font-mono text-center"
                                autoFocus
                            />
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-xs font-black rounded-xl transition-all shadow-md active:scale-95"
                                >
                                    আনলক ও প্লে করুন ▶
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold rounded-xl transition-all border border-white/10"
                                >
                                    রিলোড
                                </button>
                            </div>
                        </form>
                    ) : (
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-xs font-bold rounded-xl transition-all"
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {!loading && !error && streamData && (
                <div className="w-full h-full relative">
                    <video
                        ref={videoRef}
                        controls
                        playsInline
                        autoPlay
                        className="w-full h-full object-contain bg-black"
                    />
                </div>
            )}
        </div>
    );
}
