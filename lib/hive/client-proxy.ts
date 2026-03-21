/**
 * Hive Client Proxy
 * 
 * Wraps HiveClient.call to use /api/hive proxy when running in browser
 * This avoids CORS errors when calling api.hive.blog from client-side
 */

import HiveClient from './hiveclient';

/**
 * Call Hive API method
 * - Server-side: calls HiveClient directly
 * - Client-side: uses /api/hive proxy to avoid CORS
 */
export async function callHiveApi(method: string, params: any): Promise<any> {
  // Check if running in browser
  const isBrowser = typeof window !== 'undefined';
  
  if (!isBrowser) {
    // Server-side: use HiveClient directly
    return HiveClient.call(method as any, params as any);
  }
  
  // Client-side: use proxy to avoid CORS
  try {
    const response = await fetch('/api/hive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1,
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Hive API error');
    }
    
    return data.result;
  } catch (error) {
    console.error('Hive API proxy call failed:', error);
    throw error;
  }
}
