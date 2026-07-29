import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const EARTH_RADIUS = 1.42;
const FLIGHT_MS = 2600;
const FRONT_VIEW = new THREE.Vector3(0.16, 0.05, 0.99).normalize();
const EARTH_TEXTURES = {
  color: '/assets/earth/earth_atmos_2048.jpg',
  normal: '/assets/earth/earth_normal_2048.jpg',
  specular: '/assets/earth/earth_specular_2048.jpg',
  clouds: '/assets/earth/earth_clouds_1024.png',
};

function latLngToVector(lat, lng, radius = EARTH_RADIUS) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function earthFacingQuaternion(lat, lng) {
  const target = latLngToVector(lat, lng, 1).normalize();
  const base = new THREE.Quaternion().setFromUnitVectors(target, FRONT_VIEW);
  const twist = new THREE.Quaternion().setFromAxisAngle(FRONT_VIEW, THREE.MathUtils.degToRad(18));
  return base.multiply(twist);
}

function makeFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ocean.addColorStop(0, '#0a3560');
  ocean.addColorStop(0.5, '#0f5677');
  ocean.addColorStop(1, '#06223e');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#3f7d52';
  ctx.beginPath();
  ctx.ellipse(205, 154, 147, 78, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(334, 233, 84, 54, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(472, 190, 136, 74, -0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(628, 210, 186, 86, 0.06, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function loadTexture(loader, url, options = {}) {
  const texture = await loader.loadAsync(url);
  texture.colorSpace = options.colorSpace || THREE.SRGBColorSpace;
  if (options.wrapS) texture.wrapS = options.wrapS;
  if (options.wrapT) texture.wrapT = options.wrapT;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  if (options.flipY !== undefined) texture.flipY = options.flipY;
  if (options.anisotropy) texture.anisotropy = options.anisotropy;
  return texture;
}

export default function EarthFlight({ destination, flightActive, selectedPlotId }) {
  const mountRef = useRef(null);
  const stateRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02070d, 0.03);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0.3, 0.1, 8.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const sceneRoot = new THREE.Group();
    scene.add(sceneRoot);

    scene.add(new THREE.AmbientLight(0xaad7ff, 0.62));
    const hemi = new THREE.HemisphereLight(0xcde7ff, 0x03111c, 1.15);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-2.4, 1.9, 4.6);
    scene.add(sun);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 1200; i += 1) {
      starPositions.push(
        (Math.random() - 0.5) * 42,
        (Math.random() - 0.5) * 24,
        -Math.random() * 30 - 4,
      );
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xdbeafe,
        size: 0.018,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      }),
    );
    scene.add(stars);

    const earthGroup = new THREE.Group();
    sceneRoot.add(earthGroup);

    const earthMaterial = new THREE.MeshPhongMaterial({
      map: makeFallbackTexture(),
      normalScale: new THREE.Vector2(0.65, 0.65),
      shininess: 12,
      specular: new THREE.Color(0x323d46),
    });

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS, 128, 96),
      earthMaterial,
    );
    earthGroup.add(earth);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.04, 128, 96),
      new THREE.MeshBasicMaterial({
        color: 0x72b7ff,
        transparent: true,
        opacity: 0.17,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    earthGroup.add(atmosphere);

    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.013, 128, 96),
      new THREE.MeshPhongMaterial({
        map: makeFallbackTexture(),
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      }),
    );
    earthGroup.add(clouds);

    const marker = new THREE.Group();
    const markerStem = new THREE.Mesh(
      new THREE.ConeGeometry(0.04, 0.16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    markerStem.position.set(0, 0.09, 0);
    markerStem.rotation.x = Math.PI;
    const markerDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 }),
    );
    const markerHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 28, 18),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.15,
        depthWrite: false,
      }),
    );
    marker.add(markerHalo, markerStem, markerDot);
    earthGroup.add(marker);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(1, rect.height);
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const state = {
      animationFrame: 0,
      camera,
      clouds,
      earth,
      earthGroup,
      marker,
      markerHalo,
      renderer,
      scene,
      sceneRoot,
      stars,
      flight: null,
      ready: false,
    };
    stateRef.current = state;

    const textureLoader = new THREE.TextureLoader();
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    Promise.all([
      loadTexture(textureLoader, EARTH_TEXTURES.color, { anisotropy: maxAnisotropy }),
      loadTexture(textureLoader, EARTH_TEXTURES.normal, { colorSpace: THREE.NoColorSpace, anisotropy: maxAnisotropy }),
      loadTexture(textureLoader, EARTH_TEXTURES.specular, { colorSpace: THREE.NoColorSpace, anisotropy: maxAnisotropy }),
      loadTexture(textureLoader, EARTH_TEXTURES.clouds, { colorSpace: THREE.SRGBColorSpace, anisotropy: maxAnisotropy }),
    ]).then(([colorMap, normalMap, specularMap, cloudMap]) => {
      if (!live || !stateRef.current) return;
      earthMaterial.map = colorMap;
      earthMaterial.normalMap = normalMap;
      earthMaterial.specularMap = specularMap;
      earthMaterial.needsUpdate = true;
      clouds.material.map = cloudMap;
      clouds.material.needsUpdate = true;
      setReady(true);
    }).catch(() => {
      if (!live || !stateRef.current) return;
      setReady(true);
    });

    const animate = () => {
      const current = stateRef.current;
      if (!current) return;

      const elapsed = performance.now();
      const flight = current.flight;

      current.stars.rotation.y += 0.00014;
      current.markerHalo.scale.setScalar(1 + Math.sin(elapsed * 0.004) * 0.22);
      current.clouds.rotation.y += 0.00025;

      if (flight) {
        const progress = Math.min(1, (elapsed - flight.start) / FLIGHT_MS);
        const eased = 1 - ((1 - progress) ** 3);
        current.earthGroup.quaternion.copy(flight.fromQuat).slerp(flight.toQuat, eased);
        current.camera.position.lerpVectors(flight.fromCamera, flight.toCamera, eased);
        current.camera.fov = THREE.MathUtils.lerp(flight.fromFov, flight.toFov, eased);
        current.camera.updateProjectionMatrix();
        if (progress === 1) current.flight = null;
      } else {
        current.earthGroup.rotation.y += 0.00072;
        current.camera.position.lerp(new THREE.Vector3(0.3, 0.1, 8.4), 0.01);
      }

      current.camera.lookAt(0, 0, 0);
      current.renderer.render(current.scene, current.camera);
      current.animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      live = false;
      cancelAnimationFrame(state.animationFrame);
      resizeObserver.disconnect();
      renderer.dispose();
      earth.geometry.dispose();
      earth.material.dispose();
      atmosphere.geometry.dispose();
      atmosphere.material.dispose();
      clouds.geometry.dispose();
      clouds.material.dispose();
      markerStem.geometry.dispose();
      markerStem.material.dispose();
      markerDot.geometry.dispose();
      markerDot.material.dispose();
      markerHalo.geometry.dispose();
      markerHalo.material.dispose();
      starGeometry.dispose();
      stars.material.dispose();
      mount.removeChild(renderer.domElement);
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !destination) return;
    const point = latLngToVector(destination.lat, destination.lng, EARTH_RADIUS + 0.08);
    state.marker.position.copy(point);
    state.marker.lookAt(0, 0, 0);
  }, [destination]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state || !selectedPlotId) return;
    const toQuat = earthFacingQuaternion(destination.lat, destination.lng);
    state.flight = {
      start: performance.now(),
      fromQuat: state.earthGroup.quaternion.clone(),
      toQuat,
      fromCamera: state.camera.position.clone(),
      toCamera: new THREE.Vector3(0.08, 0.03, 3.05),
      fromFov: state.camera.fov,
      toFov: 19,
    };
  }, [selectedPlotId, destination]);

  const caption = flightActive
    ? 'กำลังหมุนโลกและบินเข้าแปลง'
    : selectedPlotId
      ? 'กำลังเตรียมภาพถ่ายดาวเทียมของแปลงที่เลือก'
      : 'เลือกแปลงจากรายการด้านขวา';

  return (
    <div className="earth-flight-scene">
      <div className="earth-flight-canvas" ref={mountRef} />
      <div className={`earth-flight-shell ${ready ? 'is-ready' : 'is-loading'}`}>
        <div className="earth-flight-card">
          <span>Spatial digital twin</span>
          <strong>{selectedPlotId || 'มุมมองโลก'}</strong>
          <em>{destination ? `${destination.lat.toFixed(4)}, ${destination.lng.toFixed(4)}` : 'รอจุดหมาย'}</em>
        </div>
        <div className="earth-flight-badge">
          <b>{caption}</b>
          <i />
        </div>
        <div className="earth-flight-progress">
          <i className={flightActive ? 'is-active' : ''} />
        </div>
      </div>
    </div>
  );
}
