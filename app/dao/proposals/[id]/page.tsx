import { Metadata } from "next";
import ProposalDetailClient from "@/components/dao/governance/ProposalDetailClient";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  
  return {
    title: `Proposal ${id.slice(0, 8)} - Skatehive DAO`,
    description: `View details and vote on Skatehive DAO proposal ${id.slice(0, 8)}`,
  };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { id } = await params;
  
  return <ProposalDetailClient proposalId={id} />;
}
