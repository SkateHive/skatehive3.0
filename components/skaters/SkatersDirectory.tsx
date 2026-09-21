"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Center,
  Container,
  Flex,
  HStack,
  Heading,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Link as ChakraLink,
  Select,
  SimpleGrid,
  Spacer,
  Text,
  Tooltip,
  VStack,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { FaGlobeAmericas, FaList, FaLocationArrow, FaMapMarkedAlt, FaSearch } from "react-icons/fa";
import type { IconType } from "react-icons";
import { useTranslations } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import { getCountryFlag } from "@/lib/utils/countryData";
import { countrySlug } from "@/lib/skaters/geo";
import {
  NEAR_SORT_KEY,
  SORT_OPTIONS,
  activityTier,
  distanceFrom,
  filterSkaters,
  groupByPlace,
  sortSkaters,
} from "@/lib/skaters/directory";
import type { ActivityTier, DirectoryData, Skater } from "@/lib/skaters/types";
import useFollowActor from "@/hooks/useFollowActor";
import useFollowingSet from "@/hooks/useFollowingSet";
import useGeolocation from "@/hooks/useGeolocation";
import SkaterCard from "./SkaterCard";

// Leaflet is ~150KB of JS that most visitors never open, so the map view only
// loads once someone actually asks for it.
const SkatersMap = dynamic(() => import("./SkatersMap"), {
  ssr: false,
  loading: () => (
    <Center py={20} border="1px solid" borderColor="border" borderRadius="lg" bg="panel">
      <Text color="dim" fontSize="sm">
        …
      </Text>
    </Center>
  ),
});

type ViewMode = "list" | "countries" | "map";

const VIEWS: { key: ViewMode; labelKey: string; icon: IconType }[] = [
  { key: "list", labelKey: "skaters.viewList", icon: FaList },
  { key: "countries", labelKey: "skaters.viewCountries", icon: FaGlobeAmericas },
  { key: "map", labelKey: "skaters.viewMap", icon: FaMapMarkedAlt },
];

const TIERS: { key: ActivityTier | null; labelKey: string }[] = [
  { key: null, labelKey: "skaters.tierAll" },
  { key: "active", labelKey: "skaters.tierActive" },
  { key: "recent", labelKey: "skaters.tierRecent" },
  { key: "quiet", labelKey: "skaters.tierQuiet" },
  { key: "dormant", labelKey: "skaters.tierDormant" },
];

/** Country pills shown before the "show all" toggle. */
const COUNTRY_PILL_LIMIT = 10;
/** How many cards render at once, and how many more each "load more" adds. */
const PAGE_SIZE = 30;
/** Cap on the "skating right now" rail — two rows at the widest grid. */
const ACTIVE_RAIL_SIZE = 6;

function isViewMode(value: string | null): value is ViewMode {
  return value === "list" || value === "countries" || value === "map";
}

function isTier(value: string | null): value is ActivityTier {
  return value === "active" || value === "recent" || value === "quiet" || value === "dormant";
}

export interface SkatersDirectoryProps {
  data: DirectoryData;
  /**
   * Set on /skaters/[country]: the country filter becomes part of the route
   * instead of a pill, so the page has one canonical URL for search engines.
   */
  lockedCountry?: string;
}

