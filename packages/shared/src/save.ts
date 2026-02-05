import { z } from "zod";
import { parseNonNegIntLike } from "./numbers";
import { ISLANDS } from "./catalog";
import { IDLE_API_VERSION } from "./version";

const zBigIntLikeString = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v) => {
    const parsed = parseNonNegIntLike(v);
    if (parsed == null) throw new Error("Invalid bigint-like value");
    return parsed.toString(10);
  });

export const zRngState = z.object({
  algo: z.literal("mulberry32"),
  state: z.number().int(),
});

export const zContractStatus = z.enum(["open", "filled", "collected", "canceled"]);

export const zSpawnAcc = z.record(
  z.string(),
  z.record(z.string(), z.number().int().nonnegative().max(60_000))
);

export const zContractState = z.object({
  id: z.string(),
  portId: z.string(),
  commodityId: z.string(),
  qty: zBigIntLikeString,
  bidPrice: zBigIntLikeString,
  feePaid: zBigIntLikeString,
  filledQty: zBigIntLikeString,
  collectedQty: zBigIntLikeString,
  status: zContractStatus,
  fillRemainderMs: z.number().int().nonnegative(),
});

export const zBuffState = z.object({
  id: z.string(),
  remainingMs: z.number().int().nonnegative(),
  powerBps: z.number().int().min(0).max(100_000).optional(),
});

export const zCannonMinigame = z.object({
  status: z.enum(["idle", "running", "finished"]),
  elapsedMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  hits: z.number().int().nonnegative(),
  shots: z.number().int().nonnegative(),
});

export const zRiggingMinigame = z
  .object({
    status: z.enum(["idle", "running", "finished"]),
    elapsedMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    zoneStartPermille: z.number().int().min(0).max(1000).default(400),
    tugs: z.number().int().nonnegative().default(0),
    goodTugs: z.number().int().nonnegative().default(0),
  })
  .default({ status: "idle", elapsedMs: 0, durationMs: 30_000, zoneStartPermille: 400, tugs: 0, goodTugs: 0 });

export const zDistilleryState = z.object({
  enabled: z.boolean(),
  remainderMs: z.number().int().nonnegative(),
});

const DEFAULT_PRODUCTION_JOBS = {
  distill_rum: { enabled: true, remainderMs: 0 },
  forge_cannonballs: { enabled: false, remainderMs: 0 },
  craft_parts: { enabled: false, remainderMs: 0 },
  assemble_repair_kits: { enabled: false, remainderMs: 0 },
  brew_dye: { enabled: false, remainderMs: 0 },
  weave_cloth: { enabled: false, remainderMs: 0 },
  tailor_cosmetics: { enabled: false, remainderMs: 0 },
} as const;

export const zProductionStateV1 = z.object({
  distillery: zDistilleryState,
});

export const zProductionStateV2 = z.object({
  jobs: z.record(z.string(), zDistilleryState),
});

export const zProductionState = z.union([zProductionStateV2, zProductionStateV1]).transform((p) => {
  if ("jobs" in p) return { jobs: { ...DEFAULT_PRODUCTION_JOBS, ...p.jobs } };
  return { jobs: { ...DEFAULT_PRODUCTION_JOBS, distill_rum: p.distillery } };
});

export const zVoyageState = z.object({
  status: z.enum(["idle", "running", "completed"]),
  routeId: z.string().nullable(),
  fromIslandId: z.string().nullable(),
  toIslandId: z.string().nullable(),
  remainingMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  pendingGold: zBigIntLikeString,
  pendingInfluence: z.number().int().nonnegative(),
  encounters: z
    .array(
      z.object({
        atMs: z.number().int().nonnegative(),
        cannonballsCost: z.number().int().positive(),
        status: z.enum(["pending", "success", "fail"]),
      })
    )
    .default([]),
});

export const zAutomationState = z
  .object({
    enabled: z.boolean().default(false),
    routeId: z.string().nullable().default(null),
    autoCollect: z.boolean().default(false),
  })
  .default({ enabled: false, routeId: null, autoCollect: false });

