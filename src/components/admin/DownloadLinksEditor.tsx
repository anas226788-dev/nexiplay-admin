'use client';

import { useState } from 'react';
import { DownloadLink } from '@/lib/types';

interface DownloadLinksEditorProps {
    movieId?: string;
    initialLinks: DownloadLink[];
    onChange: (links: Record<string, DownloadLink>) => void;
}

const RESOLUTIONS = ['360p', '480p', '720p', '1080p'] as const;

const PROVIDER_FIELDS = [
    { key: 'mega_link', label: 'Mega', placeholder: 'https://mega.nz/...' },
    { key: 'gdrive_link', label: 'Google Drive', placeholder: 'https://drive.google.com/...' },
    { key: 'mediafire_link', label: 'MediaFire', placeholder: 'https://mediafire.com/...' },
    { key: 'terabox_link', label: 'TeraBox', placeholder: 'https://terabox.com/...' },
    { key: 'pcloud_link', label: 'pCloud', placeholder: 'https://pcloud.link/...' },
    { key: 'youtube_link', label: 'YouTube', placeholder: 'https://youtube.com/...' },
] as const;

type ProviderKey = typeof PROVIDER_FIELDS[number]['key'];

export default function DownloadLinksEditor({ movieId, initialLinks, onChange }: DownloadLinksEditorProps) {
    const [activeTab, setActiveTab] = useState<string>('720p');

    // Initialize state from initialLinks
    const initializeLinks = () => {
        const links: Record<string, DownloadLink> = {};
        RESOLUTIONS.forEach(res => {
            const existing = initialLinks.find(l => l.resolution === res);
            links[res] = existing || {
                resolution: res,
                file_size: '',
                mega_link: '',
                gdrive_link: '',
                mediafire_link: '',
                terabox_link: '',
                pcloud_link: '',
                youtube_link: '',
            };
        });
        return links;
    };

    const [links, setLinks] = useState<Record<string, DownloadLink>>(initializeLinks);

    const updateLink = (resolution: string, field: string, value: string) => {
        const newLinks = {
            ...links,
            [resolution]: {
                ...links[resolution],
                [field]: value,
            }
        };
        setLinks(newLinks);
        onChange(newLinks);
    };

    const hasAnyLink = (resolution: string) => {
        const link = links[resolution];
        return PROVIDER_FIELDS.some(p => link[p.key as keyof DownloadLink]);
    };

    return (
        <div className="space-y-4">
            {/* Resolution Tabs */}
            <div className="flex flex-wrap gap-2">
                {RESOLUTIONS.map((res) => (
                    <button
                        key={res}
                        type="button"
                        onClick={() => setActiveTab(res)}
                        className={`
                            px-4 py-2 rounded-lg font-medium text-sm transition-all
                            ${activeTab === res
                                ? 'bg-red-600 text-white'
                                : hasAnyLink(res)
                                    ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                                    : 'bg-dark-700 text-gray-400 border border-white/10 hover:bg-dark-600'
                            }
                        `}
                    >
                        {res}
                        {hasAnyLink(res) && activeTab !== res && (
                            <span className="ml-1">✓</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Active Tab Content */}
            <div className="bg-dark-700/50 rounded-xl p-4 border border-white/5">
                <h3 className="text-lg font-semibold text-white mb-4">
                    {activeTab} Download Links
                </h3>

                <div className="space-y-3">
                    {/* File Size */}
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">File Size</label>
                        <input
                            type="text"
                            placeholder="e.g., 800MB"
                            value={links[activeTab]?.file_size || ''}
                            onChange={(e) => updateLink(activeTab, 'file_size', e.target.value)}
                            className="w-full bg-dark-600 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                    </div>

                    {/* Provider Links */}
                    {PROVIDER_FIELDS.map((provider) => (
                        <div key={provider.key}>
                            <label className="block text-sm text-gray-400 mb-1">{provider.label}</label>
                            <input
                                type="url"
                                placeholder={provider.placeholder}
                                value={(links[activeTab]?.[provider.key as keyof DownloadLink] as string) || ''}
                                onChange={(e) => updateLink(activeTab, provider.key, e.target.value)}
                                className="w-full bg-dark-600 border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-gray-500">
                <span className="inline-block w-3 h-3 bg-green-600/20 border border-green-500/30 rounded mr-1"></span>
                = Has links configured
            </div>
        </div>
    );
}
