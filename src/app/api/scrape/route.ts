import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { url, maxChapters } = body;

        if (!url || !url.startsWith('http')) {
            return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
        }

        const limit = parseInt(maxChapters) || 100;

        // 1. Scrape Category Page
        const categoryRes = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $cat = cheerio.load(categoryRes.data);
        
        // Extract Novel Metadata
        let title = $cat('h1.page-title').text().trim() || $cat('title').text().replace('- Romantic Golpo', '').trim();
        title = title.replace(/-\s*সকল পর্বের লিঙ্ক.*/i, '').trim();
        
        if (title.toLowerCase() === 'romantic golpo' || title === '') {
            // fallback
            const parts = url.split('/').filter(Boolean);
            title = parts[parts.length - 1].replace(/-/g, ' ').toUpperCase();
        }

        const novelSlug = url.split('/').filter(Boolean).pop() || 'novel';
        const bloggerLabel = `novel-${novelSlug}`;
        
        // Extract Chapter Links (Assuming they are inside h2.entry-title or h3.entry-title)
        const chapterLinks: { title: string, url: string }[] = [];
        $cat('h2.entry-title a, h3.entry-title a, h3 a').each((i, el) => {
            const href = $cat(el).attr('href');
            const cTitle = $cat(el).text().trim();
            if (href && href.includes('romanticgolpo.com') && !chapterLinks.some(c => c.url === href)) {
                chapterLinks.push({ title: cTitle, url: href });
            }
        });

        // We won't reverse them by default since the site lists them from Part 1 to Part N.
        
        // Limit chapters
        const chaptersToScrape = chapterLinks.slice(0, limit);

        if (chaptersToScrape.length === 0) {
            return NextResponse.json({ error: 'No chapters found on the provided URL.' }, { status: 404 });
        }

        // 2. Scrape Each Chapter
        const chaptersData: { title: string, content: string, pubDate: string }[] = [];
        
        // We will simulate publication dates sequentially to keep them in order on Blogger
        let baseDate = new Date();
        baseDate.setDate(baseDate.getDate() - chaptersToScrape.length);

        for (let i = 0; i < chaptersToScrape.length; i++) {
            const chapter = chaptersToScrape[i];
            try {
                const chapRes = await axios.get(chapter.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                const $chap = cheerio.load(chapRes.data);
                
                // Extract content
                let contentHtml = '';
                $chap('.td-post-content p, .entry-content p').each((_, p) => {
                    const text = $chap(p).text().trim();
                    if (text && !text.includes('আরও গল্প পরতে ভিজিট করুন') && !text.includes('RELATED ARTICLES')) {
                        contentHtml += `<p>${text}</p>`;
                    }
                });

                if (contentHtml) {
                    baseDate.setMinutes(baseDate.getMinutes() + 5); // Add 5 minutes for each chapter
                    chaptersData.push({
                        title: chapter.title,
                        content: contentHtml,
                        pubDate: baseDate.toISOString()
                    });
                }
            } catch (err) {
                console.error(`Failed to scrape chapter ${chapter.url}`, err);
            }
        }

        // 3. Return JSON instead of XML
        return NextResponse.json({
            novel: {
                title,
                slug: novelSlug,
                blogger_label: bloggerLabel,
                cover_url: '', // Add manual cover later
                description: '',
                status: 'ongoing',
                chapterCount: chaptersData.length
            },
            chapters: chaptersData.map((chap, i) => ({
                title: chap.title,
                slug: `chapter-${i + 1}`,
                content: chap.content,
                chapter_number: i + 1
            }))
        });

    } catch (error: any) {
        console.error('Scraper API Error:', error);
        return NextResponse.json({ error: error.message || 'Scraping failed' }, { status: 500 });
    }
}
