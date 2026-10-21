"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * 3D keyboard (Three.js) + Bongo Cat GIF. Fills its parent (parent needs position: relative and a fixed height).
 *  - catScale : cat width relative to the keyboard width on screen
 *  - catZ     : cat depth, measured from the back edge of the keyboard
 *  - catAnchor: the "feet" point inside the GIF (0..1)
 *  - shift    : shifts the keyboard to the right on wide screens (fraction of the width)
 */
export interface HeroKey { label: string; sub?: string; desc?: string; color: string; href?: string }

interface Props {
  keys: HeroKey[];
  onKeyClick?: (key: HeroKey) => void;
  onKeyHover?: (key: HeroKey | null) => void;
  catSrc?: string;
  catScale?: number;
  catZ?: number;
  catAnchor?: { x: number; y: number };
  shift?: number;
  className?: string;
  style?: CSSProperties;
}

const COLS = 5;
const KEY_SIZE = 1;
const GAP = 0.14;
const KEY_HEIGHT = 0.55;
const DEFAULT_ANCHOR = { x: 0.5, y: 0.8 };

function makeLabelTexture(label: string, sub?: string): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const ctx = c.getContext("2d");
  if (!ctx) return tex;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let fontSize = 92;
  const family = "'Segoe UI', system-ui, -apple-system, sans-serif";
  do {
    ctx.font = `800 ${fontSize}px ${family}`;
    fontSize -= 4;
  } while (ctx.measureText(label).width > size * 0.78 && fontSize > 28);

  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.fillText(label, size / 2, sub ? size * 0.42 : size / 2);
  if (sub) {
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.font = `600 ${size * 0.11}px ${family}`;
    ctx.fillText(sub, size / 2, size * 0.72);
  }
  return tex;
}

