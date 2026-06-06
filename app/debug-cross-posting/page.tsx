"use client";

/**
 * /debug-cross-posting
 *
 * Internal preview tool for the snap → Farcaster + Instagram cross-post
 * pipeline. Lets you mock up a snap (author, permlink, body, media) and
 * see EXACTLY what would be sent to each platform without actually
 * publishing.
 *
 * Uses the same helpers as the snap composer (buildSnapCastText,
 * buildSnapCastEmbeds, buildInstagramCaption) so the previews can't
 * drift from production behavior — if you tweak the composer, this
 * page reflects it.
 */

import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Code,
  Divider,
  HStack,
  Heading,
  Input,
  Link as ChakraLink,
  Select,
  Text,
  Textarea,
  VStack,
  useToast,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { APP_CONFIG } from "@/config/app.config";
import {
  buildSnapCastEmbeds,
  buildSnapCastText,
  CAST_MAX_CHARS,
} from "@/lib/crosspost/snapCast";
import { buildInstagramCaption } from "@/lib/instagram/caption";

// Channels mirror the SnapComposer + /api/farcaster/cast whitelist
const FARCASTER_CHANNELS = [
  { id: "", label: "(no channel — your feed)" },
  { id: "skateboard", label: "/skateboard" },
  { id: "gnars", label: "/gnars" },
  { id: "higher", label: "/higher" },
];

// Quick presets covering the edge cases we've debugged in production
const PRESETS = [
  {
    name: "Text only",
    body: "just did a kickflip down a 5-stair",
    imagesCsv: "",
    videoUrl: "",
  },
  {
    name: "1 image",
    body: "stoked on this new spot",
    imagesCsv:
      "https://ipfs.skatehive.app/ipfs/bafybeihiimagedemoq6r2qmsnlbnmkurq",
    videoUrl: "",
  },
  {
    name: "2 images",
    body: "before / after the bail",
    imagesCsv:
      "https://ipfs.skatehive.app/ipfs/bafybeiimg1,https://ipfs.skatehive.app/ipfs/bafybeiimg2",
    videoUrl: "",
  },
  {
    name: "Video only",
    body: "got the line on the second try",
    imagesCsv: "",
    videoUrl:
      "https://ipfs.skatehive.app/ipfs/bafybeifprcagpkfcimvpqeei3cmuadkygap7lgzi73axhtwpowbtwaxpge",
  },
  {
    name: "Long body (>1024 chars)",
    body:
      "lorem ipsum ".repeat(120) + "end",
    imagesCsv: "",
    videoUrl: "",
  },
];

