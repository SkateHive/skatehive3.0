import { PoidhBountyDetail } from "@/components/bounties/PoidhBountyDetail";

export default async function PoidhBountyPage({
  params,
}: {
  params: Promise<{ chainId: string; id: string }>;
}) {
  const { chainId, id } = await params;
  
  return <PoidhBountyDetail chainId={chainId} id={id} />;
}
