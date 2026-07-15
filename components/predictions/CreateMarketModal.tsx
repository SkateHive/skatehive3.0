"use client";
import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Input,
  Select,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { useQuery } from "@tanstack/react-query";
import { useAioha } from "@aioha/react-ui";
import useCreateMarket from "@/hooks/useCreateMarket";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import type {
  CreateMarketFields,
  MarketToken,
  SportsEvent,
} from "@/lib/predictions/types";
import {
  SPORTS_BET_TYPES,
  SPORTS_LEAGUES,
  SportsBetType,
  multiResolutionCriteria,
  participantsToOutcomes,
  sportsMoneyline,
} from "@/lib/predictions/createShapes";
import ConnectWalletPrompt from "./ConnectWalletPrompt";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Shape = "binary" | "multi" | "sports";

const inputStyle = { bg: "inputBg", borderColor: "inputBorder" } as const;

const FALLBACK_CATEGORIES = [
  { id: "crypto", name: "Crypto" },
  { id: "hive", name: "Hive" },
  { id: "sports", name: "Sports" },
  { id: "politics", name: "Politics" },
  { id: "gaming", name: "Gaming / Esports" },
  { id: "entertainment", name: "Entertainment" },
  { id: "science", name: "Science & Weather" },
  { id: "tech", name: "Tech" },
  { id: "other", name: "Other" },
];

// datetime-local (local) → ISO, or "" if empty/invalid.
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

const SHAPE_CARDS: { value: Shape; title: string; desc: string }[] = [
  { value: "binary", title: "Yes / No", desc: "A single binary question." },
  { value: "multi", title: "Multiple options", desc: "One winner from a field." },
  { value: "sports", title: "Sports match", desc: "Match winner from a live data feed." },
];

