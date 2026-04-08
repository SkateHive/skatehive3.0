export interface PageResult {
  title: string;
  path: string;
  description: string;
  icon: any;
}

export interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAirdrop?: () => void;
  onOpenReport?: () => void;
}
