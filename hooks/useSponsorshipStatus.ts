import { useState, useEffect } from "react";

interface SponsorshipStatus {
  isSponsored: boolean;
  isLite: boolean;
  sponsorUsername?: string;
  hiveUsername?: string;
  loading: boolean;
}

/**
 * Hook to fetch sponsorship status for a userbase user
 * Returns whether the user is lite/sponsored and sponsor info
 */
export function useSponsorshipStatus(userId: string | null): SponsorshipStatus {
  const [status, setStatus] = useState<SponsorshipStatus>({
    isSponsored: false,
    isLite: true, // Default to lite until we know otherwise
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setStatus({
        isSponsored: false,
        isLite: true,
        loading: false,
      });
      return;
    }

    let isCancelled = false;

    async function fetchStatus() {
      try {
        // Fetch sponsorship info
        const sponsorResponse = await fetch(
          `/api/userbase/sponsorships/info/${userId}`,
          { cache: "no-store" }
        );

        if (isCancelled) return;

        if (sponsorResponse.ok) {
          const data = await sponsorResponse.json();
          setStatus({
            isSponsored: data.sponsored || false,
            isLite: !data.sponsored,
            sponsorUsername: data.sponsor_username,
            hiveUsername: data.hive_username,
            loading: false,
          });
        } else {
          // If API fails, assume lite account
          setStatus({
            isSponsored: false,
            isLite: true,
            loading: false,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching sponsorship status:", error);
          setStatus({
            isSponsored: false,
            isLite: true,
            loading: false,
          });
        }
      }
    }

    fetchStatus();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return status;
}
