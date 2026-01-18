'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AppSettings } from '@/lib/types';
import Script from 'next/script';

export default function AdManager() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [clicked, setClicked] = useState(false);

    useEffect(() => {
        // Fetch ad settings
        async function fetchSettings() {
            const { data } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (data && data.is_ads_enabled) {
                setSettings(data);
            }
        }

        fetchSettings();
    }, []);

    useEffect(() => {
        if (!settings?.is_ads_enabled || !settings.direct_link_url) return;

        // Global click handler for Direct Link
        const handleGlobalClick = (e: MouseEvent) => {
            if (clicked) return; // Only trigger once per session/reload

            // Don't trigger if clicking on interactive elements that should work normally
            const target = e.target as HTMLElement;
            if (target.closest('a') || target.closest('button')) {
                // Optional: You can decide if you want to hijack real clicks or only background clicks
                // For aggressive monetization, often *any* click triggers it.
                // For better UX, maybe skip. Let's hijack the first click regardless for max revenue as requested by typical users of such scripts.
            }

            window.open(settings.direct_link_url, '_blank');
            setClicked(true);

            // In a real scenario, you might want to use cookies to limit frequency
            // sessionStorage.setItem('ad_clicked', 'true');
        };

        window.addEventListener('click', handleGlobalClick, { once: true });

        return () => window.removeEventListener('click', handleGlobalClick);
    }, [settings, clicked]);

    if (!settings || !settings.is_ads_enabled) return null;

    return (
        <>
            {/* Popunder Script */}
            {settings.popunder_url && (
                <Script
                    src={settings.popunder_url}
                    strategy="lazyOnload"
                />
            )}
        </>
    );
}
