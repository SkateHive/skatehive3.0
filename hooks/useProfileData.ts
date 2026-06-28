"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getProfile, getAccountWithPower } from "@/lib/hive/client-functions";
import type { ProfileData } from "../components/profile/ProfilePage";
import { VideoPart } from "@/types/VideoPart";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import { useProfileDebug } from "@/lib/utils/profileDebug";

interface HiveAccount {
    posting_json_metadata?: string;
    json_metadata?: string;
}

export default function useProfileData(username: string, hiveAccount: HiveAccount | null) {
    const debug = useProfileDebug("useProfileData");
    // Stabilize hiveAccount references to prevent unnecessary re-fetches.
    // The object reference changes on every parent render, but the actual
    // metadata strings inside it stay the same.
    const postingMetadata = hiveAccount?.posting_json_metadata || "";
    const jsonMetadata = hiveAccount?.json_metadata || "";
    const hasHiveAccount = !!hiveAccount;

    const [profileData, setProfileData] = useState<ProfileData>({
        profileImage: "",
        coverImage: "",
        website: "",
        name: "",
        followers: 0,
        following: 0,
        location: "",
        about: "",
        ethereum_address: "",
        video_parts: [],
        vote_weight: 51, // Default vote weight
        vp_percent: "0%",
        rc_percent: "0%",
        zineCover: "",
        svs_profile: "",
    });

    const updateProfileData = useCallback((newData: Partial<ProfileData>) => {
        setProfileData((prev: ProfileData) => ({ ...prev, ...newData }));
    }, []);

    // Tracks the username that the most-recently-started Phase 2 fetch belongs to.
    // Updated synchronously at the start of each effect run so any in-flight IIFE
    // from a previous username can detect it is stale before calling setState.
    const currentUsernameRef = useRef(username);

    useEffect(() => {
        if (!username || !hasHiveAccount) return;

        currentUsernameRef.current = username;
        let cancelled = false;
        let profileImage = "";
        let coverImage = "";
        let website = "";
        let instagram = "";
        let ethereum_address = "";
        let video_parts: VideoPart[] = [];
        let vote_weight = 51;
        let zineCover = "";
        let svs_profile = "";

        if (postingMetadata) {
            try {
                const parsedMetadata = JSON.parse(postingMetadata);
                const profile = parsedMetadata?.profile || {};
                profileImage = profile.profile_image || "";
                coverImage = profile.cover_image || "";
                website = profile.website || "";
                // IG handle: prefer direct field, fall back to nested
                // social.instagram, then parse from a website URL.
                if (typeof profile.instagram === "string") {
                    instagram = profile.instagram.trim();
                } else if (
                    profile.social &&
                    typeof profile.social.instagram === "string"
                ) {
                    instagram = profile.social.instagram.trim();
                } else if (typeof profile.website === "string") {
                    const m = profile.website.match(/instagram\.com\/([A-Za-z0-9._]+)/);
                    if (m) instagram = m[1];
                }
            } catch (err) {
                console.error("Failed to parse profile metadata", err);
            }
        }

        if (jsonMetadata) {
            try {
                const rawMetadata = JSON.parse(jsonMetadata);
                const parsedMetadata = migrateLegacyMetadata(rawMetadata);
                ethereum_address = parsedMetadata.extensions?.wallets?.primary_wallet || "";
                video_parts = parsedMetadata.extensions?.video_parts || [];
                const defaultWeight = parsedMetadata.extensions?.settings?.voteSettings?.default_voting_weight;
                vote_weight = typeof defaultWeight === 'number' ? Math.round(defaultWeight / 100) : 51;
                zineCover = parsedMetadata.extensions?.settings?.appSettings?.zineCover || "";
                svs_profile = parsedMetadata.extensions?.settings?.appSettings?.svs_profile || "";
            } catch (err) {
                console.error("Failed to parse json_metadata", err);
            }
        }

        // Reset bridge fields in the same call so stale follower counts from
        // the previous username don't show while Phase 2 is in-flight.
        updateProfileData({ name: username, profileImage, coverImage, website, instagram, ethereum_address, video_parts, vote_weight, zineCover, svs_profile, followers: 0, following: 0, location: "", about: "", vp_percent: "0%", rc_percent: "0%" });

        // --- Phase 2: bridge API (async, can fail independently) ---
        (async () => {
            try {
                debug.fetch("fetching profile + power", { username });
                const profileInfo = await getProfile(username);
                const powerInfo = await getAccountWithPower(username);

                if (cancelled || currentUsernameRef.current !== username) return;
                if (!profileInfo) {
                    console.warn(`Bridge profile fetch failed after retries for ${username}`);
                    return;
                }
                updateProfileData({
                    name: profileInfo.metadata?.profile?.name || username,
                    followers: profileInfo.stats?.followers || 0,
                    following: profileInfo.stats?.following || 0,
                    location: profileInfo.metadata?.profile?.location || "",
                    about: profileInfo.metadata?.profile?.about || "",
                    vp_percent: powerInfo?.data?.vp_percent || "0%",
                    rc_percent: powerInfo?.data?.rc_percent || "0%",
                });
            } catch (err) {
                console.error("Failed to fetch bridge profile info", err);
            }
        })();

        return () => { cancelled = true; };
    }, [username, hasHiveAccount, postingMetadata, jsonMetadata]);

    // Re-runs Phase 2 on demand (e.g. after follow/unfollow) so the displayed
    // follower/following counts reflect the latest blockchain state.
    const refetchBridgeData = useCallback(async () => {
        if (!username || !hasHiveAccount) return;
        try {
            const profileInfo = await getProfile(username);
            const powerInfo = await getAccountWithPower(username);
            updateProfileData({
                name: profileInfo?.metadata?.profile?.name || username,
                followers: profileInfo?.stats?.followers || 0,
                following: profileInfo?.stats?.following || 0,
                location: profileInfo?.metadata?.profile?.location || "",
                about: profileInfo?.metadata?.profile?.about || "",
                vp_percent: powerInfo?.data?.vp_percent || "0%",
                rc_percent: powerInfo?.data?.rc_percent || "0%",
            });
        } catch (err) {
            console.error("Failed to refetch bridge profile info", err);
        }
    }, [username, hasHiveAccount, updateProfileData]);

    return { profileData, updateProfileData, refetchBridgeData };
}
