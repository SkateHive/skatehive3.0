"use client";
import { useState, useEffect, useCallback } from "react";
import { getProfile, getAccountWithPower } from "@/lib/hive/client-functions";
import { ProfileData } from "../components/profile/ProfilePage";
import { VideoPart } from "@/types/VideoPart";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";

interface HiveAccount {
    posting_json_metadata?: string;
    json_metadata?: string;
}

export default function useProfileData(username: string, hiveAccount: HiveAccount | null) {
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

    useEffect(() => {
        const fetchProfileInfo = async () => {
            try {
                const profileInfo = await getProfile(username);
                const powerInfo = await getAccountWithPower(username);

                let profileImage = "";
                let coverImage = "";
                let website = "";
                let ethereum_address = "";
                let video_parts: VideoPart[] = [];
                let vote_weight = 51;
                let zineCover = "";
                let svs_profile = "";

                if (hiveAccount?.posting_json_metadata) {
                    try {
                        const parsedMetadata = JSON.parse(hiveAccount.posting_json_metadata);
                        const profile = parsedMetadata?.profile || {};
                        profileImage = profile.profile_image || "";
                        coverImage = profile.cover_image || "";
                        website = profile.website || "";
                    } catch (err) {
                        console.error("Failed to parse profile metadata", err);
                    }
                }

                if (hiveAccount?.json_metadata) {
                    try {
                        const rawMetadata = JSON.parse(hiveAccount.json_metadata);
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

                setProfileData({
                    profileImage,
                    coverImage,
                    website,
                    name: profileInfo?.metadata?.profile?.name || username,
                    followers: profileInfo?.stats?.followers || 0,
                    following: profileInfo?.stats?.following || 0,
                    location: profileInfo?.metadata?.profile?.location || "",
                    about: profileInfo?.metadata?.profile?.about || "",
                    ethereum_address: ethereum_address,
                    video_parts: video_parts,
                    vote_weight: vote_weight,
                    vp_percent: powerInfo?.data?.vp_percent || "0%",
                    rc_percent: powerInfo?.data?.rc_percent || "0%",
                    zineCover: zineCover,
                    svs_profile: svs_profile,
                });
                
            } catch (err) {
                console.error("Failed to fetch profile info", err);
            }
        };

        if (username && hiveAccount) {
            fetchProfileInfo();
        }
    }, [username, hiveAccount]);

    return { profileData, updateProfileData };
}
