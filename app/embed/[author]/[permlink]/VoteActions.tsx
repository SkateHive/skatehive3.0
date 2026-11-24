"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/contexts/LocaleContext";

type Wallet = {
  requestVote(account: string, permlink: string, author: string, weight: number,
    done: (response: { success: boolean }) => void): void;
};

function wallet() {
  return (window as Window & { hive_keychain?: Wallet }).hive_keychain;
}

export default function VoteActions({ author, permlink, fullUrl, allowVotes, comments }: {
  author: string; permlink: string; fullUrl: string; allowVotes: boolean; comments: number;
}) {
  const t = useTranslations("postEmbed");
  const [available, setAvailable] = useState(false);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const locked = useRef(false);
  useEffect(() => {
    const detect = () => setAvailable(typeof wallet()?.requestVote === "function");
    detect();
    window.addEventListener("hive_keychain_installed", detect);
    // SkateWallet injects an external script at document_idle without a ready event.
    let attempts = 0;
    const timer = window.setInterval(() => {
      detect();
      if (wallet()?.requestVote || ++attempts >= 20) window.clearInterval(timer);
    }, 250);
    window.addEventListener("focus", detect);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", detect);
      window.removeEventListener("hive_keychain_installed", detect);
    };
  }, []);

  function upvote() {
    const provider = wallet();
    if (!provider?.requestVote) return setAvailable(false);
    const voter = account.trim().replace(/^@/, "").toLowerCase();
    if (!voter || locked.current) return;
    locked.current = true;
    setStatus("pending");
    const finish = (success: boolean) => {
      locked.current = success;
      setStatus(success ? "success" : "failed");
    };
    try {
      provider.requestVote(voter, permlink, author, 10000, response => finish(response?.success === true));
    } catch {
      finish(false);
    }
  }

  return <footer style={{ padding: 16, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
    {allowVotes && available && <>
      <input aria-label={t("account")} placeholder={t("account")} value={account}
        style={{ color: "CanvasText", background: "Canvas", padding: 6 }}
        disabled={locked.current} onChange={event => setAccount(event.target.value)} />
      <button type="button" onClick={upvote} disabled={!account.trim() || locked.current}>
        {t("vote")}
      </button>
      <span role="status">{status !== "idle" && t(status)}</span>
    </>}
    <a href={fullUrl + "#comments"} target="_blank" rel="noopener noreferrer">{t("comments")} ({comments})</a>
    <a href={fullUrl} target="_blank" rel="noopener noreferrer">{t("open")}</a>
  </footer>;
}
