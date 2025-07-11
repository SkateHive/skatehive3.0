'use client';

import { useState, useEffect } from 'react';
import { useAioha } from '@aioha/react-ui';
import { FarcasterPreferences } from '@/lib/farcaster/skatehive-integration';

// Simple wrapper that will get user context from your existing system
export default function FarcasterSettingsPageWrapper() {
    const { user } = useAioha();

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-6">
                        <h2 className="text-xl font-semibold mb-2">🔐 Login Required</h2>
                        <p className="text-gray-300 mb-4">
                            Please log in to your SkateHive account to manage Farcaster notifications.
                        </p>
                        <div className="text-sm text-gray-400">
                            For testing, you can manually set user data in localStorage:
                            <pre className="mt-2 p-2 bg-gray-800 rounded text-xs">
                                {`localStorage.setItem('hiveUser', JSON.stringify({
  name: 'xvlad',
  posting_key: 'your-posting-key' // optional
}));`}
                            </pre>
                            <button
                                onClick={() => {
                                    localStorage.setItem('hiveUser', JSON.stringify({
                                        name: 'xvlad',
                                        posting_key: ''
                                    }));
                                    window.location.reload();
                                }}
                                className="mt-2 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs"
                            >
                                Set Test User (xvlad)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <FarcasterSettingsPage
            hiveUsername={user}
            postingKey={undefined} // You can get this from aioha if needed
        />
    );
}

interface FarcasterSettingsProps {
    hiveUsername: string;
    postingKey?: string; // Optional, for updating Hive profile
}

