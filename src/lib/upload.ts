import { supabase } from '@/lib/supabase';

export async function uploadPoster(file: File): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('posters')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading poster:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('posters')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch (error) {
        console.error('Error in uploadPoster:', error);
        return null;
    }
}