export const zInventoryV1 = z.object({
  wood: zBigIntLikeString,
  sugar: zBigIntLikeString,
  iron: zBigIntLikeString,
  stone: zBigIntLikeString,
  hemp: zBigIntLikeString,
  rum: zBigIntLikeString,
  cannonballs: zBigIntLikeString,
  parts: zBigIntLikeString,
  repair_kits: zBigIntLikeString,
});

export const zInventoryV2 = zInventoryV1.extend({
  herbs: zBigIntLikeString,
  dye: zBigIntLikeString,
  cloth: zBigIntLikeString,
  cosmetics: zBigIntLikeString,
});

export const zInventory = z.union([zInventoryV2, zInventoryV1]).transform((inv) => {
  if ("herbs" in inv) return inv;
  return { ...inv, herbs: "0", dye: "0", cloth: "0", cosmetics: "0" };
});

export const zWarehouseState = z.object({
  cap: zBigIntLikeString,
  inv: zInventory,
});

export const zShipHoldState = z.object({
  cap: zBigIntLikeString,
  inv: zInventory,
});

export const zLocationState = z.object({
  islandId: z.string(),
});

export const zShipState = z.object({
  classId: z.string(),
  condition: z.number().int().nonnegative().default(100),
  maxCondition: z.number().int().positive().default(100),
});

export const zCrewSkillsState = z
  .object({
    sailingXp: z.number().int().nonnegative().default(0),
    gunneryXp: z.number().int().nonnegative().default(0),
  })
  .default({ sailingXp: 0, gunneryXp: 0 });

export const zCrewState = z
  .object({
    hired: z.number().int().nonnegative().default(0),
    wagesRemainderMs: z.number().int().nonnegative().default(0),
    skills: zCrewSkillsState,
  })
  .default({ hired: 0, wagesRemainderMs: 0, skills: { sailingXp: 0, gunneryXp: 0 } });

const DEFAULT_CONTROLLER_BY_ISLAND_ID: Record<string, string> = Object.fromEntries(
  ISLANDS.map((i) => [i.id, i.controllerFlagId])
);

const DEFAULT_INVENTORY_V2 = {
  wood: "0",
  sugar: "0",
  iron: "0",
  stone: "0",
  hemp: "0",
  rum: "0",
  cannonballs: "0",
  parts: "0",
  repair_kits: "0",
  herbs: "0",
  dye: "0",
  cloth: "0",
  cosmetics: "0",
} as const;

const DEFAULT_WAREHOUSE_CAP = "50";
const DEFAULT_WAREHOUSES_BY_ISLAND_ID: Record<string, { cap: string; inv: typeof DEFAULT_INVENTORY_V2 }> = Object.fromEntries(
  ISLANDS.map((i) => [i.id, { cap: DEFAULT_WAREHOUSE_CAP, inv: { ...DEFAULT_INVENTORY_V2 } }])
);

export const zWorldState = z
  .object({
    controllerByIslandId: z.record(z.string(), z.string()),
  })
  .default({ controllerByIslandId: DEFAULT_CONTROLLER_BY_ISLAND_ID })
  .transform((w) => ({ controllerByIslandId: { ...DEFAULT_CONTROLLER_BY_ISLAND_ID, ...w.controllerByIslandId } }));

export const zConquestState = z
  .object({
    status: z.enum(["idle", "running", "success", "fail"]).default("idle"),
    targetIslandId: z.string().nullable().default(null),
    attackerFlagId: z.string().nullable().default(null),
    remainingMs: z.number().int().nonnegative().default(0),
    durationMs: z.number().int().nonnegative().default(0),
    stage: z.number().int().nonnegative().default(0),
    warChestPaid: zBigIntLikeString.default("0"),
  })
  .default({
    status: "idle",
    targetIslandId: null,
    attackerFlagId: null,
    remainingMs: 0,
    durationMs: 0,
    stage: 0,
    warChestPaid: "0",
  });

export const zShipyardState = z
  .object({
    level: z.number().int().positive().default(1),
  })
  .default({ level: 1 });

