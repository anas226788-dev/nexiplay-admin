import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug') || searchParams.get('title') || 'nexiplay-novel';
    
    let hash = 0;
    for (let i = 0; i < slug.length; i++) {
        hash = (hash * 31 + slug.charCodeAt(i)) & 0xffffffff;
    }
    const coverNum = (Math.abs(hash) % 9) + 1;

    return NextResponse.redirect(new URL(`/novel-covers/cover-${coverNum}.jpg`, req.url), 302);
}
