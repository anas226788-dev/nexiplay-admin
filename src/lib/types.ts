export interface Movie {
    id: string;
    title: string;
    slug: string;
    poster_url: string | null;
    description: string | null;
    type: 'movie' | 'series' | 'anime';
    release_year: number | null;
    trailer_url?: string;
    created_at: string;
    is_running?: boolean;
    last_episode?: number;
    next_episode?: number;
}

export interface Download {
    id: string;
    movie_id: string;
    quality: '480p' | '720p' | '1080p';
    file_size: string | null;
    file_url: string | null;
    created_at?: string;
}

export interface Category {
    id: string;
    name: string;
    slug: string;
    created_at?: string;
}

export interface AppSettings {
    id: number;
    is_ads_enabled: boolean;
    popunder_url: string;
    direct_link_url: string;
    updated_at: string;
}

export interface MovieWithDownloads extends Movie {
    downloads: Download[];
}

export interface MovieWithCategories extends Movie {
    movie_categories: {
        categories: Category;
    }[];
}

export interface FullMovie extends Movie {
    downloads: Download[];
    download_links?: DownloadLink[];
    screenshots: Screenshot[];
    language?: string;
    source?: string;
    cast_members?: string;
    format?: string;
    subtitle?: string;
    movie_categories: {
        categories: Category;
    }[];
}

export interface Screenshot {
    id: string;
    movie_id: string;
    image_url: string;
    created_at?: string;
}

export interface Ad {
    id: string;
    title: string;
    placement: 'home_top' | 'home_bottom' | 'movie_sidebar' | 'popup_global' | 'download_bottom' | 'episode_list';
    ad_type: 'image' | 'script';
    image_url: string | null;
    script_code: string | null;
    destination_url: string | null;
    device_target: 'desktop' | 'mobile' | 'both';
    is_active: boolean;
    created_at?: string;
}

export interface Notice {
    id: string;
    content: string;
    type: 'top_bar' | 'popup' | 'inline';
    pages: 'all' | 'home' | 'movie';
    is_active: boolean;
    bg_color: string;
    text_color: string;
    created_at?: string;
}

export interface TelegramSettings {
    id: number;
    telegram_type: 'group' | 'channel';
    telegram_url: string;
    is_active: boolean;
    updated_at: string;
}

export interface ChatbotSettings {
    id: string;
    is_enabled: boolean;
    bot_name: string;
    welcome_message: string;
    placeholder_text: string;
}

export interface FAQ {
    id: string;
    question: string;
    answer: string;
    keywords: string;
    is_active: boolean;
    created_at?: string;
}

export interface DownloadLink {
    id?: string;
    movie_id?: string;
    resolution: '360p' | '480p' | '720p' | '1080p';
    file_size?: string;
    mega_link?: string;
    gdrive_link?: string;
    mediafire_link?: string;
    terabox_link?: string;
    pcloud_link?: string;
    youtube_link?: string;
    created_at?: string;
}

export interface Season {
    id?: string;
    movie_id?: string;
    season_number: number;
    season_title?: string;
    poster_url?: string;
    season_zip_link?: string;
    episodes?: Episode[];
    created_at?: string;
}

export interface Episode {
    id?: string;
    season_id?: string;
    episode_number: number;
    episode_title?: string;
    download_links?: EpisodeDownloadLink[];
    created_at?: string;
}

export interface EpisodeDownloadLink {
    id?: string;
    episode_id?: string;
    resolution: '360p' | '480p' | '720p' | '1080p';
    file_size?: string;
    mega_link?: string;
    gdrive_link?: string;
    mediafire_link?: string;
    terabox_link?: string;
    pcloud_link?: string;
    youtube_link?: string;
    created_at?: string;
}

export interface Comment {
    id: string;
    movie_id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
    is_approved: boolean;
}

export interface ContentRequest {
    id: string;
    content_name: string;
    status: 'pending' | 'added' | 'rejected';
    created_at: string;
}

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    created_at: string;
    is_read: boolean;
}

export interface DMCARequest {
    id: string;
    name: string;
    company?: string;
    email: string;
    original_link: string;
    infringing_link: string;
    proof_link?: string;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    updated_at: string;
}
