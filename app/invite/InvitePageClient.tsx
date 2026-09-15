"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  Heading,
  Icon,
  Input,
  InputGroup,
  InputRightElement,
  Select,
  Spinner,
  Switch,
  Text,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaApple, FaCheck, FaTimes } from "react-icons/fa";
import {
  client,
  generatePassword,
  getPrivateKeys,
  validateAccountName,
  checkAccountExists,
} from "@/lib/invite/helpers";
import { buildInviteKeysBackup } from "@/lib/invite/backup";
import { useAioha } from "@aioha/react-ui";
import * as dhive from "@hiveio/dhive";
import useHiveAccount from "@/hooks/useHiveAccount";
import { useKeychainSDK } from "@/hooks/useKeychainSDK";
import { useTranslations } from "@/contexts/LocaleContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import SocialShareButtons from "@/components/invite/SocialShareButtons";
import InstagramStoryShare from "@/components/invite/InstagramStoryShare";
import { APP_CONFIG } from "@/config/app.config";

const randomLanguages = [
  { code: "EN", label: "English" },
  { code: "PT-BR", label: "Português (Brasil)" },
  { code: "ES", label: "Español" },
];

/**
 * "lite" creates a Skatehive account only — the friend logs in by email and
 * posts through the shared account until someone sponsors them. "hive" pays
 * the 3 HIVE fee and puts a real account on chain.
 */
type InviteMode = "lite" | "hive";

/** Fee the chain charges for account_create. */
const HIVE_ACCOUNT_FEE = 3;

/**
 * Selection has to survive a distracted reader, so the chosen card breathes
 * instead of just changing hue. The glow rides on `currentColor`, which the
 * card sets to the theme's primary — at blur 0 it hides behind the box, so the
 * animation fades in and out on its own.
 */
const selectedGlow = keyframes`
  0%, 100% { box-shadow: 0 0 2px 0 currentColor; }
  50%      { box-shadow: 0 0 12px 1px currentColor; }
`;

interface GeneratedAccount {
  username: string;
  masterPassword: string;
  keys: any;
}

/**
 * Reads the inviter's liquid HIVE straight from the chain. Returns null when
 * the lookup fails — an unreachable node must never block an invite that would
 * otherwise have gone through.
 */
async function fetchLiquidHive(username: string): Promise<number | null> {
  try {
    const [account] = await client.database.getAccounts([username]);
    if (!account) return null;
    const balance = parseFloat(String(account.balance));
    return Number.isFinite(balance) ? balance : null;
  } catch {
    return null;
  }
}

/**
 * Hive account names are lowercase and never padded. Normalizing as the user
 * types keeps the name we validate identical to the one we broadcast — the
 * validators lowercase internally, so "MyFriend" used to pass the checks and
 * then get rejected by the chain.
 */
function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/^@+/, "");
}

/** Numbered step marker — the theme caps font sizes, so hierarchy comes from
 *  weight, case and the dim index rather than from size. The uppercase label
 *  alone read as a category tag and left the reader to infer what the step
 *  wanted, so it carries a plain-language line underneath. */
function SectionLabel({
  index,
  label,
  subtitle,
}: {
  index: string;
  label: string;
  subtitle?: string;
}) {
  return (
    <Box mb={3}>
      <Flex align="baseline" gap={2}>
        <Text fontFamily="mono" fontSize="xs" color="primary">
          {index}
        </Text>
        <Text
          fontSize="sm"
          fontWeight="bold"
          color="text"
          textTransform="uppercase"
          letterSpacing="0.08em"
        >
          {label}
        </Text>
      </Flex>
      {subtitle && (
        <Text fontSize="xs" color="dim" mt={1} pl={6}>
          {subtitle}
        </Text>
      )}
    </Box>
  );
}

function StatusBox({
  tone,
  glyph,
  text,
}: {
  tone: "success" | "error";
  glyph: string;
  text: string;
}) {
  return (
    <Flex
      border="1px solid"
      borderColor={tone}
      borderLeftWidth="3px"
      bg="panel"
      px={4}
      py={3}
      gap={3}
      align="flex-start"
    >
      <Text fontFamily="mono" color={tone} lineHeight="1.6">
        {glyph}
      </Text>
      <Text fontSize="sm" color={tone} lineHeight="1.6">
        {text}
      </Text>
    </Flex>
  );
}

