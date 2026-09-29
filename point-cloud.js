import * as THREE from './assets/point-cloud/vendor/three.module.js';
import { PLYLoader } from './assets/point-cloud/vendor/PLYLoader.mjs';

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
    activeMetric: 0,
  };

  let points = null;
  let ghostPoints = null;
  let measurementGuide = null;
  let anchorPoints = null;
  let anchorGuides = null;
  let referenceGrid = null;
  let output = null;
  let target = null;
  let chaos = null;
  let drift = null;
  let phases = null;
  let frame = 0;
  let manualRotation = 0;
  let isDragging = false;
  let dragStartX = 0;
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
      createTechnicalGuides(bufferGeometry);
      root.rotation.set(-0.03, -0.18, 0);
      setupScroll();
    },
    undefined,
    (error) => {
      console.error('Не удалось загрузить модель облака точек:', error);
      section.classList.add('tech-cloud--model-error');
    },
  );

  function createTechnicalGuides(bufferGeometry) {
    const guideMaterial = new THREE.LineBasicMaterial({
      color: 0x86c8ef,
      transparent: true,
      opacity: reducedMotion ? 0.52 : 0,
      depthWrite: false,
      depthTest: false,
    });
    const guideVertices = new Float32Array([
      0.06, -0.18, 0.68, 0.62, -0.18, 0.68,
      0.62, -0.18, 0.68, 0.62, 0.32, 0.68,
      0.62, 0.32, 0.68, 0.06, 0.32, 0.68,
      0.06, 0.32, 0.68, 0.06, -0.18, 0.68,
      0.02, -0.18, 0.68, -0.08, -0.18, 0.68,
      0.02, 0.32, 0.68, -0.08, 0.32, 0.68,
    ]);
    const guideGeometry = new THREE.BufferGeometry();
    guideGeometry.setAttribute('position', new THREE.BufferAttribute(guideVertices, 3));
    measurementGuide = new THREE.LineSegments(guideGeometry, guideMaterial);
    measurementGuide.renderOrder = 4;
    root.add(measurementGuide);

    const ghostMaterial = new THREE.PointsMaterial({
      size: window.innerWidth < 700 ? 0.019 : 0.015,
      color: 0x5eaee0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    ghostPoints = new THREE.Points(bufferGeometry, ghostMaterial);
    ghostPoints.position.x = -0.2;
    ghostPoints.renderOrder = 1;
    root.add(ghostPoints);

    const anchorGeometry = new THREE.BufferGeometry();
    anchorGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.62, -0.66, 0.34,
      0.58, -0.7, 0.28,
      0.15, 0.58, -0.18,
    ], 3));
    const anchorMaterial = new THREE.PointsMaterial({
      color: 0x42b7ff,
      size: window.innerWidth < 700 ? 0.24 : 0.2,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    anchorPoints = new THREE.Points(anchorGeometry, anchorMaterial);
    anchorPoints.renderOrder = 5;
    root.add(anchorPoints);

    const anchorCenters = [
      [-0.62, -0.66, 0.34],
      [0.58, -0.7, 0.28],
      [0.15, 0.58, -0.18],
    ];
    const crossSize = 0.2;
    const crossVertices = [];
    anchorCenters.forEach(([x, y, z]) => {
      crossVertices.push(
        x - crossSize, y, z, x + crossSize, y, z,
        x, y - crossSize, z, x, y + crossSize, z,
        x, y, z - crossSize, x, y, z + crossSize,
      );
    });
    const crossGeometry = new THREE.BufferGeometry();
    crossGeometry.setAttribute('position', new THREE.Float32BufferAttribute(crossVertices, 3));
    const crossMaterial = new THREE.LineBasicMaterial({
      color: 0x42b7ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    anchorGuides = new THREE.LineSegments(crossGeometry, crossMaterial);
    anchorGuides.renderOrder = 6;
    root.add(anchorGuides);

    referenceGrid = new THREE.GridHelper(2.35, 12, 0x568fb3, 0x264c65);
    referenceGrid.position.y = -0.78;
    referenceGrid.material.transparent = true;
    referenceGrid.material.opacity = 0;
    referenceGrid.material.depthWrite = false;
    root.add(referenceGrid);
  }

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
      state.morph = THREE.MathUtils.smoothstep(progress, 0.04, 0.68);
      state.turbulence = 1 - THREE.MathUtils.smoothstep(progress, 0.08, 0.56);
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
    state.activeMetric = closestIndex;
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
      const viewRotations = [-0.08, -0.34, 0.16, -0.22];
      const rotationTarget = viewRotations[state.activeMetric] + manualRotation;
      root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, rotationTarget, 0.035);
      root.rotation.y += Math.sin(elapsed * 0.25) * 0.00025;
      root.rotation.x = -0.03 + Math.sin(elapsed * 0.22) * 0.018;
      points.material.opacity = 0.63 + morph * 0.3;
      const basePointSize = window.innerWidth < 700 ? 0.018 : 0.014;
      const detailPointSize = state.activeMetric === 2 ? basePointSize * 0.68 : basePointSize;
      points.material.size = THREE.MathUtils.lerp(points.material.size, detailPointSize, 0.055);

      const cameraTargets = [
        [0.12, 0.08, 3.55],
        [-0.13, 0.03, 3.88],
        [0.08, 0.04, 3.62],
        [0, -0.04, 4.02],
      ];
      const cameraTarget = cameraTargets[state.activeMetric];
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraTarget[0], 0.035);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraTarget[1], 0.035);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraTarget[2], 0.035);

      updateTechnicalGuides(elapsed);
    }

    renderer.render(scene, camera);
  }

  function fadeMaterial(material, visible, maximum, speed = 0.075) {
    if (!material) return;
    material.opacity = THREE.MathUtils.lerp(material.opacity, visible ? maximum : 0, speed);
  }

  function updateTechnicalGuides(elapsed) {
    const metric = state.activeMetric;
    fadeMaterial(measurementGuide?.material, metric === 0, 0.95, 0.1);

    if (ghostPoints) {
      fadeMaterial(ghostPoints.material, metric === 1, 0.48, 0.1);
      const registerPulse = (Math.sin(elapsed * 1.45) + 1) * 0.5;
      const registrationOffset = 0.1 + registerPulse * 0.1;
      ghostPoints.position.x = THREE.MathUtils.lerp(ghostPoints.position.x, metric === 1 ? -registrationOffset : 0, 0.08);
      ghostPoints.position.z = metric === 1 ? 0.055 : 0;
    }

    if (anchorPoints) {
      fadeMaterial(anchorPoints.material, metric === 3, 1, 0.11);
      anchorPoints.material.size = (window.innerWidth < 700 ? 0.24 : 0.2) * (1 + Math.sin(elapsed * 2.1) * 0.16);
    }

    if (anchorGuides) {
      fadeMaterial(anchorGuides.material, metric === 3, 1, 0.11);
    }

    if (referenceGrid?.material) {
      fadeMaterial(referenceGrid.material, metric === 3, 0.58, 0.1);
    }
  }

  const precisePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (precisePointer.matches && !reducedMotion) {
    visual.classList.add('is-draggable');
    visual.addEventListener('pointerdown', (event) => {
      isDragging = true;
      dragStartX = event.clientX;
      visual.classList.add('is-dragging');
      visual.setPointerCapture(event.pointerId);
    });
    visual.addEventListener('pointermove', (event) => {
      if (!isDragging) return;
      const delta = event.clientX - dragStartX;
      dragStartX = event.clientX;
      manualRotation += delta * 0.004;
    });
    const endDrag = (event) => {
      isDragging = false;
      visual.classList.remove('is-dragging');
      if (visual.hasPointerCapture(event.pointerId)) visual.releasePointerCapture(event.pointerId);
    };
    visual.addEventListener('pointerup', endDrag);
    visual.addEventListener('pointercancel', endDrag);
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
