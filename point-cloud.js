import * as THREE from './assets/point-cloud/vendor/three.module.js';
import { PLYLoader } from './assets/point-cloud/vendor/PLYLoader.js';

const section = document.querySelector('.tech-cloud');
const canvas = document.querySelector('#tech-cloud-canvas');
const metricCards = [...document.querySelectorAll('.tech-metric')];
const visual = document.querySelector('.tech-cloud-visual');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (section && canvas && visual) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050a12, 3.1, 7.2);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.04, 3.9);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.45));
  renderer.setClearColor(0x050a12, 0);

  const root = new THREE.Group();
  scene.add(root);

  const state = {
    morph: reducedMotion ? 1 : 0,
    turbulence: reducedMotion ? 0 : 1,
    progress: reducedMotion ? 1 : 0,
  };

  let points = null;
  let output = null;
  let target = null;
  let chaos = null;
  let drift = null;
  let phases = null;
  let frame = 0;
  const clock = new THREE.Clock();

  const loader = new PLYLoader();
  loader.load(
    './assets/point-cloud/models/Besedka_web_100k.ply',
    (geometry) => {
      geometry.computeBoundingBox();
      geometry.center();
      geometry.rotateX(-Math.PI / 2);
      geometry.computeBoundingSphere();

      const radius = geometry.boundingSphere?.radius || 1;
      geometry.scale(0.92 / radius, 0.92 / radius, 0.92 / radius);

      const source = geometry.getAttribute('position').array;
      const sourceCount = source.length / 3;
      const pointLimit = window.innerWidth < 700 ? 52000 : 100000;
      const count = Math.min(sourceCount, pointLimit);
      target = new Float32Array(count * 3);
      chaos = new Float32Array(count * 3);
      drift = new Float32Array(count * 3);
      phases = new Float32Array(count);

      const order = new Uint32Array(sourceCount);
      for (let i = 0; i < sourceCount; i += 1) order[i] = i;
      for (let i = sourceCount - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const current = order[i];
        order[i] = order[j];
        order[j] = current;
      }

      for (let i = 0; i < count; i += 1) {
        const sourceIndex = order[Math.floor((i / count) * sourceCount)] * 3;
        const index = i * 3;
        target[index] = source[sourceIndex];
        target[index + 1] = source[sourceIndex + 1] - 0.08;
        target[index + 2] = source[sourceIndex + 2];

        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const directionY = 1 - ((i + 0.5) / count) * 2;
        const directionRadius = Math.sqrt(Math.max(0, 1 - directionY * directionY));
        const theta = i * goldenAngle + (Math.random() - 0.5) * 0.08;
        const radiusNoise = Math.cbrt(Math.random()) * 0.98;
        const jitter = 0.025;
        chaos[index] = Math.cos(theta) * directionRadius * radiusNoise * 1.02 + (Math.random() - 0.5) * jitter;
        chaos[index + 1] = directionY * radiusNoise * 0.88 + (Math.random() - 0.5) * jitter;
        chaos[index + 2] = Math.sin(theta) * directionRadius * radiusNoise * 0.82 + (Math.random() - 0.5) * jitter;

        let dx = Math.random() * 2 - 1;
        let dy = Math.random() * 2 - 1;
        let dz = Math.random() * 2 - 1;
        const length = Math.hypot(dx, dy, dz) || 1;
        drift[index] = dx / length;
        drift[index + 1] = dy / length;
        drift[index + 2] = dz / length;
        phases[i] = Math.random() * Math.PI * 2;
      }

      output = chaos.slice();
      const bufferGeometry = new THREE.BufferGeometry();
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(output, 3));

      const colors = new Float32Array(count * 3);
      const cool = new THREE.Color('#77a9c9');
      const light = new THREE.Color('#d8e2e8');
      const color = new THREE.Color();
      for (let i = 0; i < count; i += 1) {
        color.copy(cool).lerp(light, 0.18 + Math.random() * 0.62);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: window.innerWidth < 700 ? 0.018 : 0.014,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });

      points = new THREE.Points(bufferGeometry, material);
      root.add(points);
      root.rotation.set(-0.03, -0.18, 0);
      setupScroll();
    },
    undefined,
    (error) => {
      console.error('Не удалось загрузить модель облака точек:', error);
      section.classList.add('tech-cloud--model-error');
    },
  );

  function setupScroll() {
    if (reducedMotion) {
      metricCards.forEach((card) => card.classList.add('is-active'));
      updateMetricDepth();
      return;
    }

    let scrollFrame = 0;
    const updateFromScroll = () => {
      scrollFrame = 0;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = THREE.MathUtils.clamp(-rect.top / distance, 0, 1);
      state.progress = progress;
      state.morph = THREE.MathUtils.smoothstep(progress, 0.08, 0.96);
      state.turbulence = 1 - THREE.MathUtils.smoothstep(progress, 0.12, 0.84);
      updateMetricDepth();
    };

    const requestScrollUpdate = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(updateFromScroll);
    };

    updateFromScroll();
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate, { passive: true });
  }

  function updateMetricDepth() {
    const viewportCenter = window.innerHeight * 0.5;
    let closestIndex = 0;
    let closestDistance = Infinity;
    const cardStates = [];

    metricCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const center = rect.top + rect.height * 0.5;
      const signedDistance = center - viewportCenter;
      const distance = Math.abs(signedDistance);
      const visibility = Math.max(0.02, 1 - distance / (window.innerHeight * 0.48));
      const easedVisibility = THREE.MathUtils.smoothstep(visibility, 0.04, 0.82);
      cardStates.push({ signedDistance, easedVisibility });

      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    metricCards.forEach((card, index) => {
      const { signedDistance, easedVisibility } = cardStates[index];
      const isActive = index === closestIndex;
      const prominence = isActive ? 1 : Math.max(0.035, easedVisibility * 0.16);
      card.classList.toggle('is-active', isActive);
      card.style.opacity = String(prominence);
      card.style.filter = `blur(${(1 - prominence) * 14}px)`;
      card.style.transform = `translate3d(0, ${Math.max(-26, Math.min(52, signedDistance * 0.075))}px, 0) scale(${0.97 + prominence * 0.03})`;
    });
    section.dataset.activeMetric = String(closestIndex);
  }

  function resize() {
    const rect = visual.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function render() {
    frame = requestAnimationFrame(render);
    resizeIfNeeded();

    const elapsed = clock.getElapsedTime();
    if (points && output && target && chaos && drift && phases) {
      const morph = state.morph;
      const inverse = 1 - morph;
      const turbulence = state.turbulence;
      const positionAttribute = points.geometry.getAttribute('position');

      for (let i = 0; i < phases.length; i += 1) {
        const index = i * 3;
        const pulse = Math.sin(elapsed * 1.6 + phases[i]) * 0.032 * turbulence;
        output[index] = chaos[index] * inverse + target[index] * morph + drift[index] * pulse;
        output[index + 1] = chaos[index + 1] * inverse + target[index + 1] * morph + drift[index + 1] * pulse;
        output[index + 2] = chaos[index + 2] * inverse + target[index + 2] * morph + drift[index + 2] * pulse;
      }

      positionAttribute.needsUpdate = true;
      const sceneScale = 0.56 + morph * 0.94;
      root.scale.setScalar(sceneScale);
      root.position.y = inverse * 0.18;
      root.rotation.y = -0.18 + elapsed * (0.012 + inverse * 0.025);
      root.rotation.x = -0.03 + Math.sin(elapsed * 0.22) * 0.018;
      points.material.opacity = 0.63 + morph * 0.3;
    }

    renderer.render(scene, camera);
  }

  let previousWidth = 0;
  let previousHeight = 0;
  function resizeIfNeeded() {
    const rect = visual.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (width === previousWidth && height === previousHeight) return;
    previousWidth = width;
    previousHeight = height;
    resize();
  }

  resize();
  render();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true });
}
