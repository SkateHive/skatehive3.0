import MarketDetail from "@/components/predictions/MarketDetail";
import HiveAccessGate from "@/components/predictions/HiveAccessGate";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <HiveAccessGate>
      <MarketDetail id={id} />
    </HiveAccessGate>
  );
}
