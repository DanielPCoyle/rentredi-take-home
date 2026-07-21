import { useEffect, useRef } from "react";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { isDaytime } from "../util.js";

// A three-globe (vasturiano/three-globe) with a real earth map.
// - `locations` render as points; a point's tooltip reads "It is day/night in <city>".
// - The tooltip auto-shows for the selected location and follows it as the globe
//   rotates; hovering another point overrides it.
// - `focus` (changes on add / list-click) rotates the globe to face that spot,
//   pulses a ring, and swaps the globe to the day or night texture for that
//   location's local time.
// - Drag / touch rotates the globe.
//
// Loaded via a lazy chunk that is facade-loaded on first interaction (see
// UserManager), so Three.js never touches the initial critical path.
export default function Globe({ locations, focus }) {
  const mountRef = useRef(null);
  const api = useRef({});
  const locsRef = useRef(locations || []);

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth || 400;
    const height = mount.clientHeight || 400;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cursor = "grab";
    renderer.domElement.style.touchAction = "none";
    mount.appendChild(renderer.domElement);

    const tip = document.createElement("div");
    tip.className = "globe-tip";
    tip.style.display = "none";
    mount.appendChild(tip);

    const scene = new THREE.Scene();
    const ambient = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.5);
    key.position.set(1, 0.5, 1);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    camera.position.set(0, 0, 260);
    camera.lookAt(0, 0, 0);

    const globe = new ThreeGlobe()
      .globeImageUrl("/earth-day.jpg")
      .showAtmosphere(true)
      .atmosphereColor("#35b6e6")
      .atmosphereAltitude(0.18);

    const gm = globe.globeMaterial();
    gm.emissiveIntensity = 0;
    gm.shininess = 5;
    gm.specular = new THREE.Color(0x222a33);

    globe
      .pointLat((d) => d.lat)
      .pointLng((d) => d.lon)
      .pointColor(() => "#8fe0ff")
      .pointAltitude(0.02)
      .pointRadius(0.4)
      .pointsMerge(false)
      .pointsData([])
      .ringLat((d) => d.lat)
      .ringLng((d) => d.lng)
      .ringColor(() => (t) => `rgba(53,182,230,${Math.sqrt(1 - t)})`)
      .ringMaxRadius(4.5)
      .ringPropagationSpeed(1.6)
      .ringRepeatPeriod(560)
      .ringsData([]);

    scene.add(globe);

    api.current = {
      renderer, scene, camera, globe, ambient, key, tip,
      targetQuat: null, idle: true, resume: null, raf: 0, texture: "day",
      pinned: null, hover: null, dragging: false, last: null,
    };

    // Position the tooltip over a datum {lat, lon, city, timezoneName, timezone},
    // or hide it if the point is on the far side of the globe.
    const camDirV = new THREE.Vector3();
    const posV = new THREE.Vector3();
    const updateTip = (d) => {
      if (!d) { tip.style.display = "none"; return; }
      globe.updateMatrixWorld(true);
      const c = globe.getCoords(d.lat, d.lon, 0.02);
      posV.set(c.x, c.y, c.z).applyMatrix4(globe.matrixWorld);
      camDirV.copy(camera.position).normalize();
      if (posV.clone().normalize().dot(camDirV) <= 0.05) { tip.style.display = "none"; return; }
      const rect = renderer.domElement.getBoundingClientRect();
      posV.project(camera);
      tip.textContent = `It is ${isDaytime(d.timezoneName, d.timezone) ? "day" : "night"} in ${d.city || "this location"}`;
      tip.style.left = `${(posV.x * 0.5 + 0.5) * rect.width}px`;
      tip.style.top = `${(-posV.y * 0.5 + 0.5) * rect.height}px`;
      tip.style.display = "block";
    };

    const animate = () => {
      const a = api.current;
      if (a.targetQuat) {
        a.globe.quaternion.slerp(a.targetQuat, 0.09);
        if (a.globe.quaternion.angleTo(a.targetQuat) < 0.01) a.targetQuat = null;
      } else if (a.idle) {
        a.globe.rotateY(0.0016); // gentle idle spin on the Y axis
      }
      a.renderer.render(a.scene, a.camera);
      updateTip(a.dragging ? null : a.hover || a.pinned); // hover wins, else pinned
      a.raf = requestAnimationFrame(animate);
    };
    animate();

    // Drag / touch rotation + hover detection. Pointer events cover mouse + touch.
    const DRAG_K = 0.005;
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);

    const onDown = (e) => {
      const a = api.current;
      a.dragging = true;
      a.last = { x: e.clientX, y: e.clientY };
      a.targetQuat = null;
      a.idle = false;
      clearTimeout(a.resume);
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture?.(e.pointerId);
    };

    const onMove = (e) => {
      const a = api.current;
      if (a.dragging) {
        const dx = e.clientX - a.last.x;
        const dy = e.clientY - a.last.y;
        a.last = { x: e.clientX, y: e.clientY };
        a.globe.quaternion
          .premultiply(new THREE.Quaternion().setFromAxisAngle(yAxis, dx * DRAG_K))
          .premultiply(new THREE.Quaternion().setFromAxisAngle(xAxis, dy * DRAG_K));
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      globe.updateMatrixWorld(true);
      const camDir = camera.position.clone().normalize();
      let best = null;
      let bestDist = 20;
      for (const d of locsRef.current) {
        const c = globe.getCoords(d.lat, d.lon, 0.02);
        const p = new THREE.Vector3(c.x, c.y, c.z).applyMatrix4(globe.matrixWorld);
        if (p.clone().normalize().dot(camDir) <= 0.05) continue;
        p.project(camera);
        const sx = (p.x * 0.5 + 0.5) * rect.width;
        const sy = (-p.y * 0.5 + 0.5) * rect.height;
        const dist = Math.hypot(sx - mx, sy - my);
        if (dist < bestDist) { bestDist = dist; best = d; }
      }
      a.hover = best;
      renderer.domElement.style.cursor = best ? "pointer" : "grab";
    };

    const onUp = (e) => {
      const a = api.current;
      if (!a.dragging) return;
      a.dragging = false;
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.releasePointerCapture?.(e.pointerId);
      clearTimeout(a.resume);
      a.resume = setTimeout(() => { a.idle = true; }, 4000);
    };

    const onLeave = () => { api.current.hover = null; };

    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);
    renderer.domElement.addEventListener("pointerleave", onLeave);

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      const a = api.current;
      cancelAnimationFrame(a.raf);
      clearTimeout(a.resume);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      if (tip.parentNode === mount) mount.removeChild(tip);
    };
  }, []);

  // Keep points in sync with the list.
  useEffect(() => {
    locsRef.current = locations || [];
    const a = api.current;
    if (a.globe) a.globe.pointsData(locations || []);
  }, [locations]);

  // Rotate to the focused location, pulse a ring, swap day/night texture, and
  // pin its tooltip. Clear all selection visuals when that location is removed.
  useEffect(() => {
    const a = api.current;
    if (!a.globe) return;

    const focusedLocationStillExists = focus
      && locations.some((location) => String(location.id) === String(focus.id));

    if (!focusedLocationStillExists) {
      a.pinned = null;
      a.hover = null;
      a.targetQuat = null;
      a.globe.ringsData([]);
      if (a.tip) a.tip.style.display = "none";
      return;
    }

    const day = isDaytime(focus.zone, focus.offset);
    const wantTex = day ? "day" : "night";
    if (a.texture !== wantTex) {
      a.globe.globeImageUrl(day ? "/earth-day.jpg" : "/earth-night.jpg");
      // Night: enough ambient to read the continents, still dim enough to read as
      // night. Day: bright.
      a.ambient.intensity = day ? 1.8 : 1.25;
      a.key.intensity = day ? 0.5 : 0.35;
      a.texture = wantTex;
    }

    a.pinned = { lat: focus.lat, lon: focus.lon, city: focus.city, timezoneName: focus.zone, timezone: focus.offset };
    a.globe.ringsData([{ lat: focus.lat, lng: focus.lon }]);
    const c = a.globe.getCoords(focus.lat, focus.lon, 0);
    const dir = new THREE.Vector3(c.x, c.y, c.z).normalize();
    a.targetQuat = new THREE.Quaternion().setFromUnitVectors(dir, new THREE.Vector3(0, 0, 1));
    a.idle = false;
    clearTimeout(a.resume);
    a.resume = setTimeout(() => { a.idle = true; }, 6000);
  }, [focus, locations]);

  return <div className="globe-canvas-wrap" ref={mountRef} />;
}
