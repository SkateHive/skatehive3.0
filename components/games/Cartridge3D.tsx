"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ─── helpers ─── */
function createCartridgeShape() {
  const s = new THREE.Shape();
  const W = 1.05; // half-width body
  const H = 1.35; // half-height body
  const SW = 0.25; // shoulder extra width each side
  const SH = 0.35; // shoulder height
  const R = 0.08; // corner radius
  const TR = 0.14; // top corner radius (shoulders)

  // Start bottom-left, go clockwise
  s.moveTo(-W + R, -H);
  s.lineTo(W - R, -H);
  s.quadraticCurveTo(W, -H, W, -H + R);
  // Right side up to shoulder start
  s.lineTo(W, H - SH);
  // Right shoulder out
  s.lineTo(W + SW, H - SH + 0.06);
  s.lineTo(W + SW, H - TR);
  s.quadraticCurveTo(W + SW, H, W + SW - TR, H);
  // Top: notch cutout
  const NW = 0.38; // notch half-width
  const ND = 0.18; // notch depth
  s.lineTo(NW, H);
  s.lineTo(NW, H - ND);
  s.lineTo(-NW, H - ND);
  s.lineTo(-NW, H);
  // Left shoulder top
  s.lineTo(-W - SW + TR, H);
  s.quadraticCurveTo(-W - SW, H, -W - SW, H - TR);
  s.lineTo(-W - SW, H - SH + 0.06);
  // Left shoulder back in
  s.lineTo(-W, H - SH);
  s.lineTo(-W, -H + R);
  s.quadraticCurveTo(-W, -H, -W + R, -H);

  return s;
}

function createRidgeShape() {
  // Small vertical ridge for the side grip
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.04, 0);
  s.lineTo(0.04, 0.22);
  s.lineTo(0, 0.22);
  s.closePath();
  return s;
}

/* ─── main mesh ─── */
type CartridgeProps = { imageUrl?: string; hovered?: boolean };

function CartridgeMesh({ imageUrl, hovered }: CartridgeProps) {
  const groupRef = useRef<THREE.Group>(null);
  const DEPTH = 0.18;

  // Cartridge body geometry (extruded 2D shape)
  const bodyGeo = useMemo(() => {
    const shape = createCartridgeShape();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 3,
    });
    geo.center();
    return geo;
  }, []);

  // Side ridges (grip lines)
  const ridgeGeo = useMemo(() => {
    const shape = createRidgeShape();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.02,
      bevelEnabled: false,
    });
  }, []);

  // Texture for label
  const safeUrl =
    imageUrl && imageUrl.trim().length > 0
      ? imageUrl
      : "/images/qfs-ogimage.png";
  const texture = useTexture(safeUrl, (t) => {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  // Materials
  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#555560"),
        roughness: 0.72,
        metalness: 0.1,
      }),
    [],
  );

  const labelBorderMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#44444d"),
        roughness: 0.85,
        metalness: 0.06,
      }),
    [],
  );

  const labelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.55,
        metalness: 0.02,
      }),
    [texture],
  );

  const ridgeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#4a4a50"),
        roughness: 0.85,
        metalness: 0.05,
      }),
    [],
  );

  const accentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#a7ff00"),
        emissive: new THREE.Color("#3a5900"),
        emissiveIntensity: 0.6,
        roughness: 0.4,
        metalness: 0.15,
      }),
    [],
  );

  // Animation
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.getElapsedTime();

    if (!hovered) {
      // Idle: slight angle to show depth
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.1, 0.08);
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.2, 0.08);
      g.position.y = THREE.MathUtils.lerp(g.position.y, 0, 0.08);
      return;
    }

    // Hover: tilt more + gentle bob
    const bob = Math.sin(t * 2) * 0.03;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -0.22, 0.1);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, 0.35, 0.1);
    g.position.y = THREE.MathUtils.lerp(g.position.y, bob, 0.1);
  });

  const FRONT = DEPTH / 2 + 0.026; // bevel offset

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      {/* ── Cartridge body ── */}
      <mesh geometry={bodyGeo} material={bodyMat} />

      {/* ── Label border (inset rectangle) ── */}
      <mesh position={[0, 0.0, FRONT + 0.001]}>
        <planeGeometry args={[1.92, 1.85]} />
        <primitive object={labelBorderMat} attach="material" />
      </mesh>

      {/* ── Label image (full art, no crop, taller to fit) ── */}
      <mesh position={[0, 0.0, FRONT + 0.003]}>
        <planeGeometry args={[1.85, 1.78]} />
        <primitive object={labelMat} attach="material" />
      </mesh>

      {/* ── Side ridges (left) ── */}
      {[-0.6, -0.35, -0.1, 0.15, 0.4].map((yOff, i) => (
        <mesh
          key={`ridge-l-${i}`}
          geometry={ridgeGeo}
          material={ridgeMat}
          position={[-1.32, yOff, -DEPTH / 2 - 0.01]}
          rotation={[0, -Math.PI / 2, 0]}
        />
      ))}

      {/* ── Side ridges (right) ── */}
      {[-0.6, -0.35, -0.1, 0.15, 0.4].map((yOff, i) => (
        <mesh
          key={`ridge-r-${i}`}
          geometry={ridgeGeo}
          material={ridgeMat}
          position={[1.32, yOff, -DEPTH / 2 - 0.01]}
          rotation={[0, Math.PI / 2, 0]}
        />
      ))}

      {/* ── Top accent stripe (inside notch area) ── */}
      <mesh position={[0, 1.17, FRONT + 0.002]}>
        <planeGeometry args={[0.72, 0.08]} />
        <primitive object={accentMat} attach="material" />
      </mesh>

      {/* ── Bottom arrow ── */}
      <mesh position={[0, -1.22, FRONT + 0.002]} rotation={[0, 0, Math.PI]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                0, 0.08, 0,
                -0.06, 0, 0,
                0.06, 0, 0,
              ]),
              3,
            ]}
          />
        </bufferGeometry>
        <primitive object={accentMat} attach="material" />
      </mesh>

      {/* ── "SKATEHIVE" text bar at bottom ── */}
      <mesh position={[0, -1.05, FRONT + 0.002]}>
        <planeGeometry args={[0.9, 0.1]} />
        <meshStandardMaterial
          color="#4a4a50"
          roughness={0.9}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}

/* ─── Canvas wrapper ─── */
export default function Cartridge3D({ imageUrl, hovered }: CartridgeProps) {
  return (
    <Canvas
      dpr={1}
      camera={{ position: [0, 0.1, 5.2], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {/* Soft ambient base — no pure black shadows */}
      <ambientLight intensity={1.2} />

      {/* Key light: soft, from top-front, with shadow */}
      <directionalLight
        position={[2, 4, 5]}
        intensity={1.0}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.002}
        shadow-normalBias={0.05}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* Fill light: opposite side, softer, no shadow */}
      <directionalLight
        position={[-3, 2, 4]}
        intensity={0.6}
        color="#dde0ff"
      />

      {/* Bottom fill — prevents dark underside */}
      <directionalLight
        position={[0, -2, 3]}
        intensity={0.3}
        color="#ffffff"
      />

      {/* Subtle green accent (brand color) */}
      <pointLight position={[-2, 1, 3]} intensity={0.15} color="#a7ff00" />

      {/* HDRI environment for realistic reflections + ambient fill */}
      <Environment preset="city" environmentIntensity={0.3} />

      <CartridgeMesh imageUrl={imageUrl} hovered={hovered} />
    </Canvas>
  );
}
