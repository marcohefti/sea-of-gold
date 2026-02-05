export type GameAction =
  | { type: "START_NEW_GAME" }
  | { type: "DOCK_WORK_START" }
  | { type: "DOCK_AUTOMATE_BUY" }
  | { type: "BUY_CHART"; chartId: string }
  | { type: "PLACE_CONTRACT"; commodityId: string; qty: bigint; bidPrice: bigint }
  | { type: "COLLECT_CONTRACT"; contractId: string }
  | { type: "COLLECT_CONTRACT_ALL" }
  | { type: "CANCEL_CONTRACT"; contractId: string }
  | { type: "LOAD_TO_HOLD"; commodityId: string; qty: bigint }
  | { type: "UNLOAD_FROM_HOLD"; commodityId: string; qty: bigint }
  | { type: "CREW_HIRE"; qty: number }
  | { type: "CREW_FIRE"; qty: number }
  | { type: "PRODUCTION_SET_ENABLED"; recipeId: string; enabled: boolean }
  | { type: "VOYAGE_START"; routeId: string }
  | { type: "VOYAGE_PREPARE"; routeId: string }
  | { type: "VOYAGE_COLLECT" }
  | { type: "SHIP_REPAIR" }
  | { type: "SHIP_BUY_CLASS"; classId: string }
  | { type: "FLEET_BUY_SHIP"; classId: string }
  | { type: "FLEET_SET_ACTIVE_SHIP"; shipId: string }
  | { type: "FLEET_SET_AUTOMATION"; shipId: string; enabled: boolean; routeId: string | null; autoCollect: boolean }
  | { type: "CONQUEST_START"; targetIslandId: string }
  | { type: "CONQUEST_ABORT" }
  | { type: "SHIPYARD_UPGRADE" }
  | { type: "FLAGSHIP_CONTRIBUTE" }
  | { type: "POLITICS_SET_AFFILIATION"; flagId: string }
  | { type: "POLITICS_DONATE"; flagId: string; gold: bigint }
  | { type: "POLITICS_CAMPAIGN_START_TAX_RELIEF" }
  | { type: "POLITICS_CAMPAIGN_ABORT" }
  | { type: "VANITY_BUY"; itemId: string }
  | { type: "UPGRADE_WAREHOUSE" }
  | { type: "CANNON_START" }
  | { type: "CANNON_FIRE" }
  | { type: "RIGGING_START" }
  | { type: "RIGGING_TUG" };
