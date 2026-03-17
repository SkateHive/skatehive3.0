import { HiveAccount } from "@/hooks/useHiveAccount";
import useHiveAccount from "@/hooks/useHiveAccount";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { createContext, useContext, useEffect, useMemo, useCallback, useState } from "react";

export interface HiveUserContextProps {
  hiveUser: HiveAccount | null;
  setHiveUser: (user: HiveAccount | null) => void;
  isLoading: boolean | undefined;
  refreshUser: () => void;
}

const HiveUserContext = createContext<HiveUserContextProps | undefined>(
  undefined,
);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<HiveAccount | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>();
  const { hiveIdentity } = useLinkedIdentities();
  const { hiveAccount, isLoading: isHiveAccountLoading } = useHiveAccount(
    hiveIdentity?.handle || ""
  );

  const refreshUserCb = useCallback(() => {
    const userData = localStorage.getItem("hiveuser");
    if (userData) {
      setUser(JSON.parse(userData));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (hiveIdentity?.handle) {
      setIsLoading(isHiveAccountLoading);
      if (hiveAccount) {
        setUser(hiveAccount);
      }
      return;
    }
    refreshUserCb();
  }, [hiveIdentity?.handle, hiveAccount, isHiveAccountLoading, refreshUserCb]);

  const value = useMemo(
    () => ({
      hiveUser: user,
      setHiveUser: setUser,
      isLoading,
      refreshUser: refreshUserCb,
    }),
    [user, isLoading, refreshUserCb]
  );

  return (
    <HiveUserContext.Provider value={value}>
      {children}
    </HiveUserContext.Provider>
  );
};

export const useHiveUser: () => HiveUserContextProps = () => {
  const context = useContext(HiveUserContext);
  if (!context) {
    throw new Error("useHiveUser must be used within a UserProvider");
  }
  return context;
};
