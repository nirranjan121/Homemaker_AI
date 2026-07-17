// src/modules/houseplan/materials/material-catalog.ts

/**
 * Central catalog of every material the design agent can apply.
 * The LLM is given this catalog in its system prompt so it knows exactly
 * which IDs are valid. The 3D widget reads hex colors + textureType to
 * decide how to render each surface.
 */

// ── Types ────────────────────────────────────────────────────────────

export type MaterialCategory = 'wall_paint' | 'wall_texture' | 'floor_material';

export interface MaterialEntry {
  id: string;
  displayName: string;
  category: MaterialCategory;
  /** Primary color used by Three.js when no image texture is loaded. */
  colorHex: string;
  /**
   * If set, the 3D renderer should apply a procedural or image-based
   * texture instead of (or layered on) the flat color.
   * 'flat' means solid color only.
   */
  textureType: 'flat' | 'brick' | 'stone' | 'wood_panel' | 'concrete' | 'plaster' |
    'marble' | 'granite' | 'ceramic' | 'hardwood' | 'carpet' | 'vinyl';
}

// ── Wall Paints (flat color) ─────────────────────────────────────────

export const WALL_PAINTS: MaterialEntry[] = [
  { id: 'white',           displayName: 'White',            category: 'wall_paint', colorHex: '#FFFFFF', textureType: 'flat' },
  { id: 'off_white',       displayName: 'Off White',        category: 'wall_paint', colorHex: '#FAF9F6', textureType: 'flat' },
  { id: 'cream',           displayName: 'Cream',            category: 'wall_paint', colorHex: '#FFFDD0', textureType: 'flat' },
  { id: 'ivory',           displayName: 'Ivory',            category: 'wall_paint', colorHex: '#FFFFF0', textureType: 'flat' },
  { id: 'beige',           displayName: 'Beige',            category: 'wall_paint', colorHex: '#F5F5DC', textureType: 'flat' },
  { id: 'light_gray',      displayName: 'Light Gray',       category: 'wall_paint', colorHex: '#D3D3D3', textureType: 'flat' },
  { id: 'warm_gray',       displayName: 'Warm Gray',        category: 'wall_paint', colorHex: '#A9A9A2', textureType: 'flat' },
  { id: 'charcoal',        displayName: 'Charcoal',         category: 'wall_paint', colorHex: '#36454F', textureType: 'flat' },
  { id: 'black',           displayName: 'Black',            category: 'wall_paint', colorHex: '#1A1A1A', textureType: 'flat' },
  { id: 'sage_green',      displayName: 'Sage Green',       category: 'wall_paint', colorHex: '#B2AC88', textureType: 'flat' },
  { id: 'olive_green',     displayName: 'Olive Green',      category: 'wall_paint', colorHex: '#708238', textureType: 'flat' },
  { id: 'forest_green',    displayName: 'Forest Green',     category: 'wall_paint', colorHex: '#228B22', textureType: 'flat' },
  { id: 'mint_green',      displayName: 'Mint Green',       category: 'wall_paint', colorHex: '#98FB98', textureType: 'flat' },
  { id: 'sky_blue',        displayName: 'Sky Blue',         category: 'wall_paint', colorHex: '#87CEEB', textureType: 'flat' },
  { id: 'light_blue',      displayName: 'Light Blue',       category: 'wall_paint', colorHex: '#ADD8E6', textureType: 'flat' },
  { id: 'navy',            displayName: 'Navy Blue',        category: 'wall_paint', colorHex: '#000080', textureType: 'flat' },
  { id: 'teal',            displayName: 'Teal',             category: 'wall_paint', colorHex: '#008080', textureType: 'flat' },
  { id: 'dusty_rose',      displayName: 'Dusty Rose',       category: 'wall_paint', colorHex: '#DCAE96', textureType: 'flat' },
  { id: 'blush_pink',      displayName: 'Blush Pink',       category: 'wall_paint', colorHex: '#DE5D83', textureType: 'flat' },
  { id: 'terracotta',      displayName: 'Terracotta',       category: 'wall_paint', colorHex: '#E2725B', textureType: 'flat' },
  { id: 'burnt_orange',    displayName: 'Burnt Orange',     category: 'wall_paint', colorHex: '#CC5500', textureType: 'flat' },
  { id: 'mustard_yellow',  displayName: 'Mustard Yellow',   category: 'wall_paint', colorHex: '#E1AD01', textureType: 'flat' },
  { id: 'lavender',        displayName: 'Lavender',         category: 'wall_paint', colorHex: '#E6E6FA', textureType: 'flat' },
  { id: 'mauve',           displayName: 'Mauve',            category: 'wall_paint', colorHex: '#E0B0FF', textureType: 'flat' },
  { id: 'taupe',           displayName: 'Taupe',            category: 'wall_paint', colorHex: '#483C32', textureType: 'flat' },
  { id: 'sand',            displayName: 'Sand',             category: 'wall_paint', colorHex: '#C2B280', textureType: 'flat' },
  { id: 'warm_white',      displayName: 'Warm White',       category: 'wall_paint', colorHex: '#F5F0E1', textureType: 'flat' },
  { id: 'peach',           displayName: 'Peach',            category: 'wall_paint', colorHex: '#FFDAB9', textureType: 'flat' },
  { id: 'coral',           displayName: 'Coral',            category: 'wall_paint', colorHex: '#FF7F50', textureType: 'flat' },
  { id: 'burgundy',        displayName: 'Burgundy',         category: 'wall_paint', colorHex: '#800020', textureType: 'flat' },
];

