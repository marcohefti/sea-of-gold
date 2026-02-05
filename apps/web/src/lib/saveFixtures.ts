import fresh from "../../../../e2e/fixtures/save_fresh.json";
import afterAutomation from "../../../../e2e/fixtures/save_after_automation.json";
import afterContracts from "../../../../e2e/fixtures/save_after_contracts.json";
import afterCannon from "../../../../e2e/fixtures/save_after_cannon.json";
import afterStarterVoyage from "../../../../e2e/fixtures/save_after_starter_voyage.json";
import legacyV1 from "../../../../e2e/fixtures/save_legacy_v1.json";

type Fixture = { name: string; seed: number; save: string };

export const SAVE_FIXTURES: Record<string, Fixture> = {
  save_fresh: fresh,
  save_after_automation: afterAutomation,
  save_after_contracts: afterContracts,
  save_after_cannon: afterCannon,
  save_after_starter_voyage: afterStarterVoyage,
  save_legacy_v1: legacyV1,
};