export default function KeyboardHero({
  keys, onKeyClick, onKeyHover, catSrc, catScale = 0.5, catZ = 0.9, catAnchor = DEFAULT_ANCHOR, shift = 0.2, className, style,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLImageElement>(null);
  const clickRef = useRef(onKeyClick);
  const hoverRef = useRef(onKeyHover);
  const catCfg = useRef({ catScale, catZ, catAnchor, shift });

  useEffect(() => {
    clickRef.current = onKeyClick;
    hoverRef.current = onKeyHover;
    catCfg.current = { catScale, catZ, catAnchor, shift };
  }, [onKeyClick, onKeyHover, catScale, catZ, catAnchor, shift]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* renderer / scene / camera */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 7, 11);
    camera.lookAt(0, 0, 0);

    /* lights */
    scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const dir = new THREE.DirectionalLight(0xffffff, 2.2);
    dir.position.set(-4, 9, 6);
    scene.add(dir);
    const rim = new THREE.PointLight(0x6d8cff, 40, 30);
    rim.position.set(6, 3, -4);
    scene.add(rim);

    /* stars */
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 60;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPos[i * 3 + 2] = -Math.random() * 30 - 5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, transparent: true, opacity: 0.7 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    /* keyboard */
    const board = new THREE.Group();
    scene.add(board);
    const rows = Math.ceil(keys.length / COLS);
    const pitch = KEY_SIZE + GAP;
    const boardW = COLS * pitch + GAP + 0.5;
    const boardD = rows * pitch + GAP + 0.5;

    const baseGeo = new RoundedBoxGeometry(boardW, 0.7, boardD, 4, 0.25);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.55, metalness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.35;
    board.add(base);

    const capGeo = new RoundedBoxGeometry(KEY_SIZE, KEY_HEIGHT, KEY_SIZE, 5, 0.14);
    const labelGeo = new THREE.PlaneGeometry(KEY_SIZE * 0.78, KEY_SIZE * 0.78);
    const disposables: { dispose?: () => void }[] = [baseGeo, baseMat, capGeo, labelGeo, starGeo, starMat];
    const keyMeshes: THREE.Mesh[] = [];

    keys.forEach((k, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const inRow = Math.min(COLS, keys.length - row * COLS); // centre an incomplete last row
      const x = (col - (inRow - 1) / 2) * pitch;
      const z = (row - (rows - 1) / 2) * pitch;
      const capMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(k.color), roughness: 0.38, metalness: 0.05 });
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(x, KEY_HEIGHT / 2 + 0.05, z);

      const tex = makeLabelTexture(k.label, k.sub);
      const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.rotation.x = -Math.PI / 2;
      label.position.y = KEY_HEIGHT / 2 + 0.004;
      cap.add(label);

      cap.userData = { key: k, restY: cap.position.y, hover: 0, press: 0, phase: i * 0.45 };
      board.add(cap);
      keyMeshes.push(cap);
      disposables.push(capMat, labelMat, tex);
    });

    board.rotation.set(0.25, -0.5, 0);
    const baseRot = { x: 0.25, y: -0.5 };

    /* interaction */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9, 9);
    const mouse = { x: 0, y: 0 };
    let hovered: THREE.Mesh | null = null;
    let pressed: THREE.Mesh | null = null;

    const setHovered = (m: THREE.Mesh | null) => {
      if (m === hovered) return;
      hovered = m;
      renderer.domElement.style.cursor = m ? "pointer" : "default";
      hoverRef.current?.(m ? (m.userData.key as HeroKey) : null);
    };
    const setPointer = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      mouse.x = pointer.x;
      mouse.y = pointer.y;
    };
    const pick = (): THREE.Mesh | null => {
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(keyMeshes, false)[0];
      return hit ? (hit.object as THREE.Mesh) : null;
    };
    const onMove = (e: PointerEvent) => { setPointer(e); setHovered(pick()); };
    const onLeave = () => { pointer.set(9, 9); mouse.x = mouse.y = 0; setHovered(null); };
    const onDown = (e: PointerEvent) => { setPointer(e); pressed = pick(); setHovered(pressed); };
    const onUp = (e: PointerEvent) => {
      setPointer(e);
      const up = pick();
      if (pressed && up === pressed) clickRef.current?.(pressed.userData.key as HeroKey);
      pressed = null;
    };
    const el = renderer.domElement;
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);

    /* resize */
    let W = 1;
    let H = 1;
    const resize = () => {
      W = mount.clientWidth || 1;
      H = mount.clientHeight || 1;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.position.z = W < 640 ? 17 : W < 1024 ? 13.5 : 11;
      camera.position.y = W < 640 ? 9 : 7;
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const wide = W >= 1024; // wide: keyboard to the right (text on the left); narrow: keyboard moves down
      const sx = wide ? catCfg.current.shift : 0;
      const sy = wide ? 0 : 0.2;
      camera.setViewOffset(W, H, -W * sx, -H * sy, W, H);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* the cat follows the keyboard */
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const toScreen = (v: THREE.Vector3) => {
      v.project(camera);
      return { x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H };
    };
    const updateCat = () => {
      const cat = catRef.current;
      if (!cat) return;
      const { catScale: s, catZ: z, catAnchor: a } = catCfg.current;
      board.updateMatrixWorld();
      const left = toScreen(board.localToWorld(vA.set(-boardW / 2, 0, 0)));
      const right = toScreen(board.localToWorld(vB.set(boardW / 2, 0, 0)));
      const width = Math.hypot(right.x - left.x, right.y - left.y) * s;
      const p = toScreen(board.localToWorld(vA.set(0, KEY_HEIGHT, -boardD / 2 + z)));
      cat.style.width = `${width}px`;
      cat.style.left = `${p.x - width * a.x}px`;
      cat.style.top = `${p.y}px`;
      cat.style.transform = `translateY(-${a.y * 100}%)`;
      cat.style.opacity = "1";
    };

    /* loop */
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      if (!reduceMotion) {
        board.position.y = Math.sin(t * 0.8) * 0.12;
        board.rotation.x += (baseRot.x - mouse.y * 0.12 - board.rotation.x) * 0.05;
        board.rotation.y += (baseRot.y + mouse.x * 0.2 - board.rotation.y) * 0.05;
        stars.rotation.y = t * 0.01;
      }
      keyMeshes.forEach((m) => {
        const u = m.userData;
        u.hover += ((m === hovered ? 1 : 0) - u.hover) * 0.18;
        u.press += ((m === pressed && m === hovered ? 1 : 0) - u.press) * 0.35;
        const idle = reduceMotion ? 0 : Math.sin(t * 1.5 + u.phase) * 0.015;
        m.position.y = u.restY + idle + u.hover * 0.1 - u.press * 0.2;
      });
      renderer.render(scene, camera);
      updateCat();
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      if (el.parentNode === mount) mount.removeChild(el);
    };
  }, [keys]);

  return (
    <div ref={mountRef} className={className} role="img" aria-label="3D keyboard"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", ...style }}>
      {catSrc && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={catRef} src={catSrc} alt="" draggable={false}
          style={{ position: "absolute", zIndex: 2, opacity: 0, pointerEvents: "none", userSelect: "none" }} />
      )}
    </div>
  );
}
