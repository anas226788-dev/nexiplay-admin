'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { uploadPoster } from '@/lib/upload'; // Reusing this for ad images
import { Ad } from '@/lib/types';

interface AdFormProps {
    initialData?: Ad;
}

export default function AdForm({ initialData }: AdFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [title, setTitle] = useState(initialData?.title || '');
    const [placement, setPlacement] = useState<Ad['placement']>(initialData?.placement || 'home_top');
    const [adType, setAdType] = useState<Ad['ad_type']>(initialData?.ad_type || 'image');
    const [imageUrl, setImageUrl] = useState(initialData?.image_url || '');
    const [scriptCode, setScriptCode] = useState(initialData?.script_code || '');
    const [destinationUrl, setDestinationUrl] = useState(initialData?.destination_url || '');
    const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        setUploading(true);
        const file = e.target.files[0];
        const url = await uploadPoster(file); // Stores in 'posters' bucket for now, simpler

        if (url) {
            setImageUrl(url);
        } else {
            alert('Failed to upload image.');
        }
        setUploading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const adData = {
                title,
                placement,
                ad_type: adType,
                image_url: adType === 'image' ? imageUrl : null,
                script_code: adType === 'script' ? scriptCode : null,
                destination_url: adType === 'image' ? destinationUrl : null,
                is_active: isActive
            };

            let result;
            if (initialData) {
                result = await supabase
                    .from('ads')
                    .update(adData)
                    .eq('id', initialData.id);
            } else {
                result = await supabase
                    .from('ads')
                    .insert(adData);
            }

            console.log('Supabase Operation Result:', result);
            if (result.error) throw result.error;

            router.push('/ads');
            router.refresh();

        } catch (error: any) {
            console.error('Full Ad Save Error:', error);
            alert(`Error saving ad: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="glass p-6 rounded-xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">{initialData ? 'Edit Ad' : 'New Ad Campaign'}</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-400">Status:</span>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`w-12 h-6 rounded-full transition-colors relative ${isActive ? 'bg-green-500' : 'bg-gray-600'}`}
                        >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isActive ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </div>

                {/* Title & Placement */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Ad Title</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                            placeholder="e.g. Home Header Promo"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Placement</label>
                        <select
                            value={placement}
                            onChange={(e) => setPlacement(e.target.value as any)}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                        >
                            <option value="home_top">Home Top Banner</option>
                            <option value="home_bottom">Home Bottom Banner</option>
                            <option value="movie_sidebar">Movie Sidebar</option>
                            <option value="popup_global">Global Popup</option>
                        </select>
                    </div>
                </div>

                {/* Ad Type */}
                <div>
                    <label className="block text-sm text-gray-400 mb-2">Ad Type</label>
                    <div className="flex gap-4">
                        <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-colors ${adType === 'image' ? 'bg-red-600/10 border-red-500/50 text-red-500' : 'bg-dark-700 border-white/10 text-gray-400'}`}>
                            <input
                                type="radio"
                                name="adType"
                                value="image"
                                checked={adType === 'image'}
                                onChange={() => setAdType('image')}
                                className="hidden"
                            />
                            <div className="text-center font-bold">Image Banner</div>
                            <div className="text-center text-xs opacity-70 mt-1">Upload an image or URL</div>
                        </label>
                        <label className={`flex-1 p-4 rounded-xl border cursor-pointer transition-colors ${adType === 'script' ? 'bg-red-600/10 border-red-500/50 text-red-500' : 'bg-dark-700 border-white/10 text-gray-400'}`}>
                            <input
                                type="radio"
                                name="adType"
                                value="script"
                                checked={adType === 'script'}
                                onChange={() => setAdType('script')}
                                className="hidden"
                            />
                            <div className="text-center font-bold">Script / Code</div>
                            <div className="text-center text-xs opacity-70 mt-1">Paste HTML/JS code (Adsterra, Google)</div>
                        </label>
                    </div>
                </div>

                {/* Image Input */}
                {adType === 'image' && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid md:grid-cols-[200px_1fr] gap-6">
                            <div className="aspect-video bg-dark-700 rounded-lg overflow-hidden relative border border-white/10 flex items-center justify-center">
                                {imageUrl ? (
                                    <Image src={imageUrl} alt="Preview" fill className="object-cover" />
                                ) : (
                                    <span className="text-gray-500 text-xs">No Preview</span>
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
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-2.5 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Or Image URL</label>
                                    <input
                                        type="url"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white"
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Destination URL (Redirect)</label>
                            <input
                                type="url"
                                value={destinationUrl}
                                onChange={(e) => setDestinationUrl(e.target.value)}
                                className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500"
                                placeholder="http://example.com/offer"
                            />
                        </div>
                    </div>
                )}

                {/* Script Input */}
                {adType === 'script' && (
                    <div className="animate-fadeIn">
                        <label className="block text-sm text-gray-400 mb-2">Ad Script / HTML Code</label>
                        <textarea
                            rows={8}
                            value={scriptCode}
                            onChange={(e) => setScriptCode(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded-lg p-3 text-white font-mono text-sm focus:outline-none focus:border-red-500"
                            placeholder="<script>...</script>"
                        />
                        <p className="text-xs text-yellow-500 mt-2">
                            Warning: Malicious scripts can break your site. Only include codes from trusted networks.
                        </p>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
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
                    {loading ? 'Saving...' : 'Save Ad Campaign'}
                </button>
            </div>
        </form>
    );
}
