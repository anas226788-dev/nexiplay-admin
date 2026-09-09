import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

let fontCache: ArrayBuffer | null = null;

async function getBengaliFont(): Promise<ArrayBuffer> {
    if (fontCache) return fontCache;
    try {
        const res = await fetch('https://fonts.gstatic.com/s/hindsiliguri/v14/ijwOs5juQtsyLLR5jN4cxBEoREP-4uE.ttf');
        if (res.ok) {
            fontCache = await res.arrayBuffer();
            return fontCache;
        }
    } catch (e) {
        console.error('Failed to load Bengali font:', e);
    }
    return new ArrayBuffer(0);
}

const GRADIENTS = [
    { bg1: '#1a050f', bg2: '#080105', accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.35)', border: 'rgba(244, 63, 94, 0.4)' }, // Crimson Rose
    { bg1: '#0f051d', bg2: '#05010b', accent: '#9333ea', glow: 'rgba(147, 51, 234, 0.35)', border: 'rgba(168, 85, 247, 0.4)' }, // Royal Violet
    { bg1: '#031525', bg2: '#010811', accent: '#0284c7', glow: 'rgba(2, 132, 199, 0.35)', border: 'rgba(56, 189, 248, 0.4)' }, // Midnight Blue
    { bg1: '#180703', bg2: '#090201', accent: '#ea580c', glow: 'rgba(234, 88, 12, 0.35)', border: 'rgba(251, 146, 60, 0.4)' }, // Sunset Amber
    { bg1: '#041712', bg2: '#010a07', accent: '#059669', glow: 'rgba(5, 150, 105, 0.35)', border: 'rgba(52, 211, 153, 0.4)' }, // Emerald Deep
    { bg1: '#150616', bg2: '#080108', accent: '#c026d3', glow: 'rgba(192, 38, 211, 0.35)', border: 'rgba(232, 121, 249, 0.4)' }, // Velvet Orchid
];

function getPalette(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    const idx = Math.abs(hash) % GRADIENTS.length;
    return GRADIENTS[idx];
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title') || 'Nexiplay Novel';
    const author = searchParams.get('author') || 'Romantic Golpo';
    const genre = searchParams.get('genre') || 'Romantic Novel';
    const slug = searchParams.get('slug') || title;

    const fontData = await getBengaliFont();
    const palette = getPalette(slug);

    let titleFontSize = 42;
    if (title.length > 35) titleFontSize = 30;
    else if (title.length > 20) titleFontSize = 36;

    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: `linear-gradient(145deg, ${palette.bg1} 0%, #08070b 50%, ${palette.bg2} 100%)`,
                    padding: '40px 36px',
                    fontFamily: '"Hind Siliguri", sans-serif',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        right: '16px',
                        bottom: '16px',
                        border: `1px solid ${palette.border}`,
                        borderRadius: '20px',
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '24px',
                        left: '24px',
                        right: '24px',
                        bottom: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        pointerEvents: 'none',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        top: '180px',
                        left: '100px',
                        width: '400px',
                        height: '400px',
                        borderRadius: '50%',
                        background: palette.glow,
                        filter: 'blur(80px)',
                        pointerEvents: 'none',
                    }}
                />

                {/* ── TOP HEADER ── */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 10,
                        marginTop: '10px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: `1px solid ${palette.border}`,
                            padding: '6px 18px',
                            borderRadius: '999px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        }}
                    >
                        <span style={{ fontSize: '11px', letterSpacing: '4px', color: '#f8fafc', fontWeight: 700 }}>
                            NEXIPLAY NOVELS
                        </span>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            gap: '6px',
                            marginTop: '12px',
                        }}
                    >
                        {[1, 2, 3, 4, 5].map((s) => (
                            <svg key={s} viewBox="0 0 24 24" width="13" height="13" fill={palette.accent}>
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        ))}
                    </div>
                </div>

                {/* ── CENTER SECTION: ORNAMENT + TITLE ── */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        maxWidth: '500px',
                        zIndex: 10,
                        padding: '0 10px',
                    }}
                >
                    {/* Book Ornament Icon */}
                    <div
                        style={{
                            width: '68px',
                            height: '68px',
                            borderRadius: '50%',
                            background: `linear-gradient(135deg, ${palette.accent} 0%, rgba(0,0,0,0.6) 100%)`,
                            border: '2px solid rgba(255,255,255,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '20px',
                            boxShadow: `0 0 30px ${palette.glow}`,
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="34" height="34" fill="#ffffff">
                            <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                        </svg>
                    </div>

                    {/* Novel Title */}
                    <h1
                        style={{
                            fontSize: `${titleFontSize}px`,
                            fontWeight: 700,
                            lineHeight: 1.3,
                            color: '#ffffff',
                            textShadow: '0 4px 20px rgba(0, 0, 0, 0.9)',
                            margin: '0 0 14px 0',
                            textAlign: 'center',
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                        }}
                    >
                        {title}
                    </h1>

                    {/* Decorative Divider */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            width: '240px',
                            marginTop: '8px',
                            marginBottom: '14px',
                        }}
                    >
                        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, transparent, ${palette.accent})` }} />
                        <div style={{ width: '8px', height: '8px', background: palette.accent, transform: 'rotate(45deg)' }} />
                        <div style={{ flex: 1, height: '1px', background: `linear-gradient(90deg, ${palette.accent}, transparent)` }} />
                    </div>

                    <p
                        style={{
                            fontSize: '18px',
                            fontWeight: 600,
                            color: '#cbd5e1',
                            margin: 0,
                            letterSpacing: '0.5px',
                        }}
                    >
                        {author}
                    </p>
                </div>

                {/* ── BOTTOM FOOTER ── */}
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        zIndex: 10,
                        marginBottom: '10px',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'rgba(0, 0, 0, 0.4)',
                            padding: '6px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                    >
                        <span style={{ color: palette.accent, fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>
                            {genre.toUpperCase()}
                        </span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '10px' }}>•</span>
                        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
                            NEXIPLAY.VERCEL.APP
                        </span>
                    </div>
                </div>
            </div>
        ),
        {
            width: 600,
            height: 900,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
            fonts: fontData.byteLength > 0 ? [
                {
                    name: 'Hind Siliguri',
                    data: fontData,
                    style: 'normal',
                    weight: 700,
                },
            ] : undefined,
        }
    );
}
