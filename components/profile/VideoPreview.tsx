"use client";
import React, { useRef, useEffect, useState } from "react";
import { Box, Icon } from "@chakra-ui/react";
import { FaPlay } from "react-icons/fa";

interface VideoPreviewProps {
    src: string;
    onClick?: () => void;
}

// Odysee `$/embed/…` URLs are HTML embed pages, not media files, so a raw
// <video src> can't play them (and the poster preload 404s against the IPFS
// metadata route). For the grid card we just need a static poster; the modal
// plays it in an <iframe>. Detected here so this component can branch to an
// <img> poster (og:image via /api/odysee-thumbnail) instead of a <video>.
const isOdyseeUrl = (url: string) => {
    try {
        return /(^|\.)odysee\.com$/i.test(new URL(url).hostname);
    } catch {
        return false;
    }
};

export default function VideoPreview({ src, onClick }: VideoPreviewProps) {
    if (isOdyseeUrl(src)) {
        return <OdyseeVideoPreview src={src} onClick={onClick} />;
    }
    return <FileVideoPreview src={src} onClick={onClick} />;
}

// Shared play-icon overlays used by both preview variants.
function PlayOverlays({ showCenter }: { showCenter: boolean }) {
    return (
        <>
            <Box
                position="absolute"
                bottom={2}
                right={2}
                bg="blackAlpha.700"
                borderRadius="full"
                p={1}
                display="flex"
                alignItems="center"
                justifyContent="center"
            >
                <Icon as={FaPlay} color="white" boxSize={3} />
            </Box>
            {showCenter && (
                <Box
                    position="absolute"
                    top="50%"
                    left="50%"
                    transform="translate(-50%, -50%)"
                    bg="blackAlpha.600"
                    borderRadius="full"
                    p={3}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                >
                    <Icon as={FaPlay} color="white" boxSize={6} />
                </Box>
            )}
        </>
    );
}

// Odysee grid card: static og:image poster + play overlay. Clicking bubbles
// to onClick (opens SnapModal, which plays the embed in an <iframe>).
function OdyseeVideoPreview({ src, onClick }: VideoPreviewProps) {
    const [poster, setPoster] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/odysee-thumbnail?url=${encodeURIComponent(src)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!cancelled && typeof j?.thumbnail === "string") {
                    setPoster(j.thumbnail);
                }
            })
            .catch(() => {
                /* no poster — fall back to the black card + play icon */
            });
        return () => {
            cancelled = true;
        };
    }, [src]);

    return (
        <Box
            position="relative"
            width="100%"
            height="100%"
            cursor="pointer"
            bg="black"
            onClick={onClick}
            _hover={{ transform: "scale(1.02)", transition: "transform 0.2s" }}
        >
            {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={poster}
                    alt=""
                    loading="lazy"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "inherit",
                    }}
                />
            )}
            <PlayOverlays showCenter={!poster} />
        </Box>
    );
}

function FileVideoPreview({ src, onClick }: VideoPreviewProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isVisible, setIsVisible] = useState(false);



    // Intersection Observer for auto-play when visible
    useEffect(() => {
        const currentVideo = videoRef.current;
        if (!currentVideo) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.5 }
        );

        observer.observe(currentVideo);

        return () => {
            observer.disconnect();
        };
    }, []);

    // Auto-play when visible
    useEffect(() => {
        const currentVideo = videoRef.current;
        if (!currentVideo) return;

        if (isVisible && isLoaded && !hasError) {
            currentVideo.play().catch(() => {
                // Silent fail if autoplay is blocked
            });
        } else {
            currentVideo.pause();
        }
    }, [isVisible, isLoaded, hasError]);

    const handleLoadedData = () => {
        setIsLoaded(true);
        setHasError(false);
    };

    const handleError = (event: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        setHasError(true);
        setIsLoaded(false);
    };

    return (
        <Box
            position="relative"
            width="100%"
            height="100%"
            cursor="pointer"
            onClick={onClick}
            _hover={{
                transform: "scale(1.02)",
                transition: "transform 0.2s",
            }}
        >
            <video
                ref={videoRef}
                src={src}
                muted
                loop
                playsInline
                preload="metadata"
                onLoadedData={handleLoadedData}
                onError={handleError}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "inherit",
                }}
            />

            <PlayOverlays showCenter={!isLoaded || hasError} />
        </Box>
    );
}
