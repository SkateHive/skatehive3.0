import { useState, useEffect } from "react";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

/**
 * Hook to get the current viewer's Hive username
 * Returns the Hive username if the viewer has a linked Hive identity
 */
export function useViewerHiveIdentity(): string | null {
  const { user } = useUserbaseAuth();
  const [hiveUsername, setHiveUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setHiveUsername(null);
      return;
    }

    let isCancelled = false;

    async function fetchHiveIdentity() {
      try {
        const response = await fetch("/api/userbase/identities", {
          cache: "no-store",
        });

        if (isCancelled) return;

        if (response.ok) {
          const data = await response.json();
          const hiveIdentity = data.identities?.find(
            (id: any) => id.type === "hive"
          );
          setHiveUsername(hiveIdentity?.handle || null);
        } else {
          setHiveUsername(null);
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Error fetching viewer Hive identity:", error);
          setHiveUsername(null);
        }
      }
    }

    fetchHiveIdentity();

    return () => {
      isCancelled = true;
    };
  }, [user]);

  return hiveUsername;
}
