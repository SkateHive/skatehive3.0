import { useRef } from "react";
import dynamic from "next/dynamic";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import type { PostDeleteState } from "@/hooks/usePostDelete";

const HiveUpgradePromptModal = dynamic(
  () => import("@/components/shared/HiveUpgradePromptModal"),
  { ssr: false }
);

interface DeletePostDialogProps {
  deletion: PostDeleteState;
}

// Everything that can open after "Delete" is clicked: the confirmation for
// Hive accounts, or the "you need a Hive account" prompt for lite accounts.
export default function DeletePostDialog({ deletion }: DeletePostDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const {
    isConfirmOpen,
    closeConfirm,
    deletePost,
    isDeleting,
    isUpgradeOpen,
    closeUpgrade,
  } = deletion;

  return (
    <>
      <AlertDialog
        isOpen={isConfirmOpen}
        leastDestructiveRef={cancelRef}
        onClose={closeConfirm}
        isCentered
      >
        <AlertDialogOverlay>
          <AlertDialogContent
            bg="background"
            color="primary"
            border="1px solid"
            borderColor="border"
            mx={4}
          >
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete post?
            </AlertDialogHeader>
            <AlertDialogBody color="text">
              It will disappear from Skatehive. Hive keeps every change
              on-chain, so the original can still be found in block explorers.
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button
                ref={cancelRef}
                variant="ghost"
                onClick={closeConfirm}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                bg="error"
                color="background"
                _hover={{ opacity: 0.85 }}
                onClick={deletePost}
                isLoading={isDeleting}
                loadingText="Deleting..."
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>

      {isUpgradeOpen && (
        <HiveUpgradePromptModal
          isOpen={isUpgradeOpen}
          onClose={closeUpgrade}
          action="delete"
        />
      )}
    </>
  );
}
