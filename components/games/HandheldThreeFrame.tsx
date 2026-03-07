"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox, Environment } from "@react-three/drei";

function HandheldScene() {
  return (
    <>
      {/* Lighting — more dramatic for 3D depth */}
      <ambientLight intensity={0.25} />
      {/* Key light (top-front) */}
      <directionalLight position={[0, 4, 10]} intensity={1.3} color="#ffffff" />
      {/* Purple accent fill (left) */}
      <directionalLight position={[-6, 1, 4]} intensity={0.6} color="#b46bff" />
      {/* Warm kick (right) */}
      <directionalLight position={[6, -1, 3]} intensity={0.3} color="#6040a0" />
      {/* Rim light (behind, outlines the shape) */}
      <directionalLight position={[0, 0, -6]} intensity={0.7} color="#4020a0" />
      {/* Top highlight for plastic sheen */}
      <directionalLight position={[0, 8, 0]} intensity={0.5} color="#ffffff" />

      {/* Subtle environment for reflections */}
      <Environment preset="night" />

      <group>
        {/* Main body — wider to show more frame */}
        <RoundedBox args={[11.0, 6.0, 0.75]} radius={0.85} smoothness={14} position={[0, 0, -0.22]}>
          <meshStandardMaterial color="#111118" roughness={0.78} metalness={0.15} />
        </RoundedBox>

        {/* Front face plate — lighter for layered/chamfered look */}
        <RoundedBox args={[10.8, 5.8, 0.1]} radius={0.8} smoothness={14} position={[0, 0, 0.17]}>
          <meshStandardMaterial color="#1e1e2a" roughness={0.55} metalness={0.22} />
        </RoundedBox>

        {/* Inner bevel (between face plate and screen) */}
        <RoundedBox args={[10.4, 5.5, 0.04]} radius={0.7} smoothness={12} position={[0, 0, 0.23]}>
          <meshStandardMaterial color="#16161f" roughness={0.4} metalness={0.28} />
        </RoundedBox>

        {/* Left grip — wider, more ergonomic, slightly lighter */}
        <RoundedBox args={[2.8, 5.4, 1.1]} radius={1.1} smoothness={14} position={[-6.2, -0.05, -0.18]}>
          <meshStandardMaterial color="#161620" roughness={0.82} metalness={0.14} />
        </RoundedBox>
        {/* Left grip inner edge */}
        <RoundedBox args={[1.6, 4.6, 0.85]} radius={0.8} smoothness={10} position={[-5.2, -0.05, 0.0]}>
          <meshStandardMaterial color="#1a1a26" roughness={0.7} metalness={0.18} />
        </RoundedBox>

        {/* Right grip */}
        <RoundedBox args={[2.8, 5.4, 1.1]} radius={1.1} smoothness={14} position={[6.2, -0.05, -0.18]}>
          <meshStandardMaterial color="#161620" roughness={0.82} metalness={0.14} />
        </RoundedBox>
        {/* Right grip inner edge */}
        <RoundedBox args={[1.6, 4.6, 0.85]} radius={0.8} smoothness={10} position={[5.2, -0.05, 0.0]}>
          <meshStandardMaterial color="#1a1a26" roughness={0.7} metalness={0.18} />
        </RoundedBox>

        {/* Screen recess */}
        <RoundedBox args={[7.4, 4.4, 0.07]} radius={0.3} smoothness={8} position={[0, 0.05, 0.25]}>
          <meshStandardMaterial color="#020204" roughness={0.98} metalness={0.0} />
        </RoundedBox>

        {/* Screen bezel ring */}
        <RoundedBox args={[7.6, 4.6, 0.04]} radius={0.35} smoothness={8} position={[0, 0.05, 0.22]}>
          <meshStandardMaterial color="#0c0c16" roughness={0.45} metalness={0.35} />
        </RoundedBox>

        {/* Left neon ring — BIGGER + BRIGHTER */}
        <mesh position={[-5.5, 0.3, 0.36]}>
          <torusGeometry args={[1.0, 0.06, 32, 128]} />
          <meshStandardMaterial
            color="#c060ff"
            emissive="#9933ff"
            emissiveIntensity={3.0}
            roughness={0.15}
            metalness={0.35}
          />
        </mesh>
        {/* Left ring glow */}
        <mesh position={[-5.5, 0.3, 0.33]}>
          <torusGeometry args={[1.0, 0.25, 16, 64]} />
          <meshStandardMaterial
            color="#8a2be2"
            emissive="#8a2be2"
            emissiveIntensity={0.8}
            transparent
            opacity={0.12}
            roughness={1}
          />
        </mesh>

        {/* Right neon ring — BIGGER + BRIGHTER */}
        <mesh position={[5.5, 0.3, 0.36]}>
          <torusGeometry args={[1.0, 0.06, 32, 128]} />
          <meshStandardMaterial
            color="#c060ff"
            emissive="#9933ff"
            emissiveIntensity={3.0}
            roughness={0.15}
            metalness={0.35}
          />
        </mesh>
        {/* Right ring glow */}
        <mesh position={[5.5, 0.3, 0.33]}>
          <torusGeometry args={[1.0, 0.25, 16, 64]} />
          <meshStandardMaterial
            color="#8a2be2"
            emissive="#8a2be2"
            emissiveIntensity={0.8}
            transparent
            opacity={0.12}
            roughness={1}
          />
        </mesh>

        {/* Vent slits — left grip */}
        {[-0.7, -0.3, 0.1, 0.5, 0.9].map((y, i) => (
          <mesh key={`vent-l-${i}`} position={[-6.2, y - 2.0, 0.25]}>
            <boxGeometry args={[1.2, 0.04, 0.03]} />
            <meshStandardMaterial color="#080810" roughness={0.95} metalness={0.05} />
          </mesh>
        ))}

        {/* Vent slits — right grip */}
        {[-0.7, -0.3, 0.1, 0.5, 0.9].map((y, i) => (
          <mesh key={`vent-r-${i}`} position={[6.2, y - 2.0, 0.25]}>
            <boxGeometry args={[1.2, 0.04, 0.03]} />
            <meshStandardMaterial color="#080810" roughness={0.95} metalness={0.05} />
          </mesh>
        ))}

        {/* Shoulder buttons (top edges) */}
        <RoundedBox args={[1.8, 0.3, 0.35]} radius={0.12} smoothness={6} position={[-4.0, 3.05, -0.1]}>
          <meshStandardMaterial color="#1a1a24" roughness={0.6} metalness={0.2} />
        </RoundedBox>
        <RoundedBox args={[1.8, 0.3, 0.35]} radius={0.12} smoothness={6} position={[4.0, 3.05, -0.1]}>
          <meshStandardMaterial color="#1a1a24" roughness={0.6} metalness={0.2} />
        </RoundedBox>

        {/* USB-C port (bottom center) */}
        <mesh position={[0, -3.05, -0.05]}>
          <boxGeometry args={[0.6, 0.15, 0.2]} />
          <meshStandardMaterial color="#0a0a12" roughness={0.5} metalness={0.4} />
        </mesh>
      </group>
    </>
  );
}

export default function HandheldThreeFrame() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.15, 10.5], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <HandheldScene />
    </Canvas>
  );
}