// ── Wall Textures ────────────────────────────────────────────────────

export const WALL_TEXTURES: MaterialEntry[] = [
  { id: 'red_brick',       displayName: 'Red Brick',        category: 'wall_texture', colorHex: '#8B4513', textureType: 'brick' },
  { id: 'white_brick',     displayName: 'White Brick',      category: 'wall_texture', colorHex: '#F0EAD6', textureType: 'brick' },
  { id: 'exposed_brick',   displayName: 'Exposed Brick',    category: 'wall_texture', colorHex: '#A0522D', textureType: 'brick' },
  { id: 'natural_stone',   displayName: 'Natural Stone',    category: 'wall_texture', colorHex: '#8B8680', textureType: 'stone' },
  { id: 'slate_stone',     displayName: 'Slate Stone',      category: 'wall_texture', colorHex: '#708090', textureType: 'stone' },
  { id: 'limestone',       displayName: 'Limestone',        category: 'wall_texture', colorHex: '#D5C4A1', textureType: 'stone' },
  { id: 'wood_panel_light',displayName: 'Light Wood Panel', category: 'wall_texture', colorHex: '#DEB887', textureType: 'wood_panel' },
  { id: 'wood_panel_dark', displayName: 'Dark Wood Panel',  category: 'wall_texture', colorHex: '#654321', textureType: 'wood_panel' },
  { id: 'wood_panel_walnut',displayName:'Walnut Wood Panel',category: 'wall_texture', colorHex: '#5C4033', textureType: 'wood_panel' },
  { id: 'raw_concrete',    displayName: 'Raw Concrete',     category: 'wall_texture', colorHex: '#9B9B93', textureType: 'concrete' },
  { id: 'polished_concrete',displayName:'Polished Concrete',category: 'wall_texture', colorHex: '#A9A9A9', textureType: 'concrete' },
  { id: 'smooth_plaster',  displayName: 'Smooth Plaster',   category: 'wall_texture', colorHex: '#F2EDE4', textureType: 'plaster' },
  { id: 'venetian_plaster',displayName: 'Venetian Plaster', category: 'wall_texture', colorHex: '#E8DCC8', textureType: 'plaster' },
];

// ── Floor Materials ──────────────────────────────────────────────────