export default function DebugCrossPostingPage() {
  const toast = useToast();

  // ── Mocked snap inputs ───────────────────────────────────────────────
  const [hiveAuthor, setHiveAuthor] = useState("xvlad");
  const [permlink, setPermlink] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "demo-permlink-" + Math.random().toString(36).slice(2, 8)
  );
  const [body, setBody] = useState(
    "just landed a tre flip down 4 stairs"
  );
  const [imagesCsv, setImagesCsv] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tagsCsv, setTagsCsv] = useState("skateboarding,bail,vert");
  const [igHandle, setIgHandle] = useState("yourighandle");
  const [farcasterChannel, setFarcasterChannel] = useState("");

  // ── Derived URLs / payloads ──────────────────────────────────────────
  const snapUrl = useMemo(() => {
    if (!hiveAuthor || !permlink) return "";
    return `${APP_CONFIG.ORIGIN.replace(/\/$/, "")}/post/${hiveAuthor}/${permlink}`;
  }, [hiveAuthor, permlink]);

  const imageUrls = useMemo(
    () =>
      imagesCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [imagesCsv]
  );
  const tags = useMemo(
    () =>
      tagsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [tagsCsv]
  );

  const castText = useMemo(
    () => buildSnapCastText(body, snapUrl || null),
    [body, snapUrl]
  );
  const castEmbeds = useMemo(
    () =>
      buildSnapCastEmbeds({
        snapUrl,
        imageUrls,
        videoUrl: videoUrl || null,
      }),
    [snapUrl, imageUrls, videoUrl]
  );

  const igCaption = useMemo(
    () =>
      buildInstagramCaption({
        body,
        hiveAuthor,
        permalinkUrl: snapUrl,
        extraTags: tags,
        igHandle: igHandle || null,
      }),
    [body, hiveAuthor, snapUrl, tags, igHandle]
  );
  const igMediaType: "REELS" | "IMAGE" | "(none)" = videoUrl
    ? "REELS"
    : imageUrls[0]
    ? "IMAGE"
    : "(none)";
  const igCoverUrl = imageUrls[0] || (videoUrl ? "(needs a thumbnail URL)" : "");

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setBody(preset.body);
    setImagesCsv(preset.imagesCsv);
    setVideoUrl(preset.videoUrl);
  };

  // ── Optional: actually send the cast (Farcaster only — IG is gated
  //    on HP and would spam @skatehive, so we never send IG from here).
  const [isSending, setIsSending] = useState(false);
  const sendCastForReal = async () => {
    if (!confirm("Send this cast to YOUR Farcaster account?")) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/farcaster/cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: castText,
          embeds: castEmbeds.length > 0 ? castEmbeds : undefined,
          channel_id: farcasterChannel || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast({
          title: "Cast sent",
          description: data?.hash ? `hash: ${data.hash}` : undefined,
          status: "success",
          duration: 5000,
        });
      } else {
        toast({
          title: `Cast failed (HTTP ${res.status})`,
          description: data?.error || "see network tab",
          status: "error",
          duration: 8000,
        });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Box minH="100vh" bg="background" color="primary" p={{ base: 4, md: 8 }}>
      <VStack align="stretch" spacing={6} maxW="1400px" mx="auto">
        <Box>
          <Heading size="lg" fontFamily="mono" color="primary">
            🧪 debug · cross-posting preview
          </Heading>
          <Text fontFamily="mono" fontSize="sm" color="dim">
            Mock a snap on the left, see the exact Farcaster + Instagram
            payloads on the right. No network calls happen until you press
            the explicit send button.
          </Text>
        </Box>

        <HStack align="stretch" spacing={6} flexWrap="wrap">
          {/* ────────── LEFT: input form ────────── */}
          <Box flex="1" minW="340px" maxW="540px">
            <SectionHeader>Inputs</SectionHeader>

            <Wrap spacing={2} mb={4}>
              {PRESETS.map((p) => (
                <WrapItem key={p.name}>
                  <Button
                    size="xs"
                    variant="outline"
                    fontFamily="mono"
                    borderColor="primary"
                    color="primary"
                    onClick={() => applyPreset(p)}
                  >
                    {p.name}
                  </Button>
                </WrapItem>
              ))}
            </Wrap>

            <VStack align="stretch" spacing={3}>
              <Field label="Hive author">
                <Input
                  fontFamily="mono"
                  size="sm"
                  value={hiveAuthor}
                  onChange={(e) => setHiveAuthor(e.target.value)}
                />
              </Field>
              <Field label="Permlink (UUID)">
                <HStack>
                  <Input
                    fontFamily="mono"
                    size="sm"
                    value={permlink}
                    onChange={(e) => setPermlink(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    fontFamily="mono"
                    onClick={() => setPermlink(crypto.randomUUID())}
                  >
                    new
                  </Button>
                </HStack>
              </Field>
              <Field label={`Snap body (${body.length} chars)`}>
                <Textarea
                  fontFamily="mono"
                  size="sm"
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </Field>
              <Field label="Image URLs (comma-separated, in order)">
                <Textarea
                  fontFamily="mono"
                  size="sm"
                  rows={2}
                  placeholder="https://ipfs.skatehive.app/ipfs/...,https://ipfs.skatehive.app/ipfs/..."
                  value={imagesCsv}
                  onChange={(e) => setImagesCsv(e.target.value)}
                />
              </Field>
              <Field label="Video URL (single)">
                <Input
                  fontFamily="mono"
                  size="sm"
                  placeholder="https://ipfs.skatehive.app/ipfs/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              </Field>
              <Field label="Hashtags (comma-separated, no #)">
                <Input
                  fontFamily="mono"
                  size="sm"
                  value={tagsCsv}
                  onChange={(e) => setTagsCsv(e.target.value)}
                />
              </Field>
              <Field label="Author's IG handle (for @-tagging in caption)">
                <Input
                  fontFamily="mono"
                  size="sm"
                  placeholder="leave blank to fall back to 'By @author'"
                  value={igHandle}
                  onChange={(e) => setIgHandle(e.target.value)}
                />
              </Field>
              <Field label="Farcaster channel">
                <Select
                  size="sm"
                  fontFamily="mono"
                  value={farcasterChannel}
                  onChange={(e) => setFarcasterChannel(e.target.value)}
                >
                  {FARCASTER_CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </VStack>
          </Box>

          {/* ────────── RIGHT: previews ────────── */}
          <VStack flex="2" minW="340px" align="stretch" spacing={6}>
            {/* Snap permalink */}
            <Box border="1px solid" borderColor="muted" p={4}>
              <SectionHeader>Snap permalink (shared in both crosspost targets)</SectionHeader>
              <Code
                p={2}
                fontFamily="mono"
                fontSize="xs"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
                bg="background"
                color="text"
                w="full"
              >
                {snapUrl || "(set hive_author + permlink)"}
              </Code>
              <Text fontSize="2xs" color="dim" mt={2} fontFamily="mono">
                Uses /post/{"{author}"}/{"{permlink}"} — the /user/.../snap/...
                route would 302 to the profile, breaking embed previews.
              </Text>
            </Box>

            {/* Farcaster preview */}
            <Box border="1px solid" borderColor="primary" p={4}>
              <HStack justify="space-between" mb={3}>
                <SectionHeader noMb>🟣 Farcaster cast</SectionHeader>
                <Text
                  fontFamily="mono"
                  fontSize="2xs"
                  color={castText.length > CAST_MAX_CHARS ? "error" : "dim"}
                >
                  {castText.length} / {CAST_MAX_CHARS} chars
                </Text>
              </HStack>

              <FieldLabel>cast text</FieldLabel>
              <Code
                p={3}
                fontFamily="mono"
                fontSize="xs"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
                bg="background"
                color="text"
                display="block"
                w="full"
              >
                {castText || "(empty)"}
              </Code>

              <FieldLabel mt={3}>embeds (max 2)</FieldLabel>
              {castEmbeds.length === 0 ? (
                <Text fontFamily="mono" fontSize="xs" color="dim">
                  (none)
                </Text>
              ) : (
                <VStack align="stretch" spacing={2}>
                  {castEmbeds.map((e, i) => (
                    <HStack key={i} align="start" spacing={2}>
                      <Text fontFamily="mono" fontSize="xs" color="primary">
                        #{i + 1}
                      </Text>
                      <Code
                        flex="1"
                        p={2}
                        fontFamily="mono"
                        fontSize="xs"
                        whiteSpace="pre-wrap"
                        wordBreak="break-all"
                        bg="background"
                        color="text"
                      >
                        {e.url}
                      </Code>
                    </HStack>
                  ))}
                </VStack>
              )}

              <FieldLabel mt={3}>channel_id</FieldLabel>
              <Code
                p={2}
                fontFamily="mono"
                fontSize="xs"
                bg="background"
                color="text"
                display="block"
              >
                {farcasterChannel || "(none — posts to your feed)"}
              </Code>

              <Divider my={4} borderColor="border" />

              <ButtonGroup size="sm" spacing={2}>
                <Button
                  variant="outline"
                  fontFamily="mono"
                  borderColor="primary"
                  color="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          text: castText,
                          embeds: castEmbeds,
                          channel_id: farcasterChannel || undefined,
                        },
                        null,
                        2
                      )
                    );
                    toast({ title: "Copied payload JSON", status: "success", duration: 1500 });
                  }}
                >
                  copy payload
                </Button>
                <Button
                  bg="primary"
                  color="background"
                  fontFamily="mono"
                  isLoading={isSending}
                  loadingText="sending…"
                  onClick={sendCastForReal}
                  isDisabled={!castText || castText.length > CAST_MAX_CHARS}
                >
                  send for real →
                </Button>
              </ButtonGroup>
              <Text fontSize="2xs" color="dim" mt={2} fontFamily="mono">
                Hits POST /api/farcaster/cast on your behalf (cookie or
                Hive-signature auth). Posts to your real Farcaster.
              </Text>
            </Box>

            {/* Instagram preview */}
            <Box border="1px solid" borderColor="warning" p={4}>
              <HStack justify="space-between" mb={3}>
                <SectionHeader noMb>📷 Instagram cross-post</SectionHeader>
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  media_type: <strong>{igMediaType}</strong>
                </Text>
              </HStack>

              <FieldLabel>caption</FieldLabel>
              <Code
                p={3}
                fontFamily="mono"
                fontSize="xs"
                whiteSpace="pre-wrap"
                wordBreak="break-word"
                bg="background"
                color="text"
                display="block"
                w="full"
              >
                {igCaption}
              </Code>

              <FieldLabel mt={3}>video_url (Reels)</FieldLabel>
              <Code
                p={2}
                fontFamily="mono"
                fontSize="xs"
                bg="background"
                color="text"
                display="block"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
              >
                {videoUrl || "(none — would publish as IMAGE)"}
              </Code>

              <FieldLabel mt={3}>image_url / cover_url</FieldLabel>
              <Code
                p={2}
                fontFamily="mono"
                fontSize="xs"
                bg="background"
                color="text"
                display="block"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
              >
                {igCoverUrl || "(none)"}
              </Code>

              <FieldLabel mt={3}>permalink_url (link in caption)</FieldLabel>
              <Code
                p={2}
                fontFamily="mono"
                fontSize="xs"
                bg="background"
                color="text"
                display="block"
                whiteSpace="pre-wrap"
                wordBreak="break-all"
              >
                {snapUrl || "(set hive_author + permlink)"}
              </Code>

              <Divider my={4} borderColor="border" />
              <ButtonGroup size="sm">
                <Button
                  variant="outline"
                  fontFamily="mono"
                  borderColor="warning"
                  color="warning"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          hive_author: hiveAuthor,
                          hive_permlink: permlink,
                          title: "",
                          body,
                          tags,
                          image_url: imageUrls[0] || null,
                          video_url: videoUrl || null,
                          permalink_url: snapUrl,
                        },
                        null,
                        2
                      )
                    );
                    toast({ title: "Copied payload JSON", status: "success", duration: 1500 });
                  }}
                >
                  copy payload
                </Button>
              </ButtonGroup>
              <Text fontSize="2xs" color="dim" mt={2} fontFamily="mono">
                No &ldquo;send for real&rdquo; here — IG is rate-limited
                (1/user/24h, 20/global/24h) and publishes to the shared
                @skatehive account. Use the snap composer for real posts.
              </Text>
            </Box>
          </VStack>
        </HStack>

        <Box>
          <Text fontFamily="mono" fontSize="2xs" color="dim" textAlign="center">
            Code:{" "}
            <ChakraLink
              href="https://github.com/SkateHive/skatehive3.0/blob/main/app/debug-cross-posting/page.tsx"
              isExternal
              color="primary"
            >
              app/debug-cross-posting/page.tsx
            </ChakraLink>
            {" · "}
            <ChakraLink
              href="https://github.com/SkateHive/skatehive3.0/blob/main/lib/crosspost/snapCast.ts"
              isExternal
              color="primary"
            >
              lib/crosspost/snapCast.ts
            </ChakraLink>
          </Text>
        </Box>
      </VStack>
    </Box>
  );
}

// ─── Tiny UI helpers ────────────────────────────────────────────────────

function SectionHeader({
  children,
  noMb,
}: {
  children: React.ReactNode;
  noMb?: boolean;
}) {
  return (
    <Heading
      size="sm"
      fontFamily="mono"
      color="primary"
      mb={noMb ? 0 : 2}
    >
      {children}
    </Heading>
  );
}

function FieldLabel({
  children,
  mt,
}: {
  children: React.ReactNode;
  mt?: number;
}) {
  return (
    <Text
      fontFamily="mono"
      fontSize="2xs"
      color="dim"
      mt={mt}
      mb={1}
      textTransform="uppercase"
      letterSpacing="wider"
    >
      {children}
    </Text>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </Box>
  );
}
