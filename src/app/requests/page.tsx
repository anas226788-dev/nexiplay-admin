'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { ContentRequest, AppSettings, Category } from '@/lib/types';
import AdminShell from '@/components/AdminShell';

interface SearchResult {
    title: string;
    url: string;
}

export default function RequestsPage() {
    const [requests, setRequests] = useState<ContentRequest[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Scraper Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [savingSettings, setSavingSettings] = useState(false);

    // Categories (for approval form)
    const [categories, setCategories] = useState<Category[]>([]);

    // Search Modal
    const [activeSearchRequest, setActiveSearchRequest] = useState<ContentRequest | null>(null);
    const [activeSearchRequestType, setActiveSearchRequestType] = useState<'auto' | 'movie' | 'series' | 'anime'>('auto');
    const [searchSource, setSearchSource] = useState<'rareanimes' | 'bollyflix' | 'movielink'>('movielink');
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [importing, setImporting] = useState(false);

    // Review Modal
    const [activeReviewRequest, setActiveReviewRequest] = useState<ContentRequest | null>(null);
    const [reviewData, setReviewData] = useState<any>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [activeSeasonTab, setActiveSeasonTab] = useState(0);
    const [approving, setApproving] = useState(false);

    // Automation
    const [processingAll, setProcessingAll] = useState(false);
    const [autoProcessingId, setAutoProcessingId] = useState<string | null>(null);
    const [showAutomationLog, setShowAutomationLog] = useState<string | null>(null);
    const [processResultsModal, setProcessResultsModal] = useState<{
        title: string;
        results: { id: string; name: string; outcome: string; message: string; matched_source?: string | null; confidence?: number }[];
    } | null>(null);

    // Messages
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchRequests();
        fetchSettings();
        fetchCategories();
    }, []);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/requests', { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to load requests');
            setRequests(payload.requests ?? []);
        } catch (error: unknown) {
            console.error('Failed to load requests:', error);
            setRequests([]);
            const message = error instanceof Error ? error.message : 'Failed to load requests';
            showMessage('error', message);
        } finally {
            setLoading(false);
        }
    };
    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to load scraper domains');
            if (payload.settings) setSettings(payload.settings as AppSettings);
        } catch (error) {
            console.error('Failed to load scraper domains:', error);
            showMessage('error', error instanceof Error ? error.message : 'Failed to load scraper domains');
        }
    };    const fetchCategories = async () => {
        const { data } = await supabase.from('categories').select('*');
        if (data) setCategories(data);
    };

    const saveSettings = async () => {
        if (!settings) return;
        setSavingSettings(true);
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rareanimes_url: settings.rareanimes_url,
                    bollyflix_url: settings.bollyflix_url,
                    movielink_url: settings.movielink_url,
                }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Failed to save scraper domains');
            if (payload.settings) setSettings(payload.settings as AppSettings);
            showMessage('success', 'Domains updated successfully!');
            setShowSettings(false);
        } catch (error) {
            console.error('Failed to save scraper domains:', error);
            showMessage('error', error instanceof Error ? error.message : 'Failed to save scraper domains');
        } finally {
            setSavingSettings(false);
        }
    };

    const updateStatus = async (id: string, status: ContentRequest['status']) => {
        const { error } = await supabase
            .from('content_requests')
            .update({ status })
            .eq('id', id);

        if (!error) {
            setRequests(requests.map(r => r.id === id ? { ...r, status } : r));
            showMessage('success', `Request marked as ${status}`);
        } else {
            showMessage('error', 'Failed to update request status');
        }
    };

    // Trigger automated processing of a single request
    const handleAutoProcessSingle = async (req: ContentRequest) => {
        setAutoProcessingId(req.id);
        try {
            const res = await fetch(`/api/cron/process-requests?request_id=${req.id}`, { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Automation failed');
            const firstResult = (data.results || [])[0];
            if (firstResult) {
                if (firstResult.outcome === 'review_ready') {
                    showMessage('success', `🎉 ${firstResult.message}`);
                } else if (firstResult.outcome === 'no_match') {
                    showMessage('error', `🔍 "${req.content_name}": ${firstResult.message}`);
                } else if (firstResult.outcome === 'duplicate') {
                    showMessage('error', `📋 "${req.content_name}": ${firstResult.message}`);
                } else {
                    showMessage('error', `⚠️ "${req.content_name}": ${firstResult.message || firstResult.outcome}`);
                }
            }
            await fetchRequests();
        } catch (e: any) {
            showMessage('error', `Automation error: ${e.message}`);
        } finally {
            setAutoProcessingId(null);
        }
    };

    // Trigger automated processing of all pending requests
    const handleProcessAll = async () => {
        setProcessingAll(true);
        try {
            const res = await fetch('/api/cron/process-requests', { cache: 'no-store' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Processing failed');
            if (data.results && data.results.length > 0) {
                setProcessResultsModal({
                    title: `Agentic Pipeline: Processed ${data.processed || 0} Request(s)`,
                    results: data.results,
                });
            } else {
                showMessage('success', data.message || 'No pending requests needed processing.');
            }
            await fetchRequests();
        } catch (e: any) {
            showMessage('error', e.message);
        } finally {
            setProcessingAll(false);
        }
    };

    // Reset a failed/skipped request for retry
    const handleRetryRequest = async (id: string) => {
        const { error } = await supabase
            .from('content_requests')
            .update({ processing_status: 'idle', processing_attempts: 0, automation_error: null })
            .eq('id', id);
        if (!error) {
            setRequests(requests.map(r => r.id === id ? { ...r, processing_status: 'idle', processing_attempts: 0, automation_error: null } : r));
            showMessage('success', 'Request reset for retry');
        }
    };

    const deleteRequest = async (id: string) => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        const { error } = await supabase.from('content_requests').delete().eq('id', id);
        if (!error) {
            setRequests(requests.filter(r => r.id !== id));
            showMessage('success', 'Request deleted');
        } else {
            showMessage('error', 'Failed to delete request');
        }
    };

    const suggestImportSource = (contentName: string): 'rareanimes' | 'bollyflix' | 'movielink' => {
        const title = contentName.toLowerCase();
        if (/anime|manga|manhwa|isekai|seasons*d|episodes*d|sd+/.test(title)) return 'rareanimes';
        if (/series|kdrama|drama|web series|season/.test(title)) return 'bollyflix';
        return 'movielink';
    };

    // Open Search Modal
    const handleStartAgentImport = (req: ContentRequest) => {
        setActiveSearchRequest(req);
        setSearchQuery(req.content_name);
        setSearchResults([]);
        setSearchSource(suggestImportSource(req.content_name));
        setActiveSearchRequestType('auto');
    };

    // Execute Search API
    const handleAgentSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchResults([]);

        try {
            const res = await fetch('/api/agent/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: searchQuery, source: searchSource })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Search failed');
            setSearchResults(data.results || []);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSearching(false);
        }
    };

    // Execute Import API
    const handleAgentImport = async (url: string) => {
        if (!activeSearchRequest) return;
        setImporting(true);

        try {
            const res = await fetch('/api/agent/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: activeSearchRequest.id,
                    url,
                    source: searchSource,
                    type: activeSearchRequestType
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Import failed');
            
            // Reload requests
            await fetchRequests();
            setActiveSearchRequest(null);
            const detectedType = data.meta?.detected_type || data.data?.type || activeSearchRequestType;
            showMessage('success', `Imported as ${detectedType}. Content is ready for review.`);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setImporting(false);
        }
    };

    // Open Review Form
    const handleStartReview = (req: ContentRequest) => {
        setActiveReviewRequest(req);
        setReviewData(req.scraped_data);
        setActiveSeasonTab(0);
        // Pre-select categories suggested by the automation pipeline
        setSelectedCategories(req.suggested_categories || []);
    };

    // Submit Approved Content to Database
    const handleApproveContent = async () => {
        if (!activeReviewRequest || !reviewData) return;
        setApproving(true);

        try {
            const { title, type, release_year, poster_url, description, source_url, scraper_source, downloads, seasons } = reviewData;
            
            if (!title.trim()) throw new Error('Title is required');

            const baseSlug = title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');

            // Generate unique slug by checking existing ones
            let uniqueSlug = `${baseSlug}-${release_year}`;
            let counter = 1;
            
            while (true) {
                const { data: existing, error: checkError } = await supabase
                    .from('movies')
                    .select('id')
                    .eq('slug', uniqueSlug)
                    .maybeSingle();
                
                if (checkError) throw checkError;
                
                if (!existing) {
                    // Slug is unique, we can use it
                    break;
                }
                
                // Slug already exists, try with counter
                counter++;
                uniqueSlug = `${baseSlug}-${release_year}-${counter}`;
            }

            // 1. Insert Movie
            const { data: movie, error: movieError } = await supabase
                .from('movies')
                .insert({
                    title,
                    slug: uniqueSlug,
                    poster_url,
                    description,
                    type,
                    release_year,
                    scraper_source,
                    scraper_url: source_url
                })
                .select()
                .single();

            if (movieError) throw movieError;

            // 2. Insert Categories
            if (selectedCategories.length > 0) {
                const catInserts = selectedCategories.map(catId => ({
                    movie_id: movie.id,
                    category_id: catId
                }));
                const { error: catError } = await supabase.from('movie_categories').insert(catInserts);
                if (catError) throw catError;
            }

            // 3. Insert Movie Downloads
            if (type === 'movie' && downloads && downloads.length > 0) {
                // Legacy table insert
                const dlInserts = downloads.map((d: any) => ({
                    movie_id: movie.id,
                    quality: d.quality,
                    file_size: d.fileSize || '1GB',
                    file_url: d.fileUrl
                }));
                const { error: dlError } = await supabase.from('downloads').insert(dlInserts);
                if (dlError) throw dlError;

                // New resolution-based table insert
                try {
                    const resolutionLinks: Record<string, any> = {};
                    for (const d of downloads) {
                        const rawRes = d.quality || '720p';
                        // Clean/map resolution to standard tabs (360p, 480p, 720p, 1080p)
                        let res = '720p';
                        if (/\b360p\b/i.test(rawRes)) res = '360p';
                        else if (/\b480p\b/i.test(rawRes)) res = '480p';
                        else if (/\b720p\b/i.test(rawRes)) res = '720p';
                        else if (/\b1080p\b/i.test(rawRes)) res = '1080p';

                        const isMega = d.fileUrl?.includes('mega.nz');

                        if (!resolutionLinks[res]) {
                            resolutionLinks[res] = {
                                movie_id: movie.id,
                                resolution: res,
                                file_size: d.fileSize || null,
                                mega_link: isMega ? d.fileUrl : null,
                                gdrive_link: !isMega ? d.fileUrl : null,
                            };
                        } else {
                            if (isMega) {
                                resolutionLinks[res].mega_link = d.fileUrl;
                            } else {
                                resolutionLinks[res].gdrive_link = d.fileUrl;
                            }
                            if (d.fileSize) {
                                resolutionLinks[res].file_size = d.fileSize;
                            }
                        }
                    }

                    const linkInserts = Object.values(resolutionLinks);
                    if (linkInserts.length > 0) {
                        const { error: linkError } = await supabase.from('download_links').insert(linkInserts);
                        if (linkError) console.warn('download_links insert warning:', linkError);
                    }
                } catch (dlLinkErr) {
                    console.error('Failed to populate download_links table:', dlLinkErr);
                }
            }

            // 4. Insert Seasons / Episodes
            if (type !== 'movie' && seasons && seasons.length > 0) {
                for (const season of seasons) {
                    const { data: insertedSeason, error: seasonError } = await supabase
                        .from('seasons')
                        .insert({
                            movie_id: movie.id,
                            season_number: season.season_number,
                            season_title: `Season ${season.season_number}`
                        })
                        .select()
                        .single();

                    if (seasonError) throw seasonError;

                    if (season.episodes && season.episodes.length > 0) {
                        for (const ep of season.episodes) {
                            const { data: insertedEpisode, error: epError } = await supabase
                                .from('episodes')
                                .insert({
                                    season_id: insertedSeason.id,
                                    episode_number: ep.episode_number,
                                    episode_title: ep.episode_title || `Episode ${ep.episode_number}`
                                })
                                .select()
                                .single();

                            if (epError) throw epError;

                            if (ep.download_links && ep.download_links.length > 0) {
                                const linkInserts = ep.download_links.map((link: any) => {
                                    // Ensure resolution is valid, fallback to 720p
                                    let resolution = link.resolution || '720p';
                                    if (!['360p', '480p', '720p', '1080p'].includes(resolution)) {
                                        resolution = '720p';
                                    }
                                    return {
                                        episode_id: insertedEpisode.id,
                                        resolution,
                                        file_size: link.file_size || '',
                                        mega_link: link.mega_link || null,
                                        gdrive_link: link.gdrive_link || null
                                    };
                                });
                                const { error: linkError } = await supabase.from('episode_download_links').insert(linkInserts);
                                if (linkError) throw linkError;
                            }
                        }
                    }
                }
            }

            // 5. Update Content Request Status to added
            const { error: reqError } = await supabase
                .from('content_requests')
                .update({ status: 'added' })
                .eq('id', activeReviewRequest.id);

            if (reqError) throw reqError;

            showMessage('success', 'Content approved and added to catalog!');
            setActiveReviewRequest(null);
            fetchRequests();

        } catch (e: any) {
            alert('Error adding content: ' + e.message);
        } finally {
            setApproving(false);
        }
    };

    if (loading) return <AdminShell><div className="p-8 text-white">Loading...</div></AdminShell>;

    return (
        <AdminShell>
            <div className="max-w-5xl mx-auto space-y-8">
                {message && (
                    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl text-sm font-semibold shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
                        message.type === 'success' 
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 shadow-green-500/5' 
                        : 'bg-red-500/10 text-red-400 border-red-500/20 shadow-red-500/5'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        📥 Content Requests
                        <span className="px-3 py-1 bg-white/10 text-base rounded-full text-gray-300">
                            {requests.length}
                        </span>
                    </h1>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg border transition-all flex items-center gap-2 ${
                            showSettings 
                            ? 'bg-red-600 border-red-500 text-white' 
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                        title="Configure Scraper Domains"
                    >
                        <svg className={`w-5 h-5 ${showSettings ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Domains</span>
                    </button>
                    <button
                        onClick={handleProcessAll}
                        disabled={processingAll}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-sm transition-all bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-purple-500/30 text-purple-300 hover:from-purple-600/30 hover:to-indigo-600/30 disabled:opacity-50"
                        title="Automatically process all pending requests using the agentic pipeline"
                    >
                        {processingAll ? (
                            <>
                                <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <span>🤖</span>
                                <span>Auto Process All</span>
                            </>
                        )}
                    </button>
                </div>

                {/* Collapsible Scraper Domain Settings Panel */}
                {showSettings && settings && (
                    <div className="bg-dark-800 border border-white/5 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4 duration-300">
                        <div className="flex items-center justify-between border-b border-white/5 pb-3">
                            <h3 className="font-bold text-white text-lg">🔧 Scraper Domain Config</h3>
                            <span className="text-xs text-gray-500">Update these if the websites change their URLs</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">MovieLinkBD URL</label>
                                <input
                                    type="url"
                                    value={settings.movielink_url || ''}
                                    onChange={(e) => setSettings({ ...settings, movielink_url: e.target.value })}
                                    className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">RareAnimes URL</label>
                                <input
                                    type="url"
                                    value={settings.rareanimes_url || ''}
                                    onChange={(e) => setSettings({ ...settings, rareanimes_url: e.target.value })}
                                    className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">BollyFlix URL</label>
                                <input
                                    type="url"
                                    value={settings.bollyflix_url || ''}
                                    onChange={(e) => setSettings({ ...settings, bollyflix_url: e.target.value })}
                                    className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={saveSettings}
                                disabled={savingSettings}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50"
                            >
                                {savingSettings ? 'Saving...' : 'Save Domains'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Desktop Requests Table */}
                <div className="hidden md:block glass-panel rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                                <tr>
                                    <th className="px-6 py-4">Request Content</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="text-white font-semibold text-sm">
                                                    {req.content_name || req.title}
                                                </span>
                                                {req.has_account && (req.user_name || req.user_email) && (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25 shadow-sm">
                                                        {req.user_avatar ? (
                                                            <img src={req.user_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                                                        ) : (
                                                            <span className="text-[11px]">👤</span>
                                                        )}
                                                        <span>{req.user_name || req.user_email}</span>
                                                    </span>
                                                )}
                                            </div>
                                            {req.notes && (
                                                <p className="text-xs text-gray-400 italic mt-1 font-normal">
                                                    Note: {req.notes}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <span className={`px-2.5 py-1 text-xs font-black rounded-full capitalize inline-block w-fit ${
                                                    req.status === 'added' ? 'bg-green-500/20 text-green-400' :
                                                    req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                                    req.status === 'review' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/10' :
                                                    'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {req.status}
                                                </span>
                                                {/* Automation Status Badge */}
                                                {req.processing_status && req.processing_status !== 'idle' && (
                                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full inline-flex items-center gap-1 w-fit ${
                                                        req.processing_status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                                                        req.processing_status === 'processing' ? 'bg-blue-500/15 text-blue-400 animate-pulse' :
                                                        req.processing_status === 'failed' ? 'bg-orange-500/15 text-orange-400' :
                                                        req.processing_status === 'no_match' ? 'bg-gray-500/15 text-gray-400' :
                                                        req.processing_status === 'duplicate' ? 'bg-amber-500/15 text-amber-400' :
                                                        req.processing_status === 'skipped' ? 'bg-gray-500/15 text-gray-500' :
                                                        'bg-white/5 text-gray-500'
                                                    }`}>
                                                        {req.processing_status === 'completed' && '🤖'}
                                                        {req.processing_status === 'processing' && '⏳'}
                                                        {req.processing_status === 'failed' && '⚠️'}
                                                        {req.processing_status === 'no_match' && '🔍'}
                                                        {req.processing_status === 'duplicate' && '📋'}
                                                        {req.processing_status === 'skipped' && '⏭️'}
                                                        {req.processing_status}
                                                    </span>
                                                )}
                                                {/* Confidence Score */}
                                                {typeof req.confidence_score === 'number' && (
                                                    <span className={`text-[10px] font-mono font-bold ${
                                                        req.confidence_score >= 0.85 ? 'text-green-400' :
                                                        req.confidence_score >= 0.65 ? 'text-yellow-400' :
                                                        'text-orange-400'
                                                    }`}>
                                                        {Math.round(req.confidence_score * 100)}% match
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400 text-sm">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 flex items-center justify-end gap-2 flex-wrap">
                                            {req.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleAutoProcessSingle(req)}
                                                        disabled={autoProcessingId === req.id}
                                                        className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 rounded-lg hover:from-amber-500/30 hover:to-orange-500/30 transition-all flex items-center gap-1.5 text-xs font-bold shadow-sm disabled:opacity-50"
                                                        title="Auto-Process with Agentic Pipeline (Search, Resolve GDFlix & Stage)"
                                                    >
                                                        {autoProcessingId === req.id ? (
                                                            <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                                        ) : (
                                                            <span>⚡</span>
                                                        )}
                                                        <span>Auto</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleStartAgentImport(req)}
                                                        className="p-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                                                        title="Find and Import with Agent"
                                                    >
                                                        🤖 Scrape
                                                    </button>
                                                    {(req.processing_status === 'failed' || req.processing_status === 'no_match' || req.processing_status === 'skipped') && (
                                                        <button
                                                            onClick={() => handleRetryRequest(req.id)}
                                                            className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                                                            title="Reset and retry automation"
                                                        >
                                                            🔄 Retry
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => updateStatus(req.id, 'added')}
                                                        className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-all"
                                                        title="Mark as Added"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                            {req.status === 'review' && (
                                                <>
                                                    <button
                                                        onClick={() => handleStartAgentImport(req)}
                                                        className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-all flex items-center gap-1.5 text-xs font-bold"
                                                        title="Rescrape from a different source"
                                                    >
                                                        🔄 Rescrape
                                                    </button>
                                                    <button
                                                        onClick={() => handleStartReview(req)}
                                                        className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider border border-yellow-500/20"
                                                        title="Review and Approve Staged Content"
                                                    >
                                                        📝 Review
                                                    </button>
                                                </>
                                            )}
                                            {/* Automation error tooltip */}
                                            {req.automation_error && (
                                                <button
                                                    onClick={() => setShowAutomationLog(showAutomationLog === req.id ? null : req.id)}
                                                    className="p-2 bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-all"
                                                    title={req.automation_error}
                                                >
                                                    📋
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteRequest(req.id)}
                                                className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-all"
                                                title="Delete"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {requests.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                                            No requests found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Card Requests View */}
                <div className="md:hidden space-y-4">
                    {requests.length === 0 ? (
                        <div className="glass-panel rounded-xl p-8 text-center text-gray-500">
                            No requests found.
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div key={req.id} className="glass-panel rounded-xl p-4 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-white">{req.content_name || req.title}</h3>
                                            {req.has_account && (req.user_name || req.user_email) && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">
                                                    👤 {req.user_name || req.user_email}
                                                </span>
                                            )}
                                        </div>
                                        {req.notes && (
                                            <p className="text-xs text-gray-400 italic mt-1">Note: {req.notes}</p>
                                        )}
                                    </div>
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize whitespace-nowrap ${
                                        req.status === 'added' ? 'bg-green-500/20 text-green-400' :
                                        req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                        req.status === 'review' ? 'bg-purple-500/20 text-purple-400' :
                                        'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        {req.status}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500">
                                    {new Date(req.created_at).toLocaleDateString()}
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                    {req.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleAutoProcessSingle(req)}
                                                disabled={autoProcessingId === req.id}
                                                className="py-2 px-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold hover:from-amber-500/30 hover:to-orange-500/30 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
                                            >
                                                {autoProcessingId === req.id ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                                ) : (
                                                    '⚡'
                                                )}
                                                Auto
                                            </button>
                                            <button
                                                onClick={() => handleStartAgentImport(req)}
                                                className="flex-1 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-bold hover:bg-purple-500/30 transition-colors"
                                            >
                                                🤖 Scrape
                                            </button>
                                            <button
                                                onClick={() => updateStatus(req.id, 'added')}
                                                className="py-2 px-3 bg-green-500/20 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/30 transition-colors"
                                            >
                                                ✓ Add
                                            </button>
                                        </>
                                    )}
                                    {req.status === 'review' && (
                                        <>
                                            <button
                                                onClick={() => handleStartAgentImport(req)}
                                                className="py-2 px-3 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-500/30 transition-colors"
                                            >
                                                🔄 Rescrape
                                            </button>
                                            <button
                                                onClick={() => handleStartReview(req)}
                                                className="flex-1 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-yellow-500/30 transition-colors"
                                            >
                                                📝 Review Content
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => deleteRequest(req.id)}
                                        className="py-2 px-3 bg-red-500/20 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* MODAL 1: Search & Agent Import */}
                {activeSearchRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span>🤖</span> Agent Scrape Search
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">Import &ldquo;{activeSearchRequest.content_name}&rdquo; from sources</p>
                                </div>
                                <button
                                    onClick={() => setActiveSearchRequest(null)}
                                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                                {/* Search controls */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Content Type</label>
                                        <select
                                            value={activeSearchRequestType}
                                            onChange={(e) => setActiveSearchRequestType(e.target.value as any)}
                                            className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500 font-semibold"
                                        >
                                            <option value="auto">Auto Detect (Recommended)</option>
                                            <option value="movie">Movie</option>
                                            <option value="series">Series</option>
                                            <option value="anime">Anime</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Source Website</label>
                                        <select
                                            value={searchSource}
                                            onChange={(e) => setSearchSource(e.target.value as any)}
                                            className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                        >
                                            <option value="movielink">MovieLinkBD</option>
                                            <option value="rareanimes">RareAnimes (Anime)</option>
                                            <option value="bollyflix">BollyFlix (Bollywood/Series)</option>
                                        </select>
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Search Query</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                                placeholder="Enter title..."
                                            />
                                            <button
                                                onClick={handleAgentSearch}
                                                disabled={searching || importing}
                                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {searching ? (
                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    'Search'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Import Progress Area */}
                                {importing && (
                                    <div className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-xl flex flex-col items-center justify-center space-y-3 animate-pulse">
                                        <span className="relative flex h-10 w-10">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-10 w-10 bg-purple-500 flex items-center justify-center text-white font-bold text-xl">🤖</span>
                                        </span>
                                        <div className="text-center">
                                            <h4 className="font-bold text-purple-400 text-sm">Agent Scraping Content Details</h4>
                                            <p className="text-xs text-gray-400 mt-1">Detecting type, normalizing metadata, grouping links and validating the import...</p>
                                        </div>
                                    </div>
                                )}

                                {/* Search Results */}
                                {!importing && (
                                    <div className="space-y-3">
                                        <h4 className="font-bold text-white text-sm uppercase tracking-wider text-gray-400 border-b border-white/5 pb-2">Search Results ({searchResults.length})</h4>
                                        {searching ? (
                                            <div className="space-y-2.5">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="h-14 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
                                                ))}
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            <div className="divide-y divide-white/5 border border-white/5 rounded-xl overflow-hidden bg-dark-900/50">
                                                {searchResults.map((result, idx) => (
                                                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors gap-4">
                                                        <div className="min-w-0">
                                                            <p className="text-white font-semibold text-sm truncate">{result.title}</p>
                                                            <p className="text-xs text-gray-500 truncate mt-0.5">{result.url}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAgentImport(result.url)}
                                                            className="shrink-0 px-3.5 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-bold rounded-lg border border-green-500/10 transition-all"
                                                        >
                                                            📥 Import
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-8 text-center text-gray-500 text-sm bg-dark-900/30 rounded-xl border border-dashed border-white/10">
                                                No results found. Adjust query or search site.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL 2: Review Staged Content */}
                {activeReviewRequest && reviewData && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
                        <div className="w-full max-w-4xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl my-8 animate-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span>📝</span> Review Staged Content
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">Staged from &ldquo;{activeReviewRequest.scraper_source}&rdquo;</p>
                                </div>
                                <button
                                    onClick={() => setActiveReviewRequest(null)}
                                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Form Body */}
                            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Left fields */}
                                    <div className="md:col-span-2 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Title</label>
                                            <input
                                                type="text"
                                                value={reviewData.title}
                                                onChange={(e) => setReviewData({ ...reviewData, title: e.target.value })}
                                                className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Description</label>
                                            <textarea
                                                rows={4}
                                                value={reviewData.description}
                                                onChange={(e) => setReviewData({ ...reviewData, description: e.target.value })}
                                                placeholder="Add content description..."
                                                className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500 resize-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Type</label>
                                                <select
                                                    value={reviewData.type}
                                                    onChange={(e) => setReviewData({ ...reviewData, type: e.target.value as any })}
                                                    className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500 font-medium"
                                                >
                                                    <option value="movie">Movie</option>
                                                    <option value="series">Series</option>
                                                    <option value="anime">Anime</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Release Year</label>
                                                <input
                                                    type="number"
                                                    value={reviewData.release_year}
                                                    onChange={(e) => setReviewData({ ...reviewData, release_year: parseInt(e.target.value) || new Date().getFullYear() })}
                                                    className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right poster & info */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Poster URL</label>
                                            <input
                                                type="text"
                                                value={reviewData.poster_url || ''}
                                                onChange={(e) => setReviewData({ ...reviewData, poster_url: e.target.value })}
                                                className="w-full bg-dark-900 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-red-500 font-mono mb-2"
                                                placeholder="Paste image URL..."
                                            />
                                            {reviewData.poster_url ? (
                                                <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden border border-white/5">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={reviewData.poster_url}
                                                        alt="Scraped poster preview"
                                                        className="object-cover w-full h-full"
                                                        onError={(e) => { (e.target as any).src = '/poster-placeholder.png'; }}
                                                    />
                                                </div>
                                            ) : (
                                                <div className="aspect-[2/3] w-full rounded-xl bg-dark-900 border border-dashed border-white/10 flex items-center justify-center text-gray-500 text-xs">
                                                    No poster scraped
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Genres / Categories selection */}
                                <div className="space-y-3 pt-4 border-t border-white/5">
                                    <label className="block text-xs font-black text-white uppercase tracking-wider">Genres / Categories</label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {categories.map((cat) => {
                                            const isSelected = selectedCategories.includes(cat.id);
                                            return (
                                                <button
                                                    key={cat.id}
                                                    type="button"
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                                                        } else {
                                                            setSelectedCategories([...selectedCategories, cat.id]);
                                                        }
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                                        isSelected 
                                                        ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/10' 
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
                                                    }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Content specific downloads / episodes */}
                                <div className="space-y-4 pt-6 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-black text-white uppercase tracking-wider text-sm flex items-center gap-2">
                                            {reviewData.type === 'movie' ? (
                                                <>
                                                    <span>💾</span> Download Options ({reviewData.downloads?.length || 0})
                                                </>
                                            ) : (
                                                <>
                                                    <span>📺</span> Seasons &amp; Episodes ({reviewData.seasons?.length || 0} {reviewData.seasons?.length === 1 ? 'Season' : 'Seasons'}, {(reviewData.seasons || []).reduce((acc: number, s: any) => acc + (s.episodes?.length || 0), 0)} Total Episodes)
                                                </>
                                            )}
                                        </h4>
                                        {reviewData.type !== 'movie' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const seasons = [...(reviewData.seasons || [])];
                                                    const nextNum = seasons.length > 0 ? Math.max(...seasons.map((s: any) => s.season_number || 1)) + 1 : 1;
                                                    seasons.push({
                                                        season_number: nextNum,
                                                        episodes: []
                                                    });
                                                    setReviewData({ ...reviewData, seasons });
                                                    setActiveSeasonTab(seasons.length - 1);
                                                }}
                                                className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                            >
                                                <span>➕</span> Add Season
                                            </button>
                                        )}
                                    </div>

                                    {/* Movie Downloads view */}
                                    {reviewData.type === 'movie' ? (
                                        <div className="space-y-3 bg-dark-900/50 p-4 rounded-xl border border-white/5">
                                            {reviewData.downloads && reviewData.downloads.length > 0 ? (
                                                reviewData.downloads.map((dl: any, idx: number) => (
                                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
                                                        <div>
                                                            <select
                                                                value={dl.quality}
                                                                onChange={(e) => {
                                                                    const dls = [...reviewData.downloads];
                                                                    dls[idx].quality = e.target.value;
                                                                    setReviewData({ ...reviewData, downloads: dls });
                                                                }}
                                                                className="w-full bg-dark-900 border border-white/10 rounded-lg p-2 text-white text-xs font-semibold"
                                                            >
                                                                <option value="480p">480p</option>
                                                                <option value="720p">720p</option>
                                                                <option value="1080p">1080p</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="text"
                                                                value={dl.fileSize || ''}
                                                                onChange={(e) => {
                                                                    const dls = [...reviewData.downloads];
                                                                    dls[idx].fileSize = e.target.value;
                                                                    setReviewData({ ...reviewData, downloads: dls });
                                                                }}
                                                                className="w-full bg-dark-900 border border-white/10 rounded-lg p-2 text-white text-xs"
                                                                placeholder="e.g. 1.2GB"
                                                            />
                                                        </div>
                                                        <div className="md:col-span-2 flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={dl.fileUrl || ''}
                                                                onChange={(e) => {
                                                                    const dls = [...reviewData.downloads];
                                                                    dls[idx].fileUrl = e.target.value;
                                                                    setReviewData({ ...reviewData, downloads: dls });
                                                                }}
                                                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg p-2 text-white text-xs font-mono"
                                                                placeholder="File Download URL"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    const dls = reviewData.downloads.filter((_: any, i: number) => i !== idx);
                                                                    setReviewData({ ...reviewData, downloads: dls });
                                                                }}
                                                                className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-gray-500 text-xs py-4 text-center">No downloads staged. Add a row below.</p>
                                            )}
                                            <button
                                                onClick={() => {
                                                    const dls = [...(reviewData.downloads || []), { quality: '720p', fileSize: '1GB', fileUrl: '' }];
                                                    setReviewData({ ...reviewData, downloads: dls });
                                                }}
                                                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 text-white font-bold rounded-lg text-xs"
                                            >
                                                + Add Quality Row
                                            </button>
                                        </div>
                                    ) : (
                                        /* Series/Anime Episodes view with Multi-Season Tabs */
                                        <div className="space-y-4 bg-dark-900/30 p-4 rounded-xl border border-white/5">
                                            {/* Season navigation tabs */}
                                            {reviewData.seasons && reviewData.seasons.length > 0 ? (
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-white/5">
                                                        {reviewData.seasons.map((season: any, sIdx: number) => {
                                                            const isActive = (activeSeasonTab >= reviewData.seasons.length ? 0 : activeSeasonTab) === sIdx;
                                                            return (
                                                                <div key={sIdx} className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setActiveSeasonTab(sIdx)}
                                                                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
                                                                            isActive
                                                                                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20'
                                                                                : 'bg-dark-900 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                                                        }`}
                                                                    >
                                                                        <span>Season {season.season_number}</span>
                                                                        <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${
                                                                            isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'
                                                                        }`}>
                                                                            {season.episodes?.length || 0} eps
                                                                        </span>
                                                                    </button>
                                                                    {reviewData.seasons.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (confirm(`Delete Season ${season.season_number}? All its episodes will be removed.`)) {
                                                                                    const newSeasons = reviewData.seasons.filter((_: any, i: number) => i !== sIdx);
                                                                                    setReviewData({ ...reviewData, seasons: newSeasons });
                                                                                    setActiveSeasonTab(Math.max(0, sIdx - 1));
                                                                                }
                                                                            }}
                                                                            className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors text-xs"
                                                                            title={`Delete Season ${season.season_number}`}
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Active Season Episodes container */}
                                                    {(() => {
                                                        const currentSeasonIdx = Math.min(activeSeasonTab, reviewData.seasons.length - 1);
                                                        const currentSeason = reviewData.seasons[currentSeasonIdx];
                                                        if (!currentSeason) return null;

                                                        return (
                                                            <div className="space-y-3">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                                                        Season {currentSeason.season_number} Episodes ({currentSeason.episodes?.length || 0})
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const copy = { ...reviewData };
                                                                            const eps = copy.seasons[currentSeasonIdx].episodes || [];
                                                                            const nextEpNum = eps.length > 0 ? Math.max(...eps.map((e: any) => e.episode_number || 1)) + 1 : 1;
                                                                            eps.push({
                                                                                episode_number: nextEpNum,
                                                                                episode_title: `Episode ${nextEpNum}`,
                                                                                download_links: [{ resolution: '720p', gdrive_link: '' }]
                                                                            });
                                                                            copy.seasons[currentSeasonIdx].episodes = eps;
                                                                            setReviewData(copy);
                                                                        }}
                                                                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold border border-white/5 flex items-center gap-1 transition-all"
                                                                    >
                                                                        <span>➕</span> Add Episode
                                                                    </button>
                                                                </div>

                                                                {currentSeason.episodes && currentSeason.episodes.length > 0 ? (
                                                                    <div className="max-h-[35vh] overflow-y-auto space-y-3 pr-2">
                                                                        {currentSeason.episodes.map((ep: any, idx: number) => (
                                                                            <div key={idx} className="p-3 bg-dark-900/60 border border-white/5 rounded-lg space-y-2">
                                                                                <div className="flex items-center justify-between gap-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="px-2 py-0.5 bg-red-600/20 text-red-400 border border-red-500/20 rounded text-[11px] font-mono font-bold whitespace-nowrap">
                                                                                            S{currentSeason.season_number} E{ep.episode_number}
                                                                                        </span>
                                                                                        <input
                                                                                            type="number"
                                                                                            value={ep.episode_number}
                                                                                            onChange={(e) => {
                                                                                                const copy = { ...reviewData };
                                                                                                copy.seasons[currentSeasonIdx].episodes[idx].episode_number = parseInt(e.target.value) || 1;
                                                                                                setReviewData(copy);
                                                                                            }}
                                                                                            className="w-16 bg-dark-900 border border-white/10 rounded px-2 py-1 text-white text-xs font-mono text-center"
                                                                                            title="Episode Number"
                                                                                        />
                                                                                    </div>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={ep.episode_title || ''}
                                                                                        onChange={(e) => {
                                                                                            const copy = { ...reviewData };
                                                                                            copy.seasons[currentSeasonIdx].episodes[idx].episode_title = e.target.value;
                                                                                            setReviewData(copy);
                                                                                        }}
                                                                                        className="flex-1 bg-dark-900 border border-white/10 rounded px-2 py-1 text-white text-xs"
                                                                                        placeholder="Episode Title"
                                                                                    />
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const copy = { ...reviewData };
                                                                                            copy.seasons[currentSeasonIdx].episodes = copy.seasons[currentSeasonIdx].episodes.filter((_: any, i: number) => i !== idx);
                                                                                            setReviewData(copy);
                                                                                        }}
                                                                                        className="p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded transition-colors text-xs"
                                                                                        title="Delete Episode"
                                                                                    >
                                                                                        🗑️
                                                                                    </button>
                                                                                </div>

                                                                                {/* Episode Download Links */}
                                                                                {ep.download_links && ep.download_links.map((link: any, lIdx: number) => (
                                                                                    <div key={lIdx} className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-1.5 border-t border-white/5 items-center">
                                                                                        <div>
                                                                                            <select
                                                                                                value={link.resolution || '720p'}
                                                                                                onChange={(e) => {
                                                                                                    const copy = { ...reviewData };
                                                                                                    copy.seasons[currentSeasonIdx].episodes[idx].download_links[lIdx].resolution = e.target.value;
                                                                                                    setReviewData(copy);
                                                                                                }}
                                                                                                className="w-full bg-dark-900 border border-white/10 rounded px-2 py-1 text-white text-xs font-semibold"
                                                                                            >
                                                                                                <option value="480p">480p</option>
                                                                                                <option value="720p">720p</option>
                                                                                                <option value="1080p">1080p</option>
                                                                                            </select>
                                                                                        </div>
                                                                                        <div className="md:col-span-3 flex gap-2">
                                                                                            <input
                                                                                                type="text"
                                                                                                value={link.mega_link || link.gdrive_link || ''}
                                                                                                onChange={(e) => {
                                                                                                    const val = e.target.value;
                                                                                                    const copy = { ...reviewData };
                                                                                                    const isMega = val.includes('mega.nz');
                                                                                                    if (isMega) {
                                                                                                        copy.seasons[currentSeasonIdx].episodes[idx].download_links[lIdx].mega_link = val;
                                                                                                        copy.seasons[currentSeasonIdx].episodes[idx].download_links[lIdx].gdrive_link = undefined;
                                                                                                    } else {
                                                                                                        copy.seasons[currentSeasonIdx].episodes[idx].download_links[lIdx].gdrive_link = val;
                                                                                                        copy.seasons[currentSeasonIdx].episodes[idx].download_links[lIdx].mega_link = undefined;
                                                                                                    }
                                                                                                    setReviewData(copy);
                                                                                                }}
                                                                                                className="flex-1 bg-dark-900 border border-white/10 rounded px-2 py-1 text-white text-xs font-mono"
                                                                                                placeholder="GDFlix or Mega Download Link"
                                                                                            />
                                                                                            {ep.download_links.length > 1 && (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={() => {
                                                                                                        const copy = { ...reviewData };
                                                                                                        copy.seasons[currentSeasonIdx].episodes[idx].download_links = copy.seasons[currentSeasonIdx].episodes[idx].download_links.filter((_: any, i: number) => i !== lIdx);
                                                                                                        setReviewData(copy);
                                                                                                    }}
                                                                                                    className="p-1 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded text-xs"
                                                                                                    title="Remove Link"
                                                                                                >
                                                                                                    ✕
                                                                                                </button>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                                {(!ep.download_links || ep.download_links.length === 0) && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            const copy = { ...reviewData };
                                                                                            copy.seasons[currentSeasonIdx].episodes[idx].download_links = [{ resolution: '720p', gdrive_link: '' }];
                                                                                            setReviewData(copy);
                                                                                        }}
                                                                                        className="w-full py-1 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 text-gray-400 hover:text-white rounded text-[11px] font-bold"
                                                                                    >
                                                                                        + Add Download Link
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                                                                        <p className="text-gray-500 text-xs">No episodes in Season {currentSeason.season_number}.</p>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const copy = { ...reviewData };
                                                                                copy.seasons[currentSeasonIdx].episodes = [
                                                                                    { episode_number: 1, episode_title: 'Episode 1', download_links: [{ resolution: '720p', gdrive_link: '' }] }
                                                                                ];
                                                                                setReviewData(copy);
                                                                            }}
                                                                            className="mt-2 px-3 py-1 bg-white/5 hover:bg-white/10 text-white rounded text-xs font-bold"
                                                                        >
                                                                            + Add First Episode
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                                                    <p className="text-gray-500 text-xs">No seasons found for this content.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setReviewData({
                                                                ...reviewData,
                                                                seasons: [{ season_number: 1, episodes: [] }]
                                                            });
                                                            setActiveSeasonTab(0);
                                                        }}
                                                        className="mt-2 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold"
                                                    >
                                                        + Create Season 1
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-white/5 flex justify-end gap-3">
                                <button
                                    onClick={() => setActiveReviewRequest(null)}
                                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-sm transition-all border border-white/5"
                                    disabled={approving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApproveContent}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-1.5"
                                    disabled={approving}
                                >
                                    {approving ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        'Approve & Publish'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* MODAL 3: Process Results Summary */}
                {processResultsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                        <span>⚡</span> {processResultsModal.title}
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-1">Automatic Search across BollyFlix & RareAnimes</p>
                                </div>
                                <button
                                    onClick={() => setProcessResultsModal(null)}
                                    className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                                {processResultsModal.results.map((r, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <span className="font-bold text-white text-sm">{r.name}</span>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                                                r.outcome === 'review_ready' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                                r.outcome === 'duplicate' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                                                r.outcome === 'no_match' ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30' :
                                                'bg-red-500/20 text-red-300 border border-red-500/30'
                                            }`}>
                                                {r.outcome === 'review_ready' ? '✅ Ready for Review' :
                                                 r.outcome === 'duplicate' ? '📋 Duplicate' :
                                                 r.outcome === 'no_match' ? '🔍 Not Found' :
                                                 '⚠️ Failed'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-300">{r.message}</p>
                                        {r.outcome === 'review_ready' && (
                                            <div className="pt-2 flex justify-end">
                                                <button
                                                    onClick={() => {
                                                        const matchedReq = requests.find(req => req.id === r.id);
                                                        setProcessResultsModal(null);
                                                        if (matchedReq) handleStartReview(matchedReq);
                                                    }}
                                                    className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-bold rounded-lg transition-colors border border-yellow-500/30"
                                                >
                                                    📝 Review Now
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-4 border-t border-white/5 flex justify-end">
                                <button
                                    onClick={() => setProcessResultsModal(null)}
                                    className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL 4: Automation Log Details */}
                {showAutomationLog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl bg-dark-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                            {(() => {
                                const logReq = requests.find(r => r.id === showAutomationLog);
                                if (!logReq) return null;
                                const logs = (logReq.automation_log || []) as any[];

                                return (
                                    <>
                                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                            <div>
                                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                                    <span>📋</span> Pipeline Automation Log
                                                </h3>
                                                <p className="text-xs text-gray-400 mt-1">{logReq.content_name}</p>
                                            </div>
                                            <button
                                                onClick={() => setShowAutomationLog(null)}
                                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                                            {/* Status Header */}
                                            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs">
                                                <div>
                                                    <span className="text-gray-400">Processing Status: </span>
                                                    <span className="font-bold text-white capitalize">{logReq.processing_status || 'idle'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Attempts: </span>
                                                    <span className="font-bold text-white">{logReq.processing_attempts || 0}</span>
                                                </div>
                                                {typeof logReq.confidence_score === 'number' && (
                                                    <div>
                                                        <span className="text-gray-400">Confidence: </span>
                                                        <span className="font-bold text-emerald-400">{Math.round(logReq.confidence_score * 100)}%</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Error Message banner */}
                                            {logReq.automation_error && (
                                                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
                                                    <span className="text-sm">⚠️</span>
                                                    <div>
                                                        <div className="font-bold">Latest Note</div>
                                                        <div>{logReq.automation_error}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Log Entries Timeline */}
                                            <div className="space-y-2">
                                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step Timeline ({logs.length})</div>
                                                {logs.length === 0 ? (
                                                    <div className="text-xs text-gray-500 italic">No detailed step logs recorded yet.</div>
                                                ) : (
                                                    logs.map((item, idx) => (
                                                        <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-xs font-mono">
                                                            <div className="flex items-center justify-between text-gray-400 mb-1">
                                                                <span className="text-amber-400 font-bold">[{item.action}]</span>
                                                                <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                                                            </div>
                                                            <div className="text-gray-200">{item.result}</div>
                                                            {item.details && Object.keys(item.details).length > 0 && (
                                                                <pre className="mt-1.5 p-2 bg-black/40 rounded text-[11px] text-gray-400 overflow-x-auto">
                                                                    {JSON.stringify(item.details, null, 2)}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-4 border-t border-white/5 flex justify-end">
                                            <button
                                                onClick={() => setShowAutomationLog(null)}
                                                className="px-5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition-colors"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                )}
            </div>
        </AdminShell>
    );
}
