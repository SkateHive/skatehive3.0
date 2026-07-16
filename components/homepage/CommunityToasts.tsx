"use client";

// UpvoteSnapToast is SUNSET — no longer rendered (kept in the tree, not deleted
// yet). See components/homepage/UpvoteSnapToast.tsx for the deprecation note.
// import UpvoteSnapToast from "./UpvoteSnapToast";
import WitnessVoteToast from "./WitnessVoteToast";
import ProfileSetupToast from "./ProfileSetupToast";

interface CommunityToastsProps {
  showInterval?: number;
  displayDuration?: number;
}

/**
 * Combined component that manages the recurring community toasts.
 *
 * Renders the witness-vote toast and the profile-setup CTA toast. The
 * snap-container upvote toast has been sunset (see above).
 */
export default function CommunityToasts({
  showInterval,
  displayDuration,
}: CommunityToastsProps) {
  return (
    <>
      <WitnessVoteToast
        showInterval={showInterval}
        displayDuration={displayDuration}
      />
      <ProfileSetupToast />
    </>
  );
}
