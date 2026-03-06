"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox, useTexture } from "@react-three/drei";
import * as THREE from "three";

type Cartridge3DProps = {
  imageUrl?: string;
  hovered?: boolean;
};

function CartridgeMesh({ imageUrl, hovered }: Cartridge3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Slightly thicker than a card
  const size = useMemo(() => ({ x: 2.1, y: 2.6, z: 0.22 }), []);

  const safeUrl = imageUrl && imageUrl.trim().length > 0 ? imageUrl : "/images/qfs-ogimage.png";
  const texture = useTexture(safeUrl, (t) => {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const labelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.6,
        metalness: 0.05,
      }),
    [texture]
  );

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#3b3b3b"),
        roughness: 0.9,
        metalness: 0.05,
      }),
    []
  );

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;

    const t = state.clock.getElapsedTime();

    // Only animate when hovered (reduces GPU load / avoids WebGL context loss)
    if (!hovered) {
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.12, 0.12);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.18, 0.12);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.12);
      return;
    }

    const bob = Math.sin(t * 2.2) * 0.02;
    const targetRotX = -0.28;
    const targetRotY = 0.38;

    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, 0.12);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, 0.12);
    g.position.y = THREE.MathUtils.lerp(g.position.y, bob, 0.12);
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <RoundedBox
        args={[size.x, size.y, size.z]}
        radius={0.12}
        smoothness={6}
        material={bodyMat}
      />

      {/* Label (front) */}
      <mesh
        position={[0, -0.02, size.z / 2 + 0.001]}
        rotation={[0, 0, 0]}
      >
        <planeGeometry args={[1.78, 1.68]} />
        <primitive object={labelMat} attach="material" />
      </mesh>

      {/* Top notch */}
      <mesh position={[0, size.y / 2 - 0.12, size.z / 2 + 0.002]}>
        <planeGeometry args={[1.1, 0.14]} />
        <meshStandardMaterial color="#a7ff00" emissive="#2a4200" emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

export default function Cartridge3D({ imageUrl, hovered }: Cartridge3DProps) {
  return (
    <Canvas
      dpr={1}
      camera={{ position: [0, 0.1, 4.2], fov: 35 }}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        // Transparent background without invalid THREE.Color('transparent')
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 3, 5]} intensity={1.1} />
      <directionalLight position={[-4, 2, 2]} intensity={0.55} />
      <CartridgeMesh imageUrl={imageUrl} hovered={hovered} />
    </Canvas>
  );
}
