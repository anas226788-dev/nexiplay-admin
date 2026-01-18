import { supabase } from '@/lib/supabase';
import AdForm from '@/components/admin/AdForm';
import { notFound } from 'next/navigation';
import { Ad } from '@/lib/types';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditAdPage({ params }: PageProps) {
    const { id } = await params;
    const { data: ad } = await supabase
        .from('ads')
        .select('*')
        .eq('id', id)
        .single();

    if (!ad) {
        notFound();
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-8">Edit Ad</h1>
            <AdForm initialData={ad as Ad} />
        </div>
    );
}