export default function CreateMarketModal({ isOpen, onClose }: CreateMarketModalProps) {
  const { user } = useAioha();
  const { createMarket, status, error, txId, isPending, dryRun, reset } =
    useCreateMarket();

  const [step, setStep] = useState(1);
  const [shape, setShape] = useState<Shape>("binary");

  // shared
  const [category, setCategory] = useState("skate");
  const [token, setToken] = useState<MarketToken>("HIVE");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openingBetAmount, setOpeningBetAmount] = useState("1");
  const [stakeCap, setStakeCap] = useState("1000");
  const [minParticipants, setMinParticipants] = useState("3");
  const [closesAt, setClosesAt] = useState(""); // datetime-local
  const [resolvesAt, setResolvesAt] = useState(""); // datetime-local

  // binary / sports-manual
  const [yesLabel, setYesLabel] = useState("YES");
  const [noLabel, setNoLabel] = useState("NO");
  const [creatorSide, setCreatorSide] = useState("YES");

  // multi
  const [participants, setParticipants] = useState("");

  // sports
  const [league, setLeague] = useState<string>(SPORTS_LEAGUES[0]);
  const [eventId, setEventId] = useState("");
  const [betType, setBetType] = useState<SportsBetType>("moneyline");

  const { data: catData } = useQuery({
    queryKey: predictionKeys.categories(),
    queryFn: predictionsApi.getCategories,
    staleTime: 300_000,
  });
  const categories = catData?.categories ?? FALLBACK_CATEGORIES;

  const {
    data: eventsData,
    isFetching: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: predictionKeys.sportsEvents(league),
    queryFn: () => predictionsApi.getSportsEvents(league),
    enabled: isOpen && shape === "sports" && !!league,
    staleTime: 60_000,
  });
  const events = eventsData?.events ?? [];
  const selectedEvent: SportsEvent | undefined = events.find((e) => e.id === eventId);

  const autoResolve = shape === "sports" && betType === "moneyline";

  const handleClose = () => {
    reset();
    setStep(1);
    onClose();
  };

  // Assemble the on-chain CreateMarketFields from wizard state.
  const assembled = useMemo<CreateMarketFields | null>(() => {
    const base = {
      token,
      stakeCap: Number(stakeCap),
      minParticipants: Number(minParticipants),
      openingBetAmount: Number(openingBetAmount),
    };

    if (shape === "binary") {
      return {
        ...base,
        title,
        description,
        category,
        outcomes: ["YES", "NO"],
        outcomeLabels: { YES: yesLabel, NO: noLabel },
        creatorSide,
        resolutionType: "manual",
        resolutionSource: null,
        resolutionCriteria: description,
        bettingClosesAt: toIso(closesAt),
        resolvesAt: toIso(resolvesAt),
      };
    }

    if (shape === "multi") {
      const { outcomes, outcomeLabels } = participantsToOutcomes(participants);
      const side = outcomes.includes(creatorSide) ? creatorSide : outcomes[0];
      return {
        ...base,
        title,
        description,
        category,
        outcomes,
        outcomeLabels,
        creatorSide: side ?? "O1",
        resolutionType: "manual",
        resolutionSource: null,
        resolutionCriteria: multiResolutionCriteria(Object.values(outcomeLabels)),
        bettingClosesAt: toIso(closesAt),
        resolvesAt: toIso(resolvesAt),
      };
    }

    // sports
    if (!selectedEvent) return null;
    if (betType === "moneyline") {
      const m = sportsMoneyline(selectedEvent);
      return {
        ...base,
        title: title || m.title,
        description: description || m.resolutionCriteria,
        category: "sports",
        outcomes: ["YES", "NO"],
        outcomeLabels: m.outcomeLabels,
        creatorSide,
        resolutionType: "auto",
        resolutionSource: m.resolutionSource,
        resolutionCriteria: m.resolutionCriteria,
        bettingClosesAt: m.bettingClosesAt,
        resolvesAt: m.resolvesAt,
      };
    }
    // spread / totals / prop → manual binary anchored to the event
    return {
      ...base,
      title: title || `${selectedEvent.homeTeam} vs ${selectedEvent.awayTeam}`,
      description,
      category: "sports",
      outcomes: ["YES", "NO"],
      outcomeLabels: { YES: yesLabel, NO: noLabel },
      creatorSide,
      resolutionType: "manual",
      resolutionSource: null,
      resolutionCriteria: description,
      bettingClosesAt: selectedEvent.commenceTime,
      resolvesAt: resolvesAt ? toIso(resolvesAt) : selectedEvent.commenceTime,
    };
  }, [
    shape, token, stakeCap, minParticipants, openingBetAmount, title, description,
    category, yesLabel, noLabel, creatorSide, participants, closesAt, resolvesAt,
    selectedEvent, betType,
  ]);

  const outcomesForSide = assembled?.outcomes ?? ["YES", "NO"];
  const labelsForSide = assembled?.outcomeLabels ?? { YES: "YES", NO: "NO" };

  const handleSubmit = async () => {
    if (!assembled) return;
    const res = await createMarket(assembled);
    if (res?.success && !res.dryRun) setTimeout(handleClose, 1500);
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleClose}
      title="create-market"
      size="xl"
      footer={
        <Flex w="full" align="center">
          {user && step > 1 && (
            <Button variant="ghost" mr="auto" onClick={() => setStep((s) => s - 1)} color="text" size="sm">
              Back
            </Button>
          )}
          <Button variant="ghost" ml="auto" mr={3} onClick={handleClose} color="text" size="sm">
            Close
          </Button>
          {user && step < 3 && (
            <Button
              bg="primary"
              color="background"
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              isDisabled={step === 2 && shape === "sports" && !selectedEvent}
            >
              Next
            </Button>
          )}
          {user && step === 3 && (
            <Button
              bg="primary"
              color="background"
              size="sm"
              isLoading={isPending}
              isDisabled={!assembled}
              onClick={handleSubmit}
            >
              {dryRun ? "Simulate creation" : "Create market"}
            </Button>
          )}
        </Flex>
      }
    >
      <Box p={4} color="text">
        <HStack spacing={2} mb={4} align="center">
          <HStack spacing={1}>
            {[1, 2, 3].map((n) => (
              <Box key={n} w={6} h={1.5} borderRadius="full" bg={step >= n ? "primary" : "subtle"} />
            ))}
          </HStack>
          {dryRun && (
            <Badge bg="warning" color="background">
              DRY RUN
            </Badge>
          )}
        </HStack>
        <Box>
          {!user ? (
            <ConnectWalletPrompt action="create a market" />
          ) : step === 1 ? (
            <VStack align="stretch" spacing={3}>
              <Text color="dim" fontSize="sm">
                Question shape
              </Text>
              {SHAPE_CARDS.map((c) => (
                <Box
                  key={c.value}
                  as="button"
                  textAlign="left"
                  p={4}
                  borderRadius="md"
                  border="1px solid"
                  borderColor={shape === c.value ? "primary" : "border"}
                  bg={shape === c.value ? "panelHover" : "transparent"}
                  onClick={() => setShape(c.value)}
                >
                  <Text fontWeight={700}>{c.title}</Text>
                  <Text color="dim" fontSize="sm">
                    {c.desc}
                  </Text>
                </Box>
              ))}
            </VStack>
          ) : step === 2 ? (
            <VStack align="stretch" spacing={3}>
              <FormControl isRequired>
                <FormLabel>Category</FormLabel>
                <Select
                  {...inputStyle}
                  value={shape === "sports" ? "sports" : category}
                  onChange={(e) => setCategory(e.target.value)}
                  isDisabled={shape === "sports"}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FormControl>

              {shape === "sports" && (
                <>
                  <Grid templateColumns="1fr 1fr" gap={3}>
                    <FormControl isRequired>
                      <FormLabel>League</FormLabel>
                      <Select
                        {...inputStyle}
                        value={league}
                        onChange={(e) => {
                          setLeague(e.target.value);
                          setEventId("");
                        }}
                      >
                        {SPORTS_LEAGUES.map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl isRequired>
                      <FormLabel>Bet type</FormLabel>
                      <Select
                        {...inputStyle}
                        value={betType}
                        onChange={(e) => setBetType(e.target.value as SportsBetType)}
                      >
                        {SPORTS_BET_TYPES.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                            {b.auto ? " (auto)" : ""}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <FormControl isRequired>
                    <FormLabel>Event</FormLabel>
                    <Select
                      {...inputStyle}
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      placeholder={eventsLoading ? "Loading events…" : "Select an event"}
                    >
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.homeTeam} vs {ev.awayTeam} —{" "}
                          {new Date(ev.commenceTime).toLocaleString()}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  {eventsError ? (
                    <HStack spacing={2}>
                      <Text color="error" fontSize="sm">
                        Couldn&apos;t load events for {league}.
                      </Text>
                      <Button size="xs" variant="outline" borderColor="border" color="text" onClick={() => refetchEvents()}>
                        Retry
                      </Button>
                    </HStack>
                  ) : (
                    events.length === 0 &&
                    !eventsLoading && (
                      <Text color="dim" fontSize="sm">
                        No upcoming events for {league}.
                      </Text>
                    )
                  )}
                  {autoResolve ? (
                    <Text color="success" fontSize="sm">
                      Auto-resolves from The Odds API final score. Outcomes and
                      close/resolve times come from the event.
                    </Text>
                  ) : (
                    <Grid templateColumns="1fr 1fr" gap={3}>
                      <FormControl isRequired>
                        <FormLabel>YES label</FormLabel>
                        <Input {...inputStyle} value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} />
                      </FormControl>
                      <FormControl isRequired>
                        <FormLabel>NO label</FormLabel>
                        <Input {...inputStyle} value={noLabel} onChange={(e) => setNoLabel(e.target.value)} />
                      </FormControl>
                    </Grid>
                  )}
                </>
              )}

              {shape === "multi" && (
                <FormControl isRequired>
                  <FormLabel>Participants</FormLabel>
                  <Textarea
                    {...inputStyle}
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="One per line, or comma separated"
                  />
                  <Text color="dim" fontSize="xs" mt={1}>
                    At least two participants. One winner.
                  </Text>
                </FormControl>
              )}

              {shape === "binary" && (
                <Grid templateColumns="1fr 1fr" gap={3}>
                  <FormControl isRequired>
                    <FormLabel>YES label</FormLabel>
                    <Input {...inputStyle} value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>NO label</FormLabel>
                    <Input {...inputStyle} value={noLabel} onChange={(e) => setNoLabel(e.target.value)} />
                  </FormControl>
                </Grid>
              )}

              <FormControl isRequired={!autoResolve}>
                <FormLabel>Question</FormLabel>
                <Input
                  {...inputStyle}
                  value={title}
                  maxLength={200}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={autoResolve ? "Auto-filled from the event (optional)" : "Will …?"}
                />
              </FormControl>
              <FormControl isRequired={!autoResolve}>
                <FormLabel>Description</FormLabel>
                <Textarea
                  {...inputStyle}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Context and how each outcome resolves."
                />
              </FormControl>
            </VStack>
          ) : (
            // step 3: economics + review
            <VStack align="stretch" spacing={3}>
              <Grid templateColumns="1fr 1fr" gap={3}>
                <FormControl isRequired>
                  <FormLabel>Token</FormLabel>
                  <Select {...inputStyle} value={token} onChange={(e) => setToken(e.target.value as MarketToken)}>
                    <option value="HIVE">HIVE</option>
                    <option value="HBD">HBD</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Your side</FormLabel>
                  <Select {...inputStyle} value={creatorSide} onChange={(e) => setCreatorSide(e.target.value)}>
                    {outcomesForSide.map((o) => (
                      <option key={o} value={o}>
                        {labelsForSide[o] || o}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Opening bet ({token})</FormLabel>
                  <Input {...inputStyle} type="number" value={openingBetAmount} onChange={(e) => setOpeningBetAmount(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Stake cap ({token})</FormLabel>
                  <Input {...inputStyle} type="number" value={stakeCap} onChange={(e) => setStakeCap(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Min participants</FormLabel>
                  <Input {...inputStyle} type="number" value={minParticipants} onChange={(e) => setMinParticipants(e.target.value)} />
                </FormControl>
              </Grid>

              {autoResolve ? (
                <Text color="dim" fontSize="sm">
                  Betting closes at kickoff and resolves automatically after the
                  match — set from the selected event.
                </Text>
              ) : (
                <Grid templateColumns="1fr 1fr" gap={3}>
                  <FormControl isRequired>
                    <FormLabel>Betting closes</FormLabel>
                    <Input {...inputStyle} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Resolves</FormLabel>
                    <Input {...inputStyle} type="datetime-local" value={resolvesAt} onChange={(e) => setResolvesAt(e.target.value)} />
                  </FormControl>
                </Grid>
              )}

              <Box bg="subtle" borderRadius="md" p={3}>
                <Text fontWeight={600} mb={1}>
                  {assembled?.title || "—"}
                </Text>
                <Text color="dim" fontSize="sm">
                  {assembled?.outcomes.length ?? 0} outcomes ·{" "}
                  {assembled?.resolutionType === "auto" ? "auto-resolve" : "manual"} ·{" "}
                  {assembled?.category}
                </Text>
              </Box>

              {error && (
                <Text color="error" fontSize="sm">
                  {error}
                </Text>
              )}
              {status === "success" && (
                <Text color="success" fontSize="sm">
                  {dryRun
                    ? "Dry run complete — see console for the transaction ops."
                    : `Market created!${txId ? ` (${txId})` : ""}`}
                </Text>
              )}
            </VStack>
          )}
        </Box>
      </Box>
    </SkateModal>
  );
}
