import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Server configuration error: missing Supabase credentials');
    }

    return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const supabase = getSupabaseClient();

        if (id) {
            const { data, error } = await supabase
                .from('ads')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 404 });
            }
            return NextResponse.json({ ad: data }, { status: 200 });
        } else {
            const { data, error } = await supabase
                .from('ads')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ ads: data }, { status: 200 });
        }
    } catch (error: any) {
        console.error('API GET Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { title, placement, ad_type, script_code, image_url, destination_url, device_target, is_active, size } = body;

        if (!title || !placement) {
            return NextResponse.json({ error: 'Title and placement are required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        const insertData = {
            title: title.trim(),
            placement,
            ad_type: ad_type || 'script',
            script_code: ad_type === 'script' ? (script_code || '') : null,
            image_url: ad_type === 'image' ? image_url?.trim() : null,
            destination_url: ad_type === 'image' ? destination_url?.trim() : null,
            device_target: device_target || 'both',
            is_active: is_active ?? true,
            size: size || 'auto'
        };

        const { data, error } = await supabase
            .from('ads')
            .insert([insertData])
            .select()
            .single();

        if (error) {
            console.error('Supabase Insert Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Ad created successfully', ad: data }, { status: 201 });
    } catch (error: any) {
        console.error('API POST Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, title, placement, ad_type, script_code, image_url, destination_url, device_target, is_active } = body;

        if (!id) {
            return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        const updateData: Record<string, any> = {};
        if (title !== undefined) updateData.title = title.trim();
        if (placement !== undefined) updateData.placement = placement;
        if (ad_type !== undefined) updateData.ad_type = ad_type;
        if (script_code !== undefined) updateData.script_code = ad_type === 'script' ? (script_code || '') : null;
        if (image_url !== undefined) updateData.image_url = ad_type === 'image' ? (image_url ? image_url.trim() : null) : null;
        if (destination_url !== undefined) updateData.destination_url = ad_type === 'image' ? (destination_url ? destination_url.trim() : null) : null;
        if (device_target !== undefined) updateData.device_target = device_target;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
            .from('ads')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Supabase Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Ad updated successfully', ad: data }, { status: 200 });
    } catch (error: any) {
        console.error('API PUT Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, is_active } = body;

        if (!id) {
            return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 });
        }
        if (typeof is_active !== 'boolean') {
            return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('ads')
            .update({ is_active })
            .eq('id', id);

        if (error) {
            console.error('Supabase Update Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Ad status updated successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('API PATCH Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Ad ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseClient();

        const { error } = await supabase
            .from('ads')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase Delete Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ message: 'Ad deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
