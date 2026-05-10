import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

type CandlePoint = { x: number; seed: number; drift: number };

function Candles(props: { count?: number }) {
  const count = props.count ?? 84;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  const points = useMemo<CandlePoint[]>(() => {
    const spacing = 0.12;
    const start = -((count - 1) * spacing) / 2;
    return Array.from({ length: count }, (_, i) => ({
      x: start + i * spacing,
      seed: Math.random() * 10,
      drift: (Math.random() - 0.5) * 0.6
    }));
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const mesh = meshRef.current;

    for (let i = 0; i < points.length; i += 1) {
      const p = points[i]!;
      const wave = Math.sin(t * 0.75 + p.seed) * 0.35 + Math.sin(t * 1.25 + p.seed * 0.7) * 0.15;
      const base = 0.55 + (i / points.length) * 0.8;
      const height = Math.max(0.12, base + wave);
      const y = height / 2 - 0.4;
      const bullish = wave + p.drift > 0;

      dummy.position.set(p.x, y, 0);
      dummy.scale.set(0.07, height, 0.07);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
      color.set(bullish ? "#34d399" : "#fb7185");
      mesh.setColorAt(i, color);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as never, undefined as never, points.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        metalness={0.2}
        roughness={0.35}
        emissive={"#0ea5e9"}
        emissiveIntensity={0.08}
      />
    </instancedMesh>
  );
}

function Grid() {
  const grid = useMemo(() => new THREE.GridHelper(12, 48, "#1f2937", "#111827"), []);
  // GridHelper is centered on origin and lies on XZ plane.
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = -0.42;
  return <primitive object={grid} />;
}

export function MarketScene() {
  return (
    <Canvas
      className="pointer-events-none absolute inset-0"
      camera={{ position: [0, 0.45, 3.1], fov: 55, near: 0.1, far: 60 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <fog attach="fog" args={["#050713", 2.5, 7]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 2, 2]} intensity={1.1} color={"#7dd3fc"} />
      <directionalLight position={[-3, 1, 2]} intensity={0.7} color={"#34d399"} />
      <Candles />
      <Grid />
    </Canvas>
  );
}

