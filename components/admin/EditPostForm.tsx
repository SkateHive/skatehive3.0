'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function EditPostForm({ defaultAuthor = '', defaultPermlink = '' }: { defaultAuthor?: string; defaultPermlink?: string }) {
  const [author, setAuthor] = useState(defaultAuthor);
  const [permlink, setPermlink] = useState(defaultPermlink);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [bodyAppend, setBodyAppend] = useState('');
  const [tags, setTags] = useState('');
  const [metadataJson, setMetadataJson] = useState('{}');
  const [previewMode, setPreviewMode] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Submitting...');
    const updates: any = {};
    if (title.trim()) updates.title = title;
    if (body.trim()) updates.body = body;
    if (bodyAppend.trim()) updates.bodyAppend = bodyAppend;
    if (tags.trim()) updates.tags = tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      updates.metadataUpdates = JSON.parse(metadataJson || '{}');
    } catch (err) {
      setStatus('Invalid JSON in metadata');
      return;
    }

    try {
      const res = await fetch('/api/posts/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Admin username should be provided in header or will be asked by server
          'x-admin-username': (window as any).__SKATEHIVE_ADMIN_USERNAME || ''
        },
        body: JSON.stringify({ author, permlink, updates, admin_username: (window as any).__SKATEHIVE_ADMIN_USERNAME || undefined })
      });
      const data = await res.json();
      if (data && data.success) {
        setStatus('Post edited successfully');
      } else {
        setStatus(`Failed: ${data?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      setStatus(`Error: ${error?.message || String(error)}`);
    }
  };

  return (
    <div className="max-w-3xl p-4 bg-white rounded shadow">
      <h3 className="text-xl font-medium mb-3">Edit App Account Post</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Author</label>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Permlink</label>
          <input value={permlink} onChange={(e) => setPermlink(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Title (optional)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Body (replace, optional)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full border p-2 rounded h-32" />
        </div>
        <div>
          <label className="block text-sm font-medium">Append to body (optional)</label>
          <textarea value={bodyAppend} onChange={(e) => setBodyAppend(e.target.value)} className="w-full border p-2 rounded h-24" />
        </div>
        <div>
          <label className="block text-sm font-medium">Tags (comma separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full border p-2 rounded" />
        </div>
        <div>
          <label className="block text-sm font-medium">Metadata (JSON)</label>
          <textarea value={metadataJson} onChange={(e) => setMetadataJson(e.target.value)} className="w-full border p-2 rounded h-24" />
        </div>
        <div className="flex items-center space-x-2">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          <button type="button" onClick={() => setPreviewMode((p) => !p)} className="px-3 py-2 border rounded">{previewMode ? 'Edit' : 'Preview'}</button>
          <div className="ml-auto text-sm text-gray-600">{status}</div>
        </div>
      </form>

      {!previewMode && (
        <div className="mt-4">
          <h4 className="font-medium">Preview</h4>
          <div className="border rounded p-3 bg-gray-50">
            <h2 className="text-lg font-semibold">{title || '—'}</h2>
            <ReactMarkdown>{bodyAppend ? `${body}\n\n${bodyAppend}` : (body || '—')}</ReactMarkdown>
            <div className="mt-2 text-sm text-gray-500">Tags: {tags}</div>
            <div className="mt-2 text-xs font-mono bg-white p-2 border rounded">{metadataJson}</div>
          </div>
        </div>
      )}
    </div>
  );
}
