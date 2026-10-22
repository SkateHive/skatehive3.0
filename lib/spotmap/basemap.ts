/**
 * Raster basemap for the public skate maps.
 *
 * CARTO's dark_all tiles started returning an "API KEY REQUIRED" watermark
 * (late 2026). The replacement, Esri World Dark Gray Canvas, loads without a
 * key but is a near-black canvas: at the default world zoom the ocean is
 * #000 and land is about #1a1a1a. On the #0a0a0a map pane that reads as a
 * blank black panel even though spot cards beside it load fine.
 *
 * World Street Map is the same Esri tile host (no key, no signup) and shows
 * land, water, and streets at every zoom, which is what a spot finder needs.
 * ArcGIS MapServer order is {z}/{y}/{x}, not the OSM {z}/{x}/{y} order.
 */
export const SKATE_MAP_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

export const SKATE_MAP_TILE_ATTRIBUTION =
  '&copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012';
