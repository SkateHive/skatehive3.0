import EditPostForm from '@/components/admin/EditPostForm';

export const metadata = {
  title: 'Admin - Edit Post'
};

export default function AdminEditPostPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Edit App Account Post</h1>
      <p className="mb-4 text-sm text-gray-600">This page allows server administrators to edit posts created by the SkateHive app account. You must be an admin to perform edits.</p>
      <EditPostForm defaultAuthor={process.env.NEXT_PUBLIC_APP_ACCOUNT || ''} />
    </div>
  );
}
