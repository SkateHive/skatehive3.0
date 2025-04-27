import { useEffect, useState } from 'react';
import { fetchNewNotifications, getLastReadNotificationDate } from '@/lib/hive/client-functions';
import { Box, Text, Stack, Spinner, Button, HStack, Tabs, TabList, TabPanels, Tab, TabPanel, Center } from '@chakra-ui/react';
import { useAioha } from '@aioha/react-ui';
import { KeyTypes } from '@aioha/aioha';
import { Notifications } from '@hiveio/dhive';
import NotificationItem from './NotificationItem';
import LoadingComponent from '../homepage/loadingComponent';

interface NotificationCompProps {
  username: string
}

export default function NotificationsComp({ username }: NotificationCompProps) {
  const { user, aioha } = useAioha();
  const [notifications, setNotifications] = useState<Notifications[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Add isLoading state
  const [lastReadDate, setLastReadDate] = useState<string>('1970-01-01T00:00:00Z'); // Add lastReadDate state

  useEffect(() => {
    const loadNotifications = async () => {
      if (user) {
        try {
          setIsLoading(true);
          const newNotifications = await fetchNewNotifications(username);
          const lastRead = await getLastReadNotificationDate(username); // Fetch last read date

          setNotifications(newNotifications);
          setLastReadDate(lastRead); // Set last read date
        } catch (error) {
          console.error("Failed to fetch notifications:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadNotifications();
  }, [user, username]);

  async function handleMarkAsRead() {
    const now = new Date().toISOString();
    const json = JSON.stringify(["setLastRead", { date: now }]);
    const result = await aioha.signAndBroadcastTx([
      ['custom_json', {
        required_auths: [],
        required_posting_auths: [user],
        id: 'notify',
        json: json,
      }]
    ], KeyTypes.Posting)
  };

  const groupedNotifications = notifications.reduce((acc, notification) => {
    if (!acc[notification.type]) {
      acc[notification.type] = [];
    }
    acc[notification.type].push(notification);
    return acc;
  }, {} as Record<string, Notifications[]>);

  return (
    <Box p={0} w="full" maxH={"100vh"} overflowY="auto" sx={{
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      scrollbarWidth: 'none',
    }}>
      <HStack mb={4} spacing={4} align="center" justify="space-between">
        <Text ml={1} fontSize="2xl" fontWeight="bold">
          Notifications
        </Text>
        {(user == username) && (
          <Button onClick={handleMarkAsRead} size="sm">
            Mark as Read
          </Button>
        )}
      </HStack>
      {isLoading ? (
        <LoadingComponent />
      ) : notifications.length > 0 ? (
        <Tabs colorScheme="accent" isLazy lazyBehavior="keepMounted">
          <Center>
            <TabList>
              {Object.keys(groupedNotifications).map(type => (
                <Tab key={type}>{type}</Tab>
              ))}
            </TabList>
          </Center>
          <TabPanels>
            {Object.keys(groupedNotifications).map(type => (
              <TabPanel key={type}>
                <Stack spacing={4} w="full">
                  {groupedNotifications[type].map(notification => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      lastReadDate={lastReadDate}
                      currentUser={username} // added missing prop
                    />
                  ))}
                </Stack>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      ) : (
        <Text>No notifications</Text>
      )}
    </Box>
  );
}
