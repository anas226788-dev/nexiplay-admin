'use client';

import { useState, useEffect } from 'react';
import { supabaseNovels } from '@/lib/supabase-novels';
import AdminShell from '@/components/AdminShell';

export default function NovelsAdminPage() {
    const [novels, setNovels] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    
    // Scraper State
    const [showScraper, setShowScraper] = useState(false);
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [scrapeMaxChapters, setScrapeMaxChapters] = useState('20');
    const [isScraping, setIsScraping] = useState(false);
    const [scrapeMessage, setScrapeMessage] = useState('');
    const [scrapedChapters, setScrapedChapters] = useState<any[]>([]);
    
    const [formData, setFormData] = useState({
        id: '',
        title: '',
        slug: '',
        author: '',
        genre: '',
        cover_url: '',
        description: '',
        blogger_label: '',
        status: 'ongoing'
    });

    useEffect(() => {
        fetchNovels();
    }, []);

    const fetchNovels = async () => {
        setLoading(true);
        const { data, error } = await supabaseNovels
            .from('novels')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (!error && data) setNovels(data);
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        alert('Debug: handleSave started. scrapedChapters length is: ' + scrapedChapters.length);
        setLoading(true);

        const payload = {
            title: formData.title,
            slug: formData.slug || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
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
                alert(error.message);
                setLoading(false);
                return;
            }
        } else {
            const { data, error } = await supabaseNovels.from('novels').insert([payload]).select().single();
            if (error) {
                alert(error.message);
                setLoading(false);
                return;
            }
            if (data) currentNovelId = data.id;
        }

        // Insert scraped chapters if any
        if (scrapedChapters.length > 0 && currentNovelId) {
            setScrapeMessage('Saving chapters to database...');
            const chaptersToInsert = scrapedChapters.map(chap => ({
                ...chap,
                novel_id: currentNovelId
            }));
            
            alert('Debug: Attempting to insert ' + chaptersToInsert.length + ' chapters into Supabase. Novel ID: ' + currentNovelId);
            
            const { error: chapterError } = await supabaseNovels
                .from('novel_chapters')
                .upsert(chaptersToInsert, { onConflict: 'novel_id,slug' });
                
            if (chapterError) {
                alert('Debug Error saving chapters: ' + JSON.stringify(chapterError));
            } else {
                alert('Debug Success: Chapters should be in DB now!');
            }
            setScrapedChapters([]); // clear them after saving
            setScrapeMessage('');
        } else {
            if (scrapedChapters.length > 0) {
                alert('Debug: currentNovelId is null or empty. Cannot save chapters.');
            }
        }

        setIsEditing(false);
        setFormData({
            id: '', title: '', slug: '', author: '', genre: '', 
            cover_url: '', description: '', blogger_label: '', status: 'ongoing'
        });
        await fetchNovels();
    };

    const handleEdit = (novel: any) => {
        setFormData(novel);
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this novel?')) return;
        const { error } = await supabaseNovels.from('novels').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchNovels();
    };

    const handleScrape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!scrapeUrl.includes('romanticgolpo.com')) {
            setScrapeMessage('Error: Only romanticgolpo.com URLs are supported right now.');
            return;
        }

        setIsScraping(true);
        setScrapeMessage('Scraping in progress... this may take a few minutes depending on chapter count.');

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
                author: existingNovel?.author || 'Unknown',
                genre: existingNovel?.genre || 'Romantic',
                cover_url: existingNovel?.cover_url || '',
                description: data.novel.description || '',
                blogger_label: data.novel.blogger_label,
                status: 'ongoing'
            });
            setIsEditing(!!existingNovel);
            setScrapedChapters(data.chapters || []);

            setScrapeMessage(`Success! Scraped ${data.novel.chapterCount} chapters. Please click "Save Novel" below to save everything to your database!`);
            setShowScraper(false);
        } catch (err: any) {
            setScrapeMessage('An error occurred during scraping: ' + err.message);
        }
        setIsScraping(false);
    };

    return (
        <AdminShell>
            <div className="p-4 md:p-8">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-black text-white">Manage Novels</h1>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setShowScraper(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            Auto Scrape
                        </button>
                        <button 
                            onClick={() => {
                                setIsEditing(false);
                                setFormData({
                                    id: '', title: '', slug: '', author: '', genre: '', 
                                    cover_url: '', description: '', blogger_label: '', status: 'ongoing'
                                });
                            }}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-bold transition-all"
                        >
                            + Add Novel
                        </button>
                    </div>
                </div>

                {/* Scraper Modal */}
                {showScraper && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-dark-900 border border-purple-500/30 rounded-3xl p-6 md:p-8 max-w-lg w-full shadow-2xl relative">
                            <button onClick={() => setShowScraper(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                            
                            <h2 className="text-2xl font-black text-white mb-2 flex items-center gap-2">
                                <span className="text-purple-500">Auto</span> Scrape Novel
                            </h2>
                            <p className="text-gray-400 text-sm mb-6">Enter the category URL of a novel from romanticgolpo.com. We will automatically fetch the chapters and prepare them to be saved directly into your Supabase database.</p>
                            
                            <form onSubmit={handleScrape} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Category URL</label>
                                    <input required type="url" placeholder="https://romanticgolpo.com/category/coffee-vanilla/" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">Max Chapters to Scrape</label>
                                    <input required type="number" min="1" max="500" value={scrapeMaxChapters} onChange={e => setScrapeMaxChapters(e.target.value)} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
                                </div>

                                {scrapeMessage && (
                                    <div className={`p-4 rounded-xl text-sm font-medium ${scrapeMessage.includes('Error') || scrapeMessage.includes('failed') ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {scrapeMessage}
                                    </div>
                                )}
                                
                                <button type="submit" disabled={isScraping} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:shadow-purple-900/50 mt-4 flex justify-center items-center gap-2">
                                    {isScraping ? (
                                        <><svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Scraping...</>
                                    ) : (
                                        'Start Scraping'
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-1 bg-dark-900 border border-white/5 rounded-2xl p-6 h-fit sticky top-24">
                        <h2 className="text-lg font-bold text-white mb-6">
                            {isEditing ? 'Edit Novel' : 'Add New Novel'}
                        </h2>
                        
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Title</label>
                                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Slug (optional)</label>
                                <input type="text" value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Author</label>
                                    <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 mb-1">Genre</label>
                                    <input type="text" value={formData.genre} onChange={e => setFormData({...formData, genre: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Cover Image URL</label>
                                <input type="url" value={formData.cover_url} onChange={e => setFormData({...formData, cover_url: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Blogger Label</label>
                                <input type="text" value={formData.blogger_label} onChange={e => setFormData({...formData, blogger_label: e.target.value})} placeholder="e.g. scum-novel" className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white" />
                                <p className="text-[10px] text-gray-500 mt-1">Chapters for this novel will be fetched from Blogger using this exact tag/label.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Status</label>
                                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white">
                                    <option value="ongoing">Ongoing</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-1">Description</label>
                                <textarea rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-dark-800 border border-white/10 rounded-xl px-4 py-2 text-white"></textarea>
                            </div>

                            <button type="submit" disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all">
                                {loading ? 'Saving...' : 'Save Novel'}
                            </button>
                        </form>
                    </div>

                    {/* List Section */}
                    <div className="lg:col-span-2">
                        <div className="bg-dark-900 border border-white/5 rounded-2xl overflow-hidden">
                            <table className="w-full text-left text-sm text-gray-400">
                                <thead className="bg-white/5 text-white">
                                    <tr>
                                        <th className="p-4">Cover</th>
                                        <th className="p-4">Novel</th>
                                        <th className="p-4">Status & Label</th>
                                        <th className="p-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {novels.map(novel => (
                                        <tr key={novel.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                                            <td className="p-4">
                                                <div className="w-12 h-16 bg-dark-800 rounded flex items-center justify-center overflow-hidden relative">
                                                    {novel.cover_url ? (
                                                        <img src={novel.cover_url} alt="" className="object-cover w-full h-full" />
                                                    ) : (
                                                        <span className="text-xs">No img</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <p className="text-white font-bold">{novel.title}</p>
                                                <p className="text-xs">{novel.genre} | {novel.author}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs uppercase font-bold tracking-wider ${novel.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                    {novel.status}
                                                </span>
                                                {novel.blogger_label && (
                                                    <p className="text-xs mt-1 text-gray-500 bg-white/5 px-2 py-0.5 rounded w-fit">
                                                        Tag: {novel.blogger_label}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleEdit(novel)} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded font-bold text-xs">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(novel.id)} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded font-bold text-xs">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {novels.length === 0 && !loading && (
                                        <tr><td colSpan={4} className="p-8 text-center text-gray-500">No novels found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}
