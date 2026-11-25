// Kas's mascot: a sky-blue piggy bank built from primitives (no model file to ship).
// Eyes follow the finger, a tap makes it hop, a changed balance makes it hop, and its brows show the budget mood.
// Battery: renders continuously only for a few seconds after something happens, then idles on 'demand'.
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Group, Mesh } from 'three';

export type Mood = 'ok' | 'warn' | 'over';

const BODY = '#6CC3FF';
const SHADE = '#4AA8E8';
const INK = '#0E1A2B';
const DEEP = '#14386B';
const HOP_S = 0.5;
const MOOD_LABEL: Record<Mood, string> = { ok: 'senang, budget masih aman', warn: 'cemas, budget hampir habis', over: 'sedih, budget terlampaui' };

type Coin = 'in' | 'out';
type Shared = { look: { x: number; y: number }; hopRequested: boolean; hopAt: number | null; coin: Coin | null; coinRequested: boolean; coinAt: number | null; blinkRequested: boolean; blinkAt: number | null };
const COIN_S = { in: 0.55, out: 0.7 };

function Pig({ shared, mood, still }: { shared: Shared; mood: Mood; still: boolean }) {
  const root = useRef<Group>(null);
  const pupils = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const eyes = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const brows = [useRef<Mesh>(null), useRef<Mesh>(null)];
  const cur = useRef({ x: 0, y: 0 });
  const coin = useRef<Mesh>(null);

  useFrame(({ clock }, dt) => {
    const g = root.current;
    if (!g) return;
    const k = Math.min(1, dt * 8);
    cur.current.x += (shared.look.x - cur.current.x) * k;
    cur.current.y += (shared.look.y - cur.current.y) * k;
    const { x, y } = cur.current;

    // whole body turns a little toward the finger, eyes a lot
    g.rotation.y = -0.35 + x * 0.45;
    g.rotation.x = (mood === 'over' ? 0.12 : 0) - y * 0.2;
    pupils.forEach((p, i) => p.current?.position.set((i ? 0.35 : -0.35) + x * 0.06, 0.3 + y * 0.06 - (mood === 'over' ? 0.04 : 0), 0.93));

    // brows: flat when fine, inner ends up when worried/sad
    const tilt = mood === 'ok' ? 0 : mood === 'warn' ? 0.25 : 0.45;
    brows.forEach((b, i) => b.current && (b.current.rotation.z = i ? -tilt : tilt));

    const t = clock.getElapsedTime();
    let lift = still ? 0 : Math.sin(t * (mood === 'ok' ? 2.4 : 1.2)) * 0.03;
    if (shared.hopRequested) {
      shared.hopRequested = false;
      shared.hopAt = t;
    }
    if (shared.hopAt !== null && !still) {
      const h = t - shared.hopAt;
      if (h < HOP_S) lift += Math.sin((Math.PI * h) / HOP_S) * 0.35;
      else shared.hopAt = null;
    }
    g.position.y = lift;

    // blink: eyes close for ~120 ms when asked (periodically, see Piggy3D)
    if (shared.blinkRequested) {
      shared.blinkRequested = false;
      shared.blinkAt = t;
    }
    const b = shared.blinkAt === null ? 1 : t - shared.blinkAt;
    const lid = !still && b < 0.12 ? 0.12 : 1;
    if (b >= 0.12) shared.blinkAt = null;
    [...eyes, ...pupils].forEach((m) => m.current?.scale.set(1, lid, 1));

    // money in: a coin drops into the slot on the back; money out: one rises out of it and fades
    const c = coin.current;
    if (!c) return;
    if (shared.coinRequested) {
      shared.coinRequested = false;
      shared.coinAt = still ? null : t;
    }
    const dir = shared.coin;
    const h = shared.coinAt === null || !dir ? Infinity : (t - shared.coinAt) / COIN_S[dir];
    c.visible = h < 1;
    if (!c.visible || !dir) {
      if (shared.coinAt !== null) shared.coinAt = null;
      return;
    }
    c.rotation.y = h * Math.PI * 2;
    if (dir === 'in') {
      c.position.y = 2.1 - 1.5 * h * h; // gravity-like ease-in; the body hides it once it is below the slot
      c.scale.setScalar(1);
    } else {
      c.position.y = 0.75 + 1.4 * (1 - (1 - h) * (1 - h)); // ease-out rise
      c.scale.setScalar(h < 0.7 ? 1 : (1 - h) / 0.3);
    }
  });

  const mat = (color: string, rough = 0.45) => <meshStandardMaterial color={color} roughness={rough} metalness={0.05} />;
  return (
    <group ref={root}>
      <mesh scale={[1.15, 0.95, 0.95]}>
        <sphereGeometry args={[1, 48, 32]} />
        {mat(BODY)}
      </mesh>
      {/* snout + nostrils */}
      <mesh position={[0, -0.05, 0.92]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.32, 0.34, 0.28, 32]} />
        {mat(SHADE)}
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, -0.05, 1.07]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          {mat(DEEP)}
        </mesh>
      ))}
      {/* eyes */}
      {[-0.35, 0.35].map((x, i) => (
        <mesh key={x} ref={eyes[i]} position={[x, 0.3, 0.8]}>
          <sphereGeometry args={[0.16, 24, 16]} />
          {mat('#FFFFFF', 0.3)}
        </mesh>
      ))}
      {pupils.map((r, i) => (
        <mesh key={i} ref={r} position={[i ? 0.35 : -0.35, 0.3, 0.93]}>
          <sphereGeometry args={[0.075, 16, 12]} />
          {mat(INK, 0.2)}
        </mesh>
      ))}
      {brows.map((r, i) => (
        <mesh key={i} ref={r} position={[i ? 0.35 : -0.35, 0.53, 0.82]}>
          <boxGeometry args={[0.26, 0.05, 0.05]} />
          {mat(DEEP)}
        </mesh>
      ))}
      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.55, 0.82, 0.2]} rotation={[0, 0, -s * 0.4]}>
          <coneGeometry args={[0.2, 0.36, 24]} />
          {mat(SHADE)}
        </mesh>
      ))}
      {/* legs */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.5, -0.85, sz * 0.4]}>
            <cylinderGeometry args={[0.16, 0.16, 0.36, 20]} />
            {mat(SHADE)}
          </mesh>
        )),
      )}
      <mesh ref={coin} visible={false} position={[0, 2, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.06, 32]} />
        <meshStandardMaterial color="#D9DEE5" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* coin slot on the back, tail */}
      <mesh position={[0, 0.93, -0.1]}>
        <boxGeometry args={[0.5, 0.05, 0.12]} />
        {mat(DEEP)}
      </mesh>
      <mesh position={[0, 0.15, -1.0]}>
        <torusGeometry args={[0.12, 0.04, 10, 24]} />
        {mat(SHADE)}
      </mesh>
    </group>
  );
}