export default function InvitePageClient() {
  const t = useTranslations();
  const { user } = useAioha();
  const { user: appUser, isLoading: isSessionLoading } = useUserbaseAuth();
  const { hiveAccount, isLoading: isAccountLoading } = useHiveAccount(
    user || ""
  );
  const { KeychainSDK, KeychainRequestTypes, KeychainKeyTypes, isLoaded } =
    useKeychainSDK();
  const [mode, setMode] = useState<InviteMode>("lite");
  const [desiredUsername, setDesiredUsername] = useState("");
  const [desiredEmail, setDesiredEmail] = useState("");
  const [accountAvailable, setAccountAvailable] = useState(false);
  const [accountInvalid, setAccountInvalid] = useState<string | null>(null);
  const [isCheckedOnce, setIsCheckedOnce] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [generated, setGenerated] = useState<GeneratedAccount | null>(null);
  const [useAccountToken, setUseAccountToken] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState("EN");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [rescue, setRescue] = useState<GeneratedAccount | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const hasHiveLogin = Boolean(user) && Boolean(hiveAccount);
  // Lite invites now create an account and send mail on the sender's behalf, so
  // they need a signed-in sender to attribute and rate-limit against.
  const hasSession = Boolean(appUser);
  const actBalance = Number(hiveAccount?.pending_claimed_accounts ?? 0);

  // Cached balance drives the up-front warning; the click re-checks on chain.
  const liquidHive = hiveAccount ? parseFloat(String(hiveAccount.balance)) : NaN;
  const payingFee = mode === "hive" && !useAccountToken;
  const shortOnHive =
    payingFee && Number.isFinite(liquidHive) && liquidHive < HIVE_ACCOUNT_FEE;

  const feeShortfallMessage = useCallback(
    (balance: number) =>
      t('invite.notEnoughHive').replace('{balance}', `${balance.toFixed(3)} HIVE`),
    [t]
  );

  // Email validation helper
  const validateEmail = useCallback((email: string): string | null => {
    if (!email) return t('invite.emailRequired');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return t('invite.invalidEmail');
    return null;
  }, [t]);

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Paying with an ACT only works when the inviter actually holds one. Without
  // this the broadcast is accepted by the UI and rejected by the chain, which
  // is how invites silently died: no account, and therefore no email either.
  useEffect(() => {
    if (actBalance <= 0 && useAccountToken) {
      setUseAccountToken(false);
    }
  }, [actBalance, useAccountToken]);

  // A Hive invite needs a Hive session to sign it. If the session goes away
  // mid-flow, fall back to the mode that always works.
  useEffect(() => {
    if (mode === "hive" && !isAccountLoading && !hasHiveLogin) {
      setMode("lite");
    }
  }, [mode, hasHiveLogin, isAccountLoading]);

  // Debounced auto-check for username availability
  useEffect(() => {
    if (!isMounted) return;
    const checkUsername = async () => {
      if (!desiredUsername) {
        setIsCheckedOnce(false);
        setAccountAvailable(false);
        setAccountInvalid(null);
        return;
      }

      const isValidAccountName = validateAccountName(desiredUsername);
      if (isValidAccountName !== null) {
        setAccountInvalid(String(isValidAccountName));
        setIsCheckedOnce(true);
        setAccountAvailable(false);
        return;
      }

      setAccountInvalid("");
      setIsCheckingUsername(true);
      const isAvailable = await checkAccountExists(desiredUsername);
      setIsCheckedOnce(true);
      setAccountAvailable(isAvailable);
      setIsCheckingUsername(false);

      if (!isAvailable) {
        setAccountInvalid(t('invite.accountNotAvailable'));
      }
    };

    const debounceTimer = setTimeout(() => {
      checkUsername();
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [desiredUsername, isMounted, t]);

  // Keys are only meaningful for the on-chain path, and they must always match
  // the username currently in the field.
  useEffect(() => {
    if (mode !== "hive" || !accountAvailable || !desiredUsername) {
      setGenerated(null);
      return;
    }
    setGenerated((current) => {
      if (current?.username === desiredUsername) return current;
      const masterPassword = generatePassword();
      return {
        username: desiredUsername,
        masterPassword,
        keys: getPrivateKeys(desiredUsername, masterPassword),
      };
    });
  }, [mode, accountAvailable, desiredUsername]);

  // Validate email on change
  useEffect(() => {
    if (!isMounted) return;
    if (desiredEmail) {
      const error = validateEmail(desiredEmail);
      setEmailError(error);
    } else {
      setEmailError(null);
    }
  }, [desiredEmail, isMounted, validateEmail]);

  const resetFeedback = () => {
    setSuccessMessage("");
    setErrorMessage("");
    setRescue(null);
  };

  const downloadKeysBackup = (account: GeneratedAccount) => {
    // Same file the invite email attaches, so a rescued account and an emailed
    // one hand the friend the exact same document.
    const backup = buildInviteKeysBackup({
      createdby: user || "skatehive",
      desiredUsername: account.username,
      masterPassword: account.masterPassword,
      keys: account.keys,
    });
    const blob = new Blob([backup], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `KEYS-BACKUP-${account.username}-SKATEHIVE.TXT`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const validateForm = () => {
    const emailValidationError = validateEmail(desiredEmail);
    if (emailValidationError) {
      setErrorMessage(emailValidationError);
      setEmailError(emailValidationError);
      return false;
    }
    if (!desiredUsername) {
      setErrorMessage(t('invite.forgotUsername'));
      return false;
    }
    if (!accountAvailable) {
      setErrorMessage(t('invite.waitingValidation'));
      return false;
    }
    return true;
  };

  /**
   * Free path: creates the Skatehive-side account and mails the friend a login
   * link. No wallet, no Keychain, no fee — and it works for inviters who have
   * no Hive account of their own.
   */
  const handleCreateLiteAccount = async () => {
    resetFeedback();

    const emailValidationError = validateEmail(desiredEmail);
    if (emailValidationError) {
      setErrorMessage(emailValidationError);
      setEmailError(emailValidationError);
      return;
    }

    setLoading(true);
    try {
      // No handle is sent: the server derives it from the address, so the
      // sender cannot name their friend permanently — or reserve the good
      // names in bulk.
      const res = await fetch("/api/userbase/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: desiredEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data?.error || t('invite.liteInviteFailed'));
        return;
      }
      if (data?.already_member) {
        setSuccessMessage(t('invite.liteAlreadyMember'));
        return;
      }
      setSuccessMessage(
        t('invite.liteInviteSent').replace('{handle}', `@${data?.handle ?? ""}`)
      );
    } catch (error: any) {
      setErrorMessage(error?.message || t('invite.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Paid path: broadcasts account creation through Keychain, then mails the
   * keys. If the mail fails the account still exists, so the keys are handed
   * to the inviter instead of being lost with the page.
   */
  const handleCreateAccount = async () => {
    resetFeedback();
    if (!validateForm()) return;

    if (!generated) {
      setErrorMessage(t('invite.waitingValidation'));
      return;
    }

    if (useAccountToken && actBalance <= 0) {
      setErrorMessage(t('invite.actNoneAvailable'));
      return;
    }

    if (
      !isLoaded ||
      !KeychainSDK ||
      !KeychainRequestTypes ||
      !KeychainKeyTypes
    ) {
      setErrorMessage(t('invite.keychainNotLoaded'));
      return;
    }

    setLoading(true);
    try {
      // Re-read the balance rather than trusting the cached account, which the
      // hook may serve up to a day stale. Catching it here means a plain error
      // on the page instead of a Keychain prompt that dies on broadcast.
      if (!useAccountToken) {
        const balance = await fetchLiquidHive(String(user));
        if (balance !== null && balance < HIVE_ACCOUNT_FEE) {
          setErrorMessage(feeShortfallMessage(balance));
          return;
        }
      }

      const { username, masterPassword, keys } = generated;
      // Use Hive Keychain to broadcast account creation
      const keychain = new KeychainSDK(window);
      const authorities = {
        creator: String(user),
        new_account_name: username,
        owner: dhive.Authority.from(keys.ownerPubkey),
        active: dhive.Authority.from(keys.activePubkey),
        posting: dhive.Authority.from(keys.postingPubkey),
        memo_key: keys.memoPubkey,
        json_metadata: "",
        extensions: [],
      };
      const createAccountOperation: dhive.Operation = useAccountToken
        ? ["create_claimed_account", authorities]
        : ["account_create", { fee: "3.000 HIVE", ...authorities }];

      const formParamsAsObject = {
        type: KeychainRequestTypes.broadcast,
        username: user || "",
        operations: [createAccountOperation],
        method: KeychainKeyTypes.active,
      };
      const broadcast = await keychain.broadcast(formParamsAsObject);
      if (!broadcast.success) {
        setErrorMessage(broadcast.error + ": " + broadcast.message);
        return;
      }

      setSuccessMessage(t('invite.accountCreatedSendingEmail'));
      // Now send the invite email
      const payload = {
        to: desiredEmail,
        subject: `Welcome to Skatehive @${username}`,
        createdby: user,
        desiredUsername: username,
        masterPassword,
        keys,
        language: selectedLanguage,
      };
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(t('invite.inviteSentSuccess'));
        return;
      }

      // The fee is spent and the account is real, but nobody holds the keys
      // except this page. Surface them before they are gone.
      setSuccessMessage("");
      setRescue(generated);
      const code = typeof data?.code === "string" ? ` (${data.code})` : "";
      setErrorMessage((data.error || t('invite.inviteFailedRetry')) + code);
    } catch (error: any) {
      setErrorMessage(error.message || t('invite.unknownError'));
    } finally {
      setLoading(false);
    }
  };

  const emailReady = Boolean(desiredEmail) && emailError === null;
  const canSubmit =
    emailReady &&
    // The lite path only needs an address; the handle is derived server-side.
    (mode === "lite"
      ? hasSession
      : accountAvailable && Boolean(generated)) &&
    // While the rescue box is up the account already exists, so another click
    // would only burn a Keychain prompt on a name the chain will reject.
    rescue === null;
  const modes: Array<{
    id: InviteMode;
    title: string;
    description: string;
    badge: string;
    locked: boolean;
    notes: string[];
  }> = [
    {
      id: "lite",
      title: t('invite.modeLite'),
      description: t('invite.modeLiteDesc'),
      badge: t('invite.badgeFree'),
      locked: !hasSession,
      notes:
        !hasSession && !isSessionLoading ? [t('invite.modeLiteLocked')] : [],
    },
    {
      id: "hive",
      title: t('invite.modeHive'),
      description: t('invite.modeHiveDesc'),
      badge: useAccountToken ? "1 ACT" : `${HIVE_ACCOUNT_FEE} HIVE`,
      locked: !hasHiveLogin,
      notes: [
        ...(!hasHiveLogin && !isAccountLoading ? [t('invite.modeHiveLocked')] : []),
        ...(shortOnHive ? [feeShortfallMessage(liquidHive)] : []),
      ],
    },
  ];

  return (
    <Box p={{ base: 4, md: 8 }} maxW="container.md" mx="auto" bg="background">
      <VStack spacing={6} align="stretch">
        <Box>
          <Heading size="lg" color="primary">
            {t('invite.title')}
          </Heading>
          <Text fontSize="sm" color="dim" mt={2}>
            {t('invite.subtitle')}
          </Text>
          {mode === "hive" && desiredUsername && (
            <Text fontSize="sm" color="dim" mt={1} fontFamily="mono">
              &gt; @{desiredUsername}
            </Text>
          )}
        </Box>

        {/* 01 — account type */}
        <Box>
          <SectionLabel
            index="01"
            label={t('invite.stepType')}
            subtitle={t('invite.stepTypeSub')}
          />
          <VStack spacing={0} align="stretch">
            {modes.map((m) => {
              const selected = mode === m.id;
              return (
                <Box
                  key={m.id}
                  as="button"
                  type="button"
                  textAlign="left"
                  w="100%"
                  p={4}
                  mt={selected ? 0 : "-1px"}
                  position="relative"
                  zIndex={selected ? 1 : 0}
                  bg={selected ? "panelHover" : "panel"}
                  border="1px solid"
                  borderColor={selected ? "primary" : "border"}
                  borderLeftWidth={selected ? "4px" : "1px"}
                  borderLeftColor={selected ? "primary" : "border"}
                  color="primary"
                  animation={selected ? `${selectedGlow} 2.4s ease-in-out infinite` : undefined}
                  sx={{
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                      boxShadow: selected ? "0 0 6px 0 currentColor" : undefined,
                    },
                  }}
                  cursor={m.locked ? "not-allowed" : "pointer"}
                  _hover={m.locked ? undefined : { bg: "panelHover" }}
                  onClick={() => {
                    if (m.locked) return;
                    setMode(m.id);
                    resetFeedback();
                  }}
                >
                  <Flex align="center" gap={3}>
                    {/* Checkbox glyph, so selection does not rely on hue alone */}
                    <Text
                      fontFamily="mono"
                      fontWeight="bold"
                      color={selected ? "primary" : "dim"}
                    >
                      [{selected ? "x" : " "}]
                    </Text>
                    <Text
                      fontWeight="bold"
                      color={m.locked ? "dim" : selected ? "primary" : "text"}
                      flex="1"
                    >
                      {m.title}
                    </Text>
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      px={2}
                      py={1}
                      border="1px solid"
                      borderColor={selected ? "primary" : "border"}
                      color={selected ? "primary" : "dim"}
                      whiteSpace="nowrap"
                    >
                      {m.badge}
                    </Text>
                  </Flex>
                  <Text fontSize="sm" color="dim" mt={2} pl={7}>
                    {m.description}
                  </Text>
                  {m.notes.map((note) => (
                    <Text key={note} fontSize="sm" color="warning" mt={2} pl={7}>
                      ! {note}
                    </Text>
                  ))}
                </Box>
              );
            })}
          </VStack>
        </Box>

        {/* ACT option — only offered to inviters who actually hold a token */}
        {mode === "hive" && actBalance > 0 && (
          <Box p={4} bg="panel" border="1px solid" borderColor="border">
            <Flex align="center" gap={3}>
              <Switch
                isChecked={useAccountToken}
                onChange={() => setUseAccountToken(!useAccountToken)}
                colorScheme="green"
              />
              <Text fontSize="sm" color="primary" fontWeight="bold" flex="1">
                {useAccountToken ? t('invite.usingACT') : t('invite.paying3Hive')}
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="dim">
                {t('invite.actBalance')}: {actBalance}
              </Text>
            </Flex>
            <Accordion allowToggle>
              <AccordionItem border="none">
                <AccordionButton px={0} _hover={{ bg: "panelHover" }}>
                  <Box
                    as="span"
                    flex="1"
                    textAlign="left"
                    color="secondary"
                    fontSize="sm"
                  >
                    {t('invite.whatAreACTs')}
                  </Box>
                  <AccordionIcon color="secondary" />
                </AccordionButton>
                <AccordionPanel px={0} pb={2} color="dim" fontSize="sm">
                  {t('invite.actsDescription')}
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </Box>
        )}

        {/* 02 — who is being invited */}
        <Box>
          <SectionLabel
            index="02"
            label={t('invite.stepDetails')}
            subtitle={
              mode === "lite"
                ? t('invite.stepDetailsSubLite')
                : t('invite.stepDetailsSubHive')
            }
          />
          <Box p={4} bg="panel" border="1px solid" borderColor="border">
            <VStack spacing={5} align="stretch">
              {/* Only the paid path needs a name up front: it is burned on
                  chain. A lite invite derives the handle from the address. */}
              {mode === "hive" && (
                <FormControl>
                  <Flex align="baseline" justify="space-between" mb={2}>
                    <Text fontWeight="bold" color="text" fontSize="sm">
                      {t('invite.usernameLabel')}
                    </Text>
                    {isCheckedOnce && desiredUsername && (
                      <Text
                        fontSize="xs"
                        fontFamily="mono"
                        color={accountAvailable ? "success" : "error"}
                      >
                        {accountAvailable
                          ? t('invite.usernameAvailable')
                          : accountInvalid}
                      </Text>
                    )}
                  </Flex>
                  <InputGroup>
                    <Input
                      type="text"
                      placeholder={t('invite.usernamePlaceholder')}
                      value={desiredUsername}
                      onChange={(e) =>
                        setDesiredUsername(normalizeUsername(e.target.value))
                      }
                      fontFamily="mono"
                      bg="inputBg"
                      color="inputText"
                      borderColor={
                        isCheckedOnce && desiredUsername
                          ? accountAvailable
                            ? "success"
                            : "error"
                          : "inputBorder"
                      }
                      _placeholder={{ color: "inputPlaceholder" }}
                      _hover={{ borderColor: "primary" }}
                      _focus={{ borderColor: "primary", boxShadow: "none" }}
                    />
                    <InputRightElement>
                      {isCheckingUsername ? (
                        <Spinner size="sm" color="primary" />
                      ) : isCheckedOnce && desiredUsername ? (
                        accountAvailable ? (
                          <Icon as={FaCheck} color="success" boxSize={4} />
                        ) : (
                          <Icon as={FaTimes} color="error" boxSize={4} />
                        )
                      ) : null}
                    </InputRightElement>
                  </InputGroup>
                  <Text fontSize="xs" color="dim" mt={2}>
                    {t('invite.usernameHint')}
                  </Text>
                </FormControl>
              )}

              <FormControl isInvalid={emailError !== null && desiredEmail !== ""}>
                <Flex align="baseline" justify="space-between" mb={2}>
                  <Text fontWeight="bold" color="text" fontSize="sm">
                    {t('invite.friendsEmail')}
                  </Text>
                  {desiredEmail && emailError && (
                    <Text fontSize="xs" fontFamily="mono" color="error">
                      {emailError}
                    </Text>
                  )}
                </Flex>
                <InputGroup>
                  <Input
                    type="email"
                    placeholder={t('invite.emailPlaceholder')}
                    value={desiredEmail}
                    onChange={(e) => setDesiredEmail(e.target.value)}
                    fontFamily="mono"
                    bg="inputBg"
                    color="inputText"
                    borderColor={
                      desiredEmail
                        ? emailError
                          ? "error"
                          : "success"
                        : "inputBorder"
                    }
                    _placeholder={{ color: "inputPlaceholder" }}
                    _hover={{ borderColor: "primary" }}
                    _focus={{ borderColor: "primary", boxShadow: "none" }}
                  />
                  <InputRightElement>
                    {desiredEmail &&
                      (emailError ? (
                        <Icon as={FaTimes} color="error" boxSize={4} />
                      ) : (
                        <Icon as={FaCheck} color="success" boxSize={4} />
                      ))}
                  </InputRightElement>
                </InputGroup>
                <Text fontSize="xs" color="dim" mt={2}>
                  {mode === "lite"
                    ? t('invite.emailHintLite')
                    : t('invite.emailHintHive')}
                </Text>
              </FormControl>

              {/* Only the keys email is localized; the magic link is not. */}
              {mode === "hive" && (
                <FormControl>
                  <Text fontWeight="bold" color="text" fontSize="sm" mb={2}>
                    {t('invite.chooseLanguage')}
                  </Text>
                  <Select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    fontFamily="mono"
                    bg="inputBg"
                    color="inputText"
                    borderColor="inputBorder"
                    _hover={{ borderColor: "primary" }}
                    _focus={{ borderColor: "primary", boxShadow: "none" }}
                  >
                    {randomLanguages.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </Select>
                  <Text fontSize="xs" color="dim" mt={2}>
                    {t('invite.languageHint')}
                  </Text>
                </FormControl>
              )}
            </VStack>
          </Box>
        </Box>

        {/* Spells out the outcome before the irreversible click */}
        <Box
          bg="panel"
          borderLeft="3px solid"
          borderLeftColor="primary"
          px={4}
          py={3}
        >
          <Text
            fontSize="xs"
            color="dim"
            textTransform="uppercase"
            letterSpacing="0.1em"
            mb={1}
          >
            {t('invite.nextTitle')}
          </Text>
          <Text fontSize="sm" color="text">
            {mode === "lite" ? t('invite.nextLite') : t('invite.nextHive')}
          </Text>
        </Box>

        <Button
          bg="success"
          color="background"
          _hover={{ bg: "primary" }}
          onClick={mode === "lite" ? handleCreateLiteAccount : handleCreateAccount}
          isLoading={loading}
          isDisabled={!canSubmit}
          size="lg"
        >
          {mode === "lite" ? t('invite.liteSendButton') : t('invite.createButton')}
        </Button>

        {successMessage && (
          <StatusBox tone="success" glyph="✓" text={successMessage} />
        )}

        {errorMessage && (
          <StatusBox tone="error" glyph="✗" text={errorMessage} />
        )}

        {/* Last chance to save the keys of an account that is already on chain */}
        {rescue && (
          <Box border="1px solid" borderColor="warning" borderLeftWidth="3px" bg="panel">
            <Box bg="warning" color="background" px={4} py={2}>
              <Text fontWeight="bold" fontSize="sm">
                ! {t('invite.rescueTitle')}
              </Text>
            </Box>
            <VStack align="stretch" spacing={3} p={4}>
              <Text fontSize="sm" color="text">
                {t('invite.rescueBody')}
              </Text>
              <Box bg="inputBg" border="1px solid" borderColor="border" p={3}>
                <Text fontSize="xs" color="dim" textTransform="uppercase" letterSpacing="0.1em">
                  {t('invite.rescueUsername')}
                </Text>
                <Text fontSize="sm" color="text" fontFamily="mono" mb={3}>
                  {rescue.username}
                </Text>
                <Text fontSize="xs" color="dim" textTransform="uppercase" letterSpacing="0.1em">
                  {t('invite.rescueMasterPassword')}
                </Text>
                <Text fontSize="sm" color="text" fontFamily="mono" wordBreak="break-all">
                  {rescue.masterPassword}
                </Text>
              </Box>
              <Button
                bg="warning"
                color="background"
                _hover={{ bg: "primary" }}
                onClick={() => downloadKeysBackup(rescue)}
              >
                {t('invite.rescueDownload')}
              </Button>
              <Text fontSize="xs" color="dim">
                {t('invite.rescueSendTo')}
              </Text>
            </VStack>
          </Box>
        )}

        {/* 03 — sharing tools, useful to every visitor, Hive account or not */}
        <Box>
          <SectionLabel
            index="03"
            label={t('invite.stepShare')}
            subtitle={t('invite.stepShareSub')}
          />
          <VStack spacing={0} align="stretch">
            <Box p={4} bg="panel" border="1px solid" borderColor="border">
              <Text fontWeight="bold" color="text" fontSize="sm" mb={3}>
                {t('invite.getAppTitle')}
              </Text>
              <Button
                as="a"
                href={APP_CONFIG.APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                leftIcon={<Icon as={FaApple} />}
                bg="primary"
                color="background"
                _hover={{ bg: "success" }}
                size="md"
              >
                App Store
              </Button>
              <Text fontSize="xs" color="dim" mt={3}>
                {t('invite.getAppOther')}
              </Text>
            </Box>

            <Box
              p={4}
              mt="-1px"
              bg="panel"
              border="1px solid"
              borderColor="border"
              textAlign="center"
            >
              <Text color="dim" fontSize="sm" mb={4}>
                {t('invite.shareDescription')}
              </Text>
              {/* A story is the highest-reach share a skater has, so it gets
                  its own row above the link-based buttons rather than being
                  buried among them. */}
              <Flex justify="center" mb={4}>
                <InstagramStoryShare />
              </Flex>
              {/* Shares the site, not the store link: it works on every device,
                  and an iPhone friend who lands there gets the app banner. */}
              <SocialShareButtons />
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Box>
  );
}
