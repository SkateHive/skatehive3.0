"use client";

import {
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Image,
  ButtonGroup,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { useState, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  ConnectionLineType,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";
import { SortOption } from "@/types/airdrop";
import useIsMobile from "@/hooks/useIsMobile";
import { useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import { memo } from "react";

// Custom centered node component for perfect edge anchoring
const CenteredNode = memo(({ data }: any) => {
  return (
    <Box position="relative">
      {data.label}
      {/* Invisible handles positioned at the exact center */}
      <Handle
        type="source"
        position={Position.Right}
        id="center-source"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "transparent",
          border: "none",
          width: "1px",
          height: "1px",
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="center-target"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "transparent",
          border: "none",
          width: "1px",
          height: "1px",
        }}
      />
    </Box>
  );
});

CenteredNode.displayName = "CenteredNode";

// Define nodeTypes and edgeTypes outside component to prevent recreation
const nodeTypes = {
  centered: CenteredNode,
};
const edgeTypes = {};

interface PreviewStepProps {
  selectedToken: string;
  totalAmount: string;
  sortOption: SortOption;
  airdropUsers: any[];
  isHiveToken: boolean;
  onBack: () => void;
  onNext: () => void;
}

export function PreviewStep({
  selectedToken,
  totalAmount,
  airdropUsers,
}: PreviewStepProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<"table" | "flow">("table");

  // Get user connection status
  const { user } = useAioha();
  const { isConnected: isEthereumConnected, address: ethereumAddress } =
    useAccount();

  // Create React Flow nodes and edges for neural network visualization
  const { nodes, edges } = useMemo(() => {
    const centerX = 0;
    const centerY = 0;
    const radius = 220;
    const senderNodeSize = 64;
    const recipientNodeSize = 54;
    const angleStep = (2 * Math.PI) / Math.min(airdropUsers.length, 12);

    // Central node (airdropper/sender) - with centered handles
    const centralNode: Node = {
      id: "sender",
      type: "centered",
      position: { x: centerX - 30, y: centerY - 30 }, // 60px avatar centered
      data: {
        label: user ? (
          <Image
            src={`https://images.hive.blog/u/${user}/avatar`}
            alt={user}
            w="60px"
            h="60px"
            borderRadius="full"
            objectFit="cover"
            border="3px solid #667eea"
            boxShadow="0 4px 16px rgba(102, 126, 234, 0.5)"
            bg="white"
          />
        ) : isEthereumConnected && ethereumAddress ? (
          <Box
            w="60px"
            h="60px"
            borderRadius="full"
            border="3px solid #667eea"
            boxShadow="0 4px 16px rgba(102, 126, 234, 0.5)"
            overflow="hidden"
            bg="white"
          >
            <Avatar
              address={ethereumAddress as `0x${string}`}
              className="w-full h-full"
            />
          </Box>
        ) : (
          <Box
            w="60px"
            h="60px"
            borderRadius="full"
            border="3px solid #667eea"
            boxShadow="0 4px 16px rgba(102, 126, 234, 0.5)"
            bg="#667eea"
            display="flex"
            alignItems="center"
            justifyContent="center"
            fontSize="xl"
            color="white"
          >
            🛹
          </Box>
        ),
      },
      style: {
        background: "transparent",
        border: "none",
        width: 60,
        height: 60,
        zIndex: 10,
      },
    };

    // Recipient nodes - perfectly balanced circular pattern
    const recipientNodes: Node[] = airdropUsers
      .slice(0, 12)
      .map((user, index) => {
        const angle = index * angleStep;
        const x = centerX + Math.cos(angle) * radius - recipientNodeSize / 2;
        const y = centerY + Math.sin(angle) * radius - recipientNodeSize / 2;

        return {
          id: `user-${index}`,
          type: "centered",
          position: { x, y },
          data: {
            label: (
              <Box
                w="50px"
                h="50px"
                borderRadius="full"
                overflow="hidden"
                border={`2px solid ${
                  index < 3 ? "#ffd700" : index < 8 ? "#4a90e2" : "#cd7f32"
                }`}
                bg="white"
                position="relative"
              >
                <Image
                  src={`https://images.hive.blog/u/${user.hive_author}/avatar/small`}
                  alt={user.hive_author}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              </Box>
            ),
          },
          style: {
            background: "transparent",
            border: "none",
            width: recipientNodeSize,
            height: recipientNodeSize,
            padding: 2,
            zIndex: 5,
          },
        };
      });

    // Edges with explicit center handle anchoring and amount labels
    const nodeEdges: Edge[] = airdropUsers.slice(0, 12).map((_, index) => ({
      id: `edge-${index}`,
      source: "sender",
      target: `user-${index}`,
      sourceHandle: "center-source",
      targetHandle: "center-target",
      type: "straight",
      animated: true,
      label: `${(parseFloat(totalAmount) / airdropUsers.length).toFixed(2)} ${selectedToken}`,
      labelStyle: {
        fill: index < 3 ? "#ffd700" : index < 8 ? "#4a90e2" : "#cd7f32",
        fontWeight: "bold",
        fontSize: "10px",
        background: "rgba(0, 0, 0, 0.8)",
        padding: "2px 6px",
        borderRadius: "4px",
        color: "white",
      },
      labelBgStyle: {
        fill: "rgba(0, 0, 0, 0.8)",
        fillOpacity: 0.9,
      },
      style: {
        stroke: index < 3 ? "#ffd700" : index < 8 ? "#4a90e2" : "#cd7f32",
        strokeWidth: 2, // Consistent thickness for all lines
        strokeOpacity: 0.9,
        strokeDasharray: "6,3",
      },
    }));

    return {
      nodes: [centralNode, ...recipientNodes],
      edges: nodeEdges,
    };
  }, [
    airdropUsers,
    selectedToken,
    totalAmount,
    user,
    isEthereumConnected,
    ethereumAddress,
  ]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(edges);

  return (
    <>
      <VStack spacing={4} align="stretch">
        {/* View Toggle and Summary Card */}
        <VStack spacing={4} align="stretch">
          {/* View Toggle Buttons */}
          <HStack justify="space-between" align="center">
            <Text fontSize="lg" fontWeight="bold" color="primary">
              Recipients Preview
            </Text>
            <ButtonGroup size="sm" isAttached variant="outline">
              <Tooltip label="Table View" hasArrow>
                <IconButton
                  aria-label="Table view"
                  icon={<ViewIcon />}
                  onClick={() => setViewMode("table")}
                  colorScheme={viewMode === "table" ? "blue" : "gray"}
                  variant={viewMode === "table" ? "solid" : "outline"}
                />
              </Tooltip>
              <Tooltip label="Network View" hasArrow>
                <IconButton
                  aria-label="Network view"
                  icon={<ViewOffIcon />}
                  onClick={() => setViewMode("flow")}
                  colorScheme={viewMode === "flow" ? "blue" : "gray"}
                  variant={viewMode === "flow" ? "solid" : "outline"}
                />
              </Tooltip>
            </ButtonGroup>
          </HStack>
        </VStack>

        {/* Content Views */}
        {viewMode === "table" ? (
          // Table View (existing implementation)
          airdropUsers.length <= 20 ? (
            <TableContainer>
              <Table size="sm" variant="simple">
                <Thead>
                  <Tr>
                    <Th color="textSecondary">Rank</Th>
                    <Th color="textSecondary">User</Th>
                    <Th color="textSecondary">Points</Th>
                    <Th color="textSecondary">Amount</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {airdropUsers.map((user, index) => (
                    <Tr key={user.hive_author + index}>
                      <Td>
                        <Badge colorScheme="blue" fontSize="xs">
                          #{index + 1}
                        </Badge>
                      </Td>
                      <Td>
                        <HStack>
                          <Image
                            src={`https://images.hive.blog/u/${user.hive_author}/avatar/small`}
                            alt={user.hive_author}
                            borderRadius="full"
                            boxSize="24px"
                            objectFit="cover"
                          />
                          <Text fontSize="sm" color="text" fontWeight="medium">
                            {user.hive_author}
                          </Text>
                        </HStack>
                      </Td>
                      <Td>
                        <Text fontSize="sm" color="textSecondary">
                          {user.points?.toFixed(0) || 0}
                        </Text>
                      </Td>
                      <Td>
                        <Text
                          fontSize="sm"
                          color="primary"
                          fontWeight="semibold"
                        >
                          {(
                            parseFloat(totalAmount) / airdropUsers.length
                          ).toFixed(2)}{" "}
                          {selectedToken}
                        </Text>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          ) : (
            <VStack spacing={2} align="stretch" maxH="400px" overflowY="auto">
              {airdropUsers.map((user, index) => (
                <HStack
                  key={user.hive_author + index}
                  p={3}
                  bg="cardBg"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="border"
                  justify="space-between"
                >
                  <HStack spacing={3}>
                    <Badge colorScheme="blue" fontSize="xs">
                      #{index + 1}
                    </Badge>
                    <Image
                      src={`https://images.hive.blog/u/${user.hive_author}/avatar/small`}
                      alt={user.hive_author}
                      borderRadius="full"
                      boxSize="32px"
                      objectFit="cover"
                      fallback={
                        <Box
                          w="32px"
                          h="32px"
                          borderRadius="full"
                          bg="primary"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          color="background"
                          fontSize="sm"
                          fontWeight="bold"
                        >
                          {user.hive_author.charAt(0).toUpperCase()}
                        </Box>
                      }
                    />
                    <VStack spacing={0} align="start">
                      <Text fontSize="sm" color="text" fontWeight="medium">
                        {user.hive_author}
                      </Text>
                      <Text fontSize="xs" color="textSecondary">
                        {user.points?.toFixed(0) || 0} points
                      </Text>
                    </VStack>
                  </HStack>
                  <Text fontSize="sm" color="primary" fontWeight="semibold">
                    {(parseFloat(totalAmount) / airdropUsers.length).toFixed(2)}{" "}
                    {selectedToken}
                  </Text>
                </HStack>
              ))}
            </VStack>
          )
        ) : (
          // React Flow Network View
          <Box
            h="500px"
            w="100%"
            border="1px solid"
            borderColor="border"
            borderRadius="md"
            overflow="hidden"
            bg="transparent"
            position="relative"
          >
            <Box
              position="absolute"
              inset={0}
              zIndex={0}
              pointerEvents="none"
              bgImage="url('/ogimage.png')"
              bgSize="cover"
              bgPosition="center"
              opacity={0.15}
            />
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              connectionLineType={ConnectionLineType.Straight}
              fitView
              fitViewOptions={{
                padding: 0.2,
                includeHiddenNodes: true,
                minZoom: 0.5,
                maxZoom: 1.5,
              }}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              attributionPosition="bottom-left"
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnDoubleClick={false}
              panOnDrag={true}
              zoomOnPinch={true}
              zoomOnScroll={true}
              preventScrolling={false}
              minZoom={0.3}
              maxZoom={2}
              style={{
                background: "transparent",
                position: "relative",
                zIndex: 1,
              }}
            >
              <Background color="rgba(235, 35, 208, 1)" gap={100} size={0.5} />

              <Controls
                position="top-right"
                showInteractive={false}
                showZoom={true}
                showFitView={true}
              />
            </ReactFlow>
          </Box>
        )}

        {/* Legend for Network View */}
        {viewMode === "flow" && (
          <Box
            bg="cardBg"
            p={3}
            borderRadius="md"
            border="1px solid"
            borderColor="border"
          >
            <Text fontSize="sm" fontWeight="bold" mb={2} color="primary">
              Airdrop Flow Legend
            </Text>
            <HStack spacing={4} flexWrap="wrap">
              <HStack spacing={2}>
                <Box w={3} h={3} bg="#667eea" borderRadius="full" />
                <Text fontSize="xs">Sender (You)</Text>
              </HStack>
              <HStack spacing={2}>
                <Box w={3} h={3} bg="#ffd700" borderRadius="full" />
                <Text fontSize="xs">Top 3 Recipients</Text>
              </HStack>
              <HStack spacing={2}>
                <Box w={3} h={3} bg="#4a90e2" borderRadius="full" />
                <Text fontSize="xs">Top 8 Recipients</Text>
              </HStack>
              <HStack spacing={2}>
                <Box w={3} h={3} bg="#cd7f32" borderRadius="full" />
                <Text fontSize="xs">Other Recipients</Text>
              </HStack>
            </HStack>
            <Text fontSize="xs" color="textSecondary" mt={2}>
              * Showing top 12 recipients in network view for clarity
            </Text>
          </Box>
        )}
      </VStack>
    </>
  );
}
