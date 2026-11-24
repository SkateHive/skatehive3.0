import type { Metadata } from "next";
import PostEmbedPage from "../page";

export const metadata: Metadata = { robots: { index: false, follow: true } };
export const revalidate = 3600;

export default PostEmbedPage;
