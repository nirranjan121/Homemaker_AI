// src/widgets/app/house-3d-viewer/page.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useWidgetSDK } from '@nitrostack/widgets';
import * as THREE from 'three';

type RoomShape = {
  id: string;
  name: string;
  polygon: { x: number; y: number }[];
  wallHeightM: number;
};

type ToolOutput = {
  geometry?: RoomShape[];
  materials?: { wallColor: string; floorMaterial: string };
  estimateInrLow?: number;
  estimateInrHigh?: number;
  resolvedCity?: string;
  quality?: string;
  disclaimer?: string;
};

export default function House3DViewer() {
  const { isReady, getToolOutput } = useWidgetSDK();
  const mountRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<ToolOutput | null>(null);

  useEffect(() => {
    if (!isReady) return;
    setData(getToolOutput() as ToolOutput);
  }, [isReady, getToolOutput]);

  // --- Three.js scene: rebuild whenever geometry/materials change ---
  useEffect(() => {
    if (!data?.geometry || !mountRef.current) return;
    const mount = mountRef.current;
    mount.innerHTML = '';

    const width = mount.clientWidth || 600;
    const height = 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e9e6df');

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 200);
    camera.position.set(10, 12, 14);
    camera.lookAt(4, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 20, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const wallColor = data.materials?.wallColor ?? '#f2f0ea';
    const floorMaterialName = data.materials?.floorMaterial ?? 'concrete';
    const floorColor = floorMaterialName.toLowerCase().includes('wood') ? '#a9754f' : '#c9c5bb';

    for (const room of data.geometry) {
      // Floor
      const shape = new THREE.Shape(room.polygon.map((p) => new THREE.Vector2(p.x, p.y)));
      const floorGeo = new THREE.ShapeGeometry(shape);
      const floorMesh = new THREE.Mesh(
        floorGeo,
        new THREE.MeshStandardMaterial({ color: floorColor, side: THREE.DoubleSide })
      );
      floorMesh.rotation.x = -Math.PI / 2;
      scene.add(floorMesh);

      // Walls: one box per polygon edge
      for (let i = 0; i < room.polygon.length; i++) {
        const a = room.polygon[i];
        const b = room.polygon[(i + 1) % room.polygon.length];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        const wallGeo = new THREE.BoxGeometry(length, room.wallHeightM, 0.15);
        const wallMesh = new THREE.Mesh(
          wallGeo,
          new THREE.MeshStandardMaterial({ color: wallColor })
        );
        wallMesh.position.set(
          (a.x + b.x) / 2,
          room.wallHeightM / 2,
          (a.y + b.y) / 2
        );
        wallMesh.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
        scene.add(wallMesh);
      }
    }

    renderer.render(scene, camera);

    return () => {
      renderer.dispose();
    };
  }, [data]);

  if (!isReady) {
    return <div className="p-4 text-sm text-gray-500">Loading…</div>;
  }

  return (
    <div className="p-4 rounded-xl bg-white">
      <div ref={mountRef} className="w-full rounded-lg overflow-hidden border border-gray-200" />
      {(data?.estimateInrLow || data?.estimateInrHigh) && (
        <div className="mt-3 p-3 rounded-lg bg-gray-50 text-sm">
          <div className="font-semibold">
            Estimated cost: ₹{data.estimateInrLow?.toLocaleString('en-IN')} – ₹
            {data.estimateInrHigh?.toLocaleString('en-IN')}
          </div>
          <div className="text-gray-500">
            {data.resolvedCity} · {data.quality} quality
          </div>
          {data.disclaimer && (
            <div className="text-gray-400 text-xs mt-1">{data.disclaimer}</div>
          )}
        </div>
      )}
    </div>
  );
}
