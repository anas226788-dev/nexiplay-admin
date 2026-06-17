'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AppSettings, TelegramSettings } from '@/lib/types';

export default function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [telegramSettings, setTelegramSettings] = useState<TelegramSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchAllSettings();
    }, []);

    async function fetchAllSettings() {
        setLoading(true);
        try {
            // Fetch App Settings
            const { data: appData, error: appError } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (appError && appError.code !== 'PGRST116') throw appError;
            if (appData) setSettings(appData);

            // Fetch Telegram Settings
            const { data: tgData, error: tgError } = await supabase
                .from('telegram_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (tgError && tgError.code !== 'PGRST116') throw tgError;
            if (tgData) setTelegramSettings(tgData);

        } catch (error) {
            console.error('Error fetching settings:', error);
            setMessage({ type: 'error', text: 'Failed to load settings.' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            // Update App Settings
            if (settings) {
                const { error } = await supabase
                    .from('app_settings')
                    .update({
                        is_ads_enabled: settings.is_ads_enabled,
                        popunder_url: settings.popunder_url,
                        direct_link_url: settings.direct_link_url,
                        ad_frequency_session: settings.ad_frequency_session || 1,
                        // Download Verification
                        is_download_verification_enabled: settings.is_download_verification_enabled || false,
                        download_ad_url_1: settings.download_ad_url_1 || '',
                        download_ad_url_2: settings.download_ad_url_2 || '',
                        // Latest Updates Ads
                        latest_update_click_ad_link: settings.latest_update_click_ad_link || '',
                        is_verification_enabled: settings.is_verification_enabled || false,
                        verification_ad_url_1: settings.verification_ad_url_1 || '',
                        verification_ad_url_2: settings.verification_ad_url_2 || '',
                        // Socials
                        social_facebook: settings.social_facebook,
                        social_twitter: settings.social_twitter,
                        social_youtube: settings.social_youtube,
                        social_pinterest: settings.social_pinterest,
                        social_reddit: settings.social_reddit,
                        social_tumblr: settings.social_tumblr,
                        social_aboutme: settings.social_aboutme,
                        social_instagram: settings.social_instagram,
                        social_threads: settings.social_threads,

                        updated_at: new Date().toISOString()
                    })
                    .eq('id', 1);

                if (error) throw error;
            }

            // Update Telegram Settings
            if (telegramSettings) {
                const { error: tgError } = await supabase
                    .from('telegram_settings')
                    .update({
                        telegram_type: telegramSettings.telegram_type,
                        telegram_url: telegramSettings.telegram_url,
                        is_active: telegramSettings.is_active,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', 1);

                if (tgError) throw tgError;
            }

            setMessage({ type: 'success', text: 'Settings updated successfully!' });
        } catch (error: any) {
            console.error('Error updating settings:', error);
            setMessage({ type: 'error', text: `Failed to update settings: ${error.message || error.details || JSON.stringify(error)}` });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
            </div>

            <div className="bg-dark-800 rounded-2xl p-8 border border-white/5">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {message && (
                        <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* App Settings */}
                    {settings && (
                        <>
                            {/* Master Switch */}
                            <div className="flex items-center justify-between p-6 bg-dark-700/50 rounded-xl border border-white/5">
                                <div>
                                    <h3 className="text-lg font-medium text-white mb-1">Enable Ads</h3>
                                    <p className="text-sm text-gray-400">Toggle all ad scripts globally.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={settings.is_ads_enabled}
                                        onChange={(e) => setSettings({ ...settings, is_ads_enabled: e.target.checked })}
                                    />
                                    <div className="w-14 h-7 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Popunder Script URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={settings.popunder_url || ''}
                                        onChange={(e) => setSettings({ ...settings, popunder_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white placeholder-gray-600"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Direct Link URL
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={settings.direct_link_url || ''}
                                        onChange={(e) => setSettings({ ...settings, direct_link_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white placeholder-gray-600"
                                    />
                                    <p className="mt-2 text-xs text-gray-500">This URL opens in a new tab when users click on content cards.</p>
                                </div>

                                <div className="p-4 bg-dark-700/30 rounded-xl border border-white/5">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Ad Click Frequency (per session)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={settings.ad_frequency_session || 1}
                                        onChange={(e) => setSettings({ ...settings, ad_frequency_session: parseInt(e.target.value) || 1 })}
                                        className="w-24 px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white"
                                    />
                                    <p className="mt-2 text-xs text-gray-500">How many times the ad popup will appear per user session when clicking content.</p>
                                </div>

                                {/* 2-Step Stream Verification Section */}
                                <div className="p-6 bg-dark-700/50 rounded-xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between pb-2">
                                        <div>
                                            <h3 className="text-lg font-medium text-white mb-1">🎬 2-Step Stream Verification</h3>
                                            <p className="text-sm text-gray-400">Lock the stream player until the user completes two 10s ad verifications.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={settings.is_verification_enabled || false}
                                                onChange={(e) => setSettings({ ...settings, is_verification_enabled: e.target.checked })}
                                            />
                                            <div className="w-14 h-7 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>

                                    {settings.is_verification_enabled && (
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Step 1 Ad URL
                                                </label>
                                                <input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={settings.verification_ad_url_1 || ''}
                                                    onChange={(e) => setSettings({ ...settings, verification_ad_url_1: e.target.value })}
                                                    className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white placeholder-gray-600"
                                                />
                                                <p className="mt-1.5 text-xs text-gray-500">Ad link for the first step (Secure Scanning). If empty, defaults to direct link.</p>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                                    Step 2 Ad URL
                                                </label>
                                                <input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={settings.verification_ad_url_2 || ''}
                                                    onChange={(e) => setSettings({ ...settings, verification_ad_url_2: e.target.value })}
                                                    className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-white placeholder-gray-600"
                                                />
                                                <p className="mt-1.5 text-xs text-gray-500">Ad link for the second step (Final Verification). If empty, defaults to popunder link.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Download Verification Ads */}
                    <div className="p-6 bg-dark-800/50 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">🔒 Download Verification Ads</h3>
                        <p className="text-xs text-gray-400 mb-4">
                            Users must complete a 2-step ad verification before downloading. Same system as Watch Online verification.
                        </p>
                        <div className="flex items-center gap-3 mb-4">
                            <label className="text-sm font-bold text-gray-300">Enable Download Verification</label>
                            <button
                                type="button"
                                onClick={() => setSettings({...settings, is_download_verification_enabled: !settings.is_download_verification_enabled})}
                                className={`relative w-12 h-6 rounded-full transition-colors ${
                                    settings.is_download_verification_enabled ? 'bg-emerald-500' : 'bg-gray-600'
                                }`}
                            >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                    settings.is_download_verification_enabled ? 'translate-x-6' : ''
                                }`} />
                            </button>
                        </div>
                        <label className="text-xs font-bold text-red-400 block mb-1">Step 1 Ad URL</label>
                        <input
                            className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm mb-1"
                            placeholder="https://example.com/ad-link-1"
                            value={settings.download_ad_url_1 || ''}
                            onChange={(e) => setSettings({...settings, download_ad_url_1: e.target.value})}
                        />
                        <p className="text-[10px] text-gray-500 mb-3">Ad link for the first step (Secure Scanning). If empty, defaults to direct link.</p>
                        <label className="text-xs font-bold text-red-400 block mb-1">Step 2 Ad URL</label>
                        <input
                            className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-sm mb-1"
                            placeholder="https://example.com/ad-link-2"
                            value={settings.download_ad_url_2 || ''}
                            onChange={(e) => setSettings({...settings, download_ad_url_2: e.target.value})}
                        />
                        <p className="text-[10px] text-gray-500">Ad link for the second step (Final Verification). If empty, defaults to popunder link.</p>
                    </div>

                            {/* Latest Updates Ads */}
                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                    <span className="text-green-500">🔔</span> Latest Updates Ads
                                </h3>
                                <p className="text-xs text-gray-500 -mt-2 mb-4">
                                    When set, clicking a Latest Updates card will open this ad link in a new tab before navigating to the content.
                                    Leave empty to disable.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Ad Click Link
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://your-ad-link.com"
                                        value={settings.latest_update_click_ad_link || ''}
                                        onChange={(e) => setSettings({ ...settings, latest_update_click_ad_link: e.target.value })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all text-white placeholder-gray-600"
                                    />
                                    <p className="mt-2 text-xs text-gray-500">Opens in a new tab when user clicks any card in the &quot;Latest Updates&quot; section. Does NOT affect Trending or other cards.</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-white/5">
                                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                    <span className="text-blue-500">🌐</span> Social Profiles
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { key: 'social_facebook', label: 'Facebook URL', placeholder: 'https://facebook.com/...' },
                                        { key: 'social_twitter', label: 'Twitter (X) URL', placeholder: 'https://twitter.com/...' },
                                        { key: 'social_youtube', label: 'YouTube URL', placeholder: 'https://youtube.com/...' },
                                        { key: 'social_pinterest', label: 'Pinterest URL', placeholder: 'https://pinterest.com/...' },
                                        { key: 'social_reddit', label: 'Reddit URL', placeholder: 'https://reddit.com/...' },
                                        { key: 'social_tumblr', label: 'Tumblr URL', placeholder: 'https://tumblr.com/...' },
                                        { key: 'social_aboutme', label: 'About.me URL', placeholder: 'https://about.me/...' },
                                        { key: 'social_instagram', label: 'Instagram URL', placeholder: 'https://instagram.com/...' },
                                        { key: 'social_threads', label: 'Threads URL', placeholder: 'https://threads.net/...' },
                                    ].map((field) => (
                                        <div key={field.key}>
                                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                                {field.label}
                                            </label>
                                            <input
                                                type="url"
                                                placeholder={field.placeholder}
                                                value={(settings as any)[field.key] || ''}
                                                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                                                className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all text-white placeholder-gray-600"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Telegram Settings */}
                    {telegramSettings && (
                        <div className="space-y-4 pt-6 border-t border-white/5">
                            <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                                <span className="text-blue-500">✈️</span> Telegram Settings
                            </h3>

                            <div className="flex items-center justify-between p-4 bg-dark-700/50 rounded-xl border border-white/5 mb-4">
                                <div>
                                    <h4 className="text-sm font-medium text-white">Show Telegram Button</h4>
                                    <p className="text-xs text-gray-400">Toggle "Join Telegram" button on public site.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={telegramSettings.is_active}
                                        onChange={(e) => setTelegramSettings({ ...telegramSettings, is_active: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
                                    <select
                                        value={telegramSettings.telegram_type}
                                        onChange={(e) => setTelegramSettings({ ...telegramSettings, telegram_type: e.target.value as 'group' | 'channel' })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 text-white"
                                    >
                                        <option value="channel">Channel</option>
                                        <option value="group">Group</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Telegram Link</label>
                                    <input
                                        type="url"
                                        placeholder="https://t.me/your_link"
                                        value={telegramSettings.telegram_url}
                                        onChange={(e) => setTelegramSettings({ ...telegramSettings, telegram_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-dark-900 border border-white/10 rounded-xl focus:outline-none focus:border-blue-500 text-white placeholder-gray-600"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-white/5 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
