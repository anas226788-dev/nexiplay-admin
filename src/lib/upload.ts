import { supabase } from '@/lib/supabase';

/**
 * Converts a title into a URL/filename-safe slug.
 * e.g. "One Piece (2024)" → "one-piece-2024"
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export async function uploadPoster(file: File, contentTitle?: string): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const suffix = Math.random().toString(36).substring(2, 6); // short 4-char suffix to avoid collisions

        let fileName: string;
        if (contentTitle && contentTitle.trim()) {
            const slug = slugify(contentTitle);
            fileName = `${slug}_${suffix}.${fileExt}`;
        } else {
            // Fallback to old random naming if no title provided
            fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        }

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

export async function uploadNoticeImage(file: File, noticeLabel?: string): Promise<string | null> {
    try {
        const fileExt = file.name.split('.').pop();
        const suffix = Math.random().toString(36).substring(2, 6);

        let baseName: string;
        if (noticeLabel && noticeLabel.trim()) {
            baseName = slugify(noticeLabel);
        } else {
            baseName = `notice_${Date.now()}`;
        }

        const fileName = `notices/${baseName}_${suffix}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('posters')
            .upload(fileName, file);

        if (uploadError) {
            console.error('Error uploading notice image:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('posters')
            .getPublicUrl(fileName);

        return data.publicUrl;
    } catch (error) {
        console.error('Error in uploadNoticeImage:', error);
        return null;
    }
}
