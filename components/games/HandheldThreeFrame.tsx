"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox, Text } from "@react-three/drei";

function HandheldScene() {
  return (
    <>
      {/* Lighting — clean, neutral, studio */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[0, 5, 8]} intensity={0.9} color="#ffffff" />
      <directionalLight position={[-4, 1, 3]} intensity={0.25} color="#c0c0cc" />
      <directionalLight position={[4, -1, 3]} intensity={0.18} color="#a0a0b0" />
      <directionalLight position={[0, -3, 6]} intensity={0.12} color="#ffffff" />
      <directionalLight position={[0, 0, -4]} intensity={0.25} color="#1a1a30" />

      <group>
        {/* ──── MAIN CHASSIS ──── */}
        <RoundedBox args={[12, 5.2, 0.55]} radius={0.25} smoothness={4} position={[0, 0, 0]}>
          <meshStandardMaterial color="#18181d" roughness={0.88} metalness={0.06} />
        </RoundedBox>

        {/* Front plate */}
        <RoundedBox args={[11.8, 5.0, 0.07]} radius={0.22} smoothness={4} position={[0, 0, 0.27]}>
          <meshStandardMaterial color="#1f1f26" roughness={0.8} metalness={0.08} />
        </RoundedBox>

        {/* ──── INTEGRATED GRIPS ──── */}
        <RoundedBox args={[2.2, 4.6, 0.85]} radius={0.45} smoothness={4} position={[-5.5, 0, -0.15]}>
          <meshStandardMaterial color="#18181d" roughness={0.9} metalness={0.05} />
        </RoundedBox>
        <RoundedBox args={[1.6, 4.3, 0.12]} radius={0.3} smoothness={4} position={[-5.2, 0, 0.26]}>
          <meshStandardMaterial color="#1c1c24" roughness={0.82} metalness={0.07} />
        </RoundedBox>

        <RoundedBox args={[2.2, 4.6, 0.85]} radius={0.45} smoothness={4} position={[5.5, 0, -0.15]}>
          <meshStandardMaterial color="#18181d" roughness={0.9} metalness={0.05} />
        </RoundedBox>
        <RoundedBox args={[1.6, 4.3, 0.12]} radius={0.3} smoothness={4} position={[5.2, 0, 0.26]}>
          <meshStandardMaterial color="#1c1c24" roughness={0.82} metalness={0.07} />
        </RoundedBox>

        {/* ──── SCREEN AREA (16:9 = 1.778) ──── */}
        {/* Bezel frame */}
        <RoundedBox args={[6.8, 4.025, 0.05]} radius={0.15} smoothness={4} position={[0, 0, 0.29]}>
          <meshStandardMaterial color="#0c0c12" roughness={0.7} metalness={0.12} />
        </RoundedBox>
        {/* Screen recess — exact 16:9 (6.4 / 3.6 = 1.778) */}
        <RoundedBox args={[6.4, 3.6, 0.08]} radius={0.1} smoothness={4} position={[0, 0, 0.30]}>
          <meshStandardMaterial color="#040406" roughness={0.95} metalness={0.0} />
        </RoundedBox>
        {/* Glass — slightly smaller than recess */}
        <RoundedBox args={[6.3, 3.54, 0.015]} radius={0.08} smoothness={4} position={[0, 0, 0.35]}>
          <meshStandardMaterial color="#080810" roughness={0.08} metalness={0.15} transparent opacity={0.25} />
        </RoundedBox>

        {/* ──── D-PAD (left grip) with labels ──── */}
        {/* Recess */}
        <group position={[-5.3, 0, 0.33]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.65, 0.65, 0.04, 32]} />
            <meshStandardMaterial color="#101016" roughness={0.92} metalness={0.04} />
          </mesh>
        </group>
        {/* Cross */}
        <mesh position={[-5.3, 0, 0.36]}>
          <boxGeometry args={[0.13, 0.85, 0.025]} />
          <meshStandardMaterial color="#28282f" roughness={0.72} metalness={0.08} />
        </mesh>
        <mesh position={[-5.3, 0, 0.36]}>
          <boxGeometry args={[0.85, 0.13, 0.025]} />
          <meshStandardMaterial color="#28282f" roughness={0.72} metalness={0.08} />
        </mesh>
        {/* Shadow */}
        <group position={[-5.3, 0, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.7, 0.7, 0.01, 32]} />
            <meshStandardMaterial color="#08080c" roughness={0.98} metalness={0.0} />
          </mesh>
        </group>
        {/* D-pad labels */}
        <Text position={[-5.3, 0.32, 0.39]} fontSize={0.15} color="#555560" anchorX="center" anchorY="middle">
          W
        </Text>
        <Text position={[-5.62, 0, 0.39]} fontSize={0.15} color="#555560" anchorX="center" anchorY="middle">
          A
        </Text>
        <Text position={[-5.3, -0.32, 0.39]} fontSize={0.15} color="#555560" anchorX="center" anchorY="middle">
          S
        </Text>
        <Text position={[-4.98, 0, 0.39]} fontSize={0.15} color="#555560" anchorX="center" anchorY="middle">
          D
        </Text>

        {/* ──── ACTION BUTTONS (right grip) with labels ──── */}
        {[
          { pos: [5.3, 0.4] as [number, number], label: "O" },
          { pos: [5.7, 0] as [number, number], label: "J" },
          { pos: [5.3, -0.4] as [number, number], label: "K" },
          { pos: [4.9, 0] as [number, number], label: "L" },
        ].map((btn, i) => (
          <React.Fragment key={`btn-${i}`}>
            <group position={[btn.pos[0], btn.pos[1], 0.34]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.22, 0.22, 0.05, 24]} />
                <meshStandardMaterial color="#28282f" roughness={0.65} metalness={0.08} />
              </mesh>
            </group>
            <group position={[btn.pos[0], btn.pos[1], 0.31]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.26, 0.26, 0.01, 24]} />
                <meshStandardMaterial color="#0a0a10" roughness={0.95} metalness={0.0} />
              </mesh>
            </group>
            <Text position={[btn.pos[0], btn.pos[1], 0.38]} fontSize={0.14} color="#555560" anchorX="center" anchorY="middle">
              {btn.label}
            </Text>
          </React.Fragment>
        ))}

        {/* ──── SPEAKER GRILLS ──── */}
        {[-0.35, -0.18, 0, 0.18, 0.35].map((x, i) =>
          [-0.12, 0, 0.12].map((y, j) => (
            <group key={`spk-l-${i}-${j}`} position={[-2.8 + x, -2.1 + y, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
                <meshStandardMaterial color="#060608" roughness={0.95} />
              </mesh>
            </group>
          ))
        )}
        {[-0.35, -0.18, 0, 0.18, 0.35].map((x, i) =>
          [-0.12, 0, 0.12].map((y, j) => (
            <group key={`spk-r-${i}-${j}`} position={[2.8 + x, -2.1 + y, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
                <meshStandardMaterial color="#060608" roughness={0.95} />
              </mesh>
            </group>
          ))
        )}

        {/* ──── SEAM LINES ──── */}
        <mesh position={[0, 2.5, 0.28]}>
          <boxGeometry args={[10.5, 0.012, 0.008]} />
          <meshStandardMaterial color="#0a0a10" roughness={0.92} />
        </mesh>
        <mesh position={[0, -2.5, 0.28]}>
          <boxGeometry args={[10.5, 0.012, 0.008]} />
          <meshStandardMaterial color="#0a0a10" roughness={0.92} />
        </mesh>
        <mesh position={[0, 2.6, 0.12]}>
          <boxGeometry args={[11.0, 0.01, 0.008]} />
          <meshStandardMaterial color="#0a0a10" roughness={0.92} />
        </mesh>

        {/* ──── VENTS (top edge) ──── */}
        {[-2.0, -1.2, -0.4, 0.4, 1.2, 2.0].map((x, i) => (
          <mesh key={`vent-${i}`} position={[x, 2.6, 0.0]}>
            <boxGeometry args={[0.45, 0.035, 0.22]} />
            <meshStandardMaterial color="#060608" roughness={0.95} />
          </mesh>
        ))}

        {/* ──── SHOULDER BUTTONS ──── */}
        <RoundedBox args={[1.3, 0.18, 0.28]} radius={0.07} smoothness={4} position={[-3.8, 2.6, -0.05]}>
          <meshStandardMaterial color="#222230" roughness={0.72} metalness={0.08} />
        </RoundedBox>
        <RoundedBox args={[1.3, 0.18, 0.28]} radius={0.07} smoothness={4} position={[3.8, 2.6, -0.05]}>
          <meshStandardMaterial color="#222230" roughness={0.72} metalness={0.08} />
        </RoundedBox>

        {/* ──── USB-C ──── */}
        <mesh position={[0, -2.62, -0.05]}>
          <boxGeometry args={[0.45, 0.1, 0.16]} />
          <meshStandardMaterial color="#0a0a12" roughness={0.5} metalness={0.25} />
        </mesh>

        {/* ──── SUBTLE LED ──── */}
        <mesh position={[0, 2.35, 0.31]}>
          <boxGeometry args={[4.5, 0.015, 0.008]} />
          <meshStandardMaterial color="#6a3b9e" emissive="#4a1b7e" emissiveIntensity={0.15} roughness={0.4} />
        </mesh>

        {/* Power LED */}
        <mesh position={[-3.4, 2.3, 0.32]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#00cc00" emissive="#009900" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </>
  );
}

export default function HandheldThreeFrame() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 10.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <HandheldScene />
    </Canvas>
  );
}
