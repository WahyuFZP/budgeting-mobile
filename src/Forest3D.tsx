// Kas's mascot and scenery (three.js via React Three Fiber), built from primitives: no model files to ship.
// A squirrel holding an acorn (saving for later) in a small morning forest.
//   - eyes follow the finger, it blinks; a tap makes it hop
//   - income: an acorn drops into its paws; expense: the acorn slips out and falls
//   - brows show the budget mood: flat (fine), raised inner ends (almost spent), sad (over budget)
// Battery: renders continuously only for a few seconds after something happens, then idles on 'demand'.
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Group, Mesh } from 'three';

export type Mood = 'ok' | 'warn' | 'over';
type Acorn = 'in' | 'out';

const FUR = '#C8763A';
const FUR_DARK = '#A65E2B';
const BELLY = '#F3DDB8';
const INK = '#1E140E';
const NUT = '#9C6B3C';
const CAP = '#5E3B1E';
const PINE = ['#2F6B45', '#3C7D52', '#4B8F5F'];
const TRUNK = '#6B4A2B';
const HILL = ['#3E7A57', '#5E9A6A'];
const SUN = '#F2B33D';
const MOOD_LABEL: Record<Mood, string> = { ok: 'senang, budget masih aman', warn: 'cemas, budget hampir habis', over: 'sedih, budget terlampaui' };

type Shared = {
  look: { x: number; y: number };
  hop: boolean;
  hopAt: number | null;
  acorn: Acorn | null;
  acornReq: boolean;
  acornAt: number | null;
  blink: boolean;
  blinkAt: number | null;
  gustReq: boolean;
  gustAt: number | null;
};

const mat = (color: string, rough = 0.6) => <meshStandardMaterial color={color} roughness={rough} metalness={0} />;

function Pine({ x, z, s = 1 }: { x: number; z: number; s?: number }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 0.5, 8]} />
        {mat(TRUNK)}
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.7 + i * 0.38, 0]}>
          <coneGeometry args={[0.55 - i * 0.13, 0.7, 10]} />
          {mat(PINE[i])}
        </mesh>
      ))}
    </group>
  );
}

/** A gust: white streaks and two leaves drift left to right while two or three birds cross the sky right to left.
 *  It lasts ~3 s and then the sky is calm until the next gust (every ~8 s, see Forest3D), so it never loops nonstop. */
const STREAKS = [
  { y: 1.7, z: 0.6, len: 1.4, delay: 0, dur: 2.2 },
  { y: 1.1, z: 1.0, len: 1.0, delay: 0.35, dur: 1.8 },
  { y: 2.2, z: -0.4, len: 1.8, delay: 0.6, dur: 2.4 },
];
const LEAVES = [
  { y: 1.4, z: 0.9, delay: 0.2, dur: 2.8, color: '#E39B3A' },
  { y: 0.9, z: 0.4, delay: 0.7, dur: 2.6, color: '#7FB069' },
];
const BIRDS = [
  { y: 2.45, z: -2, delay: 0.3, dur: 3.0, s: 1 },
  { y: 2.25, z: -2.2, delay: 0.55, dur: 3.0, s: 0.85 },
  { y: 2.6, z: -2.4, delay: 0.75, dur: 3.1, s: 0.75 },
];
export const GUST_S = 3.9; // longest delay + duration: how long the scene must keep rendering for one gust
const SPAN = 16; // world units a gust travels across, wider than the widest card
const BIRD = '#EAF2E6';