export const zFlagshipProjectState = z
  .object({
    progress: z.number().int().nonnegative().default(0),
    required: z.number().int().positive().default(3),
  })
  .default({ progress: 0, required: 3 });

export const zFleetShipState = z.object({
  id: z.string(),
  name: z.string(),
  location: zLocationState,
  ship: zShipState,
  crew: zCrewState,
  hold: zShipHoldState,
  voyage: zVoyageState,
  automation: zAutomationState,
});

export const zFleetState = z
  .object({
    ships: z.array(zFleetShipState).default([]),
    nextShipNum: z.number().int().positive().default(2),
    maxShips: z.number().int().min(1).max(5).default(2),
  })
  .default({ ships: [], nextShipNum: 2, maxShips: 2 });

const DEFAULT_INFLUENCE_BY_FLAG_ID = {
  merchants: 0,
  freebooters: 0,
  navy: 0,
  player: 0,
} as const;

export const zPoliticsStateV1 = z.object({
  affiliationFlagId: z.string(),
  influence: z.number().int().nonnegative(),
});

export const zPoliticsStateV2 = z.object({
  affiliationFlagId: z.string(),
  influenceByFlagId: z.record(z.string(), z.number().int().nonnegative()),
});

export const zPortPerkState = z.object({
  id: z.enum(["tax_relief"]),
  remainingMs: z.number().int().nonnegative(),
  taxDiscountBps: z.number().int().nonnegative(),
});

export const zPoliticsCampaignState = z
  .object({
    status: z.enum(["idle", "running", "success", "fail"]).default("idle"),
    kind: z.enum(["tax_relief"]).default("tax_relief"),
    portId: z.string().nullable().default(null),
    controllerFlagId: z.string().nullable().default(null),
    remainingMs: z.number().int().nonnegative().default(0),
    durationMs: z.number().int().nonnegative().default(0),
    goldPaid: zBigIntLikeString.default("0"),
    influenceSpent: z.number().int().nonnegative().default(0),
  })
  .default({
    status: "idle",
    kind: "tax_relief",
    portId: null,
    controllerFlagId: null,
    remainingMs: 0,
    durationMs: 0,
    goldPaid: "0",
    influenceSpent: 0,
  });

export const zPoliticsStateV3 = z.object({
  affiliationFlagId: z.string(),
  influenceByFlagId: z.record(z.string(), z.number().int().nonnegative()),
  portPerksByIslandId: z.record(z.string(), zPortPerkState).default({}),
  campaign: zPoliticsCampaignState,
});

export const zPoliticsState = z
  .union([zPoliticsStateV3, zPoliticsStateV2, zPoliticsStateV1])
  .transform((p) => {
    if ("portPerksByIslandId" in p) {
      return {
        affiliationFlagId: p.affiliationFlagId,
        influenceByFlagId: { ...DEFAULT_INFLUENCE_BY_FLAG_ID, ...p.influenceByFlagId },
        portPerksByIslandId: p.portPerksByIslandId ?? {},
        campaign: p.campaign,
      };
    }
    if ("influenceByFlagId" in p)
      return {
        affiliationFlagId: p.affiliationFlagId,
        influenceByFlagId: { ...DEFAULT_INFLUENCE_BY_FLAG_ID, ...p.influenceByFlagId },
        portPerksByIslandId: {},
        campaign: zPoliticsCampaignState.parse(undefined),
      };
    return {
      affiliationFlagId: p.affiliationFlagId,
      influenceByFlagId: { ...DEFAULT_INFLUENCE_BY_FLAG_ID, [p.affiliationFlagId]: p.influence },
      portPerksByIslandId: {},
      campaign: zPoliticsCampaignState.parse(undefined),
    };
  })
  .default({
    affiliationFlagId: "player",
    influenceByFlagId: DEFAULT_INFLUENCE_BY_FLAG_ID,
    portPerksByIslandId: {},
    campaign: zPoliticsCampaignState.parse(undefined),
  });

