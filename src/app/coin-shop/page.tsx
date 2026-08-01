'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface EarnTask {
    id: string;
    title: string;
    description: string;
    reward: number;
    icon_type: string;
    is_active: boolean;
}

interface ShopItem {
    id: string;
    title: string;
    description: string;
    price: number;
    tier: 'ad_free' | 'vip' | 'elite_pro' | 'boost' | 'request';
    days: number;
    is_active: boolean;
}

export default function CoinShopAdminPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // 1. Popup Settings
    const [popupEnabled, setPopupEnabled] = useState(true);
    const [popupTitle, setPopupTitle] = useState('Tired of Ads?');
    const [popupMessage, setPopupMessage] = useState('Upgrade to VIP for just 250 Coins to get 30 days of 100% Ad-Free streaming, Gold Profile Badges, & Ultra HD Servers!');
    const [popupButtonText, setPopupButtonText] = useState('GET VIP NOW (250 🪙)');
    const [popupAction, setPopupAction] = useState('buy_vip');
    const [popupTriggerCount, setPopupTriggerCount] = useState(1);

    // 2. Tasks
    const [tasks, setTasks] = useState<EarnTask[]>([
        { id: '1', title: 'Daily Login', description: 'Come back every day for bonus coins', reward: 5, icon_type: 'event', is_active: true },
        { id: '2', title: 'Watch 2 Episodes', description: 'Enjoy your favorite shows', reward: 35, icon_type: 'video', is_active: true },
        { id: '3', title: 'Download 1 Content', description: 'Save for offline viewing', reward: 50, icon_type: 'download', is_active: true },
        { id: '4', title: 'Invite a Friend', description: 'Share app referral code', reward: 100, icon_type: 'share', is_active: true },
        { id: '5', title: 'Watch Rewarded Video Ad', description: 'Watch a short video ad', reward: 10, icon_type: 'play', is_active: true },
        { id: '6', title: 'Comment on Content', description: 'Leave a comment under any movie or series', reward: 1, icon_type: 'comment', is_active: true },
    ]);

    // 3. Shop Items
    const [shopItems, setShopItems] = useState<ShopItem[]>([
        { id: '1', title: 'Ad-Free 24h', description: 'No ads for 24 hours', price: 100, tier: 'ad_free', days: 1, is_active: true },
        { id: '2', title: 'Ad-Free 7d', description: 'No ads for 7 days', price: 250, tier: 'ad_free', days: 7, is_active: true },
        { id: '3', title: 'Priority Request', description: 'Your content request goes first', price: 30, tier: 'request', days: 0, is_active: true },
        { id: '4', title: 'VIP Badge (30 Days)', description: 'Gold Badge + 30 Days Ad-Free', price: 250, tier: 'vip', days: 30, is_active: true },
        { id: '5', title: 'ELITE PRO (30 Days)', description: 'Diamond Badge + 2x Coins & 1080p for 30 days', price: 500, tier: 'elite_pro', days: 30, is_active: true },
        { id: '6', title: 'Double Coin Boost', description: '2x coins for 24 hours', price: 100, tier: 'boost', days: 1, is_active: true },
    ]);

    // New item modals
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDesc, setNewTaskDesc] = useState('');
    const [newTaskReward, setNewTaskReward] = useState(10);

    const [showAddShopModal, setShowAddShopModal] = useState(false);
    const [newShopTitle, setNewShopTitle] = useState('');
    const [newShopDesc, setNewShopDesc] = useState('');
    const [newShopPrice, setNewShopPrice] = useState(250);
    const [newShopTier, setNewShopTier] = useState<'ad_free' | 'vip' | 'elite_pro' | 'boost' | 'request'>('vip');
    const [newShopDays, setNewShopDays] = useState(30);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .eq('id', 1)
                .single();

            if (data) {
                if (data.coin_popup_enabled !== undefined) setPopupEnabled(data.coin_popup_enabled);
                if (data.coin_popup_title) setPopupTitle(data.coin_popup_title);
                if (data.coin_popup_message) setPopupMessage(data.coin_popup_message);
                if (data.coin_popup_button_text) setPopupButtonText(data.coin_popup_button_text);
                if (data.coin_popup_action) setPopupAction(data.coin_popup_action);
                if (data.coin_popup_trigger_count) setPopupTriggerCount(data.coin_popup_trigger_count);

                if (data.coin_tasks_json) {
                    try { setTasks(JSON.parse(data.coin_tasks_json)); } catch (_) {}
                }
                if (data.coin_shop_items_json) {
                    try { setShopItems(JSON.parse(data.coin_shop_items_json)); } catch (_) {}
                }
            }
        } catch (err) {
            console.error('Failed to load coin shop settings:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        setSaving(true);
        setMessage(null);
        try {
            const updatePayload = {
                coin_popup_enabled: popupEnabled,
                coin_popup_title: popupTitle,
                coin_popup_message: popupMessage,
                coin_popup_button_text: popupButtonText,
                coin_popup_action: popupAction,
                coin_popup_trigger_count: popupTriggerCount,
                coin_tasks_json: JSON.stringify(tasks),
                coin_shop_items_json: JSON.stringify(shopItems),
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('app_settings')
                .update(updatePayload)
                .eq('id', 1);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Coin Shop & Marketing Popup settings saved successfully!' });
        } catch (err: any) {
            setMessage({ type: 'error', text: `Failed to save: ${err.message || 'Unknown error'}` });
        } finally {
            setSaving(false);
        }
    }

    const handleAddTask = () => {
        if (!newTaskTitle) return;
        const newItem: EarnTask = {
            id: Date.now().toString(),
            title: newTaskTitle,
            description: newTaskDesc,
            reward: newTaskReward,
            icon_type: 'star',
            is_active: true
        };
        setTasks([...tasks, newItem]);
        setNewTaskTitle('');
        setNewTaskDesc('');
        setShowAddTaskModal(false);
    };

    const handleDeleteTask = (id: string) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const handleToggleTask = (id: string) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, is_active: !t.is_active } : t));
    };

    const handleAddShopItem = () => {
        if (!newShopTitle) return;
        const newItem: ShopItem = {
            id: Date.now().toString(),
            title: newShopTitle,
            description: newShopDesc,
            price: newShopPrice,
            tier: newShopTier,
            days: newShopDays,
            is_active: true
        };
        setShopItems([...shopItems, newItem]);
        setNewShopTitle('');
        setNewShopDesc('');
        setShowAddShopModal(false);
    };

    const handleDeleteShopItem = (id: string) => {
        setShopItems(shopItems.filter(s => s.id !== id));
    };

    const handleToggleShopItem = (id: string) => {
        setShopItems(shopItems.map(s => s.id === id ? { ...s, is_active: !s.is_active } : s));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-16">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        🪙 Coin Shop & Upsell Popup Manager
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Control in-app coin tasks, shop items, and post-ad VIP marketing popup prompts.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold rounded-xl shadow-lg hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving Changes...' : 'Save All Changes'}
                </button>
            </div>

            {message && (
                <div className={`p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                    {message.text}
                </div>
            )}

            {/* SECTION 1: POST-AD UPSELL MARKETING POPUP PROMPT */}
            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            👑 Ad-Dismissed VIP Upsell Popup (Free User Promotion)
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Show a high-converting enterprise popup to Free users right after an ad is dismissed or closed.
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={popupEnabled}
                            onChange={(e) => setPopupEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Popup Header Title</label>
                        <input
                            type="text"
                            value={popupTitle}
                            onChange={(e) => setPopupTitle(e.target.value)}
                            placeholder="e.g. Tired of Ads?"
                            className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Trigger Frequency</label>
                        <select
                            value={popupTriggerCount}
                            onChange={(e) => setPopupTriggerCount(parseInt(e.target.value))}
                            className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        >
                            <option value={1}>Show after EVERY 1 ad dismissal (Highest conversion)</option>
                            <option value={2}>Show after every 2 ad dismissals</option>
                            <option value={3}>Show after every 3 ad dismissals</option>
                        </select>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Popup Message Description</label>
                        <textarea
                            value={popupMessage}
                            onChange={(e) => setPopupMessage(e.target.value)}
                            rows={3}
                            placeholder="Message to display to free users..."
                            className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Primary Button Text</label>
                        <input
                            type="text"
                            value={popupButtonText}
                            onChange={(e) => setPopupButtonText(e.target.value)}
                            placeholder="e.g. GET VIP NOW (250 🪙)"
                            className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-2">Button Action Target</label>
                        <select
                            value={popupAction}
                            onChange={(e) => setPopupAction(e.target.value)}
                            className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500"
                        >
                            <option value="buy_vip">Direct Buy VIP (250 Coins)</option>
                            <option value="buy_elite">Direct Buy ELITE PRO (500 Coins)</option>
                            <option value="open_shop">Open Coin Shop Page</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* SECTION 2: EARN COIN TASKS MANAGER */}
            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            ⚡ Earn Coin Tasks Manager
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Add, update, or remove active tasks users can complete to earn coins.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddTaskModal(true)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl transition-all"
                    >
                        + Add New Task
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasks.map((task) => (
                        <div key={task.id} className="bg-dark-700/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white text-sm">{task.title}</h3>
                                    <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs font-bold rounded-lg border border-yellow-500/20">
                                        +{task.reward} 🪙
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleTask(task.id)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg ${task.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400'}`}
                                >
                                    {task.is_active ? 'Active' : 'Disabled'}
                                </button>
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="text-red-400 hover:text-red-300 text-xs font-bold"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 3: SPENT COINS / SHOP ITEMS MANAGER */}
            <div className="bg-dark-800 rounded-2xl p-6 border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            🛍️ Spent Coins / Shop Items Manager
                        </h2>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Control shop items, prices, durations, and available badges.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddShopModal(true)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl transition-all"
                    >
                        + Add New Shop Item
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {shopItems.map((item) => (
                        <div key={item.id} className="bg-dark-700/50 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-bold rounded-lg border border-red-500/20">
                                        🪙 {item.price}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400">{item.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleShopItem(item.id)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg ${item.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400'}`}
                                >
                                    {item.is_active ? 'Active' : 'Disabled'}
                                </button>
                                <button
                                    onClick={() => handleDeleteShopItem(item.id)}
                                    className="text-red-400 hover:text-red-300 text-xs font-bold"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* MODAL: ADD TASK */}
            {showAddTaskModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-white/10 space-y-4">
                        <h3 className="text-lg font-bold text-white">Add New Earn Task</h3>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Task Title</label>
                            <input
                                type="text"
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                placeholder="e.g. Follow on Telegram"
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                placeholder="e.g. Join our official channel"
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Coin Reward</label>
                            <input
                                type="number"
                                value={newTaskReward}
                                onChange={(e) => setNewTaskReward(parseInt(e.target.value) || 0)}
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowAddTaskModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
                            <button onClick={handleAddTask} className="px-5 py-2 bg-red-600 text-white font-bold text-sm rounded-xl">Add Task</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: ADD SHOP ITEM */}
            {showAddShopModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-800 rounded-2xl p-6 max-w-md w-full border border-white/10 space-y-4">
                        <h3 className="text-lg font-bold text-white">Add New Shop Item</h3>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Item Title</label>
                            <input
                                type="text"
                                value={newShopTitle}
                                onChange={(e) => setNewShopTitle(e.target.value)}
                                placeholder="e.g. VIP Pass (14 Days)"
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Description</label>
                            <input
                                type="text"
                                value={newShopDesc}
                                onChange={(e) => setNewShopDesc(e.target.value)}
                                placeholder="e.g. Enjoy 14 days VIP perks"
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Price (Coins)</label>
                                <input
                                    type="number"
                                    value={newShopPrice}
                                    onChange={(e) => setNewShopPrice(parseInt(e.target.value) || 0)}
                                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Duration (Days)</label>
                                <input
                                    type="number"
                                    value={newShopDays}
                                    onChange={(e) => setNewShopDays(parseInt(e.target.value) || 0)}
                                    className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Tier / Type</label>
                            <select
                                value={newShopTier}
                                onChange={(e) => setNewShopTier(e.target.value as any)}
                                className="w-full bg-dark-700 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none"
                            >
                                <option value="vip">VIP Badge</option>
                                <option value="elite_pro">Elite Pro Badge</option>
                                <option value="ad_free">Ad-Free Time</option>
                                <option value="boost">Double Coin Boost</option>
                                <option value="request">Priority Request</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowAddShopModal(false)} className="px-4 py-2 text-gray-400 text-sm">Cancel</button>
                            <button onClick={handleAddShopItem} className="px-5 py-2 bg-red-600 text-white font-bold text-sm rounded-xl">Add Item</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