function FarcasterSettingsPage({ hiveUsername, postingKey }: FarcasterSettingsProps) {
    const [preferences, setPreferences] = useState<FarcasterPreferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [fid, setFid] = useState('');
    const [farcasterUsername, setFarcasterUsername] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        loadUserData();
    }, [hiveUsername]);

    const loadUserData = async () => {
        setLoading(true);
        try {
            const [userPrefs, notificationStats] = await Promise.all([
                fetch(`/api/farcaster/user-preferences?hiveUsername=${hiveUsername}`).then(r => r.json()),
                fetch(`/api/farcaster/notification-stats?hiveUsername=${hiveUsername}`).then(r => r.json())
            ]);

            if (userPrefs.success) {
                setPreferences(userPrefs.data);
            }

            if (notificationStats.success) {
                setStats(notificationStats.data);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const linkFarcasterAccount = async () => {
        if (!fid || !farcasterUsername) {
            setMessage({ type: 'error', text: 'Please enter both FID and Farcaster username' });
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/api/farcaster/link-skatehive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hiveUsername,
                    fid,
                    farcasterUsername,
                    updateHiveProfile: !!postingKey,
                    postingKey: postingKey
                })
            });

            const result = await response.json();

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                await loadUserData();
                setFid('');
                setFarcasterUsername('');
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to link account' });
        } finally {
            setSaving(false);
        }
    };

    const updatePreferences = async (newPrefs: Partial<FarcasterPreferences>) => {
        setSaving(true);
        try {
            const response = await fetch('/api/farcaster/update-preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hiveUsername,
                    preferences: newPrefs
                })
            });

            const result = await response.json();

            if (result.success) {
                setMessage({ type: 'success', text: 'Preferences updated successfully' });
                await loadUserData();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update preferences' });
        } finally {
            setSaving(false);
        }
    };

    const updateScheduledPreferences = async (newPrefs: {
        scheduledNotificationsEnabled?: boolean;
        scheduledTimeHour?: number;
        scheduledTimeMinute?: number;
        timezone?: string;
        maxNotificationsPerBatch?: number;
    }) => {
        setSaving(true);
        try {
            const response = await fetch('/api/farcaster/scheduled-notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hiveUsername,
                    preferences: newPrefs
                })
            });

            const result = await response.json();

            if (result.success) {
                setMessage({ type: 'success', text: 'Scheduled preferences updated successfully' });
                await loadUserData();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update scheduled preferences' });
        } finally {
            setSaving(false);
        }
    };

    const testScheduledNotifications = async () => {
        setSaving(true);
        try {
            const response = await fetch(`/api/farcaster/scheduled-notifications?action=trigger&hiveUsername=${hiveUsername}`);
            const result = await response.json();

            if (result.success) {
                setMessage({
                    type: 'success',
                    text: `Test successful! Sent ${result.notificationsSent} notifications`
                });
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to test notifications' });
        } finally {
            setSaving(false);
        }
    };

    const unlinkAccount = async () => {
        if (!confirm('Are you sure you want to unlink your Farcaster account?')) return;

        setSaving(true);
        try {
            const response = await fetch('/api/farcaster/unlink', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hiveUsername,
                    updateHiveProfile: !!postingKey,
                    postingKey: postingKey
                })
            });

            const result = await response.json();

            if (result.success) {
                setMessage({ type: 'success', text: 'Account unlinked successfully' });
                setPreferences(null);
                await loadUserData();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to unlink account' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 text-white p-8">
                <div className="max-w-4xl mx-auto">
                    <div className="animate-pulse">
                        <div className="h-8 bg-gray-700 rounded w-1/4 mb-6"></div>
                        <div className="h-64 bg-gray-800 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-2">🛹 Farcaster Notifications</h1>
                <p className="text-gray-400 mb-8">Manage your Farcaster notification preferences for SkateHive</p>

                {message && (
                    <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-900 border border-green-700' : 'bg-red-900 border border-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                {!preferences ? (
                    // Link Account Section
                    <div className="bg-gray-800 p-6 rounded-lg mb-6">
                        <h2 className="text-xl font-semibold mb-4">🔗 Connect Your Farcaster Account</h2>
                        <p className="text-gray-400 mb-6">
                            Link your Farcaster account to receive notifications from SkateHive.
                            First, make sure you have added SkateHive as a miniapp in your Farcaster client.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Your Farcaster FID</label>
                                <input
                                    type="text"
                                    value={fid}
                                    onChange={(e) => setFid(e.target.value)}
                                    className="w-full p-3 bg-gray-700 rounded-lg"
                                    placeholder="e.g., 20721"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Your Farcaster Username</label>
                                <input
                                    type="text"
                                    value={farcasterUsername}
                                    onChange={(e) => setFarcasterUsername(e.target.value)}
                                    className="w-full p-3 bg-gray-700 rounded-lg"
                                    placeholder="e.g., yourname"
                                />
                            </div>
                            <button
                                onClick={linkFarcasterAccount}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg disabled:opacity-50"
                            >
                                {saving ? 'Linking...' : 'Link Account'}
                            </button>
                        </div>

                        <div className="mt-6 p-4 bg-blue-900 border border-blue-700 rounded-lg">
                            <h3 className="font-semibold mb-2">How to find your FID:</h3>
                            <ol className="text-sm text-gray-300 space-y-1">
                                <li>1. Open your Farcaster client (Warpcast, etc.)</li>
                                <li>2. Go to your profile</li>
                                <li>3. Your FID should be visible in your profile URL or settings</li>
                                <li>4. Or visit farcaster.xyz/~/developers to find your FID</li>
                            </ol>
                        </div>
                    </div>
                ) : (
                    // Preferences Section
                    <div className="space-y-6">
                        {/* Account Info */}
                        <div className="bg-gray-800 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4">✅ Connected Account</h2>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-lg">@{preferences.farcasterUsername}</p>
                                    <p className="text-gray-400">FID: {preferences.fid}</p>
                                    <p className="text-sm text-gray-500">
                                        Connected: {preferences.linkedAt ? new Date(preferences.linkedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                                    </p>
                                </div>
                                <button
                                    onClick={unlinkAccount}
                                    disabled={saving}
                                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg disabled:opacity-50"
                                >
                                    Unlink
                                </button>
                            </div>
                        </div>

                        {/* Scheduled Notifications Section */}
                        <div className="bg-gray-800 p-6 rounded-lg">
                            <h2 className="text-xl font-semibold mb-4">⏰ Scheduled Notifications</h2>
                            <p className="text-gray-400 mb-6">
                                Instead of real-time notifications, get a daily summary of your last few notifications at your preferred time.
                                This is more efficient and less overwhelming.
                            </p>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium">Enable Scheduled Notifications</h3>
                                        <p className="text-sm text-gray-400">Get daily notification summaries instead of instant notifications</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={preferences.scheduledNotificationsEnabled}
                                            onChange={(e) => updateScheduledPreferences({
                                                scheduledNotificationsEnabled: e.target.checked
                                            })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                {preferences.scheduledNotificationsEnabled && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Preferred Time (Hour)</label>
                                                <select
                                                    value={preferences.scheduledTimeHour}
                                                    onChange={(e) => updateScheduledPreferences({
                                                        scheduledTimeHour: parseInt(e.target.value)
                                                    })}
                                                    className="w-full bg-gray-700 text-white p-2 rounded-lg"
                                                >
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <option key={i} value={i}>
                                                            {i.toString().padStart(2, '0')}:00 ({i === 0 ? 'Midnight' : i === 12 ? 'Noon' : i < 12 ? 'AM' : 'PM'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-2">Minutes</label>
                                                <select
                                                    value={preferences.scheduledTimeMinute}
                                                    onChange={(e) => updateScheduledPreferences({
                                                        scheduledTimeMinute: parseInt(e.target.value)
                                                    })}
                                                    className="w-full bg-gray-700 text-white p-2 rounded-lg"
                                                >
                                                    {[0, 15, 30, 45].map(minute => (
                                                        <option key={minute} value={minute}>
                                                            :{minute.toString().padStart(2, '0')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">Timezone</label>
                                            <select
                                                value={preferences.timezone}
                                                onChange={(e) => updateScheduledPreferences({
                                                    timezone: e.target.value
                                                })}
                                                className="w-full bg-gray-700 text-white p-2 rounded-lg"
                                            >
                                                <option value="UTC">UTC</option>
                                                <option value="America/New_York">Eastern Time (ET)</option>
                                                <option value="America/Chicago">Central Time (CT)</option>
                                                <option value="America/Denver">Mountain Time (MT)</option>
                                                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                                <option value="Europe/London">London (GMT)</option>
                                                <option value="Europe/Paris">Paris (CET)</option>
                                                <option value="Asia/Tokyo">Tokyo (JST)</option>
                                                <option value="Australia/Sydney">Sydney (AEST)</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Max Notifications per Day ({preferences.maxNotificationsPerBatch})
                                            </label>
                                            <input
                                                type="range"
                                                min="1"
                                                max="20"
                                                value={preferences.maxNotificationsPerBatch}
                                                onChange={(e) => updateScheduledPreferences({
                                                    maxNotificationsPerBatch: parseInt(e.target.value)
                                                })}
                                                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                                            />
                                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                                <span>1 notification</span>
                                                <span>20 notifications</span>
                                            </div>
                                        </div>

                                        <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                                            <h4 className="font-semibold mb-2">📋 How Scheduled Notifications Work</h4>
                                            <ul className="text-sm text-gray-300 space-y-1">
                                                <li>• Checks your Hive notifications once per day at your preferred time</li>
                                                <li>• Sends you the last {preferences.maxNotificationsPerBatch} unread notifications to Farcaster</li>
                                                <li>• More efficient than real-time streaming, less overwhelming</li>
                                                <li>• You can still use instant notifications if you prefer</li>
                                                <li>• Time is in {preferences.timezone} timezone</li>
                                            </ul>

                                            <button
                                                onClick={testScheduledNotifications}
                                                disabled={saving}
                                                className="mt-3 bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm disabled:opacity-50"
                                            >
                                                {saving ? 'Testing...' : 'Test Now'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Regular Notification Preferences */}
                        {!preferences.scheduledNotificationsEnabled && (
                            <div className="bg-gray-800 p-6 rounded-lg">
                                <h2 className="text-xl font-semibold mb-4">🔔 Instant Notification Preferences</h2>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-medium">Enable Notifications</h3>
                                            <p className="text-sm text-gray-400">Master switch for all notifications</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={preferences.notificationsEnabled}
                                                onChange={(e) => updatePreferences({ notificationsEnabled: e.target.checked })}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>

                                    {preferences.notificationsEnabled && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">🔥 Vote Notifications</h3>
                                                    <p className="text-sm text-gray-400">When someone votes on your posts</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={preferences.notifyVotes}
                                                        onChange={(e) => updatePreferences({ notifyVotes: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">💬 Comment Notifications</h3>
                                                    <p className="text-sm text-gray-400">When someone comments on your posts</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={preferences.notifyComments}
                                                        onChange={(e) => updatePreferences({ notifyComments: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">👤 Follow Notifications</h3>
                                                    <p className="text-sm text-gray-400">When someone follows you</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={preferences.notifyFollows}
                                                        onChange={(e) => updatePreferences({ notifyFollows: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">🔔 Mention Notifications</h3>
                                                    <p className="text-sm text-gray-400">When someone mentions you</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={preferences.notifyMentions}
                                                        onChange={(e) => updatePreferences({ notifyMentions: e.target.checked })}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                </label>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-medium">Notification Frequency</h3>
                                                    <p className="text-sm text-gray-400">How often to receive notifications</p>
                                                </div>
                                                <select
                                                    value={preferences.notificationFrequency}
                                                    onChange={(e) => updatePreferences({
                                                        notificationFrequency: e.target.value as 'instant' | 'hourly' | 'daily'
                                                    })}
                                                    className="bg-gray-700 text-white p-2 rounded-lg"
                                                >
                                                    <option value="instant">Instant</option>
                                                    <option value="hourly">Hourly</option>
                                                    <option value="daily">Daily</option>
                                                </select>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Statistics */}
                        {stats && (
                            <div className="bg-gray-800 p-6 rounded-lg">
                                <h2 className="text-xl font-semibold mb-4">📊 Notification Statistics</h2>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-400">{stats.totalNotifications}</div>
                                        <div className="text-sm text-gray-400">Total Sent</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-400">{stats.successfulNotifications}</div>
                                        <div className="text-sm text-gray-400">Successful</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-red-400">{stats.failedNotifications}</div>
                                        <div className="text-sm text-gray-400">Failed</div>
                                    </div>
                                </div>

                                {Object.keys(stats.notificationsByType).length > 0 && (
                                    <div>
                                        <h3 className="font-medium mb-2">By Type:</h3>
                                        <div className="space-y-1">
                                            {Object.entries(stats.notificationsByType).map(([type, count]) => (
                                                <div key={type} className="flex justify-between text-sm">
                                                    <span className="capitalize">{type}</span>
                                                    <span>{String(count)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