export const zGameState = z.object({
  mode: z.enum(["title", "port"]),
  simNowMs: z.number().int().nonnegative(),
  stepAccMs: z.number().int().nonnegative(),
  settings: z
    .object({
      seed: z.number().int(),
    })
    .default({ seed: 1 }),
  stats: z
    .object({
      voyagesStarted: z.number().int().nonnegative(),
    })
    .default({ voyagesStarted: 0 }),
  tutorial: z
    .object({
      stepId: z.string(),
    })
    .optional(),
  resources: z.object({
    gold: zBigIntLikeString,
  }),
  shipId: z.string().default("s_1"),
  shipName: z.string().default("Sloop #1"),
  location: zLocationState,
  storage: z.object({
    warehouses: z
      .record(z.string(), zWarehouseState)
      .default(DEFAULT_WAREHOUSES_BY_ISLAND_ID)
      .transform((w) => ({ ...DEFAULT_WAREHOUSES_BY_ISLAND_ID, ...w })),
    shipHold: zShipHoldState,
  }),
  ship: zShipState,
  crew: zCrewState,
  unlocks: z.array(z.string()),
  automation: zAutomationState,
  fleet: zFleetState,
  world: zWorldState,
  conquest: zConquestState,
  shipyard: zShipyardState,
  flagship: zFlagshipProjectState,
  economy: z.object({
    contracts: z.array(zContractState),
    spawnAcc: zSpawnAcc,
  }),
  production: zProductionState,
  voyage: zVoyageState,
  politics: zPoliticsState,
  buffs: z.array(zBuffState),
  minigames: z
    .union([
      z.object({ cannon: zCannonMinigame }),
      z.object({ cannon: zCannonMinigame, rigging: zRiggingMinigame }),
    ])
    .transform((m) => {
      if ("rigging" in m) return m;
      return { ...m, rigging: zRiggingMinigame.parse(undefined) };
    }),
  dock: z.object({
    incomeRemainderMs: z.number().int().nonnegative(),
    passiveEnabled: z.boolean().optional(),
    workRemainingMs: z.number().int().nonnegative().optional(),
  }),
}).transform((s) => {
  // Product-quality migration: older saves had passive dock income by default. If the save
  // lacks the explicit `dock.passiveEnabled` flag, infer it from unlocks.
  const inferredPassive =
    typeof s.dock.passiveEnabled === "boolean"
      ? s.dock.passiveEnabled
      : s.unlocks.includes("upgrade:auto_dockwork") ||
        s.unlocks.includes("economy") ||
        s.unlocks.includes("minigame:cannon") ||
        s.unlocks.includes("route:starter_run") ||
        s.unlocks.includes("recipe:distill_rum");
  const nextDock = {
    incomeRemainderMs: s.dock.incomeRemainderMs,
    passiveEnabled: inferredPassive,
    workRemainingMs: typeof s.dock.workRemainingMs === "number" ? s.dock.workRemainingMs : 0,
  };

  const unlockSet = new Set(s.unlocks);
  if (inferredPassive) unlockSet.add("upgrade:auto_dockwork");

  const tutorialStep =
    s.mode === "title"
      ? "tut:title"
      : s.tutorial?.stepId ??
        (unlockSet.has("voyage") || unlockSet.has("politics") || unlockSet.has("crew")
          ? "tut:port"
          : unlockSet.has("economy") || inferredPassive
            ? "tut:economy_intro"
            : "tut:dock_intro");

  return {
    ...s,
    tutorial: { stepId: tutorialStep },
    dock: nextDock,
    unlocks: Array.from(unlockSet),
  };
});

export const zSavePayloadV1 = z.object({
  version: z.literal(IDLE_API_VERSION),
  client: z
    .object({
      wallClockMs: z.number().int().nonnegative().default(0),
    })
    .optional()
    .default({ wallClockMs: 0 }),
  rng: zRngState,
  state: zGameState,
});

export type SavePayloadV1 = z.infer<typeof zSavePayloadV1>;

export function parseSavePayload(json: string): SavePayloadV1 {
  const raw = JSON.parse(json);
  return zSavePayloadV1.parse(raw);
}
