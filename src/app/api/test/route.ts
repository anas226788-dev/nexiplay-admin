import { NextResponse } from 'next/server';
import { supabaseNovels } from '@/lib/supabase-novels';

export async function GET() {
    const novel_id = '3d24b2dc-d2d2-4585-b0e4-f5ee6dd409cf'; // coffee & vanilla
    
    const chaptersToInsert = [
        {
            novel_id,
            title: 'Test Chapter',
            slug: 'chapter-999',
            content: '<p>Test content</p>',
            chapter_number: 999
        }
    ];

    const { data, error } = await supabaseNovels
        .from('novel_chapters')
        .upsert(chaptersToInsert, { onConflict: 'novel_id, slug' });

    return NextResponse.json({ data, error });
}
