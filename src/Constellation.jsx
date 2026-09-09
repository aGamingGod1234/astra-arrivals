import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { randomGenerator, SOURCE_STARS } from "./cinematics.js";
import { createParticlePhysics, EVENT_SECONDS } from "./particlePhysics.js";
import {
  planeVertex,
  particleVertex,
  particleFragment,
  eventFragment,
  spaceFragment,
  starsVertex,
  starsFragment,
} from "./spaceShaders.js";

function numeralGeometry(count) {
  const canvas = document.createElement("canvas");
  canvas.width = 560;
  canvas.height = 640;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.font = '650 640px "Geist Variable", sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("6", 280, 330);
  const pixels = ctx.getImageData(0, 0, 560, 640).data,
    samples = [];
  let minY = 640,
    maxY = 0;
  for (let y = 0; y < 640; y += 2)
    for (let x = 0; x < 560; x += 2) {
      if (pixels[(y * 560 + x) * 4 + 3] > 100) {
        samples.push([x, y]);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  const random = randomGenerator(6006),
    scale = 4.35 / (maxY - minY);
  const positions = new Float32Array(count * 3),
    seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = samples[Math.floor(random() * samples.length)];
    positions.set(
      [
        (p[0] - 280 + random() * 2) * scale,
        -(p[1] - (minY + maxY) / 2 + random() * 2) * scale,
        (random() - 0.5) * 0.4,
      ],
      i * 3,
    );
    seeds[i] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

function starsGeometry(count, local = false) {
  const random = randomGenerator(7331),
    positions = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    seeds = new Float32Array(count),
    colors = new Float32Array(count * 3);
  const palette = ["#afbcd4", "#e2c6a1", "#d8dee8"];
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = random();
    positions.set(
      local
        ? [...SOURCE_STARS[i], -0.7]
        : [random() - 0.5, random() - 0.5, -12],
      i * 3,
    );
    sizes[i] = local ? 6 : r > 0.985 ? 8 + random() * 5 : 0.8 + random() * 2.0;
    seeds[i] = local ? 0.98 : r;
    color.set(palette[i % 3]);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  return g;
}

export default memo(function Constellation({
  director,
  stageRef,
  reduced,
  paused,
}) {
  const host = useRef(null),
    control = useRef({ reduced, paused });
  control.current = { reduced, paused };
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    let disposed = false,
      cleanup = () => {};
    document.fonts.ready.then(() => {
      if (disposed) return;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          alpha: false,
          antialias: false,
          powerPreference: "high-performance",
        });
      } catch {
        setFallback(true);
        return;
      }
      const node = host.current,
        scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
      camera.position.z = 500;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      renderer.setClearColor("#050811");
      node.appendChild(renderer.domElement);
      renderer.domElement.setAttribute("aria-hidden", "true");
      const uniforms = {
        uTime: { value: 0 },
        uAge: { value: -1 },
        uType: { value: 0 },
        uStrength: { value: 1 },
        uAngle: { value: 0 },
        uSpin: { value: 1 },
        uSignature: { value: 0 },
        uSource: { value: new THREE.Vector2(-2.9, 1.8) },
        uColor: { value: new THREE.Color("#d4c29d") },
        uPixelRatio: { value: renderer.getPixelRatio() },
        uPointer: { value: new THREE.Vector2(20, 20) },
        uGentle: { value: reduced ? 1 : 0 },
        uAspect: { value: 1 },
        uEnvelope: { value: 0 },
        uFront1: { value: 0 },
        uFront2: { value: 0 },
        uIgnition: { value: 0 },
        uOrbit: { value: 0 },
        uFlowAngle: { value: 0 },
        uLensCentre: { value: new THREE.Vector2() },
        uMeteorHeads: { value: new Float32Array(6) },
        uMeteorOpacity: { value: new Float32Array(6) },
      };
      const nebula = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader: planeVertex,
          fragmentShader: spaceFragment,
          depthWrite: false,
          depthTest: false,
        }),
      );
      nebula.position.z = -500;
      nebula.renderOrder = -10;
      scene.add(nebula);
      const starsMaterial = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: starsVertex,
        fragmentShader: starsFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const stars = new THREE.Points(
        starsGeometry(innerWidth < 768 ? 850 : 1700),
        starsMaterial,
      );
      stars.frustumCulled = false;
      stars.renderOrder = -5;
      scene.add(stars);
      const sculpture = new THREE.Group();
      scene.add(sculpture);
      const anchors = new THREE.Points(
        starsGeometry(SOURCE_STARS.length, true),
        starsMaterial,
      );
      anchors.frustumCulled = false;
      sculpture.add(anchors);
      const geometry = numeralGeometry(innerWidth < 768 ? 14000 : 28000);
      geometry.setAttribute("aHome", geometry.attributes.position.clone());
      const physics = createParticlePhysics(
        geometry.attributes.position.array,
        geometry.attributes.aSeed.array,
      );
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(physics.positions, 3).setUsage(
          THREE.DynamicDrawUsage,
        ),
      );
      const points = new THREE.Points(
        geometry,
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader: particleVertex,
          fragmentShader: particleFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      points.frustumCulled = false;
      points.renderOrder = 2;
      sculpture.add(points);
      const effect = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 10),
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader: planeVertex,
          fragmentShader: eventFragment,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      effect.position.z = -1;
      effect.renderOrder = 1;
      effect.frustumCulled = false;
      sculpture.add(effect);
      const horizon = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 64),
        new THREE.MeshBasicMaterial({
          color: "#020309",
          transparent: true,
          depthTest: false,
          opacity: 0,
        }),
      );
      horizon.position.z = 3;
      horizon.renderOrder = 4;
      sculpture.add(horizon);
      const glyph = document.createElement("canvas");
      glyph.width = 96;
      glyph.height = 96;
      const ctx = glyph.getContext("2d");
      ctx.font = '650 78px "Geist Variable"';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("6", 48, 51);
      const texture = new THREE.CanvasTexture(glyph);
      const meteors = Array.from({ length: 6 }, (_, i) => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: texture,
            color: "#bee6f1",
            transparent: true,
            opacity: 0,
            depthTest: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        sprite.scale.setScalar(0.26 + (i % 3) * 0.07);
        sprite.renderOrder = 3;
        sculpture.add(sprite);
        return sprite;
      });
      let width = 1,
        height = 1,
        scale = 100,
        anchorX = 0,
        anchorY = 0;
      const resize = () => {
        const bounds = node.getBoundingClientRect(),
          stage = stageRef.current.getBoundingClientRect();
        width = bounds.width;
        height = bounds.height;
        renderer.setSize(width, height);
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        nebula.scale.set(width, height, 1);
        stars.scale.set(width, height, 1);
        uniforms.uAspect.value = width / height;
        scale = Math.min(stage.width * 0.22, stage.height * 0.148);
        anchorX = stage.left - bounds.left + stage.width * 0.52 - width / 2;
        anchorY = height / 2 - (stage.top - bounds.top + stage.height * 0.47);
        sculpture.position.set(anchorX, anchorY, 0);
        sculpture.scale.setScalar(scale);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(node);
      observer.observe(stageRef.current);
      resize();
      const pointer = new THREE.Vector2(20, 20),
        neutral = new THREE.Vector2(20, 20);
      const move = (e) => {
        const b = node.getBoundingClientRect();
        pointer.set(
          (e.clientX - b.left - width / 2 - anchorX) / scale,
          (height / 2 - (e.clientY - b.top) - anchorY) / scale,
        );
      };
      const leave = () => pointer.copy(neutral);
      const surface = node.parentElement;
      surface.addEventListener("pointermove", move);
      surface.addEventListener("pointerleave", leave);
      const lost = (e) => {
        e.preventDefault();
        setFallback(true);
      };
      renderer.domElement.addEventListener("webglcontextlost", lost);
      let frame,
        previous = performance.now(),
        time = 0,
        currentId = null,
        slow = 0,
        lowered = false;
      const baseColor = new THREE.Color("#d4c29d");
      function animate(now) {
        frame = requestAnimationFrame(animate);
        const elapsed = now - previous;
        previous = now;
        if (document.hidden) return;
        const c = control.current,
          cinematic = director.current.current;
        if (!c.paused && !c.reduced) time += Math.min(elapsed, 50) / 1000;
        uniforms.uTime.value = time;
        uniforms.uGentle.value = c.reduced ? 1 : 0;
        uniforms.uPointer.value.lerp(
          c.reduced ? neutral : pointer,
          c.paused ? 0 : 0.08,
        );
        if (cinematic?.id !== currentId) {
          currentId = cinematic?.id;
          if (cinematic) {
            physics.begin(cinematic);
            uniforms.uType.value = cinematic.type;
            uniforms.uSource.value.set(...cinematic.source);
            uniforms.uAngle.value = cinematic.angle;
            uniforms.uStrength.value = cinematic.strength;
            uniforms.uSpin.value = cinematic.spin;
            uniforms.uSignature.value = cinematic.signature;
            uniforms.uColor.value.set(cinematic.color);
          } else physics.reset();
          node.dataset.event = cinematic?.name || "Rest";
        }
        if (cinematic)
          physics.advance(
            (director.current.elapsed / cinematic.duration) * EVENT_SECONDS,
          );
        const age = cinematic ? physics.age : -1;
        const event = physics.field?.state;
        geometry.attributes.position.needsUpdate = true;
        if (event) {
          uniforms.uEnvelope.value = event.envelope;
          uniforms.uFront1.value = event.front1;
          uniforms.uFront2.value = event.front2;
          uniforms.uIgnition.value = event.ignition;
          uniforms.uOrbit.value = event.orbit;
          uniforms.uFlowAngle.value = event.angle;
          uniforms.uLensCentre.value.set(event.lensX, event.lensY);
          uniforms.uMeteorHeads.value = event.heads;
          uniforms.uMeteorOpacity.value = event.meteorOpacity;
        }
        uniforms.uAge.value = age;
        if (!cinematic) uniforms.uColor.value.lerp(baseColor, 0.025);
        if (cinematic?.type === 2 && !c.reduced) {
          const open = event.envelope;
          horizon.position.set(...cinematic.source, 3);
          horizon.scale.setScalar(open);
          horizon.material.opacity = open;
        } else horizon.material.opacity = 0;
        meteors.forEach((meteor, i) => {
          if (cinematic?.type !== 1 || c.reduced) {
            meteor.material.opacity = 0;
            return;
          }
          const along = event.heads[i];
          const angle = cinematic.angle - 0.55,
            offset = (i - 2.5) * 0.7 + (cinematic.signature - 0.5) * 0.4;
          meteor.position.set(
            Math.cos(angle) * along - Math.sin(angle) * offset,
            Math.sin(angle) * along + Math.cos(angle) * offset,
            1,
          );
          meteor.material.rotation = -angle * 0.15;
          meteor.material.opacity = event.meteorOpacity[i] * event.envelope;
        });
        renderer.render(scene, camera);
        slow = elapsed > 38 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 70 && !lowered) {
          lowered = true;
          renderer.setPixelRatio(1);
          uniforms.uPixelRatio.value = 1;
          geometry.setDrawRange(0, 12000);
          physics.setCount(12000);
          resize();
        }
      }
      frame = requestAnimationFrame(animate);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        surface.removeEventListener("pointermove", move);
        surface.removeEventListener("pointerleave", leave);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        const resources = new Set();
        scene.traverse((o) => {
          if (o.geometry) resources.add(o.geometry);
          if (o.material) resources.add(o.material);
        });
        resources.forEach((r) => r.dispose());
        texture.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });
    return () => {
      disposed = true;
      cleanup();
    };
  }, [director, stageRef]);
  return (
    <div
      className="constellation universe"
      ref={host}
      role="img"
      aria-label="Deep space surrounding a particle 6. Cinematic space events disturb the particles, which always return to the numeral."
    >
      {fallback && <div className="fallback-six">6</div>}
    </div>
  );
});
