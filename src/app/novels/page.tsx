'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabaseNovels } from '@/lib/supabase-novels';
import AdminShell from '@/components/AdminShell';

export default function NovelsAdminPage() {
    const [novels, setNovels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'ongoing' | 'completed'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 25;

    // Toast message
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    // Scraper State
    const [showScraper, setShowScraper] = useState(false);
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapeMaxChapters, setScrapeMaxChapters] = useState('50');
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeMessage, setScrapeMessage] = useState('');
    const [scrapedChapters, setScrapedChapters] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        id: '',
        title: '',
        slug: '',
        author: 'Romantic Golpo',
        genre: 'Romantic',
        cover_url: '',
        description: '',
        blogger_label: '',
        status: 'completed'
    });

    useEffect(() => {
        fetchNovels();
    }, []);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 5000);
    };

    const fetchNovels = async () => {
        setLoading(true);
        const { data, error } = await supabaseNovels
            .from('novels')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (!error && data) {
            setNovels(data);
        } else if (error) {
            showToast('Failed to load novels: ' + error.message, 'error');
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            title: formData.title,
            slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-'),
            author: formData.author,
            genre: formData.genre,
            cover_url: formData.cover_url,
            description: formData.description,
            blogger_label: formData.blogger_label,
            status: formData.status
        };

        let currentNovelId = formData.id;

        if (isEditing && formData.id) {
            const { error } = await supabaseNovels.from('novels').update(payload).eq('id', formData.id);
            if (error) {
                showToast(error.message, 'error');
                setLoading(false);
                return;
            }
            showToast(`Updated "${formData.title}" successfully!`);
        } else {
            const { data, error } = await supabaseNovels.from('novels').insert([payload]).select().single();
            if (error) {
                showToast(error.message, 'error');
                setLoading(false);
                return;
            }
            if (data) currentNovelId = data.id;
            showToast(`Added "${formData.title}" successfully!`);
        }

        // Insert scraped chapters if any
        if (scrapedChapters.length > 0 && currentNovelId) {
            setScrapeMessage('Saving chapters to database...');
            const chaptersToInsert = scrapedChapters.map(chap => ({
                ...chap,
                novel_id: currentNovelId
            }));
            
            const { error: chapterError } = await supabaseNovels
                .from('novel_chapters')
                .upsert(chaptersToInsert, { onConflict: 'novel_id,slug' });
                
            if (chapterError) {
                showToast('Error saving chapters: ' + chapterError.message, 'error');
            } else {
                showToast(`Saved ${chaptersToInsert.length} chapters to database!`);
            }
            setScrapedChapters([]);
            setScrapeMessage('');
        }

        setIsEditing(false);
        setFormData({
            id: '', title: '', slug: '', author: 'Romantic Golpo', genre: 'Romantic', 
            cover_url: '', description: '', blogger_label: '', status: 'completed'
        });
        await fetchNovels();
    };

    const handleEdit = (novel: any) => {
        setFormData(novel);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
        const { error } = await supabaseNovels.from('novels').delete().eq('id', id);
        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast(`Deleted "${title}" successfully.`);
            fetchNovels();
        }
    };

    const handleScrape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scrapeUrl.includes('romanticgolpo.com')) {
            setScrapeMessage('Error: Only romanticgolpo.com URLs are supported.');
            return;
        }

        setIsScraping(true);
        setScrapeMessage('Scraping in progress... this may take 10-30 seconds.');

        try {
            const res = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: scrapeUrl, maxChapters: scrapeMaxChapters })
            });

            const data = await res.json();
            
            if (!res.ok) {
                setScrapeMessage('Scrape failed: ' + data.error);
                setIsScraping(false);
                return;
            }

            // Check if novel already exists
            const { data: existingNovel } = await supabaseNovels
                .from('novels')
                .select('id, cover_url, author, genre')
                .eq('slug', data.novel.slug)
                .maybeSingle();

            // Populate form with scraped data
            setFormData({
                id: existingNovel ? existingNovel.id : '',
                title: data.novel.title,
                slug: data.novel.slug,
                author: existingNovel?.author || 'Romantic Golpo',
                genre: existingNovel?.genre || 'Romantic',
                cover_url: data.novel.cover_url || existingNovel?.cover_url || '',
                description: data.novel.description || '',
                blogger_label: data.novel.blogger_label,
                status: data.novel.status || 'completed'
            });
            setIsEditing(!!existingNovel);
            setScrapedChapters(data.chapters || []);

            setScrapeMessage(`Success! Scraped ${data.novel.chapterCount} chapters. Click "Save Novel" below to commit.`);
            setShowScraper(false);
            showToast(`Scraped ${data.novel.chapterCount} chapters for "${data.novel.title}". Click Save Novel!`);
        } catch (err: any) {
            setScrapeMessage('An error occurred during scraping: ' + err.message);
        }
        setIsScraping(false);
    };

    const openScraperForNovel = (novel: any) => {
        const url = `https://romanticgolpo.com/category/${encodeURIComponent(novel.slug)}/`;
        setScrapeUrl(url);
        setShowScraper(true);
        setScrapeMessage('');
    };

    // Filter & Paginate
    const filteredNovels = useMemo(() => {
        return novels.filter(n => {
            const matchesQuery = !searchQuery || 
                n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (n.slug && n.slug.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (n.author && n.author.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesStatus = statusFilter === 'all' || n.status === statusFilter;
            return matchesQuery && matchesStatus;
        });
    }, [novels, searchQuery, statusFilter]);

    const totalPages = Math.ceil(filteredNovels.length / pageSize) || 1;
    const paginatedNovels = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredNovels.slice(start, start + pageSize);
    }, [filteredNovels, currentPage, pageSize]);

    return (
        <AdminShell>
            <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
                {/* Toast Message */}
                {toast && (
                    <div className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between shadow-lg transition-all animate-fade-in ${
                        toast.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                        toast.type === 'info' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                        'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}>
                        <span>{toast.message}</span>
                        <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white font-black ml-4">✕</button>
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-dark-900/60 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl md:text-3xl font-black text-white">Manage Novels</h1>
                            <span className="bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs px-2.5 py-1 rounded-full font-bold">
                                {novels.length} Books
                            </span>
                        </div>
                        <p className="text-gray-400 text-xs mt-1">Romantic Golpo catalogue & chapter manager with full cover images</p>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => {
                                setScrapeUrl('');
                                setScrapeMessage('');
                                setShowScraper(true);
                            }}
                            className="flex-1 sm:flex-initial bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            Scrape Chapters
                        </button>
                        <button 
                            onClick={() => {
                                setIsEditing(false);
                                setFormData({
                                    id: '', title: '', slug: '', author: 'Romantic Golpo', genre: 'Romantic', 
                                    cover_url: '', description: '', blogger_label: '', status: 'completed'
                                });
                            }}
                            className="flex-1 sm:flex-initial bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-1.5"
                        >
                            <span>+</span> Add Novel
                        </button>
                    </div>
                </div>

                {/* Scraper Modal */}
                {showScraper && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                        <div className="bg-dark-900 border border-purple-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
                            <button onClick={() => setShowScraper(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white p-2">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                            
                            <h2 className="text-xl font-black text-white mb-2 flex items-center gap-2">
                                <span className="text-purple-400">Auto Scrape</span> Novel Chapters
                            </h2>
                            <p className="text-gray-400 text-xs mb-6">Enter a category URL from romanticgolpo.com. It extracts all chapters with content and automatically binds the high-resolution cover image.</p>
                            
                            <form onSubmit={handleScrape} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Category URL</label>
                                    <input required type="url" placeholder="https://romanticgolpo.com/category/coffee-vanilla/" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none transition-colors" />
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Max Chapters</label>
                                    <input required type="number" min="1" max="200" value={scrapeMaxChapters} onChange={e => setScrapeMaxChapters(e.target.value)} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-purple-500 outline-none transition-colors" />
                                </div>

                                {scrapeMessage && (
                                    <div className={`p-3 rounded-xl text-xs font-medium ${scrapeMessage.includes('Error') || scrapeMessage.includes('failed') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'}`}>
                                        {scrapeMessage}
                                    </div>
                                )}
                                
                                <button type="submit" disabled={isScraping} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-purple-900/50 mt-2 flex justify-center items-center gap-2 text-sm">
                                    {isScraping ? (
                                        <><svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Scraping Chapters...</>
                                    ) : (
                                        'Fetch Chapters'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-dark-900 border border-white/5 rounded-2xl p-5 md:p-6 h-fit sticky top-24">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                {isEditing ? '✏️ Edit Novel' : '✨ Add New Novel'}
                            </h2>
                            {isEditing && (
                                <button onClick={() => {
                                    setIsEditing(false);
                                    setFormData({
                                        id: '', title: '', slug: '', author: 'Romantic Golpo', genre: 'Romantic', 
                                        cover_url: '', description: '', blogger_label: '', status: 'completed'
                                    });
                                }} className="text-xs text-gray-400 hover:text-white underline">
                                    Cancel
                                </button>
                            )}
                        </div>
                        
                        <form onSubmit={handleSave} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Title</label>
                                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Slug (URL)</label>
                                <input type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Author</label>
                                    <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Genre</label>
                                    <input type="text" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Cover Image URL</label>
                                <input type="url" value={formData.cover_url} onChange={e => setFormData({...formData, cover_url: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                                {formData.cover_url && (
                                    <div className="mt-2 w-20 h-28 rounded-lg overflow-hidden border border-white/10 bg-dark-800">
                                        <img src={formData.cover_url} alt="preview" className="w-full h-full object-cover" onError={(e: any) => { e.target.style.display = 'none'; }} />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Blogger Label</label>
                                <input type="text" value={formData.blogger_label} onChange={e => setFormData({...formData, blogger_label: e.target.value})} placeholder="e.g. scum-novel" className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Status</label>
                                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors">
                                    <option value="completed">Completed</option>
                                    <option value="ongoing">Ongoing</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Description</label>
                                <textarea rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-3.5 py-2 text-white text-sm outline-none focus:border-red-500 transition-colors"></textarea>
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition-all text-sm flex items-center justify-center gap-2">
                                {loading ? 'Saving...' : isEditing ? 'Update Novel' : 'Save Novel'}
                            </button>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Search & Filter Bar */}
                        <div className="bg-dark-900 border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                            <div className="relative w-full sm:w-80">
                                <input
                                    type="text"
                                    placeholder="Search by title, author, slug..."
                                    value={searchQuery}
                                    onChange={e => {
                                        setSearchQuery(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="w-full bg-dark-800 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-xs outline-none focus:border-purple-500 transition-colors"
                                />
                                <span className="absolute left-3 top-2.5 text-gray-500 text-xs">🔍</span>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <select 
                                    value={statusFilter} 
                                    onChange={(e: any) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none"
                                >
                                    <option value="all">All Status</option>
                                    <option value="completed">Completed</option>
                                    <option value="ongoing">Ongoing</option>
                                </select>
                                <span className="text-gray-400 text-xs whitespace-nowrap">
                                    {filteredNovels.length} matches
                                </span>
                            </div>
                        </div>

                        {/* Novels Table (Desktop) */}
                        <div className="hidden sm:block bg-dark-900 border border-white/5 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-white/5 text-white text-xs">
                                    <tr>
                                        <th className="p-3.5">Cover</th>
                                        <th className="p-3.5">Novel Title</th>
                                        <th className="p-3.5">Status</th>
                                        <th className="p-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {paginatedNovels.map(novel => (
                                        <tr key={novel.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3.5">
                                                <div className="w-12 h-16 bg-dark-800 rounded-lg flex items-center justify-center overflow-hidden relative shadow border border-white/10">
                                                    {novel.cover_url ? (
                                                        <img src={novel.cover_url} alt="" loading="lazy" className="object-cover w-full h-full" onError={(e: any) => { e.target.src = 'https://romanticgolpo.com/wp-content/uploads/2026/05/368.webp'; }} />
                                                    ) : (
                                                        <span className="text-xs">No img</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3.5">
                                                <p className="text-white font-bold text-sm">{novel.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{novel.genre} • {novel.author}</p>
                                                <p className="text-[11px] text-purple-400/80 font-mono mt-0.5 truncate max-w-xs">{novel.slug}</p>
                                            </td>
                                            <td className="p-3.5">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${novel.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                                                    {novel.status}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => openScraperForNovel(novel)}
                                                        title="Scrape chapters for this book"
                                                        className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg font-bold text-xs transition-colors flex items-center gap-1"
                                                    >
                                                        <span>🤖</span> Scrape
                                                    </button>
                                                    <button onClick={() => handleEdit(novel)} className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold text-xs transition-colors">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(novel.id, novel.title)} className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-lg font-bold text-xs transition-colors">
                                                        Del
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {paginatedNovels.length === 0 && !loading && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">No novels match your filter.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="sm:hidden space-y-3">
                            {paginatedNovels.map(novel => (
                                <div key={novel.id} className="bg-dark-900 border border-white/5 rounded-2xl p-4 space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-14 h-20 bg-dark-800 rounded-lg overflow-hidden border border-white/10 flex-shrink-0">
                                            <img src={novel.cover_url || 'https://romanticgolpo.com/wp-content/uploads/2026/05/368.webp'} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = 'https://romanticgolpo.com/wp-content/uploads/2026/05/368.webp'; }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className="text-white font-bold text-sm truncate">{novel.title}</h3>
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${novel.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {novel.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-1">{novel.genre} • {novel.author}</p>
                                            <p className="text-[10px] text-purple-400/80 font-mono mt-1 truncate">{novel.slug}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                        <button 
                                            onClick={() => openScraperForNovel(novel)}
                                            className="flex-1 py-1.5 bg-purple-600/20 text-purple-300 border border-purple-500/30 rounded-lg font-bold text-xs text-center"
                                        >
                                            🤖 Scrape Chapters
                                        </button>
                                        <button onClick={() => handleEdit(novel)} className="px-3 py-1.5 bg-white/10 text-white rounded-lg font-bold text-xs">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(novel.id, novel.title)} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg font-bold text-xs">
                                            Del
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {paginatedNovels.length === 0 && !loading && (
                                <div className="p-8 text-center text-gray-500 bg-dark-900 rounded-2xl">No novels match your filter.</div>
                            )}
                        </div>

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between bg-dark-900 border border-white/5 rounded-2xl p-3 px-4 text-xs text-gray-400">
                                <div>
                                    Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredNovels.length)} of {filteredNovels.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                                    >
                                        Prev
                                    </button>
                                    <span className="font-bold text-white px-2">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button 
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
