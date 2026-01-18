'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { uploadPoster } from '@/lib/upload';
import { Category, FullMovie, Screenshot, DownloadLink } from '@/lib/types';
import DownloadLinksEditor from './DownloadLinksEditor';
import SeasonEditor from './SeasonEditor';

interface MovieFormProps {
    initialData?: FullMovie;
}

export default function MovieForm({ initialData }: MovieFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);

    // Form State
    const [title, setTitle] = useState(initialData?.title || '');
    const [slug, setSlug] = useState(initialData?.slug || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [posterUrl, setPosterUrl] = useState(initialData?.poster_url || '');
    const [type, setType] = useState<'movie' | 'series' | 'anime'>((initialData?.type as 'movie' | 'series' | 'anime') || 'movie');
    const [releaseYear, setReleaseYear] = useState(initialData?.release_year || new Date().getFullYear());
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

    // Metadata State
    const [language, setLanguage] = useState(initialData?.language || 'Hindi');
    const [source, setSource] = useState(initialData?.source || 'BluRay');
    const [castMembers, setCastMembers] = useState(initialData?.cast_members || '');
    const [format, setFormat] = useState(initialData?.format || 'MKV');
    const [subtitle, setSubtitle] = useState(initialData?.subtitle || 'English');
    const [trailerUrl, setTrailerUrl] = useState(initialData?.trailer_url || '');

    // Downloads State
    const [downloads, setDownloads] = useState(
        initialData?.downloads && initialData.downloads.length > 0
            ? initialData.downloads.map(d => ({
                quality: d.quality,
                fileSize: d.file_size || '',
                fileUrl: d.file_url || ''
            }))
            : [{ quality: '720p', fileSize: '', fileUrl: '' }]
    );

    // Download Links State (new resolution-based system)
    const [downloadLinks, setDownloadLinks] = useState<Record<string, DownloadLink>>({});

    // Screenshots State
    const [screenshots, setScreenshots] = useState<string[]>(
        initialData?.screenshots?.map(s => s.image_url) || []
    );

    // Initialize selected categories
    useEffect(() => {
        if (initialData?.movie_categories) {
            // @ts-ignore - Supabase type inference for joined logic can be tricky
            const categoryIds = initialData.movie_categories.map(mc => mc.categories?.id || mc.category_id).filter(Boolean);
            setSelectedCategories(categoryIds);
        }
    }, [initialData]);

    // Fetch categories on mount
    useEffect(() => {
        async function fetchCategories() {
            const { data } = await supabase.from('categories').select('*');
            if (data) setCategories(data);
        }
        fetchCategories();
    }, []);

    // Auto-generate slug from title (only if not editing)
    useEffect(() => {
        if (initialData) return; // Don't auto-change slug when editing

        const slugBase = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

        if (slugBase && releaseYear) {
            setSlug(`${slugBase}-${releaseYear}`);
        } else {
            setSlug(slugBase);
        }
    }, [title, releaseYear, initialData]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const url = await uploadPoster(file);

        if (url) {
            setPosterUrl(url);
        } else {
            alert('Failed to upload image. Make sure "posters" bucket exists and is public.');
        }
        setUploading(false);
    };

    const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const files = Array.from(e.target.files);
        const newUrls: string[] = [];

        try {
            // Upload all files in parallel
            const uploadPromises = files.map(file => uploadPoster(file));
            const results = await Promise.all(uploadPromises);

            results.forEach(url => {
                if (url) newUrls.push(url);
            });

            if (newUrls.length > 0) {
                setScreenshots(prev => [...prev, ...newUrls]);
            }
        } catch (error) {
            console.error('Screenshot upload error:', error);
            alert('Error uploading screenshots');
        } finally {
            setUploading(false);
        }
    };

    const removeScreenshot = (index: number) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
    };

    const addDownloadRow = () => {
        setDownloads([...downloads, { quality: '720p', fileSize: '', fileUrl: '' }]);
    };

    const removeDownloadRow = (index: number) => {
        setDownloads(downloads.filter((_, i) => i !== index));
    };

    const updateDownload = (index: number, field: string, value: string) => {
        const newDownloads = [...downloads];
        // @ts-ignore
        newDownloads[index][field] = value;
        setDownloads(newDownloads);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let movieId = initialData?.id;

            if (initialData) {
                // UPDATE Existing Movie
                const { error: updateError } = await supabase
                    .from('movies')
                    .update({
                        title,
                        slug,
                        description,
                        poster_url: posterUrl,
                        type,
                        release_year: releaseYear,
                        language,
                        source,
                        cast_members: castMembers,
                        format,
                        subtitle,
                        trailer_url: trailerUrl
                    })
                    .eq('id', movieId);

                if (updateError) throw updateError;

                // Clear existing categories and downloads to replace them
                await supabase.from('movie_categories').delete().eq('movie_id', movieId);
                await supabase.from('downloads').delete().eq('movie_id', movieId);

            } else {
                // INSERT New Movie
                const { data: movie, error: movieError } = await supabase
                    .from('movies')
                    .insert({
                        title,
                        slug,
                        description,
                        poster_url: posterUrl,
                        type,
                        release_year: releaseYear,
                        language,
                        source,
                        cast_members: castMembers,
                        format,
                        subtitle,
                        trailer_url: trailerUrl
                    })
                    .select()
                    .single();

                if (movieError) throw movieError;
                movieId = movie.id;
            }

            // 2. Insert Categories
            if (selectedCategories.length > 0) {
                const catInserts = selectedCategories.map(catId => ({
                    movie_id: movieId,
                    category_id: catId
                }));

                const { error: catError } = await supabase
                    .from('movie_categories')
                    .insert(catInserts);

                if (catError) throw catError;
            }

            // 3. Insert Downloads (ALLOW EMPTY URL)
            const downloadInserts = downloads.map(d => ({
                movie_id: movieId,
                quality: d.quality,
                file_size: d.fileSize,
                file_url: d.fileUrl || null
            }));

            if (downloadInserts.length > 0) {
                const { error: dlError } = await supabase
                    .from('downloads')
                    .insert(downloadInserts);

                if (dlError) throw dlError;
            }

            // 4. Insert Screenshots
            // Strategy: Delete all existing and re-insert (Simple & Effective for ordering)
            await supabase.from('movie_screenshots').delete().eq('movie_id', movieId);

            if (screenshots.length > 0) {
                const ssInserts = screenshots.map(url => ({
                    movie_id: movieId,
                    image_url: url
                }));
                const { error: ssError } = await supabase.from('movie_screenshots').insert(ssInserts);
                if (ssError) throw ssError;
            }

            // 5. Insert Download Links (new resolution-based system)
            // Wrapped in try-catch to prevent blocking save if table doesn't exist
            try {
                await supabase.from('download_links').delete().eq('movie_id', movieId);

                const linkInserts = Object.values(downloadLinks)
                    .filter(link =>
                        link.mega_link || link.gdrive_link || link.mediafire_link ||
                        link.terabox_link || link.pcloud_link || link.youtube_link
                    )
                    .map(link => ({
                        movie_id: movieId,
                        resolution: link.resolution,
                        file_size: link.file_size || null,
                        mega_link: link.mega_link || null,
                        gdrive_link: link.gdrive_link || null,
                        mediafire_link: link.mediafire_link || null,
                        terabox_link: link.terabox_link || null,
                        pcloud_link: link.pcloud_link || null,
                        youtube_link: link.youtube_link || null,
                    }));

                if (linkInserts.length > 0) {
                    const { error: linkError } = await supabase.from('download_links').insert(linkInserts);
                    if (linkError) console.warn('Download links save warning:', linkError);
                }
            } catch (dlError) {
                console.warn('Download links operation failed (table may not exist):', dlError);
            }

            router.push('/');
            router.refresh();

        } catch (error: any) {
            console.error('Error saving content (FULL):', JSON.stringify(error, null, 2));
            console.error('Error object:', error);
            alert(`Error saving content: ${error.message || JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleCategory = (catId: string) => {
        if (selectedCategories.includes(catId)) {
            setSelectedCategories(selectedCategories.filter(id => id !== catId));
        } else {
            setSelectedCategories([...selectedCategories, catId]);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
            {/* Basic Info */}
            <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                <h2 className="text-xl font-bold mb-4">
                    {initialData ? 'Edit Movie' : 'Basic Information'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Slug</label>
                        <input
                            type="text"
                            required
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Type</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as 'movie' | 'series' | 'anime')}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                        >
                            <option value="movie">Movie</option>
                            <option value="series">Series</option>
                            <option value="anime">Anime</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Release Year</label>
                        <input
                            type="number"
                            required
                            value={releaseYear}
                            onChange={(e) => setReleaseYear(Number(e.target.value))}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Description</label>
                    <textarea
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                    />
                </div>
            </div>


            {/* Metadata (Auto-Details) */}
            <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-blue-500">✨</span> Movie Details Metadata
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Language</label>
                        <input type="text" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Source (Quality)</label>
                        <input type="text" value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Format</label>
                        <input type="text" value={format} onChange={(e) => setFormat(e.target.value)} className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                    </div>
                    <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                </div>
                <div>
                    <label className="block text-sm text-gray-400 mb-1">Trailer URL</label>
                    <input type="url" placeholder="https://youtube.com/..." value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm text-gray-400 mb-1">Cast Members</label>
                    <input type="text" value={castMembers} onChange={(e) => setCastMembers(e.target.value)} placeholder="Actor 1, Actor 2, Actor 3" className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500" />
                </div>

            </div>

            {/* Poster Upload */}
            <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                <h2 className="text-xl font-bold mb-4">Poster Image</h2>
                <div className="grid md:grid-cols-[200px_1fr] gap-6">
                    <div className="aspect-[2/3] bg-dark-700 rounded-lg overflow-hidden relative border border-white/10">
                        {posterUrl ? (
                            <Image
                                src={posterUrl}
                                alt="Preview"
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                                No Preview
                            </div>
                        )}
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Upload Image</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                            />
                        </div>
                        {uploading && <p className="text-sm text-yellow-400">Uploading...</p>}

                        <div className="separator flex items-center gap-4 text-xs text-gray-500 uppercase my-4">
                            <span className="h-px bg-white/10 flex-1"></span>
                            OR
                            <span className="h-px bg-white/10 flex-1"></span>
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                            <input
                                type="url"
                                value={posterUrl}
                                onChange={(e) => setPosterUrl(e.target.value)}
                                placeholder="https://..."
                                className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white focus:outline-none focus:border-red-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Screenshots Section */}
            <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span className="text-red-500">📸</span> Movie Screenshots
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                    {screenshots.map((url, index) => (
                        <div key={index} className="relative aspect-video bg-dark-700 rounded-lg overflow-hidden group border border-white/10">
                            <Image
                                src={url}
                                alt={`Screenshot ${index + 1}`}
                                fill
                                className="object-cover"
                            />
                            <button
                                type="button"
                                onClick={() => removeScreenshot(index)}
                                className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}

                    {/* Add New Button */}
                    <label className="aspect-video bg-dark-700/50 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-red-500/50 hover:bg-dark-700 transition-all group">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleScreenshotUpload}
                            disabled={uploading}
                            className="hidden"
                        />
                        <div className="p-3 rounded-full bg-white/5 group-hover:bg-red-500/10 text-gray-400 group-hover:text-red-500 transition-colors mb-2">
                            {uploading ? (
                                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            )}
                        </div>
                        <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                            {uploading ? 'Uploading...' : 'Add Screenshots'}
                        </span>
                    </label>
                </div>
            </div>

            {/* Categories */}
            <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                <h2 className="text-xl font-bold mb-4">Categories</h2>
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategory(cat.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${selectedCategories.includes(cat.id)
                                ? 'bg-red-600 text-white border-red-500'
                                : 'bg-dark-700 text-gray-400 border-white/10 hover:bg-dark-600'
                                }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Download Links - Only for Movies */}
            {type === 'movie' && (
                <div className="glass p-6 rounded-xl border border-white/5 space-y-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-green-500">📥</span> Download Links
                    </h2>
                    <p className="text-sm text-gray-400 mb-4">
                        Add download links for each resolution. Click a resolution tab to add links for that quality.
                    </p>
                    <DownloadLinksEditor
                        movieId={initialData?.id}
                        initialLinks={initialData?.download_links || []}
                        onChange={setDownloadLinks}
                    />
                </div>
            )}

            {/* Season Editor - Only for Series/Anime (only shown when editing) */}
            {(type === 'series' || type === 'anime') && initialData?.id && (
                <SeasonEditor movieId={initialData.id} movieType={type} />
            )}

            {/* Note for new series/anime */}
            {(type === 'series' || type === 'anime') && !initialData?.id && (
                <div className="glass p-6 rounded-xl border border-purple-500/20 bg-purple-900/10">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-purple-400">
                        <span>📺</span> Seasons & Episodes
                    </h2>
                    <p className="text-sm text-gray-400 mt-2">
                        Save this content first, then you can add seasons and episodes by editing it.
                    </p>
                </div>
            )}

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-6 py-3 rounded-lg bg-dark-700 text-gray-300 font-semibold hover:bg-dark-600 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="px-8 py-3 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-900/40"
                >
                    {loading ? 'Saving...' : (initialData ? 'Update Content' : 'Create Content')}
                </button>
            </div>
        </form >
    );
}
