import MarketDetail from "@/components/predictions/MarketDetail";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MarketDetail id={id} />;
}
