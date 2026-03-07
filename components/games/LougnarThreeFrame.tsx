"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { RoundedBox, Environment } from "@react-three/drei";

function LougnarScene() {
  return (
    <>
      {/* Lighting — cooler/space feel */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[0, 5, 8]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-5, 2, 4]} intensity={0.5} color="#ff8c00" />
      <directionalLight position={[5, -1, 3]} intensity={0.25} color="#4080c0" />
      <directionalLight position={[0, 0, -5]} intensity={0.5} color="#ff6600" />
      <directionalLight position={[0, 6, 0]} intensity={0.4} color="#ffffff" />

      <Environment preset="night" />

      <group>
        {/* Main body — gray metallic */}
        <RoundedBox args={[11.5, 6.2, 0.6]} radius={0.7} smoothness={14} position={[0, 0, -0.2]}>
          <meshStandardMaterial color="#2a2a30" roughness={0.55} metalness={0.45} />
        </RoundedBox>

        {/* Front plate — slightly lighter */}
        <RoundedBox args={[11.3, 6.0, 0.08]} radius={0.65} smoothness={14} position={[0, 0, 0.12]}>
          <meshStandardMaterial color="#353540" roughness={0.4} metalness={0.5} />
        </RoundedBox>

        {/* Panel line (horizontal, above screen) */}
        <mesh position={[0, 2.85, 0.17]}>
          <boxGeometry args={[10.0, 0.03, 0.02]} />
          <meshStandardMaterial color="#1a1a20" roughness={0.8} metalness={0.2} />
        </mesh>

        {/* Panel line (horizontal, below screen) */}
        <mesh position={[0, -2.85, 0.17]}>
          <boxGeometry args={[10.0, 0.03, 0.02]} />
          <meshStandardMaterial color="#1a1a20" roughness={0.8} metalness={0.2} />
        </mesh>

        {/* Screen recess — large */}
        <RoundedBox args={[9.0, 5.2, 0.07]} radius={0.25} smoothness={8} position={[0, 0, 0.15]}>
          <meshStandardMaterial color="#020204" roughness={0.98} metalness={0.0} />
        </RoundedBox>

        {/* Screen bezel ring */}
        <RoundedBox args={[9.2, 5.4, 0.04]} radius={0.3} smoothness={8} position={[0, 0, 0.13]}>
          <meshStandardMaterial color="#1c1c24" roughness={0.4} metalness={0.4} />
        </RoundedBox>

        {/* Orange accent strip (top) */}
        <mesh position={[0, 3.05, 0.14]}>
          <boxGeometry args={[6.0, 0.08, 0.04]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={1.5} roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Orange accent strip (bottom) */}
        <mesh position={[0, -3.05, 0.14]}>
          <boxGeometry args={[6.0, 0.08, 0.04]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={1.5} roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Rivets — corners (using parent group for rotation) */}
        {[[-5.2, 2.7], [5.2, 2.7], [-5.2, -2.7], [5.2, -2.7]].map(([x, y], i) => (
          <group key={`rivet-${i}`} position={[x, y, 0.17]} rotation={[Math.PI/2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.06, 0.08, 0.04, 12]} />
              <meshStandardMaterial color="#555560" roughness={0.4} metalness={0.6} />
            </mesh>
          </group>
        ))}

        {/* Antenna stub (top center) */}
        <mesh position={[0, 3.3, -0.1]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
          <meshStandardMaterial color="#444450" roughness={0.5} metalness={0.5} />
        </mesh>
        <mesh position={[0, 3.55, -0.1]}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#ff6600" emissive="#ff4400" emissiveIntensity={2.0} roughness={0.2} metalness={0.3} />
        </mesh>

        {/* Speaker holes (left side) */}
        {[-1.0, -0.5, 0.0, 0.5, 1.0].map((y, i) => (
          <group key={`spk-l-${i}`} position={[-5.4, y, 0.14]} rotation={[Math.PI/2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.04, 0.04, 0.03, 8]} />
              <meshStandardMaterial color="#15151c" roughness={0.9} metalness={0.1} />
            </mesh>
          </group>
        ))}

        {/* Speaker holes (right side) */}
        {[-1.0, -0.5, 0.0, 0.5, 1.0].map((y, i) => (
          <group key={`spk-r-${i}`} position={[5.4, y, 0.14]} rotation={[Math.PI/2, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.04, 0.04, 0.03, 8]} />
              <meshStandardMaterial color="#15151c" roughness={0.9} metalness={0.1} />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

export default function LougnarThreeFrame() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0.1, 10.5], fov: 30 }}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <LougnarScene />
    </Canvas>
  );
}
