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

    // Subtle idle bob
    const bob = Math.sin(t * 1.2) * 0.015;

    // Hover tilt
    const targetRotX = hovered ? -0.25 : -0.15;
    const targetRotY = hovered ? 0.35 : 0.22;

    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, targetRotX, 0.08);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, 0.08);
    g.position.y = THREE.MathUtils.lerp(g.position.y, bob, 0.1);
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
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.1, 4.2], fov: 35 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["transparent"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 3, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, 2]} intensity={0.6} />
      <CartridgeMesh imageUrl={imageUrl} hovered={hovered} />
    </Canvas>
  );
}
