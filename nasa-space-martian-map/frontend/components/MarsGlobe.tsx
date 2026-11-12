'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Props {
  className?: string;
}

export const MarsGlobe: React.FC<Props> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const width = 110;
    const height = 110;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.z = 2.8;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);

    // Procedural Mars texture
    const texCanvas = document.createElement('canvas');
    texCanvas.width = 512;
    texCanvas.height = 256;
    const ctx = texCanvas.getContext('2d');
    if (ctx) {
      // Base Mars rust gradient
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, '#e2e8f0'); // North polar ice cap
      grad.addColorStop(0.12, '#9a3412');
      grad.addColorStop(0.35, '#c2410c');
      grad.addColorStop(0.5, '#7c2d12'); // Dark maria (Syrtis Major)
      grad.addColorStop(0.7, '#ea580c');
      grad.addColorStop(0.9, '#9a3412');
      grad.addColorStop(1, '#f1f5f9'); // South polar ice cap
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 256);

      // Procedural surface details
      for (let i = 0; i < 70; i++) {
        const x = (i * 73) % 512;
        const y = 35 + (i * 37) % 186;
        const r = 5 + (i * 13) % 24;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(67, 20, 7, 0.45)' : 'rgba(194, 65, 12, 0.35)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const texture = new THREE.CanvasTexture(texCanvas);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Mars sphere
    const sphereGeo = new THREE.SphereGeometry(1, 32, 32);
    const sphereMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.85,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphere);

    // Jezero marker at Lat 18.45°N, Lon 77.42°E
    // Spherical to Cartesian:
    const phi = (90 - 18.45) * (Math.PI / 180);
    const theta = (77.42 + 180) * (Math.PI / 180);
    const r = 1.02;
    const jx = -r * Math.sin(phi) * Math.cos(theta);
    const jy = r * Math.cos(phi);
    const jz = r * Math.sin(phi) * Math.sin(theta);

    const beaconGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(jx, jy, jz);
    globeGroup.add(beacon);

    // Beacon ring
    const ringGeo = new THREE.RingGeometry(0.05, 0.08, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(jx * 1.01, jy * 1.01, jz * 1.01);
    ring.lookAt(jx * 2, jy * 2, jz * 2);
    globeGroup.add(ring);

    // Lighting (dramatic Deliver Us Mars low sun)
    const sunLight = new THREE.DirectionalLight(0xffedd5, 2.2);
    sunLight.position.set(3, 1, 2);
    scene.add(sunLight);

    const coldFill = new THREE.DirectionalLight(0x1e293b, 0.8);
    coldFill.position.set(-3, -1, -2);
    scene.add(coldFill);

    const ambientLight = new THREE.AmbientLight(0x451a03, 0.6);
    scene.add(ambientLight);

    // Align initial rotation to show Jezero towards camera
    globeGroup.rotation.y = -Math.PI * 0.45;
    globeGroup.rotation.x = 0.25;

    let animId: number;
    let t = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      t += 0.015;
      globeGroup.rotation.y += 0.004;
      const s = 1 + 0.25 * Math.sin(t * 3);
      ring.scale.set(s, s, s);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      beaconGeo.dispose();
      beaconMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      texture.dispose();
      if (el.contains(renderer.domElement)) {
        el.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className={`relative flex flex-col items-center select-none pointer-events-none ${className}`}>
      <div ref={mountRef} className="w-[110px] h-[110px] drop-shadow-[0_0_15px_rgba(234,88,12,0.3)]" />
      <div className="font-mono text-[9px] text-[#ff8a8e] tracking-widest text-center uppercase bg-black/70 px-2 py-0.5 rounded border border-white/10 -mt-1">
        Jezero · 18.45°N 77.42°E
      </div>
    </div>
  );
};

