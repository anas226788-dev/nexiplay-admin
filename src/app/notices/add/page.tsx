'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadNoticeImage } from '@/lib/upload';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STYLE_PRESETS = [
    {
        id: 'red_gradient',
        name: '🔥 Crimson Alert (Gradient)',
        bg: 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 border border-red-500/20 shadow-lg shadow-red-900/20',
        text: 'text-white'
    },
    {
        id: 'app_launch_crimson',
        name: '📱 App Launch Crimson (Special Promo)',
        bg: 'bg-gradient-to-r from-red-700 via-rose-600 to-amber-600 border border-red-400/30 shadow-xl shadow-red-900/30',
        text: 'text-white'
    },
    {
        id: 'cyberpunk',
        name: '🌌 Cyberpunk Neon (Gradient)',
        bg: 'bg-gradient-to-r from-purple-800 via-violet-700 to-cyan-600 border border-cyan-500/30 shadow-lg shadow-cyan-900/20',
        text: 'text-cyan-100'
    },
    {
        id: 'gold_metallic',
        name: '✨ Gold Metallic (Gradient)',
        bg: 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 border border-amber-400/30 shadow-lg shadow-amber-900/10',
        text: 'text-black'
    },
    {
        id: 'glassmorphism',
        name: '💎 Glassmorphic Frost',
        bg: 'bg-white/5 backdrop-blur-md border border-white/10 shadow-xl',
        text: 'text-white'
    },
    {
        id: 'midnight',
        name: '🌙 Midnight Sleek',
        bg: 'bg-black/60 border border-white/5 shadow-lg',
        text: 'text-gray-200'
    }
];

