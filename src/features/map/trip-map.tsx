"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import type { MapDay } from "./build-stops";

// Map paint can't read CSS variables, so the brand colors are repeated here.
const SAGE = "#5E7F73";
const CREAM = "#F7EEE5";
const WATER = "#C9DAD2";
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export function TripMap({
  days,
  selected,
  activeStopId,
  onSelectStop,
  center,
  label,
}: {
  days: MapDay[];
  selected: number;
  activeStopId: string | null;
  onSelectStop: (id: string) => void;
  center: [number, number] | null;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibre = await import("maplibre-gl");
      if (cancelled || !container.current) return;
      maplibre.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
      lib.current = maplibre;
      const m = new maplibre.Map({
        container: container.current,
        style: STYLE_URL,
        center: center ? [center[1], center[0]] : [0, 20],
        zoom: center ? 11 : 1.5,
        attributionControl: { compact: true },
      });
      m.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        tintToBrand(m);
        m.addSource("routes", { type: "geojson", data: emptyCollection() });
        m.addLayer({
          id: "route-other-days",
          type: "line",
          source: "routes",
          filter: ["!=", ["get", "active"], true],
          paint: { "line-color": SAGE, "line-width": 2, "line-opacity": 0.25, "line-dasharray": [2, 2] },
        });
        m.addLayer({
          id: "route-active",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "active"], true],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": SAGE, "line-width": 4 },
        });
        setLoaded(true);
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      markers.current.forEach((mk) => mk.remove());
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- create once; updates happen below
  }, []);

  // Draw routes and pins whenever the data or selected day changes.
  useEffect(() => {
    const mm = map.current;
    const ml = lib.current;
    if (!loaded || !mm || !ml) return;
    {
      const source = mm.getSource("routes") as import("maplibre-gl").GeoJSONSource | undefined;
      source?.setData({
        type: "FeatureCollection",
        features: days
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => d.stops.length > 1)
          .map(({ d, i }) => ({
            type: "Feature" as const,
            properties: { active: i === selected },
            geometry: { type: "LineString" as const, coordinates: d.stops.map((s) => [s.longitude, s.latitude]) },
          })),
      });

      markers.current.forEach((mk) => mk.remove());
      const stops = days[selected]?.stops ?? [];
      markers.current = stops.map((stop) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "wrld-pin";
        el.dataset.kind = stop.kind === "activity" ? "activity" : stop.kind === "stay" ? "stay" : "travel";
        el.dataset.active = String(stop.id === activeStopId);
        el.setAttribute("aria-label", stop.title);
        const shape = document.createElement("span");
        shape.className = "wrld-pin__shape";
        const inner = document.createElement("span");
        inner.textContent = stop.number ? String(stop.number) : stop.kind === "stay" ? "◆" : stop.kind === "arrive" ? "↓" : "↑";
        shape.appendChild(inner);
        el.appendChild(shape);
        el.addEventListener("click", () => onSelectStop(stop.id));
        return new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([stop.longitude, stop.latitude]).addTo(mm);
      });

      if (stops.length) {
        const bounds = new ml.LngLatBounds();
        stops.forEach((s) => bounds.extend([s.longitude, s.latitude]));
        mm.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 600 });
      }
    }
  }, [loaded, days, selected, activeStopId, onSelectStop]);

  return <div ref={container} role="region" aria-label={label} className="h-full min-h-[420px] w-full overflow-hidden rounded-xl" />;
}

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

/** Pull the base map toward the WRLD palette: warm land, sage-tinted water. */
function tintToBrand(m: MapLibreMap) {
  try {
    for (const layer of m.getStyle().layers ?? []) {
      if (layer.type === "background") m.setPaintProperty(layer.id, "background-color", CREAM);
      if (layer.type === "fill" && /water/.test(layer.id)) m.setPaintProperty(layer.id, "fill-color", WATER);
    }
  } catch {
    // Styling is cosmetic; a different base style may not have these layers.
  }
}
