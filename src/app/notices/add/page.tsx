'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadNoticeImage } from '@/lib/upload';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddNoticePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formData, setFormData] = useState({
        content: '',
        image_url: '',
        type: 'top_bar',
        pages: 'all',
        bg_color: 'bg-red-600',
        text_color: 'text-white',
        is_active: true
    });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase
            .from('notices')
            .insert([formData]);

        if (error) {
            alert(error.message);
        } else {
            router.push('/notices');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-8">Create Notice</h1>
            <form onSubmit={handleSubmit} className="bg-dark-800 p-8 rounded-xl border border-white/5 space-y-6">
                <div>
                    <label className="block text-gray-400 mb-2">Message Content (HTML Supported)</label>
                    <textarea
                        required
                        className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-600"
                        rows={4}
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    />
                </div>

                {/* Image Upload */}
                <div>
                    <label className="block text-gray-400 mb-2">Notice Image (Optional)</label>
                    {formData.image_url ? (
                        <div className="relative inline-block">
                            <img src={formData.image_url} alt="Notice" className="max-w-[250px] h-auto rounded-lg border border-white/10" />
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
                                    <p className="text-gray-400 text-sm">Click to upload or drag & drop</p>
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
                    <p className="text-xs text-gray-500 mt-2">Image shows in popup & inline notices. Top bar is text-only.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-400 mb-2">Type</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="top_bar">Top Bar</option>
                            <option value="popup">Popup Modal</option>
                            <option value="inline">Inline (In Page)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Show On</label>
                        <select
                            className="w-full bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                            value={formData.pages}
                            onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                        >
                            <option value="all">All Pages</option>
                            <option value="home">Homepage Only</option>
                            <option value="movie">Movie/Episode Pages</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-gray-400 mb-2">Background Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                className="h-11 w-12 bg-dark-900 border border-white/10 rounded-lg p-1 cursor-pointer"
                                value={formData.bg_color.startsWith('#') ? formData.bg_color : '#ff0000'}
                                onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                            />
                            <input
                                type="text"
                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                                value={formData.bg_color}
                                onChange={(e) => setFormData({ ...formData, bg_color: e.target.value })}
                                placeholder="#RRGGBB or bg-red-600"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-400 mb-2">Text Color</label>
                        <div className="flex gap-2">
                            <input
                                type="color"
                                className="h-11 w-12 bg-dark-900 border border-white/10 rounded-lg p-1 cursor-pointer"
                                value={formData.text_color.startsWith('#') ? formData.text_color : '#ffffff'}
                                onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                            />
                            <input
                                type="text"
                                className="flex-1 bg-dark-900 border border-white/10 rounded-lg px-4 py-3 text-white"
                                value={formData.text_color}
                                onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                                placeholder="#RRGGBB or text-white"
                            />
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading || uploading}
                    className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Create Notice'}
                </button>
            </form>
        </div>
    );
}