export default function AddNoticePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // App config info from Supabase
    const [appConfig, setAppConfig] = useState<{ apk_url: string; latest_version_name: string } | null>(null);

    // Form data state
    const [formData, setFormData] = useState({
        content: '',
        image_url: '',
        video_url: '',
        platform: 'both',
        type: 'top_bar',
        pages: 'all',
        movie_id: '',
        bg_color: 'bg-gradient-to-r from-red-600 via-red-500 to-orange-600 border border-red-500/20 shadow-lg shadow-red-900/20',
        text_color: 'text-white',
        is_active: true
    });

    // Preset selection state
    const [selectedPreset, setSelectedPreset] = useState<string>('0');

    // Movies target search/select state
    const [movies, setMovies] = useState<any[]>([]);
    const [loadingMovies, setLoadingMovies] = useState(false);
    const [movieSearch, setMovieSearch] = useState('');

    // App download button builder state
    const [btnText, setBtnText] = useState('📥 Download App APK');
    const [btnUrl, setBtnUrl] = useState('');
    const [btnStyle, setBtnStyle] = useState<'white' | 'large' | 'neon'>('white');

    useEffect(() => {
        async function fetchInitialData() {
            setLoadingMovies(true);
            try {
                // Fetch Movies
                const { data: moviesData } = await supabase
                    .from('movies')
                    .select('id, title, type, release_year')
                    .order('title', { ascending: true });
                if (moviesData) setMovies(moviesData);

                // Fetch App Config
                const { data: configData } = await supabase
                    .from('app_config')
                    .select('apk_url, latest_version_name')
                    .eq('id', 'app_update')
                    .single();

                if (configData) {
                    setAppConfig(configData);
                    const defaultUrl = configData.apk_url || '';
                    const defaultVer = configData.latest_version_name || '1.0.3';
                    setBtnUrl(defaultUrl);
                    setBtnText(`📥 Download APK (v${defaultVer})`);
                }
            } catch (err) {
                console.error('Error fetching initial data:', err);
            } finally {
                setLoadingMovies(false);
            }
        }
        fetchInitialData();
    }, []);

    const handlePresetChange = (value: string) => {
        setSelectedPreset(value);
        if (value === 'custom') {
            setFormData(prev => ({
                ...prev,
                bg_color: '#ff0000',
                text_color: '#ffffff'
            }));
        } else {
            const preset = STYLE_PRESETS[parseInt(value)];
            setFormData(prev => ({
                ...prev,
                bg_color: preset.bg,
                text_color: preset.text
            }));
        }
    };

    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }
        setUploading(true);
        const url = await uploadNoticeImage(file, formData.content?.substring(0, 50));
        if (url) {
            setFormData(prev => ({ ...prev, image_url: url }));
        } else {
            alert('Failed to upload image. Please try again.');
        }
        setUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleImageUpload(file);
    };

    // ── Quick Templates for App Download ──
    const applyAppDownloadTemplate = (templateType: 'top_bar' | 'popup' | 'bottom_bar') => {
        const downloadLink = btnUrl || '/api/download/apk';
        const ver = appConfig?.latest_version_name || '1.0.3';

        if (templateType === 'top_bar') {
            setFormData({
                ...formData,
                type: 'top_bar',
                platform: 'web',
                pages: 'all',
                bg_color: STYLE_PRESETS[1].bg,
                text_color: 'text-white',
                content: `📱 <b>NexiPlay Official Android App (v${ver}):</b> Faster streaming, background downloads & zero ads! <a href="${downloadLink}" class="notice-app-btn"><span>📥</span> Download APK</a>`
            });
            setSelectedPreset('1');
        } else if (templateType === 'popup') {
            setFormData({
                ...formData,
                type: 'popup',
                platform: 'web',
                pages: 'home',
                bg_color: 'bg-dark-900/90 backdrop-blur-2xl border border-red-500/20 shadow-2xl',
                text_color: 'text-white',
                content: `<div class="text-center space-y-3">
  <div class="text-3xl">📱✨</div>
  <h3 class="text-xl font-bold text-white">NexiPlay Android App is Live!</h3>
  <p class="text-sm text-gray-300">Enjoy 4K HDR playback, fast episode downloads, novel reading & instant background streaming directly on your phone.</p>
  <div class="pt-2">
    <a href="${downloadLink}" class="notice-app-btn-lg">🚀 Download Free APK (v${ver})</a>
  </div>
</div>`
            });
            setSelectedPreset('custom');
        } else if (templateType === 'bottom_bar') {
            setFormData({
                ...formData,
                type: 'bottom_bar',
                platform: 'web',
                pages: 'all',
                bg_color: 'bg-dark-900/95 border-t border-red-500/30',
                text_color: 'text-white',
                content: `📲 <b>Watch on Mobile:</b> Download the official NexiPlay app for the fastest streaming experience. <a href="${downloadLink}" class="notice-app-btn">⚡ Install Now</a>`
            });
            setSelectedPreset('custom');
        }
    };

    // ── Insert Download Button into Message Content ──
    const insertDownloadButton = () => {
        const downloadLink = btnUrl || '/api/download/apk';

        const btnClass = btnStyle === 'large' ? 'notice-app-btn-lg' : btnStyle === 'neon' ? 'notice-app-btn-neon' : 'notice-app-btn';
        const buttonHtml = ` <a href="${downloadLink}" class="${btnClass}">${btnText || '📥 Download APK'}</a>`;

        setFormData(prev => ({
            ...prev,
            content: prev.content ? `${prev.content}${buttonHtml}` : buttonHtml.trim()
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            content: formData.content,
            type: formData.type,
            pages: formData.pages,
            bg_color: formData.bg_color,
            text_color: formData.text_color,
            is_active: formData.is_active,
            image_url: formData.image_url || null,
            video_url: formData.video_url || null,
            platform: formData.platform,
            movie_id: formData.pages === 'specific' && formData.movie_id ? formData.movie_id : null
        };

        if (formData.pages === 'specific' && !payload.movie_id) {
            alert('Please select a targeted content title.');
            setLoading(false);
            return;
        }

        const { error } = await supabase
            .from('notices')
            .insert([payload]);

        if (error) {
            alert(error.message);
        } else {
            router.push('/notices');
        }
        setLoading(false);
    };

    const filteredMovies = movies.filter(m =>
        m.title.toLowerCase().includes(movieSearch.toLowerCase())
    );

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <span className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-lg">
                            📢
                        </span>
                        Create Notice
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Publish announcements, alerts, and app download promos to Website & App</p>
                </div>
                <Link href="/notices" className="text-sm text-gray-400 hover:text-white transition-colors">
                    ← Back to Notices
                </Link>
            </div>

            {/* ── 1-Click App Download Promo Templates ── */}
            <div className="p-6 bg-gradient-to-r from-red-950/40 via-dark-800 to-dark-800 rounded-2xl border border-red-500/20 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                        <span className="text-2xl">📲</span>
                        <div>
                            <h3 className="text-base font-bold text-white">App Download Notice Templates</h3>
                            <p className="text-xs text-gray-400">Instantly create a notice that lets website visitors download the Android APK</p>
                        </div>
                    </div>
                    {appConfig?.latest_version_name && (
                        <span className="text-xs font-semibold px-2.5 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full">
                            Latest APK: v{appConfig.latest_version_name}
                        </span>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <button
                        type="button"
                        onClick={() => applyAppDownloadTemplate('top_bar')}
                        className="p-3 bg-dark-900/80 hover:bg-red-600/20 border border-white/10 hover:border-red-500/40 rounded-xl text-left transition-all group"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-red-400 group-hover:text-red-300">
                            <span>📌</span> Top Bar Banner
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Header strip with direct download button</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => applyAppDownloadTemplate('popup')}
                        className="p-3 bg-dark-900/80 hover:bg-red-600/20 border border-white/10 hover:border-red-500/40 rounded-xl text-left transition-all group"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-red-400 group-hover:text-red-300">
                            <span>💬</span> Launch Modal Popup
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Stunning popup card with large download CTA</p>
                    </button>

                    <button
                        type="button"
                        onClick={() => applyAppDownloadTemplate('bottom_bar')}
                        className="p-3 bg-dark-900/80 hover:bg-red-600/20 border border-white/10 hover:border-red-500/40 rounded-xl text-left transition-all group"
                    >
                        <div className="flex items-center gap-2 text-xs font-bold text-red-400 group-hover:text-red-300">
                            <span>⬇️</span> Bottom Sticky Bar
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">Floating bar fixed at bottom of screen</p>
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-dark-800 p-8 rounded-2xl border border-white/5 space-y-6 shadow-xl">
                {/* Notice Content */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-300">Message Content (HTML Supported)</label>
                        <span className="text-[11px] text-gray-500">Supports &lt;b&gt;, &lt;a&gt;, &lt;span&gt;, &lt;br&gt;</span>
                    </div>
                    <textarea
                        required
                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-600 text-sm font-mono leading-relaxed"
                        rows={4}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        placeholder="e.g. 📱 <b>NexiPlay Official App:</b> Download now for faster streaming & offline downloads! <a href='...' class='notice-app-btn'>Download APK</a>"
                    />
                </div>

                {/* ── App Download Button Generator ── */}
                <div className="p-5 bg-dark-700/40 rounded-xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <span className="text-green-400">📥</span> Insert App Download Action Button
                        </h4>
                        <span className="text-[11px] text-gray-400">Click to append to your message</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Button Label</label>
                            <input
                                type="text"
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                                value={btnText}
                                onChange={(e) => setBtnText(e.target.value)}
                                placeholder="e.g. 📥 Download APK (v1.0.3)"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-gray-400 mb-1">APK Download Link (Google Drive / S3 / Direct)</label>
                            <input
                                type="url"
                                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-red-600"
                                value={btnUrl}
                                onChange={(e) => setBtnUrl(e.target.value)}
                                placeholder="https://drive.google.com/uc?export=download&id=..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">Style:</span>
                            <button
                                type="button"
                                onClick={() => setBtnStyle('white')}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${btnStyle === 'white' ? 'bg-white text-red-600 font-bold' : 'bg-dark-900 text-gray-400 border border-white/10'}`}
                            >
                                Pill White
                            </button>
                            <button
                                type="button"
                                onClick={() => setBtnStyle('large')}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${btnStyle === 'large' ? 'bg-red-600 text-white font-bold' : 'bg-dark-900 text-gray-400 border border-white/10'}`}
                            >
                                Large Red Button
                            </button>
                            <button
                                type="button"
                                onClick={() => setBtnStyle('neon')}
                                className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${btnStyle === 'neon' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold' : 'bg-dark-900 text-gray-400 border border-white/10'}`}
                            >
                                Cyber Neon
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={insertDownloadButton}
                            className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5"
                        >
                            <span>➕</span> Insert Download Button into Message
                        </button>
                    </div>
                </div>

                {/* ── Live Preview Card ── */}
                {formData.content && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Live Preview</label>
                        <div
                            className={`p-4 rounded-xl text-center text-sm font-medium relative border overflow-hidden ${formData.bg_color} ${formData.text_color}`}
                        >
                            <div className="flex items-center justify-center gap-2 flex-wrap" dangerouslySetInnerHTML={{ __html: formData.content }} />
                        </div>
                    </div>
                )}

                {/* Video URL */}
                <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Notice Video URL (Optional)</label>
                    <input
                        type="text"
                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600"
                        value={formData.video_url}
                        onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                        placeholder="YouTube video link, or direct mp4/webm link"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Popups & inline notices render video player. For top bars, a glowing button opens the video.
                    </p>
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Notice Image (Optional, Only if Video is blank)</label>
                    {formData.image_url ? (
                        <div className="relative inline-block">
                            <img src={formData.image_url} alt="Notice" className="max-w-[250px] h-auto rounded-xl border border-white/10" />
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, image_url: '' })}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${uploading ? 'border-blue-500/50 bg-blue-500/5' : 'border-white/10 hover:border-white/30 hover:bg-white/5'}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            {uploading ? (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-blue-400 text-sm">Uploading...</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-gray-400 text-sm font-medium">Click to upload or drag & drop</p>
                                    <p className="text-gray-600 text-xs">JPG, PNG, GIF, WebP</p>
                                </div>
                            )}
                        </div>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Platform</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600"
                            value={formData.platform}
                            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                        >
                            <option value="both">🌐 Both (Web & App)</option>
                            <option value="web">💻 Web Only</option>
                            <option value="app">📱 App Only</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Type</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="top_bar">📌 Top Bar (Sticky Header)</option>
                            <option value="popup">💬 Popup Modal (Center)</option>
                            <option value="inline">📄 Inline (In Page)</option>
                            <option value="toast">🔔 Toast (Corner Notification)</option>
                            <option value="bottom_bar">⬇️ Bottom Bar (Sticky Footer)</option>
                            <option value="fullscreen">🖥️ Fullscreen Takeover</option>
                            <option value="marquee">📰 Marquee Ticker (Scrolling - Top)</option>
                            <option value="marquee_bottom">📰 Marquee Ticker (Scrolling - Bottom)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Show On</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600"
                            value={formData.pages}
                            onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        >
                            <option value="all">All Pages</option>
                            <option value="home">Homepage Only</option>
                            <option value="movie">All Movies/Series Pages</option>
                            <option value="specific">Specific Content Only</option>
                        </select>
                    </div>
                </div>

                {/* Specific Content Target Picker */}
                {formData.pages === 'specific' && (
                    <div className="space-y-4 bg-gradient-to-b from-dark-900 to-dark-800/50 p-5 rounded-2xl border border-white/[0.08] shadow-lg">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-200">
                                <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-red-500/15 text-red-400">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </span>
                                Target Content
                            </label>
                            <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{filteredMovies.length} titles</span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search movies, anime, series..."
                                className="w-full bg-dark-800/80 border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-red-500/50 text-sm placeholder:text-gray-600 transition-all"
                                value={movieSearch}
                                onChange={(e) => setMovieSearch(e.target.value)}
                            />
                        </div>

                        {/* Content List */}
                        {loadingMovies ? (
                            <div className="flex items-center justify-center gap-2 py-6">
                                <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                                <span className="text-gray-500 text-xs">Loading content database...</span>
                            </div>
                        ) : filteredMovies.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-gray-500 text-sm">No titles found</p>
                            </div>
                        ) : (
                            <div className="max-h-52 overflow-y-auto space-y-1 pr-1 custom-scrollbar rounded-xl">
                                {filteredMovies.map(movie => {
                                    const isSelected = formData.movie_id === movie.id;
                                    return (
                                        <button
                                            type="button"
                                            key={movie.id}
                                            onClick={() => setFormData({ ...formData, movie_id: movie.id })}
                                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all ${isSelected ? 'bg-red-500/10 border border-red-500/30 text-white' : 'bg-white/[0.02] hover:bg-white/[0.06] text-gray-300'}`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-red-500 border-red-500' : 'border-white/20'}`}>
                                                {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-sm truncate flex-1">{movie.title}</span>
                                            <span className="text-[10px] uppercase font-bold text-gray-500">{movie.type}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Preset Selector */}
                <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Style Theme Preset</label>
                    <select
                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600"
                        value={selectedPreset}
                        onChange={(e) => handlePresetChange(e.target.value)}
                    >
                        {STYLE_PRESETS.map((preset, index) => (
                            <option key={index} value={index}>
                                {preset.name}
                            </option>
                        ))}
                        <option value="custom">⚙️ Custom Colors (Pick Manually)</option>
                    </select>
                </div>

                {/* Custom Colors Block */}
                {selectedPreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-dark-900 rounded-xl border border-white/5">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Background Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    className="h-10 w-12 bg-dark-800 border border-white/10 rounded-lg p-1 cursor-pointer"
                                    value={formData.bg_color.startsWith('#') ? formData.bg_color : '#ff0000'}
                                    onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                                />
                                <input
                                    type="text"
                                    className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white text-xs"
                                    value={formData.bg_color}
                                    onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Text Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    className="h-10 w-12 bg-dark-800 border border-white/10 rounded-lg p-1 cursor-pointer"
                                    value={formData.text_color.startsWith('#') ? formData.text_color : '#ffffff'}
                                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                                />
                                <input
                                    type="text"
                                    className="flex-1 bg-dark-800 border border-white/10 rounded-lg px-3 py-2 text-white text-xs"
                                    value={formData.text_color}
                                    onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                    <span className="text-sm font-semibold text-white">Active (Visible to users)</span>
                </div>

                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-red-600/20 text-base"
                >
                    {loading ? 'Publishing Notice...' : '🚀 Publish Notice'}
                </button>
            </form>
        </div>
    );
}