function Gust({ shared }: { shared: Shared }) {
  const streaks = useRef<(Mesh | null)[]>([]);
  const leaves = useRef<(Mesh | null)[]>([]);
  const birds = useRef<(Group | null)[]>([]);
  const wings = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (shared.gustReq) {
      shared.gustReq = false;
      shared.gustAt = t;
    }
    const since = shared.gustAt === null ? Infinity : t - shared.gustAt;
    const progress = (delay: number, dur: number) => (since - delay) / dur; // 0..1 while on screen
    STREAKS.forEach((w, i) => {
      const m = streaks.current[i];
      if (!m) return;
      const p = progress(w.delay, w.dur);
      m.visible = p >= 0 && p <= 1;
      m.position.x = -SPAN / 2 + p * SPAN;
      m.position.y = w.y + Math.sin(t * 3 + i) * 0.06;
    });
    LEAVES.forEach((l, i) => {
      const m = leaves.current[i];
      if (!m) return;
      const p = progress(l.delay, l.dur);
      m.visible = p >= 0 && p <= 1;
      m.position.x = -SPAN / 2 + p * SPAN;
      m.position.y = l.y + Math.sin(t * 2.5 + i) * 0.25; // flutters while drifting
      m.rotation.set(t * 3 + i, t * 2, t * 4);
    });
    BIRDS.forEach((b, i) => {
      const g = birds.current[i];
      if (!g) return;
      const p = progress(b.delay, b.dur);
      g.visible = p >= 0 && p <= 1;
      g.position.x = SPAN / 2 - p * SPAN; // right to left, against the wind
      g.position.y = b.y + Math.sin(p * Math.PI) * 0.25; // shallow arc
      const flap = Math.sin(t * 14 + i) * 0.7; // wings beat up and down around the body's long axis
      wings.current[i * 2]?.rotation.set(flap, 0, 0);
      wings.current[i * 2 + 1]?.rotation.set(-flap, 0, 0);
    });
    if (since > GUST_S) shared.gustAt = null;
  });
  return (
    <>
      {STREAKS.map((w, i) => (
        <mesh key={i} visible={false} ref={(m) => void (streaks.current[i] = m)} position={[0, w.y, w.z]}>
          <boxGeometry args={[w.len, 0.022, 0.01]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.45} />
        </mesh>
      ))}
      {LEAVES.map((l, i) => (
        <mesh key={i} visible={false} ref={(m) => void (leaves.current[i] = m)} position={[0, l.y, l.z]} scale={[0.13, 0.025, 0.08]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color={l.color} roughness={0.7} />
        </mesh>
      ))}
      {BIRDS.map((b, i) => (
        // turned a little toward the camera so the wing beats read as a bird, not a line
        <group key={i} visible={false} ref={(g) => void (birds.current[i] = g)} position={[0, b.y, b.z]} rotation={[0.5, 0.5, 0]} scale={b.s}>
          <mesh scale={[0.16, 0.06, 0.06]}>
            <sphereGeometry args={[1, 10, 6]} />
            <meshBasicMaterial color={BIRD} />
          </mesh>
          {/* each wing hinges at the body: the group is the hinge, the box hangs off it */}
          {[-1, 1].map((side, k) => (
            <group key={side} ref={(g) => void (wings.current[i * 2 + k] = g)}>
              <mesh position={[0, 0, side * 0.13]} scale={[0.1, 0.012, 0.24]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color={BIRD} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

function Scene({ shared, mood, still, scenery, shift, drop }: { shared: Shared; mood: Mood; still: boolean; scenery: boolean; shift: number; drop: number }) {
  const squirrel = useRef<Group>(null);
  const world = useRef<Group>(null); // whole scene; eases toward `drop` so moving it never jumps
  const tail = useRef<Group>(null);
  const trees = useRef<Group>(null);
  const acorn = useRef<Group>(null);
  const eyes = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const pupils = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const brows = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const cur = useRef({ x: 0, y: 0 });

  useFrame(({ clock }, dt) => {
    if (world.current) world.current.position.y += (drop - world.current.position.y) * Math.min(1, dt * (still ? 60 : 6));
    const g = squirrel.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    const k = Math.min(1, dt * 8);
    cur.current.x += (shared.look.x - cur.current.x) * k;
    cur.current.y += (shared.look.y - cur.current.y) * k;
    const { x, y } = cur.current;

    // body turns a little toward the finger, eyes a lot
    g.rotation.y = -0.25 + x * 0.5;
    g.rotation.x = (mood === 'over' ? 0.1 : 0) - y * 0.15;
    pupils.forEach((p, i) => p.current?.position.set((i ? 0.16 : -0.16) + x * 0.035, 1.42 + y * 0.035 - (mood === 'over' ? 0.02 : 0), 0.52));
    const tilt = mood === 'ok' ? 0 : mood === 'warn' ? 0.3 : 0.5;
    brows.forEach((b, i) => b.current && (b.current.rotation.z = i ? -tilt : tilt));

    // idle life: breathing bob, tail sway, trees in the breeze
    if (!still) {
      if (tail.current) tail.current.rotation.z = Math.sin(t * 1.8) * 0.12;
      if (trees.current) trees.current.children.forEach((tr, i) => (tr.rotation.z = Math.sin(t * 1.2 + i) * 0.03));
    }
    let lift = still ? 0 : Math.sin(t * (mood === 'ok' ? 2.2 : 1.1)) * 0.02;
    if (shared.hop) {
      shared.hop = false;
      shared.hopAt = t;
    }
    if (shared.hopAt !== null && !still) {
      const h = (t - shared.hopAt) / 0.5;
      if (h < 1) lift += Math.sin(Math.PI * h) * 0.35;
      else shared.hopAt = null;
    }
    g.position.y = lift;

    // blink: lids close ~120 ms
    if (shared.blink) {
      shared.blink = false;
      shared.blinkAt = t;
    }
    const b = shared.blinkAt === null ? 1 : t - shared.blinkAt;
    if (b >= 0.12) shared.blinkAt = null;
    const lid = !still && b < 0.12 ? 0.12 : 1;
    [...eyes, ...pupils].forEach((m) => m.current?.scale.set(1, lid, 1));

    // acorn: held in the paws at rest; drops in from above on income, slips out and falls on expense
    const a = acorn.current;
    if (!a) return;
    if (shared.acornReq) {
      shared.acornReq = false;
      shared.acornAt = still ? null : t;
    }
    const dir = shared.acorn;
    const p = shared.acornAt === null || !dir ? 1 : (t - shared.acornAt) / (dir === 'in' ? 0.6 : 0.8);
    if (p >= 1) {
      shared.acornAt = null;
      a.position.set(0, 0.88, 0.56);
      a.scale.setScalar(1);
      a.rotation.z = 0;
    } else if (dir === 'in') {
      a.position.set(0, 2.6 - 1.72 * p * p, 0.56); // falls with gravity-like ease into the paws
      a.rotation.z = p * Math.PI * 2;
      a.scale.setScalar(1);
    } else {
      a.position.set(0.25 * p, 0.88 - 0.8 * p * p, 0.56 + 0.4 * p); // slips forward and down
      a.rotation.z = -p * Math.PI;
      a.scale.setScalar(p < 0.7 ? 1 : (1 - p) / 0.3 + 0.001);
    }
  });

  return (
    <group ref={world} position={[0, drop, 0]}>
    {scenery && !still && <Gust shared={shared} />}
    <group position={[shift, 0, 0]}>
      {scenery && (
        <>
          <mesh position={[2.2 - shift * 0.6, 2.6, -4]}>
            <sphereGeometry args={[0.45, 24, 16]} />
            <meshStandardMaterial color={SUN} emissive={SUN} emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[-1.5, -1.9, -2.5]} scale={[3.2, 2.2, 1.6]}>
            <sphereGeometry args={[1, 32, 16]} />
            {mat(HILL[0])}
          </mesh>
          <mesh position={[1.8, -2.1, -1.5]} scale={[3, 2.3, 1.6]}>
            <sphereGeometry args={[1, 32, 16]} />
            {mat(HILL[1])}
          </mesh>
          <group ref={trees}>
            <Pine x={-1.9} z={-1.6} s={1.1} />
            <Pine x={-1.2} z={-2.4} s={0.8} />
            <Pine x={1.7} z={-1.2} s={0.95} />
            <Pine x={2.4} z={-2.2} s={0.7} />
          </group>
        </>
      )}
      <group ref={squirrel}>
        {/* tail first so it sits behind the body */}
        <group ref={tail} position={[0, 0.35, -0.45]}>
          {[
            [0, 0.15, -0.1, 0.3],
            [0, 0.55, -0.32, 0.36],
            [0, 0.98, -0.34, 0.38],
            [0, 1.36, -0.18, 0.33],
            [0, 1.6, 0.05, 0.25],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x, y, z]}>
              <sphereGeometry args={[r, 20, 14]} />
              {mat(i % 2 ? FUR_DARK : FUR, 0.85)}
            </mesh>
          ))}
        </group>
        <mesh position={[0, 0.62, 0]} scale={[0.85, 1.05, 0.8]}>
          <sphereGeometry args={[0.55, 32, 20]} />
          {mat(FUR)}
        </mesh>
        <mesh position={[0, 0.58, 0.3]} scale={[0.7, 0.9, 0.5]}>
          <sphereGeometry args={[0.42, 24, 16]} />
          {mat(BELLY)}
        </mesh>
        {/* head */}
        <mesh position={[0, 1.36, 0.12]}>
          <sphereGeometry args={[0.42, 32, 20]} />
          {mat(FUR)}
        </mesh>
        <mesh position={[0, 1.24, 0.46]} scale={[1.25, 0.85, 1]}>
          <sphereGeometry args={[0.16, 20, 14]} />
          {mat(BELLY)}
        </mesh>
        <mesh position={[0, 1.29, 0.61]}>
          <sphereGeometry args={[0.055, 12, 10]} />
          {mat(INK, 0.3)}
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.24, 1.72, 0.05]} rotation={[0, 0, -s * 0.25]}>
            <mesh>
              <coneGeometry args={[0.11, 0.3, 12]} />
              {mat(FUR)}
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <coneGeometry args={[0.05, 0.14, 8]} />
              {mat(FUR_DARK)}
            </mesh>
          </group>
        ))}
        {/* eyes, pupils, brows */}
        {[-0.16, 0.16].map((x, i) => (
          <mesh key={x} ref={eyes[i]} position={[x, 1.42, 0.44]}>
            <sphereGeometry args={[0.1, 20, 14]} />
            {mat('#FFFFFF', 0.25)}
          </mesh>
        ))}
        {pupils.map((r, i) => (
          <mesh key={i} ref={r} position={[i ? 0.16 : -0.16, 1.42, 0.52]}>
            <sphereGeometry args={[0.05, 14, 10]} />
            {mat(INK, 0.2)}
          </mesh>
        ))}
        {brows.map((r, i) => (
          <mesh key={i} ref={r} position={[i ? 0.16 : -0.16, 1.57, 0.45]}>
            <boxGeometry args={[0.15, 0.03, 0.03]} />
            {mat(FUR_DARK)}
          </mesh>
        ))}
        {/* paws reaching forward to hold the acorn, feet */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.17, 0.86, 0.48]} rotation={[-1.1, 0, s * 0.4]}>
            <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
            {mat(FUR_DARK)}
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.24, 0.08, 0.2]} scale={[1, 0.55, 1.5]}>
            <sphereGeometry args={[0.14, 16, 10]} />
            {mat(FUR_DARK)}
          </mesh>
        ))}
        <group ref={acorn} position={[0, 0.88, 0.56]}>
          <mesh scale={[1, 1.2, 1]}>
            <sphereGeometry args={[0.12, 16, 12]} />
            {mat(NUT, 0.5)}
          </mesh>
          <mesh position={[0, 0.1, 0]} scale={[1, 0.55, 1]}>
            <sphereGeometry args={[0.13, 16, 10]} />
            {mat(CAP, 0.9)}
          </mesh>
          <mesh position={[0, 0.19, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.06, 6]} />
            {mat(CAP)}
          </mesh>
        </group>
      </group>
    </group>
    </group>
  );
}