export const FLOOR_MATERIALS: MaterialEntry[] = [
  { id: 'white_marble',    displayName: 'White Marble',     category: 'floor_material', colorHex: '#F5F5F0', textureType: 'marble' },
  { id: 'carrara_marble',  displayName: 'Carrara Marble',   category: 'floor_material', colorHex: '#E8E5E0', textureType: 'marble' },
  { id: 'black_marble',    displayName: 'Black Marble',     category: 'floor_material', colorHex: '#2C2C2C', textureType: 'marble' },
  { id: 'black_granite',   displayName: 'Black Granite',    category: 'floor_material', colorHex: '#1C1C1C', textureType: 'granite' },
  { id: 'grey_granite',    displayName: 'Grey Granite',     category: 'floor_material', colorHex: '#808080', textureType: 'granite' },
  { id: 'ceramic_white',   displayName: 'White Ceramic Tile',category:'floor_material', colorHex: '#F0F0F0', textureType: 'ceramic' },
  { id: 'ceramic_beige',   displayName: 'Beige Ceramic Tile',category:'floor_material', colorHex: '#D4C5A9', textureType: 'ceramic' },
  { id: 'porcelain_white', displayName: 'White Porcelain',  category: 'floor_material', colorHex: '#FAFAFA', textureType: 'ceramic' },
  { id: 'porcelain_grey',  displayName: 'Grey Porcelain',   category: 'floor_material', colorHex: '#B0B0B0', textureType: 'ceramic' },
  { id: 'oak_hardwood',    displayName: 'Oak Hardwood',     category: 'floor_material', colorHex: '#C9A66B', textureType: 'hardwood' },
  { id: 'walnut_hardwood', displayName: 'Walnut Hardwood',  category: 'floor_material', colorHex: '#5C4033', textureType: 'hardwood' },
  { id: 'teak_hardwood',   displayName: 'Teak Hardwood',    category: 'floor_material', colorHex: '#B8860B', textureType: 'hardwood' },
  { id: 'maple_hardwood',  displayName: 'Maple Hardwood',   category: 'floor_material', colorHex: '#E8D5B7', textureType: 'hardwood' },
  { id: 'cherry_hardwood', displayName: 'Cherry Hardwood',  category: 'floor_material', colorHex: '#8B0000', textureType: 'hardwood' },
  { id: 'bamboo_floor',    displayName: 'Bamboo',           category: 'floor_material', colorHex: '#E3C16F', textureType: 'hardwood' },
  { id: 'grey_carpet',     displayName: 'Grey Carpet',      category: 'floor_material', colorHex: '#808080', textureType: 'carpet' },
  { id: 'beige_carpet',    displayName: 'Beige Carpet',     category: 'floor_material', colorHex: '#C8B99A', textureType: 'carpet' },
  { id: 'navy_carpet',     displayName: 'Navy Carpet',      category: 'floor_material', colorHex: '#1B2A4A', textureType: 'carpet' },
  { id: 'vinyl_wood',      displayName: 'Wood-Look Vinyl',  category: 'floor_material', colorHex: '#B8956A', textureType: 'vinyl' },
  { id: 'vinyl_stone',     displayName: 'Stone-Look Vinyl', category: 'floor_material', colorHex: '#A09888', textureType: 'vinyl' },
  { id: 'polished_concrete_floor', displayName: 'Polished Concrete', category: 'floor_material', colorHex: '#A9A9A9', textureType: 'concrete' },
  { id: 'raw_concrete_floor',      displayName: 'Raw Concrete',     category: 'floor_material', colorHex: '#9B9B93', textureType: 'concrete' },
];

// ── Full catalog + lookup helpers ────────────────────────────────────

export const ALL_MATERIALS: MaterialEntry[] = [
  ...WALL_PAINTS,
  ...WALL_TEXTURES,
  ...FLOOR_MATERIALS,
];

const materialById = new Map(ALL_MATERIALS.map(m => [m.id, m]));

export function lookupMaterial(id: string): MaterialEntry | undefined {
  return materialById.get(id);
}

export function getMaterialsByCategory(category: MaterialCategory): MaterialEntry[] {
  return ALL_MATERIALS.filter(m => m.category === category);
}

/**
 * Builds a concise summary of available materials for the LLM system prompt.
 * Grouped by category so the LLM knows exactly which IDs are valid.
 */
export function buildCatalogSummaryForPrompt(): string {
  const sections: string[] = [];

  sections.push('## Wall Paints (apply to: wall_color)');
  sections.push(WALL_PAINTS.map(m => `- "${m.id}" → ${m.displayName}`).join('\n'));

  sections.push('\n## Wall Textures (apply to: wall_texture)');
  sections.push(WALL_TEXTURES.map(m => `- "${m.id}" → ${m.displayName} [${m.textureType}]`).join('\n'));

  sections.push('\n## Floor Materials (apply to: floor_material)');
  sections.push(FLOOR_MATERIALS.map(m => `- "${m.id}" → ${m.displayName} [${m.textureType}]`).join('\n'));

  return sections.join('\n');
}
