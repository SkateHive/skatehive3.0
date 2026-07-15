"use client";
import React, { useState } from "react";
import {
  Badge,
  Button,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import useCreateMarket from "@/hooks/useCreateMarket";
import type {
  CreateMarketFields,
  MarketOutcome,
  MarketToken,
} from "@/lib/predictions/types";
import ConnectWalletPrompt from "./ConnectWalletPrompt";

interface CreateMarketModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputStyle = { bg: "inputBg", borderColor: "inputBorder" } as const;

// datetime-local value (local time) → ISO string, or "" if empty/invalid.
function toIso(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export default function CreateMarketModal({ isOpen, onClose }: CreateMarketModalProps) {
  const { user } = useAioha();
  const { createMarket, status, error, txId, isPending, dryRun, reset } =
    useCreateMarket();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sports");
  const [token, setToken] = useState<MarketToken>("HIVE");
  const [yesLabel, setYesLabel] = useState("Yes");
  const [noLabel, setNoLabel] = useState("No");
  const [creatorSide, setCreatorSide] = useState<MarketOutcome>("YES");
  const [stakeCap, setStakeCap] = useState("1000");
  const [minParticipants, setMinParticipants] = useState("3");
  const [resolutionCriteria, setResolutionCriteria] = useState("");
  const [bettingClosesAt, setBettingClosesAt] = useState("");
  const [resolvesAt, setResolvesAt] = useState("");
  const [openingBetAmount, setOpeningBetAmount] = useState("1");

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const fields: CreateMarketFields = {
      title,
      description,
      category,
      token,
      outcomeLabels: { YES: yesLabel, NO: noLabel },
      creatorSide,
      stakeCap: Number(stakeCap),
      minParticipants: Number(minParticipants),
      resolutionCriteria,
      bettingClosesAt: toIso(bettingClosesAt),
      resolvesAt: toIso(resolvesAt),
      openingBetAmount: Number(openingBetAmount),
    };
    const res = await createMarket(fields);
    if (res?.success && !res.dryRun) {
      setTimeout(handleClose, 1500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg="panel" color="text">
        <ModalHeader>
          Create a market
          {dryRun && (
            <Badge ml={2} bg="warning" color="background">
              DRY RUN
            </Badge>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!user ? (
            <ConnectWalletPrompt action="create a market" />
          ) : (
            <VStack align="stretch" spacing={3}>
              <FormControl isRequired>
                <FormLabel>Question / title</FormLabel>
                <Input {...inputStyle} value={title} onChange={(e) => setTitle(e.target.value)} />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Description</FormLabel>
                <Textarea {...inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
              </FormControl>

              <Grid templateColumns="1fr 1fr" gap={3}>
                <FormControl isRequired>
                  <FormLabel>Category</FormLabel>
                  <Input {...inputStyle} value={category} onChange={(e) => setCategory(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Token</FormLabel>
                  <Select {...inputStyle} value={token} onChange={(e) => setToken(e.target.value as MarketToken)}>
                    <option value="HIVE">HIVE</option>
                    <option value="HBD">HBD</option>
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>YES label</FormLabel>
                  <Input {...inputStyle} value={yesLabel} onChange={(e) => setYesLabel(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>NO label</FormLabel>
                  <Input {...inputStyle} value={noLabel} onChange={(e) => setNoLabel(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Your side</FormLabel>
                  <Select {...inputStyle} value={creatorSide} onChange={(e) => setCreatorSide(e.target.value as MarketOutcome)}>
                    <option value="YES">{yesLabel} (YES)</option>
                    <option value="NO">{noLabel} (NO)</option>
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
                <FormControl isRequired>
                  <FormLabel>Betting closes</FormLabel>
                  <Input {...inputStyle} type="datetime-local" value={bettingClosesAt} onChange={(e) => setBettingClosesAt(e.target.value)} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Resolves</FormLabel>
                  <Input {...inputStyle} type="datetime-local" value={resolvesAt} onChange={(e) => setResolvesAt(e.target.value)} />
                </FormControl>
              </Grid>

              <FormControl isRequired>
                <FormLabel>Resolution criteria</FormLabel>
                <Textarea {...inputStyle} value={resolutionCriteria} onChange={(e) => setResolutionCriteria(e.target.value)} placeholder="How will this market be resolved?" />
              </FormControl>

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
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} color="text">
            Close
          </Button>
          {user && (
            <Button bg="primary" color="background" isLoading={isPending} onClick={handleSubmit}>
              {dryRun ? "Simulate creation" : "Create market"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