export default function Forest3D({
  width = 240,
  height = 240,
  mood = 'ok',
  hopKey,
  acorn,
  scenery = true,
  shift = 0,
  drop = -0.6,
  distance = 4.6,
  onTap,
  alwaysLive = false,
}: {
  width?: number;
  height?: number;
  mood?: Mood;
  /** change it to make the squirrel react (e.g. pass the balance) */
  hopKey?: unknown;
  /** with a hopKey change: 'in' drops an acorn into its paws, 'out' makes it lose one */
  acorn?: Acorn;
  /** hills, pines and sun behind the squirrel */
  scenery?: boolean;
  /** move the squirrel and its forest sideways (world units), e.g. to the right of text in a wide card */
  shift?: number;
  /** camera distance; wider cards need it further back so the squirrel is not cropped */
  distance?: number;
  /** lower the whole scene (world units); the camera aims at the origin, so a squirrel standing on it sits high */
  drop?: number;
  /** called when the user touches the scene, e.g. to show what the squirrel says */
  onTap?: () => void;
  alwaysLive?: boolean;
}) {
  const still = useReducedMotion();
  const shared = useRef<Shared>({ look: { x: 0, y: 0 }, hop: false, hopAt: null, acorn: null, acornReq: false, acornAt: null, blink: false, blinkAt: null, gustReq: false, gustAt: null }).current;
  const [live, setLive] = useState(true);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  const wake = (ms = 2500) => {
    setLive(true);
    clearTimeout(idle.current);
    if (!alwaysLive) idle.current = setTimeout(() => setLive(false), ms);
  };
  const hop = () => {
    if (!still) shared.hop = true;
    wake();
  };
  useEffect(() => {
    wake();
    return () => clearTimeout(idle.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, drop]);
  // a sign of life every few seconds: a gust passes (wind, leaves, birds), the squirrel blinks, then calm again
  useEffect(() => {
    if (still) return;
    const gust = () => {
      shared.blink = true;
      shared.gustReq = true;
      wake(GUST_S * 1000 + 300);
    };
    const first = setTimeout(gust, 1500);
    const id = setInterval(gust, 8000);
    return () => (clearTimeout(first), clearInterval(id));
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    if (acorn) {
      shared.acorn = acorn;
      shared.acornReq = true;
    }
    hop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopKey]);

  const lookAt = (x: number, y: number) => {
    shared.look = { x: Math.max(-1, Math.min(1, (x / width) * 2 - 1)), y: Math.max(-1, Math.min(1, -((y / height) * 2 - 1))) };
    wake();
  };

  return (
    <View
      style={{ width, height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Tupai Kas di hutan kecil, ${MOOD_LABEL[mood]}`}
      onTouchStart={(e) => (lookAt(e.nativeEvent.locationX, e.nativeEvent.locationY), hop(), onTap?.())}
      onTouchMove={(e) => lookAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onTouchEnd={() => ((shared.look = { x: 0, y: 0 }), wake())}
    >
      {/* keyed by distance: R3F reads the camera only when the canvas is created */}
      <Canvas key={distance} camera={{ position: [0, 1.25, distance], fov: 40 }} frameloop={live ? 'always' : 'demand'}>
        <ambientLight intensity={1.0} />
        <directionalLight position={[3, 4, 4]} intensity={2.1} color="#FFF4DA" />
        <directionalLight position={[-3, 1, 2]} intensity={0.5} />
        <Scene shared={shared} mood={mood} still={still} scenery={scenery} shift={shift} drop={drop} />
      </Canvas>
    </View>
  );
}
