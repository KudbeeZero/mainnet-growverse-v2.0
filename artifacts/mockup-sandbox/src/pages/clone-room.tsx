// ============================================================================
// FRONTIER — Clone Room :: 3D environment scaffold (Manual Section 7)
// ----------------------------------------------------------------------------
// CLONE-05: a standalone, full-page React Three Fiber Canvas mounted at
// /clone-room. This is intentionally just the room scaffold — box primitives
// for the four zones (work bench, grow tent, clone dome, shelf) plus ambient +
// directional lighting and a camera at workbench level.
//
// No game logic, no interactions, no procedural plant geometry yet — those
// arrive in CLONE-07 / CLONE-08. This Canvas is fully isolated and never
// imports or shares state with the main game canvas (Section 11).
// ============================================================================

import { Canvas } from "@react-three/fiber";

// --- Room primitives --------------------------------------------------------

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#2b2b33" />
    </mesh>
  );
}

function BackWall() {
  return (
    <mesh position={[0, 3, -6]}>
      <boxGeometry args={[20, 6, 0.2]} />
      <meshStandardMaterial color="#23232a" />
    </mesh>
  );
}

/** Center: the work bench with a low pegboard behind it. */
function WorkBench() {
  return (
    <group position={[0, 0, 0]}>
      {/* bench top */}
      <mesh position={[0, 1, 0]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.15, 1.4]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
      {/* legs */}
      {[
        [-1.35, 0.5, 0.55],
        [1.35, 0.5, 0.55],
        [-1.35, 0.5, -0.55],
        [1.35, 0.5, -0.55],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color="#4a3727" />
        </mesh>
      ))}
      {/* pegboard */}
      <mesh position={[0, 2, -0.6]}>
        <boxGeometry args={[3, 1.6, 0.08]} />
        <meshStandardMaterial color="#3a3f4b" />
      </mesh>
    </group>
  );
}

/** Left: grow tent enclosure with an overhead LED bar. */
function GrowTent() {
  return (
    <group position={[-4.5, 0, -1]}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[2.4, 3.2, 2.4]} />
        <meshStandardMaterial color="#1c1c22" transparent opacity={0.85} />
      </mesh>
      {/* LED bar */}
      <mesh position={[0, 3.05, 0]}>
        <boxGeometry args={[2, 0.12, 0.5]} />
        <meshStandardMaterial
          color="#bfe0ff"
          emissive="#9ec9ff"
          emissiveIntensity={0.8}
        />
      </mesh>
      {/* fabric pot */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.6, 0.5, 0.8, 16]} />
        <meshStandardMaterial color="#33312f" />
      </mesh>
    </group>
  );
}

/** Right: humidity dome over rooting cubes. */
function CloneDome() {
  return (
    <group position={[4.2, 1.08, 0]}>
      {/* tray */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.6, 0.16, 1.1]} />
        <meshStandardMaterial color="#2f3a33" />
      </mesh>
      {/* clear dome */}
      <mesh position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#cfeede" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/** Back wall: shelf holding seed vaults + harvest jars. */
function Shelf() {
  return (
    <group position={[0, 0, -5.6]}>
      {[1.2, 2.4, 3.6].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[8, 0.12, 0.6]} />
          <meshStandardMaterial color="#5a4632" />
        </mesh>
      ))}
      {/* a few placeholder jars / vaults on the shelves */}
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={x} position={[x, 1.45, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.4, 12]} />
          <meshStandardMaterial color="#8fa3b0" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Scene() {
  return (
    <>
      {/* Lighting: ambient fill + a key directional light. */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <Floor />
      <BackWall />
      <Shelf />
      <GrowTent />
      <WorkBench />
      <CloneDome />
    </>
  );
}

export default function CloneRoom() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#15151a" }}>
      <Canvas
        shadows
        // Camera positioned at workbench level, looking at the bench.
        camera={{ position: [0, 1.6, 5.5], fov: 50 }}
      >
        <Scene />
      </Canvas>
    </div>
  );
}
