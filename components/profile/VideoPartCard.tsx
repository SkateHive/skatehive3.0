'use client'
import { Box, IconButton, Text, Button, Flex } from "@chakra-ui/react";
import { FaWindowClose } from "react-icons/fa";
import { VideoPart } from "@/types/VideoPart";

interface VideoPartCardProps {
    videoPart: VideoPart;
    onRemove: () => void;
    isOwner: boolean;
}

const VideoPartCard = ({ videoPart, onRemove, isOwner }: VideoPartCardProps) => {
    const getYoutubeEmbedUrl = (url: string) => {
        const regExp = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const match = url.match(regExp);
        return match ? `https://www.youtube.com/embed/${match[1]}` : null;
    };

    const getEmbedUrl = (url: string) => {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return getYoutubeEmbedUrl(url);
        }
        return null;
    };

    const embedUrl = getEmbedUrl(videoPart.url);

    return (
        <Box
            borderRadius="lg"
            overflow="hidden"
            p={6}
            mb={4}
            boxShadow="md"
            width="100%"
            color={"white"}
            position="relative"
        >
            {embedUrl && (
                <Box mb={4} position="relative" width="100%" paddingTop="56.25%">
                    <iframe
                        src={embedUrl}
                        style={{
                            border: 0,
                            backgroundColor: 'transparent',
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%'
                        }}
                        allowFullScreen
                        sandbox="allow-pointer-lock allow-same-origin allow-scripts allow-popups"
                        title={videoPart.name}
                    ></iframe>
                </Box>
            )}
            <Flex justifyContent="space-between" alignItems="flex-end">
                <Box>
                    <Text fontWeight="bold" fontSize="xl" mb={2}>{videoPart.name}</Text>
                    <Text mb={1}>Filmmakers: {videoPart.filmmaker.join(", ")}</Text>
                    <Text mb={1}>Friends: {videoPart.friends.join(", ")}</Text>
                    <Text mb={1}>Year: {videoPart.year}</Text>
                </Box>
                {isOwner && (
                    <Button
                        colorScheme="red"
                        onClick={onRemove}
                        leftIcon={<FaWindowClose />}
                    >
                        Remove
                    </Button>
                )}
            </Flex>
        </Box>
    );
}

export default VideoPartCard; 