export default function Piggy3D({
  size = 240,
  mood = 'ok',
  hopKey,
  coin,
  alwaysLive = false,
}: {
  size?: number;
  mood?: Mood;
  hopKey?: unknown;
  /** with a hopKey change: 'in' drops a coin into the piggy, 'out' takes one out */
  coin?: Coin;
  alwaysLive?: boolean;
}) {
  const still = useReducedMotion();
  const shared = useRef<Shared>({ look: { x: 0, y: 0 }, hopRequested: false, hopAt: null, coin: null, coinRequested: false, coinAt: null, blinkRequested: false, blinkAt: null }).current;
  const [live, setLive] = useState(true);
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);

  // keep rendering for a moment after any event, then stop (unless this is the onboarding hero)
  const wake = () => {
    setLive(true);
    clearTimeout(idle.current);
    if (!alwaysLive) idle.current = setTimeout(() => setLive(false), 2500);
  };
  const hop = () => {
    if (!still) shared.hopRequested = true;
    wake();
  };
  useEffect(() => {
    wake();
    return () => clearTimeout(idle.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);
  // a sign of life every few seconds: wake briefly, blink and bob, then stop rendering again
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => {
      shared.blinkRequested = true;
      wake();
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    if (coin) {
      shared.coin = coin;
      shared.coinRequested = true;
    }
    hop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hopKey]);

  const lookAt = (x: number, y: number) => {
    shared.look = { x: Math.max(-1, Math.min(1, (x / size) * 2 - 1)), y: Math.max(-1, Math.min(1, -((y / size) * 2 - 1))) };
    wake();
  };

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Celengan Kas, ${MOOD_LABEL[mood]}`}
      onTouchStart={(e) => (lookAt(e.nativeEvent.locationX, e.nativeEvent.locationY), hop())}
      onTouchMove={(e) => lookAt(e.nativeEvent.locationX, e.nativeEvent.locationY)}
      onTouchEnd={() => ((shared.look = { x: 0, y: 0 }), wake())}
    >
      <Canvas camera={{ position: [0, 0.3, 4.2], fov: 42 }} frameloop={live ? 'always' : 'demand'}>
        <ambientLight intensity={1.1} />
        <directionalLight position={[2, 3, 4]} intensity={2} />
        <directionalLight position={[-3, 1, 2]} intensity={0.6} />
        <Pig shared={shared} mood={mood} still={still} />
      </Canvas>
    </View>
  );
}