export default function SkatersDirectory({ data, lockedCountry }: SkatersDirectoryProps) {
  const t = useTranslations();
  const router = useRouter();

  // Who the viewer is, and everyone they already follow — both resolved once
  // for the whole grid rather than once per card.
  const { actor, statusActor, isLiteUser, useStoredPostingKey } = useFollowActor();
  const { following, markFollowing } = useFollowingSet(statusActor);

  // Asked for on a button press only, never on mount.
  const { origin, state: geoState, locate, clear: clearOrigin } = useGeolocation();

  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string | null>(lockedCountry ?? null);
  const [tier, setTier] = useState<ActivityTier | null>(null);
  const [sortKey, setSortKey] = useState("active");
  const [view, setView] = useState<ViewMode>("list");
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Guards the URL writer below: on mount the reader and the writer would
  // otherwise both run, and the writer (still holding the default state) would
  // wipe the query string off a shared link before the reader's state landed.
  const [urlApplied, setUrlApplied] = useState(false);

  // Filters come out of the query string AFTER mount, deliberately.
  //
  // Reading them with useSearchParams() during render would opt this whole
  // subtree out of static rendering, and the prerendered HTML would contain the
  // loading fallback instead of ~1700 skaters — which is exactly the SEO
  // problem this page had before. Server-rendering the unfiltered directory and
  // then applying the shared link's filters costs one extra render and keeps
  // the HTML crawlable.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextQuery = params.get("q");
    if (nextQuery) setQuery(nextQuery);
    if (!lockedCountry) {
      const nextCountry = params.get("country");
      if (nextCountry) setCountry(nextCountry);
    }
    const nextTier = params.get("activity");
    if (isTier(nextTier)) setTier(nextTier);
    const nextSort = params.get("sort");
    if (nextSort && SORT_OPTIONS.some((option) => option.key === nextSort)) setSortKey(nextSort);
    const nextView = params.get("view");
    if (isViewMode(nextView)) setView(nextView);
    setUrlApplied(true);
  }, [lockedCountry]);

  // Both the server render and the first client render use the snapshot's own
  // timestamp, so activity labels can't cause a hydration mismatch. After mount
  // we switch to the real clock.
  const [now, setNow] = useState(() => Date.parse(data.generatedAt) || Date.now());
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const deferredQuery = React.useDeferredValue(query);

  // Filters live in the URL so a filtered directory is a shareable link.
  // replaceState rather than router.push: typing in the search box should not
  // fill up the back button.
  useEffect(() => {
    if (!urlApplied) return;
    const params = new URLSearchParams();
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    if (!lockedCountry && country) params.set("country", country);
    if (tier) params.set("activity", tier);
    // "near" is deliberately not published: it depends on the viewer's own
    // position, so the reader below rejects it and the link would not reproduce
    // for whoever opens it.
    if (sortKey !== "active" && sortKey !== NEAR_SORT_KEY) params.set("sort", sortKey);
    if (view !== "list") params.set("view", view);
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [deferredQuery, country, tier, sortKey, view, lockedCountry, urlApplied]);

  useEffect(() => {
    if (origin) setSortKey(NEAR_SORT_KEY);
    else setSortKey((current) => (current === NEAR_SORT_KEY ? "active" : current));
  }, [origin]);

  // Any filter change scrolls the list back to the first page of results.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [deferredQuery, country, tier, sortKey]);

  const filtered = useMemo(
    () => filterSkaters(data.skaters, { query: deferredQuery, country, tier }, now),
    [data.skaters, deferredQuery, country, tier, now]
  );

  const sorted = useMemo(
    () => sortSkaters(filtered, sortKey, origin),
    [filtered, sortKey, origin]
  );
  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);

  const activeThisWeek = useMemo(
    () => data.skaters.filter((skater) => activityTier(skater, now) === "active"),
    [data.skaters, now]
  );

  const activeThisMonth = useMemo(
    () =>
      data.skaters.filter((skater) => {
        const currentTier = activityTier(skater, now);
        return currentTier === "active" || currentTier === "recent";
      }).length,
    [data.skaters, now]
  );

  const placeCount = useMemo(() => groupByPlace(data.skaters).length, [data.skaters]);

  // The numbers ARE the summary, so they replace the paragraph that used to
  // say the same thing in prose. Built off the memos above, not a second pass.
  const stats = useMemo(() => {
    const entries: { value: number; label: string; colorScheme: string }[] = [
      { value: data.skaters.length, label: t("skaters.statSkaters"), colorScheme: "green" },
    ];
    if (!lockedCountry) {
      entries.push({
        value: data.countries.length,
        label: t("skaters.statCountries"),
        colorScheme: "blue",
      });
    }
    entries.push({ value: placeCount, label: t("skaters.statPlaces"), colorScheme: "purple" });
    entries.push({ value: activeThisMonth, label: t("skaters.statActive"), colorScheme: "orange" });
    return entries;
  }, [data.skaters.length, data.countries.length, placeCount, activeThisMonth, lockedCountry, t]);

  // Countries present in the current result set, so the pills never offer a
  // filter that would come back empty.
  const countryOptions = useMemo(() => {
    if (lockedCountry) return [];
    const counts = new Map<string, number>();
    for (const skater of filterSkaters(data.skaters, { query: deferredQuery, tier }, now)) {
      if (!skater.country) continue;
      counts.set(skater.country, (counts.get(skater.country) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [data.skaters, deferredQuery, tier, now, lockedCountry]);

  const byCountry = useMemo(() => {
    const groups = new Map<string, Skater[]>();
    const nowhere: Skater[] = [];
    const unknown: Skater[] = [];
    for (const skater of sorted) {
      if (skater.country) {
        const bucket = groups.get(skater.country);
        if (bucket) bucket.push(skater);
        else groups.set(skater.country, [skater]);
      } else if (skater.nowhere) {
        nowhere.push(skater);
      } else {
        unknown.push(skater);
      }
    }
    const ordered = Array.from(groups.entries()).sort(
      (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])
    );
    return { ordered, nowhere, unknown };
  }, [sorted]);

  const hasFilters = Boolean(deferredQuery.trim() || (!lockedCountry && country) || tier);

  const clearFilters = useCallback(() => {
    setQuery("");
    if (!lockedCountry) setCountry(null);
    setTier(null);
  }, [lockedCountry]);

  const selectCountryFromMap = useCallback(
    (selected: string) => {
      if (lockedCountry) {
        router.push(`/skaters/${countrySlug(selected)}`);
        return;
      }
      setCountry(selected);
      setView("list");
    },
    [lockedCountry, router]
  );

  const renderGrid = (list: Skater[]) => (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
      {list.map((skater) => (
        <SkaterCard
          key={skater.username}
          skater={skater}
          t={t}
          now={now}
          viewer={actor}
          isFollowing={following?.has(skater.username) ?? false}
          isLiteUser={isLiteUser}
          useStoredPostingKey={useStoredPostingKey}
          onFollowChange={markFollowing}
          distanceKm={distanceFrom(origin, skater)}
        />
      ))}
    </SimpleGrid>
  );

  return (
    <Box minH="100vh" py={8}>
      <Container maxW="container.xl">
        {/* Hero. Same shape the directory has always had: display title, two
            lines of orientation, then the run of colour-coded badges. */}
        <VStack spacing={4} mb={8} textAlign="center">
          {lockedCountry && (
            <ChakraLink
              as={NextLink}
              href="/skaters"
              color="gray.500"
              fontSize="sm"
              fontWeight="semibold"
              _hover={{ color: "primary" }}
            >
              ← {t("skaters.backToDirectory")}
            </ChakraLink>
          )}

          <Heading
            as="h1"
            className="fretqwik-title"
            fontSize={{ base: "4xl", md: "6xl" }}
            fontWeight="extrabold"
            color="primary"
            letterSpacing="wider"
          >
            {lockedCountry
              ? tVars(t("skaters.countryHeading"), { country: lockedCountry })
              : t("skaters.title")}
          </Heading>

          <Text fontSize={{ base: "md", md: "lg" }} color="gray.400" maxW="2xl">
            {lockedCountry
              ? tVars(t("skaters.countrySubtitle"), { country: lockedCountry })
              : t("skaters.subtitle")}
          </Text>

          <Text fontSize="sm" color="gray.500" maxW="2xl">
            {t("skaters.spotMapPrompt")}{" "}
            <ChakraLink as={NextLink} href="/map" color="primary" fontWeight="semibold">
              {t("skaters.spotMapLink")}
            </ChakraLink>{" "}
            {t("skaters.spotMapSuffix")}
          </Text>

          <HStack spacing={3} flexWrap="wrap" justify="center">
            {stats.map((stat) => (
              <Badge key={stat.label} colorScheme={stat.colorScheme} fontSize="sm" px={3} py={1}>
                {stat.value} {stat.label}
              </Badge>
            ))}
          </HStack>
        </VStack>

        {/* Skating right now — only when nothing is filtered, so it stays a
            snapshot of the community rather than of the current search. */}
        {!hasFilters && view === "list" && (
          <Box mb={{ base: 10, md: 14 }}>
            <Flex align="baseline" gap={3} mb={4} flexWrap="wrap">
              <Heading as="h2" fontSize="md" color="primary" textTransform="uppercase" letterSpacing="wide">
                {t("skaters.activeNowTitle")}
              </Heading>
              <Text fontSize="xs" color="dim">
                {t("skaters.activeNowSubtitle")}
              </Text>
            </Flex>
            {activeThisWeek.length === 0 ? (
              <Text fontSize="sm" color="dim">
                {t("skaters.activeNowEmpty")}
              </Text>
            ) : (
              renderGrid(activeThisWeek.slice(0, ACTIVE_RAIL_SIZE))
            )}
          </Box>
        )}

        {/* Search, views and sort on one line; the filter pills below it. */}
        <Flex gap={4} mb={4} flexWrap="wrap" align="center">
          <InputGroup maxW={{ base: "100%", md: "360px" }}>
            <InputLeftElement pointerEvents="none">
              <FaSearch color="gray" aria-hidden="true" />
            </InputLeftElement>
            <Input
              aria-label={t("skaters.searchLabel")}
              placeholder={t("skaters.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              bg="rgba(0,0,0,0.3)"
              border="1px solid"
              borderColor="whiteAlpha.300"
              _focus={{ borderColor: "primary" }}
            />
          </InputGroup>

          <HStack spacing={2} role="group" aria-label={t("skaters.viewLabel")}>
            {VIEWS.map(({ key, labelKey, icon: Icon }) => (
              <Button
                key={key}
                size="sm"
                leftIcon={<Icon />}
                variant={view === key ? "solid" : "outline"}
                colorScheme="green"
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {t(labelKey)}
              </Button>
            ))}
          </HStack>

          <Select
            size="sm"
            maxW="180px"
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value)}
            aria-label={t("skaters.sortLabel")}
            bg="rgba(0,0,0,0.3)"
            borderColor="whiteAlpha.300"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {t(option.labelKey)}
              </option>
            ))}
            {origin && <option value={NEAR_SORT_KEY}>{t("skaters.sortNear")}</option>}
          </Select>

          <Button
            size="sm"
            leftIcon={<FaLocationArrow />}
            variant={origin ? "solid" : "outline"}
            colorScheme="blue"
            isLoading={geoState === "locating"}
            onClick={origin ? clearOrigin : locate}
          >
            {origin ? t("skaters.nearMeOn") : t("skaters.nearMe")}
          </Button>

          {(geoState === "denied" || geoState === "unavailable") && (
            <Text fontSize="xs" color="gray.500">
              {geoState === "denied" ? t("skaters.nearMeDenied") : t("skaters.nearMeUnavailable")}
            </Text>
          )}

          {hasFilters && (
            <Button size="sm" variant="ghost" color="gray.500" onClick={clearFilters}>
              {t("skaters.clearFilters")}
            </Button>
          )}
        </Flex>

        {/* Pills are Badges for the look but real buttons underneath, so they
            can be tabbed to and fired from the keyboard. */}
        <Flex gap={2} mb={3} flexWrap="wrap" align="center">
          <Text fontSize="sm" color="gray.500">
            {t("skaters.activityLabel")}:
          </Text>
          {TIERS.map(({ key, labelKey }) => (
            <Badge
              key={labelKey}
              as="button"
              type="button"
              cursor="pointer"
              colorScheme={tier === key ? "green" : "gray"}
              aria-pressed={tier === key}
              onClick={() => setTier(key)}
              fontSize="xs"
              px={3}
              py={1}
            >
              {t(labelKey)}
            </Badge>
          ))}
        </Flex>

        {!lockedCountry && countryOptions.length > 0 && (
          <Flex gap={2} mb={5} flexWrap="wrap" align="center">
            <Text fontSize="sm" color="gray.500">
              {t("skaters.countryLabel")}:
            </Text>
            <Badge
              as="button"
              type="button"
              cursor="pointer"
              colorScheme={country === null ? "green" : "gray"}
              aria-pressed={country === null}
              onClick={() => setCountry(null)}
              fontSize="xs"
              px={3}
              py={1}
            >
              {t("skaters.allCountries")}
            </Badge>
            {(showAllCountries ? countryOptions : countryOptions.slice(0, COUNTRY_PILL_LIMIT)).map(
              ({ name, count }) => (
                <Badge
                  key={name}
                  as="button"
                  type="button"
                  cursor="pointer"
                  colorScheme={country === name ? "green" : "gray"}
                  aria-pressed={country === name}
                  onClick={() => setCountry(country === name ? null : name)}
                  fontSize="xs"
                  px={3}
                  py={1}
                >
                  {getCountryFlag(name)} {name} ({count})
                </Badge>
              )
            )}
            {countryOptions.length > COUNTRY_PILL_LIMIT && (
              <Button
                size="xs"
                variant="ghost"
                color="gray.500"
                onClick={() => setShowAllCountries((value) => !value)}
              >
                {showAllCountries ? t("skaters.showFewerCountries") : t("skaters.showAllCountries")}
              </Button>
            )}
          </Flex>
        )}

        {/* Only the list view paginates, so only there does "showing X of Y"
            describe anything. The countries view carries a count on every
            group heading and the map carries one on its layer toggle. The
            total is the CURRENT result set: reading it off data.skaters made
            the line say "showing 30 of 1706" while a country filter had the
            grid down to 78. */}
        {view === "list" && (
          <Text fontSize="xs" color="gray.500" mb={5}>
            {tVars(t("skaters.showing"), {
              shown: visible.length,
              total: sorted.length,
            })}
          </Text>
        )}

        {/* Results */}
        {sorted.length === 0 ? (
          <Center py={16}>
            <VStack spacing={3}>
              <Text color="text" fontSize="lg">
                {lockedCountry ? t("skaters.emptyCountry") : t("skaters.noResults")}
              </Text>
              <Text color="dim" fontSize="sm">
                {t("skaters.noResultsHint")}
              </Text>
              {hasFilters && (
                <Button size="sm" colorScheme="green" onClick={clearFilters}>
                  {t("skaters.clearFilters")}
                </Button>
              )}
            </VStack>
          </Center>
        ) : view === "map" ? (
          <SkatersMap
            skaters={sorted}
            t={t}
            onSelectCountry={selectCountryFromMap}
            origin={origin}
          />
        ) : view === "countries" ? (
          // Every group is capped at PAGE_SIZE. Without it this view rendered
          // one card per skater with no pagination at all — ~900 of them on an
          // unfiltered /skaters, each carrying a FollowButton — while the list
          // view next to it was careful to draw 30. It is an overview: the
          // count on each heading gives the real size and the heading links to
          // that country's own page.
          <VStack spacing={8} align="stretch">
            {byCountry.ordered.map(([name, list]) => (
              <Box key={name} as="section">
                <Flex
                  align="center"
                  gap={3}
                  mb={3}
                  pb={2}
                  borderBottom="1px solid"
                  borderColor="border"
                  flexWrap="wrap"
                >
                  <Text fontSize="2xl" aria-hidden="true">
                    {getCountryFlag(name)}
                  </Text>
                  <Heading as="h2" fontSize="lg" color="primary">
                    <ChakraLink as={NextLink} href={`/skaters/${countrySlug(name)}`}>
                      {name}
                    </ChakraLink>
                  </Heading>
                  <Badge colorScheme="green" fontSize="xs">
                    {list.length}
                  </Badge>
                </Flex>
                {renderGrid(list.slice(0, PAGE_SIZE))}
                {list.length > PAGE_SIZE && (
                  <Text fontSize="xs" color="dim" mt={3}>
                    {tVars(t("skaters.moreInList"), { count: list.length - PAGE_SIZE })}
                  </Text>
                )}
              </Box>
            ))}

            {byCountry.nowhere.length > 0 && (
              <Box as="section">
                <Flex align="center" gap={3} mb={3} pb={2} borderBottom="1px solid" borderColor="border">
                  <Text fontSize="2xl" aria-hidden="true">
                    🛸
                  </Text>
                  <Heading as="h2" fontSize="lg" color="accent">
                    {t("skaters.somewhereOutThere")}
                  </Heading>
                  <Badge colorScheme="purple" fontSize="xs">
                    {byCountry.nowhere.length}
                  </Badge>
                </Flex>
                {renderGrid(byCountry.nowhere.slice(0, PAGE_SIZE))}
                {byCountry.nowhere.length > PAGE_SIZE && (
                  <Text fontSize="xs" color="dim" mt={3}>
                    {tVars(t("skaters.moreInList"), {
                      count: byCountry.nowhere.length - PAGE_SIZE,
                    })}
                  </Text>
                )}
              </Box>
            )}

            {byCountry.unknown.length > 0 && (
              <Box as="section">
                <Flex align="center" gap={3} mb={3} pb={2} borderBottom="1px solid" borderColor="border">
                  <Text fontSize="2xl" aria-hidden="true">
                    🌍
                  </Text>
                  <Heading as="h2" fontSize="lg" color="dim">
                    {t("skaters.locationUnknown")}
                  </Heading>
                  <Badge fontSize="xs">{byCountry.unknown.length}</Badge>
                </Flex>
                {renderGrid(byCountry.unknown.slice(0, PAGE_SIZE))}
                {byCountry.unknown.length > PAGE_SIZE && (
                  <Text fontSize="xs" color="dim" mt={3}>
                    {tVars(t("skaters.moreInList"), {
                      count: byCountry.unknown.length - PAGE_SIZE,
                    })}
                  </Text>
                )}
              </Box>
            )}
          </VStack>
        ) : (
          <>
            {renderGrid(visible)}
            {visible.length < sorted.length && (
              <Center mt={6}>
                <Button
                  colorScheme="green"
                  variant="outline"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  {t("skaters.loadMore")}
                </Button>
              </Center>
            )}
          </>
        )}


      </Container>
    </Box>
  );
}
