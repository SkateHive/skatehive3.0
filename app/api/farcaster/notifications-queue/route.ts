import { NextRequest, NextResponse } from 'next/server';
import { fetchNewNotificationsServer, getLastReadNotificationDateServer } from '@/lib/hive/server-notification-functions';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const hiveUsername = searchParams.get('hiveUsername');

    if (!hiveUsername) {
        return NextResponse.json({ success: false, message: 'Missing hiveUsername' }, { status: 400 });
    }

    try {
        // Get last read notification date
        let lastReadDate;
        try {
            lastReadDate = await getLastReadNotificationDateServer(hiveUsername);
            console.log(`[notifications-queue] getLastReadNotificationDateServer result:`, lastReadDate);
        } catch (err) {
            console.error(`[notifications-queue] Error in getLastReadNotificationDateServer:`, err);
            return NextResponse.json({ success: false, message: 'getLastReadNotificationDateServer failed', error: String(err) }, { status: 500 });
        }
        console.log(`[notifications-queue] hiveUsername: ${hiveUsername}`);
        console.log(`[notifications-queue] lastReadDate: ${lastReadDate}`);

        // Fetch all notifications
        let allNotifications;
        try {
            allNotifications = await fetchNewNotificationsServer(hiveUsername);
        } catch (err) {
            console.error(`[notifications-queue] Error in fetchNewNotificationsServer:`, err);
            throw new Error('fetchNewNotificationsServer failed');
        }
        console.log(`[notifications-queue] allNotifications count: ${allNotifications.length}`);
        if (allNotifications.length > 0) {
            console.log(`[notifications-queue] first notification:`, allNotifications[0]);
            console.log(`[notifications-queue] last notification:`, allNotifications[allNotifications.length - 1]);
        }

        // Filter unread notifications
        const unread = allNotifications.filter(n => {
            const notifDate = new Date(n.date).getTime();
            const lastReadTimestamp = new Date(lastReadDate).getTime();
            return notifDate > lastReadTimestamp;
        });
        console.log(`[notifications-queue] unread count: ${unread.length}`);
        if (unread.length > 0) {
            console.log(`[notifications-queue] first unread:`, unread[0]);
            console.log(`[notifications-queue] last unread:`, unread[unread.length - 1]);
        }

        // Map to simple format for frontend
        const mapped = unread.map(n => ({
            type: n.type,
            message: n.msg,
            timestamp: n.date,
            url: n.url || '',
        }));

        return NextResponse.json({ success: true, notifications: mapped });
    } catch (error) {
        console.error('Failed to get notifications queue:', error);
        return NextResponse.json({ success: false, message: 'Failed to get notifications queue', error: String(error) }, { status: 500 });
    }
}
