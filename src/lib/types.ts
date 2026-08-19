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
    updated_at?: string;
    is_running?: boolean;
    last_episode?: number;
    next_episode?: number;
    is_trending?: boolean;
    trending_badge?: boolean;
    trending_rank?: number;
    banner_url_desktop?: string;
    banner_url_mobile?: string;
    // Running Series Features
    running_status?: 'Ongoing' | 'Completed' | 'Hiatus';
    running_notice?: string;
    next_episode_date?: string;
    admin_note?: string;
    notify_admin?: boolean;
    // Per-Content Notice System
    notice_enabled?: boolean;
    notice_text?: string;
    allow_global_notices?: boolean;
    // Dual Action Click System
    ad_link?: string;
    // Adult Content
    is_adult?: boolean;
    // Auto Scraper Configuration
    scraper_url?: string;
    scraper_source?: 'fxlinks' | 'rareanimes' | 'movielink' | 'bollyflix' | 'animerulz' | 'toonplay' | 'multi';
    scraper_resolution?: '360p' | '480p' | '720p' | '1080p';
    scraper_season?: number;
    // Multi-scraper concurrent configurations
    animerulz_url?: string;
    animerulz_season?: number;
    animerulz_resolution?: '360p' | '480p' | '720p' | '1080p';
    toonplay_url?: string;
    toonplay_season?: number;
    toonplay_resolution?: '360p' | '480p' | '720p' | '1080p';
    // Streaming service integration
    tmdb_id?: string;
    imdb_id?: string;
    mal_id?: string;
    streaming_url?: string;
    streaming_url_animerulz?: string;
    streaming_url_toonplay?: string;
    app_streaming_enabled?: boolean;
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
    image_url?: string;
    video_url?: string;
    platform: 'web' | 'app' | 'both';
    type: 'top_bar' | 'popup' | 'inline' | 'toast' | 'bottom_bar' | 'fullscreen' | 'marquee' | 'marquee_bottom';
    pages: 'all' | 'home' | 'movie' | 'specific';
    movie_id?: string;
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

export interface AppSettings {
    id: number;
    is_ads_enabled: boolean;
    popunder_url: string;
    direct_link_url: string;
    ad_frequency_session: number;
    ad_enabled_pages?: string[];
    ad_enabled_devices?: 'all' | 'desktop' | 'mobile';
    native_ad_code?: string;
    social_bar_code?: string;
    app_enabled_servers?: string;
    // Social Links
    rareanimes_url?: string;
    bollyflix_url?: string;
    movielink_url?: string;
    // Social Links
    social_pinterest?: string;
    social_twitter?: string;
    social_facebook?: string;
    social_youtube?: string;
    social_reddit?: string;
    social_tumblr?: string;
    social_aboutme?: string;
    social_instagram?: string;
    social_threads?: string;
    // Monetization
    gplink_url?: string;
    smartlink_url?: string;
    is_download_verification_enabled?: boolean;
    download_ad_url_1?: string;
    download_ad_url_2?: string;
    // Novel Verification
    is_novel_verification_enabled?: boolean;
    novel_ad_url_1?: string;
    novel_ad_url_2?: string;
    // Latest Updates Ads
    latest_update_click_ad_link?: string;
    is_verification_enabled?: boolean;
    verification_ad_url_1?: string;
    verification_ad_url_2?: string;
    // App Ads SDK Configuration
    app_ad_network?: 'startio' | 'unity' | 'both';
    startio_app_id?: string;
    unity_app_key?: string;
    unity_banner_id?: string;
    unity_interstitial_id?: string;
    unity_rewarded_id?: string;
    is_banner_enabled?: boolean;
    is_interstitial_enabled?: boolean;
    is_rewarded_enabled?: boolean;
    is_native_enabled?: boolean;
    is_app_open_enabled?: boolean;
    is_premium_server_ad_enabled?: boolean;
    is_test_ads_enabled?: boolean;
    // Coin Popup Marketing Config
    coin_popup_enabled?: boolean;
    coin_popup_title?: string;
    coin_popup_message?: string;
    coin_popup_button_text?: string;
    coin_popup_action?: string;
    coin_popup_trigger_count?: number;
    updated_at: string;
}

export interface ChatbotSettings {
    id: string;
    is_enabled: boolean;
    bot_name: string;
    welcome_message: string;
    placeholder_text: string;
    openrouter_models?: string;
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
    streaming_url?: string;
    streaming_url_animerulz?: string;
    streaming_url_toonplay?: string;
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
    // Language & Approval (for RareAnimes Hindi DUB/SUB)
    language_type?: 'dub' | 'sub' | null;
    approval_status?: 'approved' | 'pending' | 'rejected';
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
    title?: string;
    status: 'pending' | 'added' | 'rejected' | 'review';
    scraped_data?: any;
    scraper_source?: 'rareanimes' | 'bollyflix' | 'movielink' | 'animerulz' | 'toonplay' | null;
    source_url?: string | null;
    created_at: string;
    user_id?: string | null;
    user_name?: string | null;
    user_email?: string | null;
    user_avatar?: string | null;
    has_account?: boolean;
    type?: string | null;
    notes?: string | null;
}

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    created_at: string;
    is_read: boolean;
    user_id?: string;
    status?: 'pending' | 'approved' | 'rejected';
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

export interface DownloadTutorial {
    id: string;
    source_key: string;
    source_name: string;
    tutorial_url: string;
    is_active: boolean;
    updated_at?: string;
}

export interface Upcoming {
    id: string;
    title: string;
    slug: string;
    poster_url: string;
    type: 'anime' | 'series' | 'movie';
    release_date: string;
    status: 'announced' | 'confirmed' | 'delayed';
    trailer_url?: string;
    created_at: string;
}

export interface LeaderboardEntry {
    id: string;
    rank: number;
    user_id: string | null;
    name: string;
    avatar_url: string | null;
    badge_type: 'elite' | 'vip' | 'none' | string;
    coins: number;
    watched_count: number;
    is_fake: boolean;
    updated_at: string;
}

export interface AppConfig {
    id: string;
    latest_version_code: number;
    latest_version_name: string;
    apk_url: string;
    release_notes: string;
    force_update: boolean;
    min_version_code: number;
    updated_at: string;
}
