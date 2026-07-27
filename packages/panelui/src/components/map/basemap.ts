/**
 * The basemap, drawn from theme tokens.
 *
 * A hosted map style ships its colours baked in, which gives you exactly two
 * maps: a light one and a dark one. PanelUI has six themes, and a map that
 * stays grey while the rest of the screen turns green is the one element on
 * the page that visibly does not belong to it.
 *
 * So the style is assembled here instead. Tiles still come from the vector
 * source — that is the part worth paying someone for — but every colour in
 * the style is a token the caller's theme already resolved, which means a new
 * theme gets a matching basemap without anyone drawing one.
 *
 * The layer list is deliberately short. A full street style runs to ninety-odd
 * layers separating tunnel casings from bridge casings at eleven zoom stops;
 * almost none of that survives being recoloured down to five greys, and every
 * layer is another thing to keep in step with the tokens. What is here is the
 * set that still reads as a map at any zoom: ground, water, green space,
 * buildings, roads, boundaries, and the labels that make them findable.
 */
import type { StyleSpecification } from './maplibre';

/** Resolved theme colours the style is built from. */
export interface BasemapTokens {
  /** Ground — everything that is not something else. */
  background: string;
  /** Water bodies and rivers. */
  water: string;
  /** Parks, forest, and other green space. */
  land: string;
  /** Building footprints. */
  building: string;
  /** Roads, boundaries and other lines. */
  line: string;
  /** Label text. */
  label: string;
  /** Halo behind label text, so it stays legible over any fill. */
  labelHalo: string;
}

/**
 * Vector tiles and the glyphs to label them with.
 *
 * Swappable because the tiles are the one part of the style that is somebody
 * else's to license. The defaults follow the OpenMapTiles schema, so any
 * source using it can be dropped in without touching the layers below.
 */
export interface BasemapSource {
  /** TileJSON URL for the vector source. */
  url: string;
  /** Glyph endpoint, `{fontstack}` and `{range}` templated. */
  glyphs: string;
  /** Font stack for labels. Needs to exist at the glyph endpoint. */
  fonts: string[];
  /** Shown in the attribution control. Check your provider's terms. */
  attribution?: string;
}

/**
 * CARTO's street tiles.
 *
 * Free for non-commercial use; commercial use needs a licence from them. Pass
 * your own `BasemapSource` to use a different provider — the layers below only
 * assume the OpenMapTiles schema, which most vector providers serve.
 */
export const CARTO_SOURCE: BasemapSource = {
  url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
  glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  fonts: ['Montserrat Regular', 'Open Sans Regular', 'Noto Sans Regular'],
  attribution: '© OpenStreetMap contributors, © CARTO',
};

const SOURCE_ID = 'basemap';

/**
 * Widths that hold up across the whole zoom range.
 *
 * A road drawn at a fixed width is a hairline at zoom 5 and a runway at zoom
 * 18, so each class interpolates between the zoom it appears at and the zoom
 * it stops growing. Exponential rather than linear because zoom itself is
 * exponential — a linear ramp makes every road look identical for the first
 * half of the range and then explodes.
 */
function width(stops: [number, number][]) {
  return [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    ...stops.flat(),
  ] as unknown as number;
}

/**
 * Builds a complete MapLibre style from resolved theme colours.
 *
 * `blank` drops the tile source and every layer that reads from it, leaving
 * just the ground colour — a canvas for data that supplies its own geography,
 * such as a choropleth or an arc diagram, where street detail underneath is
 * noise rather than context.
 */
export function buildBasemapStyle(
  tokens: BasemapTokens,
  options: { blank?: boolean; source?: BasemapSource } = {}
): StyleSpecification {
  const { blank = false, source = CARTO_SOURCE } = options;

  const ground = {
    id: 'ground',
    type: 'background',
    paint: { 'background-color': tokens.background },
  };

  if (blank) {
    return {
      version: 8,
      name: 'PanelUI blank',
      sources: {},
      layers: [ground],
    } as unknown as StyleSpecification;
  }

  const label = {
    'text-font': source.fonts,
    'text-max-width': 8,
  };

  const labelPaint = {
    'text-color': tokens.label,
    'text-halo-color': tokens.labelHalo,
    'text-halo-width': 1.2,
  };

  return {
    version: 8,
    name: 'PanelUI',
    glyphs: source.glyphs,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: source.url,
        ...(source.attribution ? { attribution: source.attribution } : {}),
      },
    },
    layers: [
      ground,
      // Green space sits directly on the ground and everything else on top of
      // it, so a park never punches a hole through a road crossing it.
      {
        id: 'landcover',
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'landcover',
        paint: { 'fill-color': tokens.land, 'fill-opacity': 0.7 },
      },
      {
        id: 'park',
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'park',
        paint: { 'fill-color': tokens.land, 'fill-opacity': 0.7 },
      },
      {
        id: 'water',
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'water',
        paint: { 'fill-color': tokens.water },
      },
      {
        id: 'waterway',
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'waterway',
        paint: {
          'line-color': tokens.water,
          'line-width': width([
            [8, 0.5],
            [16, 3],
          ]),
        },
      },
      // Buildings only from the zoom where they stop being a grey smear.
      {
        id: 'building',
        type: 'fill',
        source: SOURCE_ID,
        'source-layer': 'building',
        minzoom: 14,
        paint: { 'fill-color': tokens.building, 'fill-opacity': 0.8 },
      },
      // Roads as one line per class rather than a fill over a casing. At these
      // contrasts a casing is a second grey against the first and reads as a
      // blur, not as an edge.
      {
        id: 'road-minor',
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'transportation',
        minzoom: 12,
        filter: ['match', ['get', 'class'], ['minor', 'service', 'track'], true, false],
        paint: {
          'line-color': tokens.line,
          'line-width': width([
            [12, 0.4],
            [18, 6],
          ]),
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'road-secondary',
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'transportation',
        minzoom: 8,
        filter: ['match', ['get', 'class'], ['secondary', 'tertiary'], true, false],
        paint: {
          'line-color': tokens.line,
          'line-width': width([
            [8, 0.5],
            [18, 10],
          ]),
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'road-major',
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'transportation',
        filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false],
        paint: {
          'line-color': tokens.line,
          'line-width': width([
            [5, 0.5],
            [18, 14],
          ]),
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      // Dashed, because a border is a claim rather than a thing on the ground.
      {
        id: 'boundary',
        type: 'line',
        source: SOURCE_ID,
        'source-layer': 'boundary',
        filter: ['<=', ['get', 'admin_level'], 4],
        paint: {
          'line-color': tokens.line,
          'line-dasharray': [2, 2],
          'line-width': width([
            [3, 0.6],
            [12, 1.8],
          ]),
        },
      },
      {
        id: 'water-label',
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'water_name',
        layout: { ...label, 'text-field': ['get', 'name'], 'text-size': 11 },
        paint: labelPaint,
      },
      {
        id: 'road-label',
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          ...label,
          'text-field': ['get', 'name'],
          'text-size': 10,
          'symbol-placement': 'line',
        },
        paint: labelPaint,
      },
      // Places last, so a city name is never hidden under a street name.
      {
        id: 'place-label',
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'place',
        layout: {
          ...label,
          'text-field': ['get', 'name'],
          // Cities carry more weight than villages, and the type is the only
          // thing distinguishing them once every label is the same colour.
          'text-size': [
            'match',
            ['get', 'class'],
            'city',
            14,
            'town',
            12,
            10,
          ],
        },
        paint: labelPaint,
      },
    ],
  } as unknown as StyleSpecification;
}
