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
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
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

        const apiUrl = id
            ? `/api/v1/anime/stream?id=${encodeURIComponent(id)}&season=${season}&episode=${episode}`
            : `/api/v1/anime/stream?slug=${encodeURIComponent(slug!)}&season=${season}&episode=${episode}`;

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

    return (
        <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden m-0 p-0 select-none">
            {loading && (
                <div className="flex flex-col items-center gap-3 text-white">
                    <div className="w-10 h-10 border-3 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
                    <span className="text-xs font-semibold tracking-wider text-gray-400">Loading RR Nexiplay Stream...</span>
                </div>
            )}

            {error && (
                <div className="p-6 max-w-md bg-white/5 border border-red-500/20 rounded-2xl text-center text-white">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 text-xl font-bold">
                        ✕
                    </div>
                    <p className="text-sm font-medium text-red-300">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-bold rounded-xl transition-all"
                    >
                        Retry
                    </button>
                </div>
            )}

            {!loading && !error && streamData && (
                <div className="w-full h-full relative">
                    <video
                        ref={videoRef}
                        controls
                        playsInline
                        className="w-full h-full object-contain bg-black"
                    />
                </div>
            )}
        </div>
    );
}
