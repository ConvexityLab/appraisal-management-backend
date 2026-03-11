/**
 * Seed Module: Construction Cost Catalog
 *
 * ~150 RSMeans-style CSI MasterFormat unit-cost items spanning 17 divisions.
 * Costs are approximate national averages (USD, 2024 basis) for feasibility
 * review and AI budget-reasonability analysis.
 *
 * Container: construction-cost-catalog  (partition key: /division)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function item(
  seq: string, division: string, divisionName: string,
  sectionCode: string, sectionName: string, description: string,
  unit: string, material: number, labor: number, equipment: number,
  keywords: string[],
): Record<string, unknown> {
  const id = `csi-${sectionCode.replace(/ /g, '-')}-${seq}`;
  const now = new Date().toISOString();
  return {
    id, division, divisionName, sectionCode, sectionName, description, unit,
    materialCost: material, laborCost: labor, equipmentCost: equipment,
    totalCost: Math.round((material + labor + equipment) * 100) / 100,
    keywords, type: 'construction-cost-catalog-item', createdAt: now, updatedAt: now,
  };
}

// ─── Division 01 — General Requirements ──────────────────────────────────────
const div01 = () => [
  item('001', '01', 'General Requirements', '01 50 00', 'Temporary Facilities', 'Temporary office trailer, rental per month', 'LS', 650, 250, 0, ['temp office', 'trailer', 'site office', 'temporary']),
  item('002', '01', 'General Requirements', '01 50 00', 'Temporary Facilities', 'Portable toilet rental per month', 'EA', 175, 0, 0, ['portable toilet', 'restroom', 'sanitation']),
  item('003', '01', 'General Requirements', '01 50 00', 'Temporary Facilities', 'Construction fencing, chain-link 6 ft', 'LF', 4.25, 3.50, 0, ['fencing', 'chain link', 'site fence', 'security fence']),
  item('004', '01', 'General Requirements', '01 74 19', 'Construction Waste Management', 'Dumpster rental 10-CY, per week', 'EA', 385, 0, 0, ['dumpster', 'waste', 'disposal', 'debris']),
  item('005', '01', 'General Requirements', '01 74 19', 'Construction Waste Management', 'Dumpster rental 30-CY, per week', 'EA', 575, 0, 0, ['dumpster', 'waste', 'disposal', 'debris', 'rolloff']),
  item('006', '01', 'General Requirements', '01 31 23', 'Project Meetings', 'OAC meeting, owner-architect-contractor weekly, allowance per week', 'LS', 0, 950, 0, ['meeting', 'OAC', 'project management']),
];

// ─── Division 02 — Existing Conditions ───────────────────────────────────────
const div02 = () => [
  item('001', '02', 'Existing Conditions', '02 41 13', 'Selective Demolition', 'Demo interior partition, drywall both sides 2×4 stud, per LF', 'LF', 0, 8.50, 0, ['demolition', 'demo', 'partition', 'drywall removal', 'selective demo']),
  item('002', '02', 'Existing Conditions', '02 41 13', 'Selective Demolition', 'Demo interior drywall ceiling, per SF', 'SF', 0, 1.85, 0, ['demolition', 'demo', 'ceiling', 'drywall demolition']),
  item('003', '02', 'Existing Conditions', '02 41 13', 'Selective Demolition', 'Remove existing flooring — carpet w/ pad, per SF', 'SF', 0, 0.65, 0, ['demolition', 'carpet removal', 'flooring demo']),
  item('004', '02', 'Existing Conditions', '02 41 13', 'Selective Demolition', 'Remove existing flooring — ceramic tile, per SF', 'SF', 0, 2.10, 0, ['demolition', 'tile removal', 'flooring demo', 'ceramic']),
  item('005', '02', 'Existing Conditions', '02 41 16', 'Structure Demolition', 'Demolish wood-frame house, 2-story, incl. haul-off up to 1 mi', 'SF', 0, 8.50, 4.50, ['full demolition', 'house demo', 'tear down', 'structure demo']),
  item('006', '02', 'Existing Conditions', '02 31 00', 'Exploratory Excavation', 'Soil boring, standard penetration test, per foot', 'LF', 18, 32, 14, ['soil boring', 'geotechnical', 'SPT', 'soil test']),
  item('007', '02', 'Existing Conditions', '02 82 13', 'Asbestos Abatement', 'Asbestos pipe insulation removal, per LF', 'LF', 12, 38, 0, ['asbestos', 'abatement', 'hazmat', 'pipe insulation']),
];

// ─── Division 03 — Concrete ──────────────────────────────────────────────────
const div03 = () => [
  item('001', '03', 'Concrete', '03 10 00', 'Concrete Forming', 'Formwork — wall, 8 ft high, plywood, per SF of contact area', 'SF', 2.85, 6.40, 0.30, ['formwork', 'forms', 'wall forms', 'concrete forming']),
  item('002', '03', 'Concrete', '03 10 00', 'Concrete Forming', 'Formwork — slab on grade, edge forms, per LF', 'LF', 1.45, 3.20, 0, ['formwork', 'slab form', 'edge form']),
  item('003', '03', 'Concrete', '03 20 00', 'Concrete Reinforcing', 'Rebar — #4 deformed, horizontal placement per placed ton', 'TON', 980, 620, 0, ['rebar', 'reinforcing', 'steel reinforcement', '#4 bar']),
  item('004', '03', 'Concrete', '03 20 00', 'Concrete Reinforcing', 'Rebar — #5 deformed, horizontal placement per placed ton', 'TON', 945, 580, 0, ['rebar', 'reinforcing', 'steel reinforcement', '#5 bar']),
  item('005', '03', 'Concrete', '03 20 00', 'Concrete Reinforcing', 'Wire mesh — 6×6 W1.4×W1.4, per SF', 'SF', 0.32, 0.28, 0, ['wire mesh', 'WWF', 'welded wire', 'slab reinforcing']),
  item('006', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Concrete, ready mix, normal weight, 3000 psi, direct chute', 'CY', 145, 38, 0, ['concrete', 'ready mix', '3000 psi', 'pour']),
  item('007', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Concrete, ready mix, normal weight, 4000 psi, pumped', 'CY', 162, 48, 22, ['concrete', 'ready mix', '4000 psi', 'pump', 'pour']),
  item('008', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Concrete, foundation wall, 12 in thick, 3000 psi, per LF', 'LF', 95, 65, 8, ['foundation wall', 'concrete wall', 'poured wall']),
  item('009', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Slab on grade, 4 in thick, 3500 psi, per SF incl. finishing', 'SF', 3.10, 3.85, 0.45, ['slab', 'slab on grade', 'concrete floor', 'SOG']),
  item('010', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Slab on grade, 6 in thick, 4000 psi, per SF incl. finishing', 'SF', 4.60, 4.25, 0.55, ['slab', 'slab on grade', 'concrete floor', '6 inch slab']),
  item('011', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Spread footing, 24×12 in, 3000 psi, per LF', 'LF', 42, 28, 4, ['footing', 'spread footing', 'continuous footing']),
  item('012', '03', 'Concrete', '03 30 00', 'Cast-in-Place Concrete', 'Pier/caisson, 12 in dia., 3000 psi, per LF', 'LF', 48, 55, 32, ['pier', 'caisson', 'drilled pier', 'foundation pier']),
  item('013', '03', 'Concrete', '03 39 00', 'Concrete Curing', 'Liquid membrane curing compound, per SF', 'SF', 0.18, 0.12, 0, ['curing', 'concrete cure', 'membrane cure']),
];

// ─── Division 04 — Masonry ───────────────────────────────────────────────────
const div04 = () => [
  item('001', '04', 'Masonry', '04 22 00', 'Concrete Unit Masonry', 'CMU wall, 8×8×16 standard block, 8 ft high, per SF', 'SF', 3.85, 9.20, 0, ['CMU', 'block wall', 'concrete block', 'masonry wall']),
  item('002', '04', 'Masonry', '04 22 00', 'Concrete Unit Masonry', 'CMU wall, 12×8×16 block, 8 ft high, per SF', 'SF', 5.10, 10.50, 0, ['CMU', 'block wall', '12 inch block', 'masonry wall']),
  item('003', '04', 'Masonry', '04 21 13', 'Brick Masonry', 'Face brick, running bond, per SF of face area', 'SF', 9.50, 14.20, 0, ['brick', 'face brick', 'brick veneer', 'brick wall']),
  item('004', '04', 'Masonry', '04 21 13', 'Brick Masonry', 'Brick veneer, residential, per SF', 'SF', 8.20, 12.50, 0, ['brick veneer', 'brick', 'residential brick', 'exterior brick']),
  item('005', '04', 'Masonry', '04 43 00', 'Stone Masonry', 'Stone veneer, natural fieldstone, per SF', 'SF', 28.50, 22.00, 0, ['stone', 'stone veneer', 'fieldstone', 'natural stone']),
];

// ─── Division 05 — Metals ────────────────────────────────────────────────────
const div05 = () => [
  item('001', '05', 'Metals', '05 12 00', 'Structural Steel Framing', 'W8×31 wide-flange beam, per placed ton', 'TON', 1850, 920, 180, ['structural steel', 'wide flange', 'W-beam', 'steel framing']),
  item('002', '05', 'Metals', '05 31 00', 'Steel Decking', 'Steel roof deck 1.5 in deep, 22 ga., per SF', 'SF', 2.85, 1.65, 0, ['steel deck', 'metal deck', 'roof deck']),
  item('003', '05', 'Metals', '05 50 00', 'Metal Fabrications', 'Steel staircase, straight, 12 risers, complete', 'EA', 3800, 1200, 0, ['stair', 'steel stair', 'metal stair']),
  item('004', '05', 'Metals', '05 52 00', 'Metal Railings', 'Steel pipe railing, 2-rail, painted, per LF', 'LF', 38, 24, 0, ['railing', 'guardrail', 'handrail', 'steel railing']),
  item('005', '05', 'Metals', '05 73 00', 'Decorative Metal Stairs', 'Wrought iron baluster, per EA', 'EA', 28, 12, 0, ['baluster', 'balustrade', 'wrought iron', 'decorative stair']),
];

// ─── Division 06 — Wood, Plastics & Composites ──────────────────────────────
const div06 = () => [
  item('001', '06', 'Wood, Plastics & Composites', '06 11 00', 'Wood Framing', 'Wall framing, 2×4 @ 16 in o.c., per SF of wall area', 'SF', 1.85, 4.50, 0, ['framing', 'wall framing', '2x4', 'stud wall', 'wood frame']),
  item('002', '06', 'Wood, Plastics & Composites', '06 11 00', 'Wood Framing', 'Wall framing, 2×6 @ 16 in o.c., per SF of wall area', 'SF', 2.65, 4.75, 0, ['framing', 'wall framing', '2x6', 'stud wall', 'exterior wall']),
  item('003', '06', 'Wood, Plastics & Composites', '06 11 00', 'Wood Framing', 'Floor framing, 2×10 @ 16 in o.c., per SF of floor area', 'SF', 3.10, 4.20, 0, ['floor framing', 'joist', '2x10', 'floor system', 'framing']),
  item('004', '06', 'Wood, Plastics & Composites', '06 11 00', 'Wood Framing', 'Roof framing, rafters 2×12, 5:12 pitch, per SF', 'SF', 3.85, 5.80, 0, ['roof framing', 'rafter', '2x12', 'stick frame roof']),
  item('005', '06', 'Wood, Plastics & Composites', '06 11 00', 'Wood Framing', 'Engineered lumber — LVL beam 3.5×11.25 in, per LF', 'LF', 18, 8, 0, ['LVL', 'engineered lumber', 'laminated veneer', 'beam']),
  item('006', '06', 'Wood, Plastics & Composites', '06 16 00', 'Sheathing', 'OSB sheathing 7/16 in, walls, per SF', 'SF', 0.85, 1.20, 0, ['sheathing', 'OSB', 'wall sheathing', 'oriented strand board']),
  item('007', '06', 'Wood, Plastics & Composites', '06 16 00', 'Sheathing', 'OSB sheathing 5/8 in, roof decking, per SF', 'SF', 1.05, 1.35, 0, ['sheathing', 'OSB', 'roof decking', 'roof sheathing']),
  item('008', '06', 'Wood, Plastics & Composites', '06 16 00', 'Sheathing', 'Plywood 3/4 T&G, subfloor, per SF', 'SF', 1.42, 1.65, 0, ['subfloor', 'plywood', 'T&G', 'floor sheathing']),
  item('009', '06', 'Wood, Plastics & Composites', '06 41 16', 'Cabinets', 'Kitchen cabinets — base, semi-custom, per LF incl. install', 'LF', 285, 85, 0, ['cabinets', 'kitchen cabinets', 'base cabinet', 'cabinetry']),
  item('010', '06', 'Wood, Plastics & Composites', '06 41 16', 'Cabinets', 'Kitchen cabinets — wall, semi-custom, per LF incl. install', 'LF', 220, 75, 0, ['cabinets', 'kitchen cabinets', 'wall cabinet', 'upper cabinet']),
  item('011', '06', 'Wood, Plastics & Composites', '06 22 00', 'Millwork', 'Interior door frame/casing set, per EA', 'EA', 85, 65, 0, ['millwork', 'door casing', 'door frame', 'trim']),
  item('012', '06', 'Wood, Plastics & Composites', '06 22 00', 'Millwork', 'Baseboard trim 3-1/2 in, painted MDF, per LF', 'LF', 1.85, 2.40, 0, ['baseboard', 'base trim', 'MDF trim', 'millwork']),
  item('013', '06', 'Wood, Plastics & Composites', '06 22 00', 'Millwork', 'Crown molding 4-1/2 in, per LF', 'LF', 4.20, 5.80, 0, ['crown molding', 'crown', 'trim', 'millwork']),
];

// ─── Division 07 — Thermal & Moisture Protection ─────────────────────────────
const div07 = () => [
  item('001', '07', 'Thermal & Moisture Protection', '07 11 00', 'Dampproofing', 'Foundation damp proofing, bituminous coating, per SF', 'SF', 0.95, 0.65, 0, ['dampproofing', 'foundation waterproofing', 'bituminous', 'basement waterproofing']),
  item('002', '07', 'Thermal & Moisture Protection', '07 13 00', 'Sheet Waterproofing', 'Below-grade waterproofing membrane, HDPE, per SF', 'SF', 3.85, 2.10, 0, ['waterproofing', 'HDPE', 'sheet waterproofing', 'below grade']),
  item('003', '07', 'Thermal & Moisture Protection', '07 21 00', 'Thermal Insulation', 'Batt insulation R-13 (3-1/2 in), fiberglass, per SF', 'SF', 0.58, 0.65, 0, ['insulation', 'batt insulation', 'R-13', 'fiberglass insulation', 'wall insulation']),
  item('004', '07', 'Thermal & Moisture Protection', '07 21 00', 'Thermal Insulation', 'Batt insulation R-19 (6 in), fiberglass, per SF', 'SF', 0.85, 0.70, 0, ['insulation', 'batt insulation', 'R-19', 'fiberglass insulation', 'attic insulation']),
  item('005', '07', 'Thermal & Moisture Protection', '07 21 00', 'Thermal Insulation', 'Batt insulation R-38 (12 in), fiberglass, per SF', 'SF', 1.45, 0.80, 0, ['insulation', 'batt insulation', 'R-38', 'attic insulation', 'ceiling insulation']),
  item('006', '07', 'Thermal & Moisture Protection', '07 21 00', 'Thermal Insulation', 'Spray polyurethane foam, closed-cell, 2 in thick, per SF', 'SF', 3.20, 1.85, 0, ['spray foam', 'SPF', 'closed cell foam', 'insulation']),
  item('007', '07', 'Thermal & Moisture Protection', '07 21 00', 'Thermal Insulation', 'Blown-in fiberglass insulation, R-38, per SF', 'SF', 1.10, 0.90, 0.15, ['blown in insulation', 'loose fill', 'R-38', 'attic insulation']),
  item('008', '07', 'Thermal & Moisture Protection', '07 25 00', 'Weather Barriers', 'Housewrap — Tyvek HomeWrap, per SF', 'SF', 0.38, 0.45, 0, ['housewrap', 'Tyvek', 'weather barrier', 'WRB']),
  item('009', '07', 'Thermal & Moisture Protection', '07 31 13', 'Asphalt Shingles', 'Asphalt shingles, architectural 30-yr, per SQ installed', 'SQ', 185, 145, 0, ['shingles', 'asphalt shingles', 'architectural shingles', 'roofing', '30 year shingles']),
  item('010', '07', 'Thermal & Moisture Protection', '07 31 13', 'Asphalt Shingles', 'Ridge cap shingles, per LF', 'LF', 3.50, 4.20, 0, ['ridge cap', 'ridge shingles', 'roofing']),
  item('011', '07', 'Thermal & Moisture Protection', '07 31 15', 'Slate Shingles', 'Slate roofing, 3/16 in, per SQ installed', 'SQ', 950, 480, 0, ['slate roof', 'slate shingles', 'roofing', 'premium roofing']),
  item('012', '07', 'Thermal & Moisture Protection', '07 32 00', 'Roof Tiles', 'Concrete roof tile, high profile, per SQ installed', 'SQ', 395, 285, 0, ['tile roof', 'concrete tile', 'roofing']),
  item('013', '07', 'Thermal & Moisture Protection', '07 41 13', 'Metal Roof Panels', 'Standing seam metal roof, 24 ga., per SQ installed', 'SQ', 520, 385, 0, ['metal roof', 'standing seam', 'metal roofing']),
  item('014', '07', 'Thermal & Moisture Protection', '07 51 00', 'Built-Up Bituminous Roofing', 'Built-up roof (BUR), 4-ply, gravel surfaced, per SQ', 'SQ', 285, 165, 0, ['BUR', 'built-up roof', 'flat roof', 'commercial roofing']),
  item('015', '07', 'Thermal & Moisture Protection', '07 54 23', 'TPO Roofing', 'TPO membrane roofing, 60-mil, mechanically attached, per SQ', 'SQ', 195, 135, 0, ['TPO', 'membrane roofing', 'flat roof', 'commercial roofing']),
  item('016', '07', 'Thermal & Moisture Protection', '07 62 00', 'Sheet Metal Flashing', 'Galvanized sheet metal flashing, 16 oz, per LF', 'LF', 4.85, 5.20, 0, ['flashing', 'sheet metal flashing', 'galvanized flashing']),
  item('017', '07', 'Thermal & Moisture Protection', '07 92 00', 'Joint Sealants', 'Silicone caulk, exterior, per LF', 'LF', 0.65, 1.20, 0, ['caulk', 'sealant', 'silicone', 'joint sealant']),
];

// ─── Division 08 — Openings ──────────────────────────────────────────────────
const div08 = () => [
  item('001', '08', 'Openings', '08 14 16', 'Flush Wood Doors', 'Interior flush door, hollow-core, 2-8×6-8, pre-hung incl. hardware', 'EA', 185, 95, 0, ['door', 'interior door', 'hollow core', 'flush door']),
  item('002', '08', 'Openings', '08 14 16', 'Flush Wood Doors', 'Interior flush door, solid-core, 2-8×6-8, pre-hung incl. hardware', 'EA', 285, 105, 0, ['door', 'interior door', 'solid core', 'flush door']),
  item('003', '08', 'Openings', '08 14 53', 'French Doors', 'French doors — exterior, fiberglass, 5-0×6-8, per pair incl. hardware', 'EA', 1850, 285, 0, ['french doors', 'exterior door', 'fiberglass door']),
  item('004', '08', 'Openings', '08 11 13', 'Hollow Metal Doors', 'Steel exterior entry door, insulated, 3-0×6-8, incl. frame & hardware', 'EA', 850, 195, 0, ['steel door', 'entry door', 'exterior door', 'hollow metal']),
  item('005', '08', 'Openings', '08 36 13', 'Sectional Doors', 'Garage door, steel raised panel, 16×7 ft, insulated, incl. opener', 'EA', 1650, 485, 0, ['garage door', 'overhead door', 'sectional door']),
  item('006', '08', 'Openings', '08 51 13', 'Aluminum Windows', 'Double-hung window, vinyl, low-E, 3-0×4-0, per EA installed', 'EA', 385, 145, 0, ['window', 'double hung', 'vinyl window', 'low-E']),
  item('007', '08', 'Openings', '08 51 13', 'Aluminum Windows', 'Casement window, vinyl, low-E, 2-6×4-0, per EA installed', 'EA', 425, 155, 0, ['window', 'casement', 'vinyl window', 'low-E']),
  item('008', '08', 'Openings', '08 51 13', 'Aluminum Windows', 'Fixed picture window, vinyl, low-E, 4-0×5-0, per EA installed', 'EA', 620, 175, 0, ['window', 'picture window', 'fixed window', 'vinyl window']),
  item('009', '08', 'Openings', '08 51 13', 'Aluminum Windows', 'Sliding glass door, vinyl, low-E, 6-0×6-8, per EA installed', 'EA', 1250, 285, 0, ['sliding door', 'patio door', 'sliding glass door', 'SGD']),
];

// ─── Division 09 — Finishes ──────────────────────────────────────────────────
const div09 = () => [
  item('001', '09', 'Finishes', '09 21 16', 'Gypsum Board Assemblies', 'GWB 1/2 in, single layer, walls, taped & finished, per SF', 'SF', 0.52, 1.85, 0, ['drywall', 'GWB', 'gypsum board', 'sheetrock', 'wall finish']),
  item('002', '09', 'Finishes', '09 21 16', 'Gypsum Board Assemblies', 'GWB 5/8 in type X, ceiling, taped & finished, per SF', 'SF', 0.68, 2.10, 0, ['drywall', 'GWB', 'ceiling drywall', 'type X', 'fire rated drywall']),
  item('003', '09', 'Finishes', '09 21 16', 'Gypsum Board Assemblies', 'Moisture-resistant GWB (green board), 1/2 in, per SF', 'SF', 0.72, 1.95, 0, ['moisture resistant drywall', 'green board', 'bathroom drywall', 'MR drywall']),
  item('004', '09', 'Finishes', '09 30 00', 'Tiling', 'Ceramic floor tile 12×12, per SF incl. thin-set & grout', 'SF', 3.85, 6.20, 0, ['tile', 'ceramic tile', 'floor tile', 'tiling']),
  item('005', '09', 'Finishes', '09 30 00', 'Tiling', 'Porcelain floor tile 12×24, per SF incl. thin-set & grout', 'SF', 6.50, 7.80, 0, ['tile', 'porcelain tile', 'floor tile', 'tiling']),
  item('006', '09', 'Finishes', '09 30 00', 'Tiling', 'Subway tile 3×6, wall, per SF incl. thin-set & grout', 'SF', 4.85, 8.50, 0, ['tile', 'subway tile', 'wall tile', 'backsplash']),
  item('007', '09', 'Finishes', '09 30 00', 'Tiling', 'Natural stone tile, marble 12×12 floor, per SF', 'SF', 14.20, 8.50, 0, ['marble', 'stone tile', 'floor tile', 'natural stone']),
  item('008', '09', 'Finishes', '09 65 00', 'Resilient Flooring', 'Luxury vinyl plank (LVP), floating, per SF', 'SF', 3.20, 2.50, 0, ['LVP', 'vinyl plank', 'luxury vinyl', 'resilient flooring']),
  item('009', '09', 'Finishes', '09 65 00', 'Resilient Flooring', 'Sheet vinyl, commercial grade, per SF', 'SF', 2.85, 2.10, 0, ['sheet vinyl', 'vinyl flooring', 'resilient flooring']),
  item('010', '09', 'Finishes', '09 68 00', 'Carpet', 'Carpet, mid-grade, incl. pad & installation, per SF', 'SF', 3.50, 2.40, 0, ['carpet', 'carpeting', 'broadloom', 'flooring']),
  item('011', '09', 'Finishes', '09 68 00', 'Carpet', 'Carpet pad 8 lb rebond, per SF', 'SF', 0.65, 0, 0, ['carpet pad', 'rebond pad', 'carpet underlayment']),
  item('012', '09', 'Finishes', '09 64 00', 'Wood Flooring', 'Engineered hardwood, 5 in wide, floating, per SF', 'SF', 6.85, 3.20, 0, ['hardwood', 'engineered hardwood', 'wood floor', 'flooring']),
  item('013', '09', 'Finishes', '09 64 00', 'Wood Flooring', 'Solid hardwood, 3-1/4 in red oak, nailed, per SF finished', 'SF', 8.20, 5.50, 0, ['hardwood', 'solid hardwood', 'oak floor', 'wood flooring']),
  item('014', '09', 'Finishes', '09 90 00', 'Paints and Coatings', 'Interior latex paint, walls & ceilings, 2 coats, per SF', 'SF', 0.28, 0.85, 0, ['paint', 'interior paint', 'latex paint', 'painting']),
  item('015', '09', 'Finishes', '09 90 00', 'Paints and Coatings', 'Interior semi-gloss, trim & doors, per SF', 'SF', 0.35, 1.45, 0, ['paint', 'trim paint', 'semi-gloss', 'painting']),
  item('016', '09', 'Finishes', '09 90 00', 'Paints and Coatings', 'Exterior latex paint, 2 coats, per SF', 'SF', 0.45, 1.65, 0, ['paint', 'exterior paint', 'house paint', 'painting']),
];

// ─── Division 10 — Specialties ───────────────────────────────────────────────
const div10 = () => [
  item('001', '10', 'Specialties', '10 28 00', 'Toilet Accessories', 'Shower enclosure, fiberglass 3-piece, 32×32, per EA installed', 'EA', 685, 285, 0, ['shower', 'shower enclosure', 'fiberglass shower', 'bathroom']),
  item('002', '10', 'Specialties', '10 28 00', 'Toilet Accessories', 'Tub/shower combo, fiberglass alcove, 30×60, per EA installed', 'EA', 850, 320, 0, ['bathtub', 'tub shower', 'fiberglass tub', 'bathroom']),
  item('003', '10', 'Specialties', '10 14 00', 'Signage', 'Address sign, residential, per EA', 'EA', 85, 45, 0, ['sign', 'address sign', 'house number', 'signage']),
];

// ─── Division 11 — Equipment ─────────────────────────────────────────────────
const div11 = () => [
  item('001', '11', 'Equipment', '11 31 00', 'Residential Appliances', 'Refrigerator, 26 CF, stainless, Energy Star, per EA', 'EA', 1650, 85, 0, ['refrigerator', 'appliance', 'fridge', 'kitchen appliance']),
  item('002', '11', 'Equipment', '11 31 00', 'Residential Appliances', 'Range, electric freestanding, 30 in, per EA', 'EA', 985, 75, 0, ['range', 'stove', 'electric range', 'appliance', 'kitchen appliance']),
  item('003', '11', 'Equipment', '11 31 00', 'Residential Appliances', 'Dishwasher, built-in, standard 24 in, Energy Star, per EA', 'EA', 685, 120, 0, ['dishwasher', 'appliance', 'kitchen appliance']),
  item('004', '11', 'Equipment', '11 31 00', 'Residential Appliances', 'Washer/dryer, stacked unit, per EA', 'EA', 1285, 175, 0, ['washer', 'dryer', 'laundry appliance', 'washer dryer']),
  item('005', '11', 'Equipment', '11 31 00', 'Residential Appliances', 'Microwave, over-range, 1.7 CF, per EA', 'EA', 385, 85, 0, ['microwave', 'appliance', 'over range microwave', 'kitchen appliance']),
];

// ─── Division 13 — Special Construction ──────────────────────────────────────
const div13 = () => [
  item('001', '13', 'Special Construction', '13 11 00', 'Swimming Pools', 'In-ground pool, vinyl liner, 16×32 ft, complete', 'LS', 42000, 18000, 3500, ['pool', 'swimming pool', 'in-ground pool', 'vinyl pool']),
  item('002', '13', 'Special Construction', '13 11 00', 'Swimming Pools', 'Gunite pool, 16×32 ft, basic finish, complete', 'LS', 55000, 22000, 4500, ['pool', 'swimming pool', 'gunite pool', 'concrete pool']),
  item('003', '13', 'Special Construction', '13 48 00', 'Sound, Vibration Control', 'Mass loaded vinyl acoustic barrier, per SF', 'SF', 2.20, 1.85, 0, ['sound insulation', 'acoustic', 'MLV', 'soundproofing']),
];

// ─── Division 21 — Fire Suppression ──────────────────────────────────────────
const div21 = () => [
  item('001', '21', 'Fire Suppression', '21 13 13', 'Wet-Pipe Sprinkler Systems', 'Residential fire sprinkler system, wet-pipe, per SF', 'SF', 1.85, 2.50, 0, ['sprinkler', 'fire suppression', 'fire sprinkler', 'NFPA 13']),
  item('002', '21', 'Fire Suppression', '21 13 13', 'Wet-Pipe Sprinkler Systems', 'Commercial fire sprinkler system, wet-pipe, per head installed', 'EA', 185, 95, 0, ['sprinkler head', 'fire suppression', 'commercial sprinkler']),
];

// ─── Division 22 — Plumbing ──────────────────────────────────────────────────
const div22 = () => [
  item('001', '22', 'Plumbing', '22 11 00', 'Facility Water Distribution', 'Copper water line 3/4 in, per LF installed', 'LF', 5.85, 8.50, 0, ['plumbing', 'water line', 'copper pipe', 'supply line']),
  item('002', '22', 'Plumbing', '22 11 00', 'Facility Water Distribution', 'PEX water line 1/2 in, per LF installed', 'LF', 1.85, 3.20, 0, ['plumbing', 'PEX', 'water line', 'supply line']),
  item('003', '22', 'Plumbing', '22 11 00', 'Facility Water Distribution', 'PEX-A manifold system, rough-in, 10-port, per EA', 'EA', 285, 385, 0, ['PEX manifold', 'plumbing manifold', 'homerun plumbing']),
  item('004', '22', 'Plumbing', '22 13 00', 'Facility Sanitary Sewerage', 'ABS drain pipe 4 in, per LF', 'LF', 5.20, 8.20, 0, ['drain', 'ABS pipe', 'sanitary sewer', 'waste pipe']),
  item('005', '22', 'Plumbing', '22 13 00', 'Facility Sanitary Sewerage', 'ABS drain pipe 3 in, per LF', 'LF', 3.85, 6.40, 0, ['drain', 'ABS pipe', 'sanitary sewer', 'waste pipe']),
  item('006', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Water heater, gas 50 gal, 40 MBH, per EA installed', 'EA', 685, 285, 0, ['water heater', 'hot water', 'gas water heater', 'plumbing']),
  item('007', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Tankless water heater, gas whole-house, per EA installed', 'EA', 1250, 385, 0, ['tankless water heater', 'on-demand water heater', 'plumbing']),
  item('008', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Toilet, elongated, dual-flush, ADA, per EA installed', 'EA', 385, 185, 0, ['toilet', 'commode', 'WC', 'bathroom fixture', 'plumbing fixture']),
  item('009', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Lavatory, 24×18 undermount, cultured marble top, per EA installed', 'EA', 485, 195, 0, ['lavatory', 'sink', 'bathroom sink', 'vanity top', 'plumbing fixture']),
  item('010', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Kitchen sink, stainless, double-bowl undermount, per EA installed', 'EA', 385, 185, 0, ['kitchen sink', 'stainless sink', 'double bowl sink', 'plumbing fixture']),
  item('011', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Bathtub, alcove, cast iron 5 ft, per EA installed', 'EA', 950, 285, 0, ['bathtub', 'cast iron tub', 'alcove tub', 'plumbing fixture']),
  item('012', '22', 'Plumbing', '22 42 00', 'Commercial Plumbing Fixtures', 'Walk-in shower, tile walls, glass door 36×36, per EA', 'EA', 1850, 1250, 0, ['shower', 'walk-in shower', 'glass shower', 'tile shower', 'bathroom']),
];

// ─── Division 23 — HVAC ──────────────────────────────────────────────────────
const div23 = () => [
  item('001', '23', 'HVAC', '23 07 00', 'HVAC Insulation', 'Duct insulation, flexible round duct R-8, per LF', 'LF', 3.85, 2.50, 0, ['duct insulation', 'HVAC insulation', 'flex duct insulation']),
  item('002', '23', 'HVAC', '23 31 00', 'HVAC Ducts', 'Galvanized sheet metal duct, round 8 in, per LF installed', 'LF', 9.50, 14.20, 0, ['ductwork', 'sheet metal duct', 'HVAC duct', 'round duct']),
  item('003', '23', 'HVAC', '23 31 00', 'HVAC Ducts', 'Flexible duct 8 in dia., per LF', 'LF', 3.85, 4.50, 0, ['flex duct', 'flexible duct', 'HVAC', 'ductwork']),
  item('004', '23', 'HVAC', '23 74 00', 'Packaged Outdoor HVAC Equipment', 'Split system A/C + heat pump, 3-ton, 16 SEER, per EA installed', 'EA', 3850, 1250, 0, ['heat pump', 'HVAC unit', 'split system', 'air conditioner', 'AC']),
  item('005', '23', 'HVAC', '23 74 00', 'Packaged Outdoor HVAC Equipment', 'Split system A/C + heat pump, 4-ton, 16 SEER, per EA installed', 'EA', 4650, 1450, 0, ['heat pump', 'HVAC unit', 'split system', 'air conditioner', 'AC']),
  item('006', '23', 'HVAC', '23 74 00', 'Packaged Outdoor HVAC Equipment', 'Gas furnace, 80,000 BTU, 96% AFUE, per EA installed', 'EA', 1850, 850, 0, ['furnace', 'gas furnace', 'HVAC', 'heating']),
  item('007', '23', 'HVAC', '23 82 00', 'Convection Heating/Cooling', 'Electric baseboard heater 1500W, per EA installed', 'EA', 95, 75, 0, ['baseboard heat', 'electric heat', 'convection heater']),
  item('008', '23', 'HVAC', '23 09 00', 'Instrumentation and Control', 'Smart programmable thermostat, per EA installed', 'EA', 185, 45, 0, ['thermostat', 'smart thermostat', 'HVAC control']),
];

// ─── Division 26 — Electrical ────────────────────────────────────────────────
const div26 = () => [
  item('001', '26', 'Electrical', '26 05 19', 'Low-Voltage Electrical Power Conductors', 'Romex NM-B 12/2 wiring, per LF in wall', 'LF', 0.75, 1.45, 0, ['wire', 'Romex', 'NM-B', 'electrical wire', 'wiring']),
  item('002', '26', 'Electrical', '26 05 19', 'Low-Voltage Electrical Power Conductors', 'Romex NM-B 14/2 wiring, per LF in wall', 'LF', 0.55, 1.35, 0, ['wire', 'Romex', 'NM-B', 'electrical wire', 'wiring']),
  item('003', '26', 'Electrical', '26 24 16', 'Panelboards', 'Main electrical panel, 200A service, 40-circuit, per EA', 'EA', 685, 985, 0, ['panel', 'electrical panel', 'main panel', '200 amp service', 'breaker box']),
  item('004', '26', 'Electrical', '26 27 26', 'Wiring Devices', 'Duplex outlet, 20A tamper resistant, per EA installed', 'EA', 12, 22, 0, ['outlet', 'receptacle', 'duplex outlet', 'electrical outlet']),
  item('005', '26', 'Electrical', '26 27 26', 'Wiring Devices', 'GFCI outlet 20A, per EA installed', 'EA', 28, 28, 0, ['GFCI', 'ground fault', 'outlet', 'bathroom outlet', 'kitchen outlet']),
  item('006', '26', 'Electrical', '26 27 26', 'Wiring Devices', 'AFCI breaker 20A, per EA', 'EA', 42, 18, 0, ['AFCI', 'arc fault', 'breaker', 'circuit breaker']),
  item('007', '26', 'Electrical', '26 51 00', 'Interior Lighting', 'Recessed LED downlight 4 in, per EA installed', 'EA', 55, 65, 0, ['recessed light', 'can light', 'LED downlight', 'lighting']),
  item('008', '26', 'Electrical', '26 51 00', 'Interior Lighting', 'Recessed LED downlight 6 in, per EA installed', 'EA', 68, 70, 0, ['recessed light', 'can light', 'LED downlight', 'lighting']),
  item('009', '26', 'Electrical', '26 51 00', 'Interior Lighting', 'Ceiling fan with light, 52 in, per EA installed', 'EA', 285, 95, 0, ['ceiling fan', 'fan with light', 'lighting']),
  item('010', '26', 'Electrical', '26 56 00', 'Exterior Lighting', 'Exterior wall sconce, LED, per EA installed', 'EA', 145, 75, 0, ['exterior light', 'wall sconce', 'outdoor lighting']),
  item('011', '26', 'Electrical', '26 56 00', 'Exterior Lighting', 'Security floodlight, motion-activated LED, per EA', 'EA', 85, 65, 0, ['floodlight', 'security light', 'motion sensor light', 'exterior lighting']),
  item('012', '26', 'Electrical', '26 24 13', 'Switchboards', 'Whole-house surge protector, panel-mounted, per EA', 'EA', 145, 85, 0, ['surge protector', 'whole house surge', 'electrical protection']),
  item('013', '26', 'Electrical', '26 22 00', 'Low-Voltage Transformers', 'EV charging station, Level 2, 48A EVSE, per EA installed', 'EA', 785, 350, 0, ['EV charger', 'electric vehicle', 'Level 2 charger', 'EVSE']),
];

// ─── Site Work ───────────────────────────────────────────────────────────────
const siteWork = () => [
  item('001', '02', 'Existing Conditions', '02 22 00', 'Surveys', 'Boundary survey + topographic survey, residential lot', 'LS', 0, 1850, 0, ['survey', 'site survey', 'boundary survey', 'topography', 'land survey']),
  item('002', '02', 'Existing Conditions', '02 30 00', 'Subsurface Investigation', 'Phase I environmental site assessment (ESA)', 'LS', 850, 1650, 0, ['environmental', 'Phase I', 'ESA', 'site assessment']),
  item('003', '02', 'Existing Conditions', '02 65 00', 'Underground Storage Tank Removal', 'UST removal, 500-gal residential, complete', 'EA', 1850, 2200, 850, ['UST', 'underground tank', 'tank removal', 'environmental']),
  item('004', '02', 'Existing Conditions', '02 71 00', 'Groundwater Monitoring', 'Well installation, 4 in monitoring well, per LF', 'LF', 28, 65, 22, ['monitoring well', 'groundwater', 'environmental']),
];

// ─── Build all items ─────────────────────────────────────────────────────────

function buildAllItems(): Record<string, unknown>[] {
  return [
    ...div01(), ...div02(), ...div03(), ...div04(), ...div05(), ...div06(), ...div07(),
    ...div08(), ...div09(), ...div10(), ...div11(), ...div13(), ...div21(), ...div22(),
    ...div23(), ...div26(), ...siteWork(),
  ];
}

// ─── Module export ───────────────────────────────────────────────────────────

export const module: SeedModule = {
  name: 'construction-catalog',
  containers: ['construction-cost-catalog'],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned += await cleanContainer(ctx, 'construction-cost-catalog', '/division', 'csi-');
    }

    for (const catalogItem of buildAllItems()) {
      await upsert(ctx, 'construction-cost-catalog', catalogItem, result);
    }

    return result;
  },
};
