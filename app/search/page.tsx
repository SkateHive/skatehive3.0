import { redirect } from "next/navigation";
import { resolveSearchPath } from "@/lib/search/resolveSearchPath";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    query?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * `/search` did not exist, so nav and shared links such as `/search?q=skate`
 * 404'd. Blog sort links use `/blog?query=`; everything else is a tag search.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const raw = firstParam(params.q) || firstParam(params.query);
  redirect(resolveSearchPath(raw));
}
