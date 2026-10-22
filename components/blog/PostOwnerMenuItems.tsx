import NextLink from "next/link";
import { MenuItem } from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { SlPencil } from "react-icons/sl";

interface PostOwnerMenuItemsProps {
  author: string;
  permlink: string;
  canEdit: boolean;
  onDelete: () => void;
  isDeleting: boolean;
}

// Owner-only actions for post cards. Editing happens on the post page
// (?edit=1 opens the editor there) since cards don't carry the editor.
export default function PostOwnerMenuItems({
  author,
  permlink,
  canEdit,
  onDelete,
  isDeleting,
}: PostOwnerMenuItemsProps) {
  return (
    <>
      {canEdit && (
        <MenuItem
          as={NextLink}
          href={`/post/${author}/${permlink}?edit=1`}
          bg="background"
          color="primary"
        >
          <SlPencil style={{ marginRight: "8px" }} />
          Edit
        </MenuItem>
      )}
      <MenuItem
        onClick={onDelete}
        bg="background"
        color="error"
        isDisabled={isDeleting}
      >
        <DeleteIcon style={{ marginRight: "8px" }} />
        Delete
      </MenuItem>
    </>
  );
}
