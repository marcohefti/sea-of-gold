import { z } from "zod";

import commoditiesJson from "./content/commodities.json";
import flagsJson from "./content/flags.json";
import islandsJson from "./content/islands.json";
import shipClassesJson from "./content/ship_classes.json";
import routesJson from "./content/routes.json";
import recipesJson from "./content/recipes.json";
import vanityItemsJson from "./content/vanity_items.json";
import unlocksJson from "./content/unlocks.json";
import upgradesJson from "./content/upgrades.json";
import chartsJson from "./content/charts.json";

export const zId = z.string().min(1);

export const zCommodity = z.object({
  id: zId,
  name: z.string().min(1),
  kind: z.enum(["currency", "raw", "refined", "supply"]),
});
export type CommodityDef = z.infer<typeof zCommodity>;

export const zFlag = z.object({
  id: zId,
  name: z.string().min(1),
  taxBps: z.number().int().nonnegative().max(5000),
});
export type FlagDef = z.infer<typeof zFlag>;

export const zIsland = z.object({
  id: zId,
  name: z.string().min(1),
  tier: z.number().int().min(1).max(9),
  controllerFlagId: zId,
  produces: z.record(zId, z.number().int().nonnegative()),
});
export type IslandDef = z.infer<typeof zIsland>;

export const zShipClass = z.object({
  id: zId,
  name: z.string().min(1),
  crewCap: z.number().int().positive(),
  holdCap: z.number().int().positive(),
  speedPct: z.number().int().min(50).max(200),
  combatRating: z.number().int().nonnegative(),
  rumPerMinute: z.number().int().nonnegative(),
  buyCostGold: z.number().int().nonnegative(),
});
export type ShipClassDef = z.infer<typeof zShipClass>;

export const zRoute = z.object({
  id: zId,
  name: z.string().min(1),
  fromIslandId: zId,
  toIslandId: zId,
  durationMs: z.number().int().positive(),
  rumCost: z.number().int().nonnegative(),
  goldReward: z.number().int().nonnegative(),
  influenceReward: z.number().int().nonnegative(),
});
export type RouteDef = z.infer<typeof zRoute>;

export const zRecipe = z.object({
  id: zId,
  name: z.string().min(1),
  input: z.record(zId, z.number().int().positive()),
  output: z.record(zId, z.number().int().positive()),
  intervalMs: z.number().int().positive(),
});
export type RecipeDef = z.infer<typeof zRecipe>;

export const zVanityItem = z.object({
  id: zId,
  name: z.string().min(1),
  desc: z.string().min(1),
  costCosmetics: z.number().int().positive(),
});
export type VanityItemDef = z.infer<typeof zVanityItem>;

export const zUnlockDef = z.object({
  id: zId,
  name: z.string().min(1),
  hint: z.string().min(1),
});
export type UnlockDef = z.infer<typeof zUnlockDef>;

export const zUpgradeDef = z.object({
  id: zId,
  name: z.string().min(1),
  hint: z.string().min(1),
});
export type UpgradeDef = z.infer<typeof zUpgradeDef>;

export const zChartDef = z.object({
  id: zId,
  name: z.string().min(1),
  routeId: zId,
  costGold: z.number().int().positive(),
});
export type ChartDef = z.infer<typeof zChartDef>;

function byId<T extends { id: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    if (out[item.id]) throw new Error(`Duplicate id: ${item.id}`);
    out[item.id] = item;
  }
  return out;
}

function validateRefs(args: {
  commodities: CommodityDef[];
  flags: FlagDef[];
  islands: IslandDef[];
  shipClasses: ShipClassDef[];
  routes: RouteDef[];
  recipes: RecipeDef[];
  vanityItems: VanityItemDef[];
  charts: ChartDef[];
}) {
  const commodityIds = new Set(args.commodities.map((c) => c.id));
  const flagIds = new Set(args.flags.map((f) => f.id));
  const islandIds = new Set(args.islands.map((i) => i.id));
  const routeIds = new Set(args.routes.map((r) => r.id));

  for (const island of args.islands) {
    if (!flagIds.has(island.controllerFlagId)) throw new Error(`Island ${island.id} refs unknown flag: ${island.controllerFlagId}`);
    for (const commodityId of Object.keys(island.produces)) {
      if (!commodityIds.has(commodityId)) throw new Error(`Island ${island.id} produces unknown commodity: ${commodityId}`);
    }
  }

  for (const route of args.routes) {
    if (!islandIds.has(route.fromIslandId)) throw new Error(`Route ${route.id} refs unknown island: ${route.fromIslandId}`);
    if (!islandIds.has(route.toIslandId)) throw new Error(`Route ${route.id} refs unknown island: ${route.toIslandId}`);
  }

  for (const recipe of args.recipes) {
    for (const commodityId of Object.keys(recipe.input)) {
      if (!commodityIds.has(commodityId)) throw new Error(`Recipe ${recipe.id} input refs unknown commodity: ${commodityId}`);
    }
    for (const commodityId of Object.keys(recipe.output)) {
      if (!commodityIds.has(commodityId)) throw new Error(`Recipe ${recipe.id} output refs unknown commodity: ${commodityId}`);
    }
  }

  // Ensure at least one ship class is free (starter).
  if (!args.shipClasses.some((s) => s.buyCostGold === 0)) throw new Error("No starter ship class (buyCostGold=0).");
  if (!args.commodities.some((c) => c.id === "gold" && c.kind === "currency")) throw new Error("Missing currency commodity 'gold'.");
  if (!args.vanityItems.every((v) => v.id.startsWith("vanity:"))) throw new Error("All vanity item ids must start with 'vanity:'.");
  if (!args.charts.every((c) => c.id.startsWith("chart:"))) throw new Error("All chart ids must start with 'chart:'.");
  for (const chart of args.charts) {
    if (!routeIds.has(chart.routeId)) throw new Error(`Chart ${chart.id} refs unknown route: ${chart.routeId}`);
  }
}

export const COMMODITIES = z.array(zCommodity).parse(commoditiesJson);
export const COMMODITY_BY_ID = byId(COMMODITIES);

export const FLAGS = z.array(zFlag).parse(flagsJson);
export const FLAG_BY_ID = byId(FLAGS);

export const ISLANDS = z.array(zIsland).parse(islandsJson);
export const ISLAND_BY_ID = byId(ISLANDS);

export const SHIP_CLASSES = z.array(zShipClass).parse(shipClassesJson);
export const SHIP_CLASS_BY_ID = byId(SHIP_CLASSES);

export const ROUTES = z.array(zRoute).parse(routesJson);
export const ROUTE_BY_ID = byId(ROUTES);

export const RECIPES = z.array(zRecipe).parse(recipesJson);
export const RECIPE_BY_ID = byId(RECIPES);

export const VANITY_ITEMS = z.array(zVanityItem).parse(vanityItemsJson);

export const VANITY_BY_ID = byId(VANITY_ITEMS);

export const UNLOCKS = z.array(zUnlockDef).parse(unlocksJson);
export const UNLOCK_BY_ID = byId(UNLOCKS);

export const UPGRADES = z.array(zUpgradeDef).parse(upgradesJson);
export const UPGRADE_BY_ID = byId(UPGRADES);

export const CHARTS = z.array(zChartDef).parse(chartsJson);
export const CHART_BY_ID = byId(CHARTS);

validateRefs({
  commodities: COMMODITIES,
  flags: FLAGS,
  islands: ISLANDS,
  shipClasses: SHIP_CLASSES,
  routes: ROUTES,
  recipes: RECIPES,
  vanityItems: VANITY_ITEMS,
  charts: CHARTS,
});
