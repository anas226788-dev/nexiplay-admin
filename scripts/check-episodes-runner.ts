/**
 * Standalone CLI runner for Running Series Auto-Checker.
 * Designed to run in GitHub Actions (no serverless timeout) or locally.
 */

// Load .env file for local runs (Next.js does this automatically, but npx tsx doesn't)
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
    const envPath = resolve(process.cwd(), envFile);
    if (existsSync(envPath)) {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            const key = trimmed.substring(0, eqIdx).trim();
            const value = trimmed.substring(eqIdx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
        console.log(`📁 Loaded env from ${envFile}`);
        break;
    }
}

import { handleCheckEpisodes } from '../src/lib/episode-checker';

async function run() {
    console.log('====================================================');
    console.log('🎬 NexiPlay Running Series Cron Job Started');
    console.log('⏰ Time:', new Date().toISOString());
    console.log('====================================================');

    const startTime = Date.now();
    try {
        const results = await handleCheckEpisodes(undefined, 'running');
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n====================================================');
        console.log(`✅ Cron completed in ${durationSec}s`);
        console.log(`📊 Total items evaluated: ${Array.isArray(results) ? results.length : 0}`);
        console.log('====================================================\n');

        if (Array.isArray(results)) {
            for (const item of results) {
                const icon = item.status === 'updated' ? '🎉' : item.status === 'skipped' ? '⏭️' : item.status === 'error' ? '❌' : 'ℹ️';
                console.log(`${icon} [${item.status?.toUpperCase()}] ${item.title}`);
                if (item.message) console.log(`   Message: ${item.message}`);
                if (item.error) console.log(`   Error: ${item.error}`);
                if (item.reason) console.log(`   Reason: ${item.reason}`);
                if (item.nextEpisodeDate) console.log(`   Next Check: ${item.nextEpisodeDate}`);
                if (item.warnings && item.warnings.length > 0) {
                    console.log(`   Warnings: ${item.warnings.join('; ')}`);
                }
            }
        } else {
            console.log('Output:', results);
        }

        console.log('\nDone.');
    } catch (err: any) {
        console.error('\n❌ Fatal error running check-episodes cron:', err.message || err);
        process.exit(1);
    }
}

run();
