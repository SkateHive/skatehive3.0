import { useEffect, useRef } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  VStack,
  Text,
  Button,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import type { SavingsJar } from "@/hooks/wallet/useSavingsJars";

const CONFETTI_COLORS = ["#a7ff00", "#A8FF60", "#fff200"];
const CONFETTI_MS = 3200;

interface JarCelebrationProps {
  jar: SavingsJar | null;
  onClose: () => void;
}

/**
 * Hitting a goal is an event: confetti + a social hook ("post about it")
 * that turns saving into content for the community.
 */
export function JarCelebration({ jar, onClose }: JarCelebrationProps) {
  const t = useTranslations("cofrinhos");
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!jar) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const colors = [...CONFETTI_COLORS, jar.color];
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 4 + Math.random() * 5,
      h: 6 + Math.random() * 8,
      vy: 1.6 + Math.random() * 2.4,
      vx: (Math.random() - 0.5) * 1.6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (now - start < CONFETTI_MS) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [jar]);

  if (!jar) return null;

  return (
    <Modal isOpen={!!jar} onClose={onClose} isCentered size="sm">
      <ModalOverlay bg="blackAlpha.800" />
      <ModalContent
        bg="background"
        border="2px solid"
        borderColor="primary"
        borderRadius="none"
        overflow="hidden"
        position="relative"
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          aria-hidden
        />
        <ModalBody py={8} position="relative">
          <VStack spacing={3} textAlign="center">
            <Text fontSize="4xl" lineHeight={1}>
              {jar.icon}
            </Text>
            <Text
              fontSize="lg"
              fontWeight="black"
              color="primary"
              fontFamily="mono"
              textTransform="uppercase"
              letterSpacing="widest"
            >
              {t("celebrationTitle")}
            </Text>
            <Text fontSize="sm" color="text" fontFamily="mono" lineHeight="tall">
              {tVars(t("celebrationBody"), {
                name: jar.name,
                target: (jar.target_hbd ?? 0).toFixed(3),
              })}
            </Text>
            <VStack spacing={2} w="100%" pt={2}>
              <Button
                w="100%"
                bg="primary"
                color="background"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wide"
                onClick={() => {
                  onClose();
                  router.push("/compose");
                }}
                _hover={{ bg: "accent" }}
              >
                {t("celebrationShare")}
              </Button>
              <Button
                w="100%"
                variant="outline"
                borderColor="primary"
                color="primary"
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wide"
                onClick={onClose}
                _hover={{ bg: "muted" }}
              >
                {t("celebrationKeep")}
              </Button>
            </VStack>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
