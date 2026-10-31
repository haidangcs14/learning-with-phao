import * as THREE from "three";

interface Tween { t: number; dur: number; update: (k: number) => void; done: () => void }
const smooth = (k: number) => k * k * (3 - 2 * k);
const BANK_L = -5.4, BANK_R = 5.4, SPAN_L = -3.5, SPAN_R = 3.5, STEP_TOP = 0.09, BIRD_Y = 0.56;
const WOOD = 0xb7793f, GREEN = 0x22c55e;

/** The 3D stage of "Word Bridge": a river, two banks, a bridge that grows one plank per correct word, and a bird carrying the player's avatar. */
export class BridgeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private clock = new THREE.Clock();
  private tweens: Tween[] = [];
  private steps: THREE.Mesh[] = [];
  private bird = new THREE.Group();
  private body!: THREE.Mesh;
  private wings: THREE.Mesh[] = [];
  private medallion!: THREE.Mesh;
  private water!: THREE.Mesh;
  private clouds: THREE.Group[] = [];
  private labels: { sprite: THREE.Sprite; age: number }[] = [];
  private n = 0;
  private at = -1; // -1 left bank, 0..n-1 on a plank, n right bank
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(4, 9, 7);
    this.scene.add(sun);
    this.buildWorld();
    this.buildBird();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas.parentElement ?? canvas);
    this.resize();
    this.placeBird(-1);
    this.loop();
  }

  // ---------------------------------------------------------------- world
  private buildWorld() {
    const std = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    for (const sx of [-1, 1]) {
      const dirt = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.6, 3.4), std(0x8b5a2b));
      dirt.position.set(sx * (BANK_R + 0.9), -0.85, 0);
      const grass = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 3.5), std(0x4ade80));
      grass.position.set(sx * (BANK_R + 0.9), -0.05, 0);
      this.scene.add(dirt, grass);
      for (const z of [-1.2, 1.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 10), std(0x7c4a1d));
        post.position.set(sx * 3.7, 0.4, z);
        this.scene.add(post);
      }
    }
    const geo = new THREE.PlaneGeometry(24, 6, 48, 10);
    this.water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88, flatShading: true, roughness: 0.3 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, -1.1, 0);
    this.scene.add(this.water);
    for (let i = 0; i < 4; i++) {
      const cloud = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
      for (const [x, y, r] of [[0, 0, 0.7], [0.8, -0.1, 0.55], [-0.8, -0.15, 0.5]] as const) { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); s.position.set(x, y, 0); cloud.add(s); }
      cloud.position.set(-9 + i * 6, 4 + (i % 2) * 0.8, -4);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private buildBird() {
    const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 18), mat(0xfacc15));
    this.body.scale.set(1.05, 0.92, 0.92);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 20, 16), mat(0xfacc15));
    head.position.set(0.38, 0.42, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 12), mat(0xf97316));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.7, 0.4, 0);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 10), mat(0xf59e0b));
    tail.rotation.z = Math.PI / 2 + 0.3;
    tail.position.set(-0.62, 0.18, 0);
    this.bird.add(this.body, head, beak, tail);
    for (const z of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0x111827));
      eye.position.set(0.58, 0.52, z);
      this.bird.add(eye);
    }
    for (const z of [-0.46, 0.46]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xf59e0b));
      wing.scale.set(1.1, 0.35, 0.5);
      wing.position.set(-0.05, 0.08, z * 0.95);
      this.wings.push(wing);
      this.bird.add(wing);
    }
    for (const z of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6), mat(0xf97316));
      leg.position.set(0.02, -0.5, z);
      this.bird.add(leg);
    }
    // the player's avatar rides on the side of the bird that faces the camera
    this.medallion = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.medallion.position.set(0.02, 0.12, 0.52);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.4, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    ring.position.set(0.02, 0.12, 0.515);
    this.bird.add(this.medallion, ring);
    this.scene.add(this.bird);
  }

  setAvatar(url: string | null, initial: string) {
    const apply = (tex: THREE.Texture) => { tex.colorSpace = THREE.SRGBColorSpace; (this.medallion.material as THREE.MeshBasicMaterial).map = tex; (this.medallion.material as THREE.MeshBasicMaterial).needsUpdate = true; };
    const fallback = () => {
      const c = document.createElement("canvas"); c.width = c.height = 128;
      const g = c.getContext("2d");
      if (g) { g.fillStyle = "#4f46e5"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#fff"; g.font = "bold 80px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(initial.toUpperCase(), 64, 70); }
      apply(new THREE.CanvasTexture(c));
    };
    if (!url) { fallback(); return; }
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, apply, undefined, fallback); // cross-origin avatars without CORS headers fall back to the initial
  }

  // ---------------------------------------------------------------- positions & tweens
  private stepX(i: number) { return SPAN_L + ((i + 0.5) * (SPAN_R - SPAN_L)) / Math.max(1, this.n); }
  private posOf(i: number) {
    if (i < 0) return new THREE.Vector3(BANK_L + 0.2, BIRD_Y, 0);
    if (i >= this.n) return new THREE.Vector3(BANK_R - 0.2, BIRD_Y, 0);
    return new THREE.Vector3(this.stepX(i), STEP_TOP + BIRD_Y - 0.05, 0);
  }
  private placeBird(i: number) { this.bird.position.copy(this.posOf(i)); this.bird.rotation.set(0, 0, 0); this.bird.scale.set(1, 1, 1); this.at = i; }
  private tween(dur: number, update: (k: number) => void): Promise<void> {
    return new Promise((resolve) => { this.tweens.push({ t: 0, dur, update, done: resolve }); });
  }
  private async hop(to: number, dur = 0.45) {
    const a = this.bird.position.clone(), b = this.posOf(to);
    this.at = to;
    await this.tween(dur, (k) => {
      this.bird.position.lerpVectors(a, b, smooth(k));
      this.bird.position.y += Math.sin(Math.PI * k) * 0.95;
      const sq = 1 + Math.sin(Math.PI * k) * 0.12;
      this.bird.scale.set(1 / sq, sq, 1);
    });
    this.bird.position.copy(b);
    this.bird.scale.set(1, 1, 1);
  }

  // ---------------------------------------------------------------- game API
  setLevel(n: number) {
    this.tweens = [];
    for (const s of this.steps) { this.scene.remove(s); s.geometry.dispose(); (s.material as THREE.Material).dispose(); }
    this.steps = [];
    this.n = n;
    const w = (SPAN_R - SPAN_L) / n;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, 0.18, 1.7), new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.8 }));
      mesh.position.set(this.stepX(i), STEP_TOP - 0.09, 0);
      mesh.scale.set(0.001, 0.001, 0.001);
      this.steps.push(mesh);
      this.scene.add(mesh);
    }
    for (const l of this.labels) this.scene.remove(l.sprite);
    this.labels = [];
    this.setBody(0xfacc15);
    this.placeBird(-1);
  }
  private setBody(color: number) { (this.body.material as THREE.MeshStandardMaterial).color.setHex(color); }
  private showStep(i: number, show: boolean) {
    const m = this.steps[i];
    if (!m) return Promise.resolve();
    const from = m.scale.x, to = show ? 1 : 0.001;
    return this.tween(show ? 0.4 : 0.25, (k) => { const s = from + (to - from) * smooth(k); m.scale.set(s, s, s); m.position.y = STEP_TOP - 0.09 + (show ? (1 - smooth(k)) * 0.6 : 0); });
  }

  /** A correct word: a plank appears, the bird jumps onto it and the chosen word floats above it on a yellow label. */
  async place(i: number, word: string) {
    void this.showStep(i, true);
    this.addLabel(word);
    await this.hop(i);
  }
  /** Words returned to the board: their planks disappear and the bird steps back. */
  async remove(from: number) {
    for (let j = from; j < this.n; j++) void this.showStep(j, false);
    for (const s of this.steps) (s.material as THREE.MeshStandardMaterial).color.setHex(WOOD);
    this.setBody(0xfacc15);
    await this.hop(from - 1, 0.35);
  }
  /** A wrong word: the bird is startled (it jerks and flashes red). */
  async startle() {
    this.setBody(0xef4444);
    const base = this.bird.position.clone();
    await this.tween(0.45, (k) => { this.bird.position.x = base.x + Math.sin(k * 40) * 0.08 * (1 - k); this.bird.position.y = base.y + Math.sin(k * Math.PI) * 0.35; this.bird.rotation.z = Math.sin(k * 30) * 0.25 * (1 - k); });
    this.bird.position.copy(base); this.bird.rotation.z = 0;
    this.setBody(0xfacc15);
  }
  /** The whole bridge turns green. */
  async complete() {
    const from = new THREE.Color(WOOD), to = new THREE.Color(GREEN);
    await this.tween(0.6, (k) => { for (const s of this.steps) (s.material as THREE.MeshStandardMaterial).color.copy(from).lerp(to, k); });
  }
  /** The bird walks over the finished bridge to the other bank. */
  async cross() {
    for (let i = this.at + 1; i <= this.n; i++) await this.hop(i, 0.32);
  }
  /** No hearts left: the bird falls into the river. */
  async fall() {
    this.setBody(0xef4444);
    const y0 = this.bird.position.y;
    await this.tween(0.9, (k) => { this.bird.position.y = y0 - k * k * 2.4; this.bird.rotation.z = k * 5; this.bird.rotation.x = k * 2; });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(this.bird.position.x, -1.05, 0.2);
    this.scene.add(ring);
    await this.tween(0.8, (k) => { ring.scale.setScalar(1 + k * 5); (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k; });
    this.scene.remove(ring);
  }

  private addLabel(text: string) {
    const c = document.createElement("canvas"); c.width = 360; c.height = 104;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#fde047"; g.strokeStyle = "#ca8a04"; g.lineWidth = 6;
      g.beginPath(); g.roundRect(6, 6, 348, 76, 22); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(160, 82); g.lineTo(180, 100); g.lineTo(200, 82); g.fill();
      g.fillStyle = "#111827"; g.textAlign = "center"; g.textBaseline = "middle";
      let size = 46; g.font = `bold ${size}px sans-serif`;
      while (g.measureText(text).width > 320 && size > 18) { size -= 2; g.font = `bold ${size}px sans-serif`; }
      g.fillText(text, 180, 46);
    }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(2.2, 0.64, 1);
    this.scene.add(sprite);
    this.labels.push({ sprite, age: 0 });
  }

  // ---------------------------------------------------------------- loop
  private resize() {
    const host = this.canvas.parentElement ?? this.canvas;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const half = 7.4; // keep the whole bridge in view on narrow screens
    const z = Math.max(10, half / (Math.tan((this.camera.fov * Math.PI) / 360) * this.camera.aspect));
    this.camera.position.set(0, 2.6, z);
    this.camera.lookAt(0, 0.5, 0);
    this.camera.updateProjectionMatrix();
  }
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05), time = this.clock.elapsedTime;
    for (const tw of [...this.tweens]) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.update(k);
      if (k >= 1) { this.tweens = this.tweens.filter((x) => x !== tw); tw.done(); }
    }
    const pos = this.water.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 0.7 + time * 1.6) * 0.09 + Math.cos(pos.getY(i) * 1.1 + time * 1.2) * 0.06);
    pos.needsUpdate = true;
    this.wings.forEach((w, i) => { w.rotation.x = Math.sin(time * 6 + i * Math.PI) * 0.18; });
    for (const c of this.clouds) { c.position.x += dt * 0.25; if (c.position.x > 11) c.position.x = -11; }
    for (const l of [...this.labels]) {
      l.age += dt;
      l.sprite.position.set(this.bird.position.x, this.bird.position.y + 1.15 + Math.min(l.age, 1) * 0.25, 0.8);
      (l.sprite.material as THREE.SpriteMaterial).opacity = l.age < 1.1 ? 1 : Math.max(0, 1 - (l.age - 1.1) / 0.5);
      if (l.age > 1.6) { this.scene.remove(l.sprite); this.labels = this.labels.filter((x) => x !== l); }
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
  }
}
