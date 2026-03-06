"use client";
import React, { useState, useEffect } from 'react';
import { Button, Input, Stack, Text, Box } from '@chakra-ui/react';
import { isAdminUser } from '@/lib/utils/adminCheck';

export function PostManagement() {
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [author, setAuthor] = useState(process.env.NEXT_PUBLIC_APP_ACCOUNT || 'skatedev');
  const [permlink, setPermlink] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!username) return;
    let mounted = true;
    (async () => {
      const res = await isAdminUser(username);
      if (mounted) setIsAdmin(res);
    })();
    return () => { mounted = false };
  }, [username]);

  const doDelete = async () => {
    setStatus('Deleting...');
    try {
      const resp = await fetch('/api/posts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUser: username, author, permlink })
      });
      const data = await resp.json();
      if (data.success) {
        setStatus('Deleted successfully');
      } else {
        setStatus(`Failed: ${data.message || 'unknown'}`);
      }
    } catch (e) {
      setStatus('Network error');
    }
  };

  return (
    <Box bg="gray.900" color="white" p={4} borderRadius="md">
      <Stack spacing={3}>
        <Text fontWeight="bold">Admin Post Management</Text>
        <Input placeholder="Your admin username" value={username} onChange={(e) => setUsername(e.target.value)} />
        {!isAdmin && username && (
          <Text color="orange.300">You are not an admin. Admin UI is view-only.</Text>
        )}
        <Input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        <Input placeholder="Permlink" value={permlink} onChange={(e) => setPermlink(e.target.value)} />
        <Button colorScheme="red" onClick={doDelete} isDisabled={!isAdmin || !author || !permlink}>Delete Post</Button>
        <Text>{status}</Text>
      </Stack>
    </Box>
  );
}

export default PostManagement;
