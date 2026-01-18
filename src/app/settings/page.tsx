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
        } catch (error) {
            console.error('Error updating settings:', error);
            setMessage({ type: 'error', text: 'Failed to update settings.' });
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
