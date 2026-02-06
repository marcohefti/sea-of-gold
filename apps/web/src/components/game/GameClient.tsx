"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";

import {
  getChartCostGoldForUi,
  getCannonVolleyDurationMsForUi,
  getCannonVolleyRefreshWindowMsForUi,
  getCannonVolleyUiForUi,
  getActiveContractCountForPortForUi,
  getContractPlacementFeeForUiWithBid,
  getContractMaxActivePerPortForUi,
  getConquestRequirementsForUi,
  getCrewHireCostGoldForUi,
  getCrewWageGoldPerCrewPerMinForUi,
  getDockAutomateCostGoldForUi,
  getDockPassiveGoldPerSecForUi,
  getDockWorkDurationMsForUi,
  getDockWorkHustleReduceMsForUi,
  getDonationGoldPerInfluenceForUi,
  getEffectivePortTaxBpsForUi,
  getFactionStandingForUi,
  getFlagshipForUi,
  getNextGoalsForUi,
  getPortGoldFlowPerMinForUi,
  getRiggingRunDurationMsForUi,
  getRiggingRunRefreshWindowMsForUi,
  getRiggingRunRumEfficiencyPctForUi,
  getRiggingRunSpeedBonusPctForUi,
  getRiggingRunUiForUi,
  getShipRepairForUi,
  getShipSpeedPctForUi,
  getShipyardMaxLevelForUi,
  getShipyardUpgradeCostForUi,
  getTaxReliefCampaignForUi,
  getWarehouseUpgradeForUi,
  getVoyageDurationMsForUi,
  getVoyageStartRequirements,
  invUsed,
  isDockWorkManualAvailableForUi,
  type GameAction,
  type GameState,
} from "@sea-of-gold/engine";
import {
  COMMODITY_BY_ID,
  CHARTS,
  FLAG_BY_ID,
  FLAGS,
  IDLE_API_VERSION,
  ISLAND_BY_ID,
  ISLANDS,
  RECIPE_BY_ID,
  ROUTES,
  ROUTE_BY_ID,
  SHIP_CLASS_BY_ID,
  VANITY_ITEMS,
} from "@sea-of-gold/shared";
import {
  AlertTriangle,
  Anchor,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Coins,
  Compass,
  Crosshair,
  Flag,
  FlaskConical,
  Gem,
  Hammer,
  Lock,
  Package,
  Sailboat,
  ScrollText,
  Shield,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
  Warehouse as WarehouseGlyph,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createIdleStore, parseBigintFromUi } from "@/lib/idleStore";
import { SAVE_FIXTURES } from "@/lib/saveFixtures";
import { cn } from "@/lib/utils";

type NavKey = "port" | "economy" | "crew" | "voyage" | "politics";

const RESOURCE_GLYPH_BY_LABEL: Record<string, LucideIcon> = {
  Gold: Coins,
  Wood: Package,
  Sugar: FlaskConical,
  Rum: Gem,
  Hemp: Wind,
  Herbs: Sparkles,
  Cosmetics: Gem,
  Cannonballs: Crosshair,
  Warehouse: WarehouseGlyph,
};

const NAV_GLYPH_BY_KEY: Record<NavKey, LucideIcon> = {
  port: Anchor,
  economy: TrendingUp,
  crew: Users,
  voyage: Sailboat,
  politics: Flag,
};

function toSafeRatio(used: bigint, cap: bigint): number {
  if (cap <= 0n) return 0;
  const scaled = Number((used * 1000n) / cap);
  return Math.max(0, Math.min(1, scaled / 1000));
}

function TinySparkline({ value }: { value: bigint }) {
  const absValue = value < 0n ? -value : value;
  const points: Array<[number, number]> = [0, 1, 2, 3, 4].map((idx) => {
    const y = 2 + Number((absValue / BigInt(idx + 1)) % 7n);
    return [idx * 4, 11 - y];
  });
  const path = points.map(([x, y], idx) => `${idx === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <svg aria-hidden="true" viewBox="0 0 16 12" className="h-3.5 w-4.5 text-[color:var(--sog-accent)]">
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.35" />
    </svg>
  );
}

function StorageRing({ used, cap }: { used: bigint; cap: bigint }) {
  const ratio = toSafeRatio(used, cap);
  const circumference = 2 * Math.PI * 7;
  const tone = ratio >= 0.95 ? "var(--sog-danger)" : ratio >= 0.8 ? "var(--sog-warning)" : "var(--sog-positive)";
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4">
      <circle cx="9" cy="9" r="7" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2" />
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke={tone}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - ratio)}
        strokeLinecap="round"
        strokeWidth="2"
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

function HarborSigil({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" className={cn("sog-svg-frame h-16 w-16 text-[color:var(--sog-accent)]", className)}>
      <defs>
        <linearGradient id="sogSigilFill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(210,162,74,0.95)" />
          <stop offset="100%" stopColor="rgba(76,175,115,0.85)" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="none" opacity="0.25" stroke="url(#sogSigilFill)" strokeWidth="1.5" />
      <path d="M17 36c3 2 6 2 9 0s6-2 9 0 6 2 9 0 6-2 9 0" fill="none" opacity="0.9" stroke="url(#sogSigilFill)" strokeLinecap="round" strokeWidth="2" />
      <path d="M21 44c2 1.5 4.5 1.5 6.5 0s4.5-1.5 6.5 0 4.5 1.5 6.5 0 4.5-1.5 6.5 0" fill="none" opacity="0.65" stroke="url(#sogSigilFill)" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M32 15v17M24 23h16" fill="none" opacity="0.95" stroke="url(#sogSigilFill)" strokeLinecap="round" strokeWidth="2.2" />
      <circle cx="32" cy="23" r="2.8" fill="url(#sogSigilFill)" />
    </svg>
  );
}

function GoldPill({ gold }: { gold: bigint }) {
  return (
    <div className="sog-surface-muted flex items-center gap-2 rounded-md px-2.5 py-1 text-sm text-zinc-100">
      <Coins aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--sog-accent)]" />
      <span className="text-zinc-300">Gold</span>
      <span className="font-semibold tabular-nums">{gold.toString(10)}</span>
      <TinySparkline value={gold} />
    </div>
  );
}

function ResourcePill({ label, value }: { label: string; value: bigint }) {
  const Glyph = RESOURCE_GLYPH_BY_LABEL[label] || CircleDot;
  return (
    <div className="sog-surface-muted flex items-center gap-2 rounded-md px-2.5 py-1 text-sm text-zinc-100">
      <Glyph aria-hidden="true" className="h-3.5 w-3.5 text-zinc-300" />
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium tabular-nums">{value.toString(10)}</span>
      <TinySparkline value={value} />
    </div>
  );
}

function WarehousePill({ used, cap }: { used: bigint; cap: bigint }) {
  return (
    <div className="sog-surface-muted flex items-center gap-2 rounded-md px-2.5 py-1 text-sm text-zinc-100">
      <StorageRing used={used} cap={cap} />
      <span className="text-zinc-300">Warehouse</span>
      <span className="font-medium tabular-nums">
        {used.toString(10)}/{cap.toString(10)}
      </span>
    </div>
  );
}

function formatDurationCompact(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = s % 60;
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${s}s`;
}

function BuffsPill({ buffs }: { buffs: GameState["buffs"] }) {
  if (buffs.length === 0)
    return (
      <div className="sog-surface-muted flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-zinc-400">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
        No active buffs
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {buffs.map((b) => (
        <div
          key={b.id}
          className="sog-surface-muted sog-animate-in flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-zinc-100"
        >
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--sog-accent)]" />
          <span className="font-medium">{b.id}</span>{" "}
          <span className="text-zinc-400 tabular-nums">{formatDurationCompact(b.remainingMs)}</span>
        </div>
      ))}
    </div>
  );
}

function PortPerkPill({ perk }: { perk: { id: string; remainingMs: number; taxDiscountBps: number } | null }) {
  if (!perk || perk.remainingMs <= 0) return null;
  return (
    <div className="sog-surface-muted sog-animate-pulse flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm text-zinc-100">
      <Shield aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--sog-positive)]" />
      <span className="font-medium">perk:{perk.id}</span>{" "}
      <span className="text-zinc-400 tabular-nums">{formatDurationCompact(perk.remainingMs)}</span>
    </div>
  );
}

function TitleScreen({
  onStart,
  onImport,
}: {
  onStart: () => void;
  onImport: (save: string) => void;
}) {
  const fixtureKeys = Object.keys(SAVE_FIXTURES);
  const [fixtureKey, setFixtureKey] = React.useState(fixtureKeys[0] || "save_fresh");
  const [saveText, setSaveText] = React.useState("");
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-black text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <div className="mb-4 flex items-center gap-4">
            <HarborSigil className="sog-animate-float" />
            <div className="sog-kicker">Deterministic Captaincy</div>
          </div>
          <h1 className="text-4xl font-semibold tracking-tight">Sea of Gold</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Single-player idle captaincy. Deterministic simulation. Voyages soon.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <Button data-testid="start-new-game" onClick={onStart}>
              <Compass aria-hidden="true" className="h-4 w-4" />
              Start New Game
            </Button>
            <div className="text-xs text-zinc-500">
              Harness API v{IDLE_API_VERSION}
            </div>
          </div>

          <div className="mt-10 grid gap-3">
            <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
              <CardHeader>
                <CardTitle>Milestone 1</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-300">
                Dock income, contracts, and the Cannon Volley minigame.
              </CardContent>
            </Card>

            <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
              <CardHeader>
                <CardTitle>Import Save</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="text-xs text-zinc-500">
                  Paste a save payload (JSON) and import. For automated tests, you can also load a fixture.
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <label className="mb-1 block text-xs text-zinc-400">Fixture</label>
                    <select
                      data-testid="fixture-select"
                      className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                      value={fixtureKey}
                      onChange={(e) => setFixtureKey(e.target.value)}
                    >
                      {fixtureKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    data-testid="fixture-load"
                    variant="secondary"
                    className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                    onClick={() => setSaveText(SAVE_FIXTURES[fixtureKey]?.save ?? "")}
                  >
                    Load Fixture
                  </Button>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Save JSON</label>
                  <textarea
                    data-testid="save-import-input"
                    value={saveText}
                    onChange={(e) => setSaveText(e.target.value)}
                    spellCheck={false}
                    className="h-32 w-full resize-none rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                    placeholder='{"version":"0.1.0","rng":...,"state":...}'
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">Imports are versioned and migrated on load.</div>
                  <Button
                    data-testid="save-import-submit"
                    disabled={!saveText.trim()}
                    onClick={() => onImport(saveText)}
                  >
                    Import
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function DockIntroPanel({
  state,
  onWork,
  onBuyAutomation,
}: {
  state: GameState;
  onWork: () => void;
  onBuyAutomation: () => void;
}) {
  const flow = getPortGoldFlowPerMinForUi(state);
  const passivePerSec = getDockPassiveGoldPerSecForUi(state);
  const automateCost = getDockAutomateCostGoldForUi();
  const canWork = isDockWorkManualAvailableForUi(state);
  const canBuyAutomation = !state.dock.passiveEnabled && state.resources.gold >= automateCost;
  const workDurationMs = getDockWorkDurationMsForUi();
  const hustleReduceMs = getDockWorkHustleReduceMsForUi();
  const working = state.dock.workRemainingMs > 0;
  const workProgressPct =
    working && workDurationMs > 0
      ? Math.max(0, Math.min(1, 1 - state.dock.workRemainingMs / workDurationMs))
      : 0;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Anchor aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Dock
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1 text-sm text-zinc-300">
          <div>
            Passive:{" "}
            <span className="font-medium text-zinc-100 tabular-nums">{passivePerSec.toString(10)} gold/sec</span>{" "}
            <span className="text-zinc-500">(automate to earn while idle)</span>
          </div>
          <div>
            Net:{" "}
            <span className="font-medium tabular-nums text-zinc-100">
              {flow.netGoldPerMin >= 0n ? "+" : ""}
              {flow.netGoldPerMin.toString(10)} gold/min
            </span>
            {flow.crewTotal > 0 ? (
              <span className="text-zinc-500"> · wages {flow.wagesGoldPerMin.toString(10)}g/min</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 rounded-md border border-zinc-800 bg-black p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
            <Hammer aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
            Work the docks
          </div>
          <div className="text-xs text-zinc-500">
            Start a short shift to earn your first gold. Gold will not increase unless you work or automate.{" "}
            <span className="text-zinc-400">Tip:</span> while a shift is running, click{" "}
            <span className="text-zinc-200">Hustle</span> to finish sooner (same pay).
          </div>
          {working ? (
            <div className="sog-progress-track mt-1 h-2 w-full">
              <div className="sog-progress-fill sog-animate-shimmer h-full" style={{ width: `${Math.round(workProgressPct * 100)}%` }} />
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button data-testid="work-docks" onClick={onWork} disabled={!canWork}>
              {working
                ? `Hustle (+${(hustleReduceMs / 1000).toFixed(1)}s) · ${formatDurationCompact(state.dock.workRemainingMs)}`
                : "Work shift"}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 rounded-md border border-zinc-800 bg-black p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
            <TrendingUp aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-positive)]" />
            Automate dockwork
          </div>
          <div className="text-xs text-zinc-500">
            Cost: <span className="tabular-nums text-zinc-200">{automateCost.toString(10)}g</span>. Enables passive gold
            and unlocks Economy. More systems unlock as you place contracts and produce Rum.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              data-testid="upgrade-auto-dockwork"
              variant="secondary"
              className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
              onClick={onBuyAutomation}
              disabled={!canBuyAutomation}
            >
              {state.dock.passiveEnabled ? "Purchased" : "Buy Automation"}
            </Button>
            {!state.dock.passiveEnabled && !canBuyAutomation ? (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--sog-warning)]" />
                Need{" "}
                <span className="tabular-nums text-zinc-200">
                  {(automateCost - state.resources.gold).toString(10)}
                </span>{" "}
                more gold.
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EconomyIntroPanel({ onOpenEconomy }: { onOpenEconomy: () => void }) {
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Next: Economy
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm text-zinc-300">
          Place <span className="text-zinc-200">contracts</span> for commodities. Fills happen deterministically over time and
          collected goods land in your <span className="text-zinc-200">warehouse</span>.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onOpenEconomy}>
            <TrendingUp aria-hidden="true" className="h-4 w-4" />
            Open Economy
          </Button>
          <div className="text-xs text-zinc-500">
            Tip: place your first contract to unlock <span className="text-zinc-200">Cannon Volley</span> and the{" "}
            <span className="text-zinc-200">Distillery</span>.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type CommandAction = {
  id: string;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
};

function getUnlockedRoutesFromCurrentPort(state: GameState): string[] {
  const portId = state.location.islandId;
  return ROUTES.filter((route) => route.fromIslandId === portId && state.unlocks.includes(`route:${route.id}`)).map((route) => route.id);
}

function renderCommandActionIcon(actionId: string, className: string) {
  if (actionId.includes("economy") || actionId.includes("contract")) return <TrendingUp aria-hidden="true" className={className} />;
  if (actionId.includes("voyage")) return <Sailboat aria-hidden="true" className={className} />;
  if (actionId.includes("cannon")) return <Crosshair aria-hidden="true" className={className} />;
  if (actionId.includes("politics")) return <Flag aria-hidden="true" className={className} />;
  if (actionId.includes("work") || actionId.includes("automation")) return <Anchor aria-hidden="true" className={className} />;
  return <Compass aria-hidden="true" className={className} />;
}

function formatDebugEventLabel(event: unknown): string {
  if (!event || typeof event !== "object") return "Unknown event";
  const kind = typeof (event as { kind?: unknown }).kind === "string" ? (event as { kind: string }).kind : "unknown";

  if (kind === "action") {
    const action = (event as { action?: { type?: unknown } }).action;
    const t = action && typeof action.type === "string" ? action.type : "ACTION";
    return `Command: ${t}`;
  }
  if (kind === "status") {
    const system = typeof (event as { system?: unknown }).system === "string" ? (event as { system: string }).system : "system";
    const from = typeof (event as { from?: unknown }).from === "string" ? (event as { from: string }).from : "prev";
    const to = typeof (event as { to?: unknown }).to === "string" ? (event as { to: string }).to : "next";
    return `${system} changed ${from} -> ${to}`;
  }
  if (kind === "unlock") {
    const added = Array.isArray((event as { added?: unknown[] }).added) ? (event as { added: unknown[] }).added : [];
    return added.length > 0 ? `Unlocked ${added.length} item${added.length > 1 ? "s" : ""}` : "Unlock event";
  }
  if (kind === "advance") {
    const msRaw = (event as { ms?: unknown }).ms;
    const ms = typeof msRaw === "number" && Number.isFinite(msRaw) ? msRaw : 0;
    return `Simulation advanced ${formatDurationCompact(ms)}`;
  }
  return "Event";
}

function getDebugEventIcon(event: unknown): LucideIcon {
  if (!event || typeof event !== "object") return ScrollText;
  const kind = typeof (event as { kind?: unknown }).kind === "string" ? (event as { kind: string }).kind : "unknown";
  if (kind === "action") return Timer;
  if (kind === "status") return CheckCircle2;
  if (kind === "unlock") return Sparkles;
  if (kind === "advance") return Sailboat;
  return ScrollText;
}

function getDebugEventToneClass(event: unknown): string {
  if (!event || typeof event !== "object") return "text-zinc-300";
  const kind = typeof (event as { kind?: unknown }).kind === "string" ? (event as { kind: string }).kind : "unknown";
  if (kind === "unlock") return "text-emerald-200";
  if (kind === "status") return "text-[color:var(--sog-accent)]";
  if (kind === "action") return "text-zinc-200";
  if (kind === "advance") return "text-zinc-300";
  return "text-zinc-300";
}

function CommandDeckPanel({
  state,
  activeNav,
  onOpenNav,
  onWork,
  onBuyAutomation,
  onCollectContracts,
  onPrepareVoyage,
  onStartVoyage,
  onCollectVoyage,
  onOpenCannon,
}: {
  state: GameState;
  activeNav: NavKey;
  onOpenNav: (nav: NavKey) => void;
  onWork: () => void;
  onBuyAutomation: () => void;
  onCollectContracts: () => void;
  onPrepareVoyage: (routeId: string) => void;
  onStartVoyage: (routeId: string) => void;
  onCollectVoyage: () => void;
  onOpenCannon: () => void;
}) {
  const goals = getNextGoalsForUi(state);
  const highlightedGoal = goals[0] || "Build a stronger voyage economy.";
  const dockAutomateCost = getDockAutomateCostGoldForUi();
  const contractsHere = state.economy.contracts.filter(
    (c) => c.portId === state.location.islandId && (c.status === "open" || c.status === "filled")
  );
  const collectableContracts = contractsHere.filter((c) => c.filledQty > c.collectedQty).length;
  const routeIds = getUnlockedRoutesFromCurrentPort(state);
  const primaryRouteId = routeIds[0] || null;
  const primaryReq = primaryRouteId ? getVoyageStartRequirements(state, state.ship.classId, primaryRouteId) : null;
  const hasRumForPrimary = primaryReq ? state.storage.shipHold.inv.rum >= primaryReq.totalRum : false;
  const hasCannonBuff = state.buffs.some((b) => b.id === "cannon_volley" && b.remainingMs > 0);

  const primaryAction = (() => {
    if (state.tutorial.stepId === "tut:dock_intro") {
      if (!state.dock.passiveEnabled && state.resources.gold >= dockAutomateCost) {
        return {
          id: "buy-automation",
          label: "Buy Dock Automation",
          hint: "Enable passive gold and unlock Economy.",
          onClick: onBuyAutomation,
        } satisfies CommandAction;
      }
      return {
        id: "work-docks",
        label: state.dock.workRemainingMs > 0 ? "Hustle Shift" : "Work Shift",
        hint: "Manual action keeps early pacing tight.",
        onClick: onWork,
      } satisfies CommandAction;
    }

    if (state.unlocks.includes("economy") && contractsHere.length === 0) {
      if (activeNav !== "economy") {
        return {
          id: "open-economy",
          label: "Open Economy",
          hint: "Place a contract to feed production loops.",
          onClick: () => onOpenNav("economy"),
        } satisfies CommandAction;
      }
      return {
        id: "place-contract",
        label: "Place Contract",
        hint: "Use quantity + bid to control fills and fees.",
        onClick: () => {},
        disabled: true,
      } satisfies CommandAction;
    }

    if (collectableContracts > 0) {
      if (activeNav !== "economy") {
        return {
          id: "go-economy-collect",
          label: "Collect Contracts",
          hint: `${collectableContracts} contract${collectableContracts > 1 ? "s" : ""} ready at this port.`,
          onClick: () => onOpenNav("economy"),
        } satisfies CommandAction;
      }
      return {
        id: "collect-contracts",
        label: "Collect Contracts",
        hint: "Move filled goods into warehouse inventory.",
        onClick: onCollectContracts,
      } satisfies CommandAction;
    }

    if (state.voyage.status === "completed") {
      if (activeNav !== "voyage") {
        return {
          id: "go-voyage-collect",
          label: "Collect Voyage",
          hint: "Bank pending rewards and trigger route unlocks.",
          onClick: () => onOpenNav("voyage"),
        } satisfies CommandAction;
      }
      return {
        id: "voyage-collect",
        label: "Collect Voyage",
        hint: "Claim gold and influence from the completed route.",
        onClick: onCollectVoyage,
      } satisfies CommandAction;
    }

    if (state.unlocks.includes("voyage") && primaryRouteId && state.voyage.status === "idle") {
      if (!hasRumForPrimary) {
        return {
          id: "prep-rum",
          label: "Prepare Hold Supplies",
          hint: `Load rum/cannonballs for ${ROUTE_BY_ID[primaryRouteId]?.name ?? primaryRouteId}.`,
          onClick: () => onPrepareVoyage(primaryRouteId),
        } satisfies CommandAction;
      }

      if (activeNav !== "voyage") {
        return {
          id: "go-voyage",
          label: "Open Voyage",
          hint: "Route supplies into gold and influence.",
          onClick: () => onOpenNav("voyage"),
        } satisfies CommandAction;
      }

      return {
        id: "start-voyage",
        label: "Start Voyage",
        hint: `Launch ${ROUTE_BY_ID[primaryRouteId]?.name ?? primaryRouteId} now.`,
        onClick: () => onStartVoyage(primaryRouteId),
      } satisfies CommandAction;
    }

    if (state.unlocks.includes("minigame:cannon") && !hasCannonBuff) {
      return {
        id: "open-cannon",
        label: "Play Cannon Volley",
        hint: "Active play banks a voyage payout buff.",
        onClick: onOpenCannon,
      } satisfies CommandAction;
    }

    if (state.unlocks.includes("politics") && state.politics.affiliationFlagId === "player") {
      return {
        id: "open-politics",
        label: "Choose Affiliation",
        hint: "Pick a faction to unlock influence progression.",
        onClick: () => onOpenNav("politics"),
      } satisfies CommandAction;
    }

    return {
      id: "open-port",
      label: "Review Port",
      hint: "Check goals, storage pressure, and sinks.",
      onClick: () => onOpenNav("port"),
    } satisfies CommandAction;
  })();

  const quickActions: CommandAction[] = [];
  if (state.unlocks.includes("economy")) {
    quickActions.push({
      id: "quick-economy",
      label: "Economy",
      hint: "Contracts and market levers.",
      onClick: () => onOpenNav("economy"),
    });
  }
  if (state.unlocks.includes("voyage")) {
    quickActions.push({
      id: "quick-voyage",
      label: "Voyage",
      hint: "Run routes with stocked hold.",
      onClick: () => onOpenNav("voyage"),
    });
  }
  if (state.unlocks.includes("politics")) {
    quickActions.push({
      id: "quick-politics",
      label: "Politics",
      hint: "Influence, campaigns, conquest.",
      onClick: () => onOpenNav("politics"),
    });
  }
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <div className="sog-kicker flex items-center gap-1.5">
          <Compass aria-hidden="true" className="h-3.5 w-3.5" />
          Command Deck
        </div>
        <CardTitle className="flex items-center gap-2">
          <Anchor aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Primary Objective
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="rounded-md border border-zinc-800 bg-black/70 px-3 py-2 text-sm text-zinc-200">{highlightedGoal}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            data-testid="command-primary-action"
            className="sog-animate-pulse"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {renderCommandActionIcon(primaryAction.id, "h-4 w-4")}
            {primaryAction.label}
          </Button>
          <div className="text-xs text-zinc-500">{primaryAction.hint}</div>
        </div>
        {quickActions.length > 0 ? (
          <div className="grid gap-2 border-t border-zinc-900 pt-3">
            <div className="sog-kicker">Quick Access</div>
            <div className="flex flex-wrap gap-2">
              {quickActions.map((item) => (
                <Button key={item.id} variant="secondary" className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900" onClick={item.onClick}>
                  {renderCommandActionIcon(item.id, "h-3.5 w-3.5")}
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CaptainsLogPanel({ events }: { events: unknown[] }) {
  const rows = events.slice(-8).reverse();
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <div className="sog-kicker flex items-center gap-1.5">
          <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
          Session Feedback
        </div>
        <CardTitle className="flex items-center gap-2">
          <ScrollText aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Captain’s Log
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm text-zinc-300">
        {rows.length === 0 ? (
          <div className="rounded-md border border-zinc-800 bg-black/70 px-3 py-2 text-zinc-500">
            No notable events yet. Start actions to populate the log.
          </div>
        ) : (
          rows.map((event, index) => {
            const EventIcon = getDebugEventIcon(event);
            return (
              <div key={index} className="sog-animate-in flex items-center gap-2 rounded-md border border-zinc-800 bg-black/70 px-3 py-2">
                <EventIcon aria-hidden="true" className={cn("h-3.5 w-3.5", getDebugEventToneClass(event))} />
                <span className={cn("text-sm", getDebugEventToneClass(event))}>{formatDebugEventLabel(event)}</span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function MidgameScalingPanel({ state }: { state: GameState }) {
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const hold = state.storage.shipHold;
  const holdRum = hold.inv.rum;
  const unlockedRoutes = ROUTES.filter((route) => route.fromIslandId === portId && state.unlocks.includes(`route:${route.id}`));
  const routeRequirements = unlockedRoutes
    .map((route) => getVoyageStartRequirements(state, state.ship.classId, route.id))
    .filter((req): req is NonNullable<ReturnType<typeof getVoyageStartRequirements>> => !!req);
  const startableRouteCount = routeRequirements.filter((req) => holdRum >= req.totalRum).length;
  const minRumNeeded =
    routeRequirements.length > 0
      ? routeRequirements.reduce((min, req) => (req.totalRum < min ? req.totalRum : min), routeRequirements[0].totalRum)
      : 0n;
  const rumGap = holdRum >= minRumNeeded ? 0n : minRumNeeded - holdRum;
  const missingRumRouteCount = routeRequirements.filter((req) => holdRum < req.totalRum).length;

  const chartsFromPort = CHARTS.filter((chart) => ROUTE_BY_ID[chart.routeId]?.fromIslandId === portId);
  const chartUnlocksFromPort = chartsFromPort.filter(
    (chart) => !state.unlocks.includes(chart.id) && !state.unlocks.includes(`route:${chart.routeId}`)
  );
  const affordableChartCount = chartUnlocksFromPort.filter((chart) => state.resources.gold >= getChartCostGoldForUi(chart.id)).length;

  const globalUnlockedRouteCount = state.unlocks.filter((id) => id.startsWith("route:")).length;
  const currentPortTotalRouteCount = ROUTES.filter((route) => route.fromIslandId === portId).length;

  const warehouseUsed = wh ? invUsed(wh.inv) : 0n;
  const warehouseCap = wh?.cap ?? 0n;
  const holdUsed = invUsed(hold.inv);
  const warehouseFillPct = warehouseCap > 0n ? Number((warehouseUsed * 100n) / warehouseCap) : 0;
  const holdFillPct = hold.cap > 0n ? Number((holdUsed * 100n) / hold.cap) : 0;

  const flow = getPortGoldFlowPerMinForUi(state);
  const bottlenecks: string[] = [];
  if (state.voyage.status === "idle" && unlockedRoutes.length > 0 && startableRouteCount === 0) {
    if (rumGap > 0n) bottlenecks.push(`Voyage stall: load ${rumGap.toString(10)} rum into hold.`);
    else bottlenecks.push("Voyage stall: produce rum and refill hold.");
  }
  if (flow.netGoldPerMin < 0n) {
    bottlenecks.push(`Net negative: ${flow.netGoldPerMin.toString(10)} gold/min after crew wages.`);
  }
  if (warehouseFillPct >= 85) {
    bottlenecks.push(`Warehouse pressure: ${warehouseFillPct}% full (contracts may clog).`);
  }
  if (affordableChartCount > 0) {
    bottlenecks.push(`Expansion ready: ${affordableChartCount} chart unlock${affordableChartCount > 1 ? "s" : ""} affordable.`);
  }
  if (bottlenecks.length === 0) {
    bottlenecks.push("No immediate bottleneck. Keep voyages cycling and invest in sinks/expansion.");
  }

  return (
    <Card data-testid="midgame-scaling-radar" className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Midgame Scaling Radar
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Routes</div>
            <div className="mt-1 text-zinc-200 tabular-nums">
              Global unlocked {globalUnlockedRouteCount} · here {unlockedRoutes.length}/{currentPortTotalRouteCount}
            </div>
            <div className="mt-1 text-zinc-400 tabular-nums">
              Startable {startableRouteCount} · blocked by rum {missingRumRouteCount}
            </div>
            <div className="mt-1 text-zinc-500 tabular-nums">
              Min rum need {minRumNeeded.toString(10)} · gap {rumGap.toString(10)}
            </div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Economy Pressure</div>
            <div className="mt-1 text-zinc-200 tabular-nums">
              Net {flow.netGoldPerMin >= 0n ? "+" : ""}
              {flow.netGoldPerMin.toString(10)} gold/min
            </div>
            <div className="mt-1 text-zinc-400 tabular-nums">
              Warehouse {warehouseUsed.toString(10)}/{warehouseCap.toString(10)} ({warehouseFillPct}%)
            </div>
            <div className="mt-1 text-zinc-500 tabular-nums">
              Hold {holdUsed.toString(10)}/{hold.cap.toString(10)} ({holdFillPct}%)
            </div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm sm:col-span-2">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Expansion Window</div>
            <div className="mt-1 text-zinc-200 tabular-nums">
              Charts pending {chartUnlocksFromPort.length} · affordable {affordableChartCount}
            </div>
          </div>
        </div>
        <div className="grid gap-2">
          {bottlenecks.map((item, idx) => (
            <div key={idx} className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-300">
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DebugDispatchPanel({
  enabled,
  onDispatch,
  onOffline,
  onClearOffline,
}: {
  enabled: boolean;
  onDispatch: (action: GameAction) => void;
  onOffline: (ms: number) => void;
  onClearOffline: () => void;
}) {
  if (!enabled) return null;
  return (
    <Card data-testid="debug-panel" className="border-zinc-800 bg-zinc-950 text-zinc-100">
      <CardHeader>
        <CardTitle>Debug — State Machine</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <div className="text-xs text-zinc-500">
          Automation-only buttons to exercise invalid transitions (engine should no-op safely).
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            data-testid="debug-dispatch-voyage-start"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onDispatch({ type: "VOYAGE_START", routeId: "starter_run" })}
          >
            Dispatch VOYAGE_START
          </Button>
          <Button
            data-testid="debug-dispatch-cannon-start"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onDispatch({ type: "CANNON_START" })}
          >
            Dispatch CANNON_START
          </Button>
          <Button
            data-testid="debug-dispatch-cannon-fire"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onDispatch({ type: "CANNON_FIRE" })}
          >
            Dispatch CANNON_FIRE
          </Button>
          <Button
            data-testid="debug-offline-2h"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onOffline(2 * 60 * 60 * 1000)}
          >
            Apply Offline +2h
          </Button>
          <Button
            data-testid="debug-offline-8h"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onOffline(8 * 60 * 60 * 1000)}
          >
            Apply Offline +8h
          </Button>
          <Button
            data-testid="debug-offline-clear"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={onClearOffline}
          >
            Clear Offline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NavButton({
  active,
  testId,
  icon: Icon,
  children,
  onClick,
  disabled,
  lockedReason,
}: {
  active: boolean;
  testId: string;
  icon: LucideIcon;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  lockedReason?: string;
}) {
  return (
    <Button
      data-testid={testId}
      variant={active ? "default" : "secondary"}
      className={cn(
        "w-full justify-start",
        active ? "sog-nav-active border-[color:var(--sog-accent-soft)]" : "bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
      )}
      disabled={disabled}
      title={disabled ? lockedReason : undefined}
      onClick={disabled ? () => {} : onClick}
    >
      <span className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" className="h-3.5 w-3.5 opacity-90" />
          <span>{children}</span>
        </span>
        <span className="flex items-center gap-1.5">
          {active ? <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[color:var(--sog-accent)]" /> : null}
          {disabled ? (
            <span className="flex items-center gap-1 rounded bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-300">
              <Lock aria-hidden="true" className="h-3 w-3" />
              Locked
            </span>
          ) : null}
        </span>
      </span>
    </Button>
  );
}

function EconomyPanel({
  state,
  debugUi,
  onPlace,
  onCollectAll,
  onCancel,
  onCollectOne,
}: {
  state: GameState;
  debugUi: boolean;
  onPlace: (commodityId: string, qty: string, bidPrice: string) => void;
  onCollectAll: () => void;
  onCancel: (contractId: string) => void;
  onCollectOne: (contractId: string) => void;
}) {
  const [open, setOpen] = React.useState(true);
  const [commodityId, setCommodityId] = React.useState("wood");
  const [qty, setQty] = React.useState("10");
  const [price, setPrice] = React.useState("1");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "open" | "filled" | "collected" | "canceled">("all");
  const [scope, setScope] = React.useState<"here" | "all">("here");
  const [sortBy, setSortBy] = React.useState<"newest" | "priority" | "commodity" | "status">("newest");
  const portId = state.location.islandId;
  const qtyParsed = parseBigintFromUi(qty) ?? 0n;
  const bidParsed = parseBigintFromUi(price) ?? 0n;
  const fee = qtyParsed > 0n ? getContractPlacementFeeForUiWithBid(state, qtyParsed, bidParsed) : 0n;
  const tier = ISLAND_BY_ID[portId]?.tier ?? 1;
  const taxBps = getEffectivePortTaxBpsForUi(state, portId);
  const maxSlots = getContractMaxActivePerPortForUi();
  const usedSlots = getActiveContractCountForPortForUi(state, portId);
  const slotsFull = usedSlots >= maxSlots;
  const canAfford = qtyParsed > 0n && state.resources.gold >= fee;
  const producedIds = React.useMemo(() => {
    const produces = ISLAND_BY_ID[portId]?.produces || { wood: 0, sugar: 0 };
    return Object.keys(produces).filter((id) => id !== "gold");
  }, [portId]);
  const wh = state.storage.warehouses[portId];
  const whUsed = wh ? invUsed(wh.inv) : 0n;
  const whCap = wh?.cap ?? 0n;
  const whFree = whCap > whUsed ? whCap - whUsed : 0n;
  const collectibleCount = state.economy.contracts.filter(
    (c) => c.portId === portId && c.status !== "canceled" && c.status !== "collected" && c.filledQty > c.collectedQty
  ).length;

  const portProduces = ISLAND_BY_ID[portId]?.produces ?? {};
  const priorityRankById = React.useMemo(() => {
    const map = new Map<string, number>();
    const groups = new Map<string, GameState["economy"]["contracts"]>();
    for (const c of state.economy.contracts) {
      if (c.status !== "open") continue;
      const key = `${c.portId}::${c.commodityId}`;
      const arr = groups.get(key);
      if (arr) arr.push(c);
      else groups.set(key, [c]);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => (a.bidPrice === b.bidPrice ? (a.id < b.id ? -1 : 1) : a.bidPrice > b.bidPrice ? -1 : 1));
      for (let i = 0; i < arr.length; i++) map.set(arr[i].id, i + 1);
    }
    return map;
  }, [state.economy.contracts]);

  const visibleContracts = React.useMemo(() => {
    const scopeFiltered = state.economy.contracts.filter((c) => (scope === "here" ? c.portId === portId : true));
    const statusFiltered = scopeFiltered.filter((c) => (statusFilter === "all" ? true : c.status === statusFilter));

    const parseContractNum = (id: string) => {
      const m = id.match(/(\d+)$/);
      return m ? Number.parseInt(m[1], 10) : 0;
    };

    const statusOrder: Record<string, number> = { open: 0, filled: 1, collected: 2, canceled: 3 };

    statusFiltered.sort((a, b) => {
      if (sortBy === "newest") return parseContractNum(b.id) - parseContractNum(a.id);
      if (sortBy === "priority") {
        const ap = priorityRankById.get(a.id) ?? 999_999;
        const bp = priorityRankById.get(b.id) ?? 999_999;
        if (ap !== bp) return ap - bp;
        if (a.bidPrice !== b.bidPrice) return a.bidPrice > b.bidPrice ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      }
      if (sortBy === "commodity") {
        if (a.commodityId !== b.commodityId) return a.commodityId < b.commodityId ? -1 : 1;
        return a.id < b.id ? -1 : 1;
      }
      if (sortBy === "status") {
        const as = statusOrder[a.status] ?? 99;
        const bs = statusOrder[b.status] ?? 99;
        if (as !== bs) return as - bs;
        return a.id < b.id ? -1 : 1;
      }
      return 0;
    });
    return statusFiltered;
  }, [state.economy.contracts, portId, priorityRankById, scope, sortBy, statusFilter]);

  React.useEffect(() => {
    if (producedIds.length === 0) return;
    if (producedIds.includes(commodityId)) return;
    setCommodityId(producedIds[0]);
  }, [producedIds, commodityId]);

  return (
    <div className="grid gap-4">
        <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-100">Economy — Contracts</div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="contracts-open"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Hide Form" : "Show Form"}
          </Button>
          <Button
            data-testid="contracts-collect"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={onCollectAll}
          >
            Collect Available
          </Button>
        </div>
      </div>
      {collectibleCount > 0 ? (
        <div className="text-xs text-zinc-500">
          Collectible: <span className="tabular-nums text-zinc-200">{collectibleCount}</span> · warehouse free{" "}
          <span className="tabular-nums text-zinc-200">{whFree.toString(10)}</span>
          {whFree <= 0n ? <span className="ml-2 text-rose-300">Warehouse full</span> : null}
        </div>
      ) : null}

      {open ? (
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <CardTitle>Place Contract</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-zinc-400">Commodity</label>
                <select
                  data-testid="contracts-commodity"
                  className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                  value={commodityId}
                  onChange={(e) => setCommodityId(e.target.value)}
                >
                  {producedIds.map((id) => (
                    <option key={id} value={id}>
                      {COMMODITY_BY_ID[id]?.name ?? id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Qty</label>
                <Input
                  data-testid="contracts-qty"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  inputMode="numeric"
                  className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Bid Price</label>
                <Input
                  data-testid="contracts-price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="numeric"
                  className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                Fee: <span className="tabular-nums text-zinc-200">{fee.toString(10)}</span> gold · tier{" "}
                <span className="tabular-nums text-zinc-200">{tier}</span> · tax{" "}
                <span className="tabular-nums text-zinc-200">{taxBps}</span>bps
                {bidParsed > 1n ? <span className="ml-2 text-zinc-500">(includes bid premium)</span> : null}
                {!canAfford ? <span className="ml-2 text-rose-300">Insufficient gold</span> : null}
                {slotsFull ? <span className="ml-2 text-rose-300">Slots full</span> : null}
              </div>
              <Button
                data-testid="contracts-place"
                disabled={!canAfford}
                onClick={() => onPlace(commodityId, qty, price)}
              >
                {slotsFull ? "Place (Full)" : "Place"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Contracts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <div>
              Slots:{" "}
              <span className={cn("tabular-nums", slotsFull ? "text-rose-200" : "text-zinc-200")}>
                {usedSlots}/{maxSlots}
              </span>
            </div>
            <div>
              Warehouse free: <span className="tabular-nums text-zinc-200">{whFree.toString(10)}</span>
              {whFree <= 0n ? <span className="ml-2 text-rose-200">Storage full blocks collecting</span> : null}
            </div>
          </div>
          <div className="mb-3 grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Market: supply per minute at{" "}
                <span className="text-zinc-200">{ISLAND_BY_ID[portId]?.name ?? portId}</span>.
                Higher bids fill first (ties break by contract id). Lower-priority contracts wait behind higher bids.
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500">Scope</label>
                <select
                  data-testid="contracts-filter-scope"
                  className="h-8 rounded-md border border-zinc-800 bg-black px-2 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  <option value="here">This port</option>
                  <option value="all">All ports</option>
                </select>
                <label className="text-xs text-zinc-500">Filter</label>
                <select
                  data-testid="contracts-filter-status"
                  className="h-8 rounded-md border border-zinc-800 bg-black px-2 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="filled">Filled</option>
                  <option value="collected">Collected</option>
                  <option value="canceled">Canceled</option>
                </select>
                <label className="text-xs text-zinc-500">Sort</label>
                <select
                  data-testid="contracts-sort"
                  className="h-8 rounded-md border border-zinc-800 bg-black px-2 text-xs text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="newest">Newest</option>
                  <option value="priority">Priority</option>
                  <option value="commodity">Commodity</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(portProduces)
                .filter(([id, rate]) => id !== "gold" && (rate ?? 0) > 0)
                .map(([id, rate]) => (
                  <div
                    key={id}
                    className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-300"
                  >
                    <span className="text-zinc-400">{COMMODITY_BY_ID[id]?.name ?? id}</span>{" "}
                    <span className="tabular-nums text-zinc-200">{rate}</span>/min
                  </div>
                ))}
            </div>
          </div>

          {visibleContracts.length === 0 ? (
            <div className="text-sm text-zinc-400">No contracts yet.</div>
          ) : (
            <div className="grid gap-2">
              {visibleContracts.map((c) => {
                const available = c.filledQty - c.collectedQty;
                const prio = c.status === "open" ? (priorityRankById.get(c.id) ?? 0) : 0;
                const commodityName = COMMODITY_BY_ID[c.commodityId]?.name ?? c.commodityId;

                return (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{commodityName}</span>
                      {debugUi ? <span className="text-zinc-500">#{c.id}</span> : null}
                      {scope === "all" ? <span className="text-xs text-zinc-500">{c.portId}</span> : null}
                      {debugUi && prio > 0 ? (
                        <span className="text-xs text-zinc-500 tabular-nums" title="Higher bids fill first for this port+commodity.">
                          prio {prio}
                        </span>
                      ) : null}
                      {debugUi && prio > 1 ? (
                        <span className="text-xs text-amber-200" title="Lower priority bids may not receive supply until higher bids are satisfied.">
                          behind {prio - 1}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                      <span className="tabular-nums">
                        filled {c.filledQty.toString(10)}/{c.qty.toString(10)} · collected{" "}
                        {c.collectedQty.toString(10)}
                        {available > 0n ? (
                          <>
                            {" "}
                            · available <span className="tabular-nums">{available.toString(10)}</span>
                          </>
                        ) : null}
                      </span>
                      {available > 0n && c.status !== "canceled" && c.status !== "collected" ? (
                        <Button
                          data-testid={`contract-collect-${c.id}`}
                          variant="secondary"
                          className="h-7 bg-zinc-950 px-2 text-zinc-100 hover:bg-zinc-900"
                          onClick={() => onCollectOne(c.id)}
                        >
                          Collect
                        </Button>
                      ) : null}
                      <span className="text-zinc-500">status</span>
                      <span className="font-medium text-zinc-200">{c.status}</span>
                      <Button
                        data-testid={`contract-cancel-${c.id}`}
                        variant="secondary"
                        className="h-7 bg-zinc-950 px-2 text-zinc-100 hover:bg-zinc-900"
                        disabled={c.status === "canceled" || c.status === "collected"}
                        onClick={() => onCancel(c.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CannonPanel({
  state,
  onStart,
  onFire,
  onClose,
}: {
  state: GameState;
  onStart: () => void;
  onFire: () => void;
  onClose: () => void;
}) {
  const mg = state.minigames.cannon;
  const refreshWindowMs = getCannonVolleyRefreshWindowMsForUi();
  const existingBuff = state.buffs.find((b) => b.id === "cannon_volley");
  const existingPowerBps = existingBuff?.powerBps ?? (existingBuff ? 12_000 : undefined);
  const existingBonusPct = existingPowerBps != null ? Math.max(0, Math.round((existingPowerBps - 10_000) / 100)) : null;
  const startBlocked = existingBuff ? existingBuff.remainingMs >= refreshWindowMs : false;
  const startDisabled = startBlocked || mg.status === "running";
  const ui = getCannonVolleyUiForUi(mg.status === "running" ? mg.elapsedMs : 0);
  const inZone = mg.status === "running" && ui.inZone;
  const pct = ui.phasePct;
  const durationS = Math.round(getCannonVolleyDurationMsForUi() / 1000);
  const runPowerBps = mg.hits >= 12 ? 13_500 : mg.hits >= 6 ? 12_000 : 11_000;
  const runBonusPct = Math.max(0, Math.round((runPowerBps - 10_000) / 100));

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100 sog-animate-in">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Crosshair aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Cannon Volley
        </CardTitle>
        <Button
          data-testid="minigame-cannon-close"
          variant="secondary"
          className="h-7 bg-zinc-950 px-2 text-xs text-zinc-100 hover:bg-zinc-900"
          onClick={onClose}
        >
          Close
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-zinc-300">
          Press <span className="font-medium text-zinc-100">Fire</span> when the indicator is in the gold zone. Reward:{" "}
          <span className="text-zinc-200">cannon_volley</span> buff (voyage gold bonus). Tiers:{" "}
          <span className="text-zinc-200">0–5 hits</span> = +10%,{" "}
          <span className="text-zinc-200">6+</span> = +20% (+60s),{" "}
          <span className="text-zinc-200">12+</span> = +35% (+180s). Stacking: keeps the best tier and the longer duration.
        </div>
        {existingBuff ? (
          <div className="mt-2 text-xs text-zinc-400">
            Current buff:{" "}
            <span className="font-medium text-zinc-100">
              {existingBonusPct != null ? `+${existingBonusPct}%` : "+?%"}
            </span>{" "}
            voyage gold ·{" "}
            <span className="tabular-nums text-zinc-100">{formatDurationCompact(existingBuff.remainingMs)}</span> remaining.
          </div>
        ) : null}

        <div className="mt-3 rounded-md border border-zinc-800 bg-black p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Timer aria-hidden="true" className="h-3.5 w-3.5" />
              Status: <span className="text-zinc-100">{mg.status}</span>
            </span>
            <span className="tabular-nums">
              {mg.elapsedMs} / {mg.durationMs}ms
            </span>
          </div>
          <div className="sog-progress-track mt-2 h-3 w-full">
            <div
              className={cn("h-full", inZone ? "sog-progress-fill sog-animate-shimmer" : "bg-zinc-400")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span className="tabular-nums">
              shots {mg.shots} · hits {mg.hits}
            </span>
            <span>{inZone ? "IN ZONE" : "—"}</span>
          </div>
        </div>
        {mg.status === "finished" ? (
          <div className="mt-2 text-xs text-zinc-400">
            Last run:{" "}
            <span className="tabular-nums text-zinc-100">{mg.hits}</span> hits ⇒{" "}
            <span className="font-medium text-zinc-100">+{runBonusPct}%</span>.
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button data-testid="minigame-cannon-start" className="sog-animate-pulse" disabled={startDisabled} onClick={onStart}>
            <Timer aria-hidden="true" className="h-4 w-4" />
            Start ({durationS}s)
          </Button>
          <Button
            data-testid="minigame-cannon-fire"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={onFire}
          >
            <Crosshair aria-hidden="true" className="h-4 w-4" />
            Fire
          </Button>
        </div>
        {startBlocked ? (
          <div className="mt-2 text-xs text-zinc-500">
            Locked: your <span className="text-zinc-200">cannon_volley</span> buff is still active. You can replay when it has{" "}
            <span className="tabular-nums text-zinc-200">{formatDurationCompact(refreshWindowMs)}</span> or less remaining.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RiggingPanel({
  state,
  onStart,
  onTug,
  onClose,
}: {
  state: GameState;
  onStart: () => void;
  onTug: () => void;
  onClose: () => void;
}) {
  const mg = state.minigames.rigging;
  const refreshWindowMs = getRiggingRunRefreshWindowMsForUi();
  const existingBuff = state.buffs.find((b) => b.id === "rigging_run");
  const startBlocked = existingBuff ? existingBuff.remainingMs >= refreshWindowMs : false;
  const startDisabled = startBlocked || mg.status === "running";
  const ui = getRiggingRunUiForUi(mg.status === "running" ? mg.elapsedMs : 0, mg.zoneStartPermille);
  const widthPermille = ui.widthPermille;
  const phasePermille = ui.phasePermille;
  const inZone = mg.status === "running" && ui.inZone;
  const phasePct = Math.round((phasePermille / 10) * 10) / 10;
  const zoneStartPct = mg.zoneStartPermille / 10;
  const zoneWidthPct = widthPermille / 10;
  const efficiencyPct = getRiggingRunRumEfficiencyPctForUi();
  const speedBonusPct = getRiggingRunSpeedBonusPctForUi();
  const durationS = Math.round(getRiggingRunDurationMsForUi() / 1000);

  return (
    <Card className="border-zinc-800 bg-zinc-950 text-zinc-100 sog-animate-in">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Wind aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Rigging Run
        </CardTitle>
        <Button
          data-testid="minigame-rigging-close"
          variant="secondary"
          className="h-7 bg-zinc-950 px-2 text-xs text-zinc-100 hover:bg-zinc-900"
          onClick={onClose}
        >
          Close
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-zinc-300">
          Tap <span className="font-medium text-zinc-100">Tug</span> when the marker is inside the green rigging window.
          Reward: <span className="text-zinc-200">rigging_run</span> buff ({efficiencyPct}% reduced baseline rum burn, +{speedBonusPct}% voyage speed).
          Stacking: refreshes to the longer remaining duration.
        </div>

        <div className="mt-3 rounded-md border border-zinc-800 bg-black p-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Timer aria-hidden="true" className="h-3.5 w-3.5" />
              Status: <span className="text-zinc-100">{mg.status}</span>
            </span>
            <span className="tabular-nums">
              {mg.elapsedMs} / {mg.durationMs}ms
            </span>
          </div>
          <div className="sog-progress-track mt-2 relative h-3 w-full">
            <div
              className="absolute top-0 h-full bg-emerald-400/30"
              style={{ left: `${zoneStartPct}%`, width: `${zoneWidthPct}%` }}
            />
            <div
              className={cn("absolute top-0 h-full w-1", inZone ? "bg-emerald-400 sog-animate-pulse" : "bg-zinc-200")}
              style={{ left: `${phasePct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
            <span className="tabular-nums">
              tugs {mg.tugs} · good {mg.goodTugs}
            </span>
            <span>{inZone ? "IN WINDOW" : "—"}</span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button data-testid="minigame-rigging-start" className="sog-animate-pulse" disabled={startDisabled} onClick={onStart}>
            <Timer aria-hidden="true" className="h-4 w-4" />
            Start ({durationS}s)
          </Button>
          <Button
            data-testid="minigame-rigging-tug"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={onTug}
          >
            <Wind aria-hidden="true" className="h-4 w-4" />
            Tug
          </Button>
        </div>
        {startBlocked ? (
          <div className="mt-2 text-xs text-zinc-500">
            Locked: your <span className="text-zinc-200">rigging_run</span> buff is still active. You can replay when it has{" "}
            <span className="tabular-nums text-zinc-200">{formatDurationCompact(refreshWindowMs)}</span> or less remaining.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DistilleryPanel({
  state,
  onSetEnabled,
}: {
  state: GameState;
  onSetEnabled: (enabled: boolean) => void;
}) {
  const dist = state.production.jobs.distill_rum || { enabled: false, remainderMs: 0 };
  const recipe = RECIPE_BY_ID.distill_rum;
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const sugar = wh?.inv.sugar ?? 0n;
  const rum = wh?.inv.rum ?? 0n;
  const reqSugar = BigInt(recipe.input.sugar || 0);
  const hasInputs = reqSugar <= 0n ? true : sugar >= reqSugar;
  const nextInMsRaw = recipe.intervalMs - (dist.remainderMs % recipe.intervalMs);
  const nextInMs = nextInMsRaw === 0 ? recipe.intervalMs : nextInMsRaw;
  const statusLabel = !dist.enabled ? "disabled" : !hasInputs ? "blocked (needs sugar)" : "running";
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Distillery</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm text-zinc-300">
          Converts <span className="font-medium text-zinc-100">Sugar</span> into{" "}
          <span className="font-medium text-zinc-100">Rum</span> at{" "}
          <span className="font-medium text-zinc-100">1/2s</span>.
        </div>
        <div className="text-xs text-zinc-500">
          Status: <span className="text-zinc-200">{statusLabel}</span>
          {dist.enabled && hasInputs ? (
            <>
              {" "}
              · next in <span className="tabular-nums text-zinc-200">{formatDurationCompact(nextInMs)}</span>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResourcePill label="Sugar" value={sugar} />
          <ResourcePill label="Rum" value={rum} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            {hasInputs ? (
              <>
                Uses <span className="tabular-nums text-zinc-200">{reqSugar.toString(10)}</span> sugar per rum.
              </>
            ) : (
              <>
                Missing{" "}
                <span className="tabular-nums text-rose-200">{(reqSugar - sugar).toString(10)}</span> sugar to run.
              </>
            )}
          </div>
          <Button
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onSetEnabled(!dist.enabled)}
          >
            {dist.enabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CraftingPanel({
  state,
  onSetEnabled,
}: {
  state: GameState;
  onSetEnabled: (recipeId: string, enabled: boolean) => void;
}) {
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const inv = wh?.inv as Record<string, bigint> | undefined;
  const used = wh ? invUsed(wh.inv) : 0n;
  const cap = wh?.cap ?? 0n;
  const free = cap > used ? cap - used : 0n;
  const recipes = [
    "forge_cannonballs",
    "craft_parts",
    "assemble_repair_kits",
    "brew_dye",
    "weave_cloth",
    "tailor_cosmetics",
  ] as const;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Crafting</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {recipes.map((recipeId) => {
          const def = RECIPE_BY_ID[recipeId];
          const job = state.production.jobs[recipeId] || { enabled: false, remainderMs: 0 };
          const unlocked = state.unlocks.includes(`recipe:${recipeId}`);
          const lockedHint =
            recipeId === "brew_dye" || recipeId === "weave_cloth" || recipeId === "tailor_cosmetics"
              ? "Unlock by reaching 10+ influence with your affiliated flag."
              : "Unlock by completing the Starter Run voyage.";

          const interval = def.intervalMs;
          const nextInMsRaw = interval - (job.remainderMs % interval);
          const nextInMs = nextInMsRaw === 0 ? interval : nextInMsRaw;

          const inputBits = Object.entries(def.input)
            .map(([id, qty]) => `${qty} ${COMMODITY_BY_ID[id]?.name ?? id} (you: ${(inv?.[id] ?? 0n).toString(10)})`)
            .join(" · ");
          const outputBits = Object.entries(def.output)
            .map(([id, qty]) => `${qty} ${COMMODITY_BY_ID[id]?.name ?? id}`)
            .join(" · ");

          const missingInputs = Object.entries(def.input)
            .filter(([id]) => id !== "gold")
            .map(([id, qty]) => {
              const have = inv?.[id] ?? 0n;
              const need = BigInt(qty);
              if (have >= need) return null;
              return { id, missing: need - have };
            })
            .filter(Boolean) as Array<{ id: string; missing: bigint }>;

          let inputTotal = 0n;
          let outputTotal = 0n;
          for (const qty of Object.values(def.input)) inputTotal += BigInt(qty);
          for (const qty of Object.values(def.output)) outputTotal += BigInt(qty);
          const net = outputTotal - inputTotal;
          const capBlocked = net > 0n && free < net;

          const running = unlocked && job.enabled && missingInputs.length === 0 && !capBlocked;

          return (
            <div key={recipeId} className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-zinc-100">{def.name}</div>
                <div className="text-xs text-zinc-500 tabular-nums">
                  every {Math.round(def.intervalMs / 1000)}s
                </div>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                in: <span className="text-zinc-300">{inputBits || "—"}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                out: <span className="text-zinc-300">{outputBits || "—"}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Status:{" "}
                {!unlocked ? (
                  <span className="text-zinc-400">locked</span>
                ) : !job.enabled ? (
                  <span className="text-zinc-400">disabled</span>
                ) : missingInputs.length > 0 ? (
                  <span className="text-rose-200">
                    blocked (needs{" "}
                    {missingInputs
                      .slice(0, 2)
                      .map((m) => `${m.missing.toString(10)} ${COMMODITY_BY_ID[m.id]?.name ?? m.id}`)
                      .join(", ")}
                    {missingInputs.length > 2 ? "…" : ""})
                  </span>
                ) : capBlocked ? (
                  <span className="text-rose-200">blocked (warehouse full)</span>
                ) : (
                  <span className="text-zinc-200">running</span>
                )}
                {running ? (
                  <>
                    {" "}
                    · next in <span className="tabular-nums text-zinc-200">{formatDurationCompact(nextInMs)}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  data-testid={`recipe-toggle-${recipeId}`}
                  disabled={!unlocked}
                  onClick={() => onSetEnabled(recipeId, !job.enabled)}
                >
                  {!unlocked ? "Locked" : job.enabled ? "Disable" : "Enable"}
                </Button>
                {!unlocked ? <div className="text-xs text-zinc-500">{lockedHint}</div> : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function VanityShopPanel({ state, onBuy }: { state: GameState; onBuy: (itemId: string) => void }) {
  const unlocked = state.unlocks.includes("vanity_shop");
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const cosmetics = wh?.inv.cosmetics ?? 0n;

  if (!unlocked) {
    return (
      <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
        <CardHeader>
          <CardTitle>Vanity Shop</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          Locked. Earn <span className="text-zinc-200">10+ influence</span> with your affiliated flag to unlock dye/cloth
          production and cosmetics sinks.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Vanity Shop</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ResourcePill label="Cosmetics" value={cosmetics} />
        </div>
        <div className="grid gap-2">
          {VANITY_ITEMS.map((item) => {
            const owned = state.unlocks.includes(item.id);
            const cost = BigInt(item.costCosmetics);
            const canBuy = !owned && cosmetics >= cost && state.voyage.status !== "running";
            const suffix = item.id.startsWith("vanity:") ? item.id.slice("vanity:".length) : item.id;
            const testId = `vanity-buy-${suffix}`;

            return (
              <div key={item.id} className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-zinc-100">{item.name}</div>
                  <div className="text-xs text-zinc-500 tabular-nums">{item.costCosmetics} cosmetics</div>
                </div>
                <div className="mt-1 text-xs text-zinc-400">{item.desc}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button data-testid={testId} disabled={!canBuy} onClick={() => onBuy(item.id)}>
                    {owned ? "Owned" : `Buy (${item.costCosmetics})`}
                  </Button>
                  {state.voyage.status === "running" ? <div className="text-xs text-zinc-500">Dock to buy.</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function WarehousePanel({ state, onUpgrade }: { state: GameState; onUpgrade: () => void }) {
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const inv = wh?.inv;
  const used = inv ? invUsed(inv) : 0n;
  const cap = wh?.cap ?? 0n;
  const upgrade = getWarehouseUpgradeForUi();
  const canUpgrade = state.resources.gold >= upgrade.costGold;
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Warehouse</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WarehousePill used={used} cap={cap} />
          <ResourcePill label="Wood" value={inv?.wood ?? 0n} />
          <ResourcePill label="Sugar" value={inv?.sugar ?? 0n} />
          <ResourcePill label="Hemp" value={inv?.hemp ?? 0n} />
          <ResourcePill label="Herbs" value={inv?.herbs ?? 0n} />
          <ResourcePill label="Rum" value={inv?.rum ?? 0n} />
          <ResourcePill label="Cosmetics" value={inv?.cosmetics ?? 0n} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-zinc-500">
            Upgrade:{" "}
            <span className="text-zinc-100 tabular-nums">+{upgrade.capBonus.toString(10)} cap</span> for{" "}
            <span className="text-zinc-100 tabular-nums">{upgrade.costGold.toString(10)} gold</span>
          </div>
          <Button data-testid="warehouse-upgrade" disabled={!canUpgrade} onClick={onUpgrade}>
            Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShipHoldPanel({
  state,
  onLoad,
  onUnload,
}: {
  state: GameState;
  onLoad: (commodityId: string, qty: string) => void;
  onUnload: (commodityId: string, qty: string) => void;
}) {
  const hold = state.storage.shipHold;
  const used = invUsed(hold.inv);
  const cap = hold.cap;
  const [commodityId, setCommodityId] = React.useState("rum");
  const [qty, setQty] = React.useState("5");

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Ship Hold</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-zinc-900 bg-black px-3 py-1 text-sm text-zinc-100">
            <span className="text-zinc-500">Hold</span>
            <span className="font-medium tabular-nums">
              {used.toString(10)}/{cap.toString(10)}
            </span>
          </div>
          <ResourcePill label="Rum" value={hold.inv.rum} />
          <ResourcePill label="Cannonballs" value={hold.inv.cannonballs} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-zinc-400">Commodity</label>
            <select
              data-testid="cargo-commodity"
              className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
              value={commodityId}
              onChange={(e) => setCommodityId(e.target.value)}
            >
              <option value="rum">Rum</option>
              <option value="dye">Dye</option>
              <option value="cloth">Cloth</option>
              <option value="cosmetics">Cosmetics</option>
              <option value="cannonballs">Cannonballs</option>
              <option value="wood">Wood</option>
              <option value="sugar">Sugar</option>
              <option value="iron">Iron</option>
              <option value="stone">Stone</option>
              <option value="hemp">Hemp</option>
              <option value="herbs">Herbs</option>
              <option value="parts">Parts</option>
              <option value="repair_kits">Repair Kits</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Qty</label>
            <Input
              data-testid="cargo-qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button data-testid="cargo-load" onClick={() => onLoad(commodityId, qty)}>
              Load
            </Button>
            <Button
              data-testid="cargo-unload"
              variant="secondary"
              className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
              onClick={() => onUnload(commodityId, qty)}
            >
              Unload
            </Button>
          </div>
        </div>
        <div className="text-xs text-zinc-500">
          Transfer moves items between the current port warehouse and your ship hold. No items are lost: transfers cap at free
          space.
        </div>
      </CardContent>
    </Card>
  );
}

function ShipPanel({ state, onRepair }: { state: GameState; onRepair: () => void }) {
  const ship = state.ship;
  const def = SHIP_CLASS_BY_ID[ship.classId] || { name: ship.classId };
  const pct = ship.maxCondition > 0 ? Math.round((ship.condition / ship.maxCondition) * 100) : 0;
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const kits = wh?.inv.repair_kits ?? 0n;
  const repair = getShipRepairForUi();
  const canRepair =
    state.voyage.status !== "running" &&
    ship.condition < ship.maxCondition &&
    (kits > 0n || state.resources.gold >= repair.goldCost);

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Ship</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            Class: <span className="font-medium text-zinc-100">{def.name}</span>
          </div>
          <div className="text-xs text-zinc-400 tabular-nums">
            condition {ship.condition}/{ship.maxCondition} ({pct}%)
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded bg-zinc-900">
          <div className="h-full bg-emerald-400" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">
            Repair prefers{" "}
            <span className="text-zinc-100 tabular-nums">1 repair kit</span> (+{repair.kitRepairCondition}). Fallback:{" "}
            <span className="text-zinc-100 tabular-nums">{repair.goldCost.toString(10)} gold</span> (+{repair.goldRepairCondition}).
            Kits at port:{" "}
            <span className="text-zinc-100 tabular-nums">{kits.toString(10)}</span>.
          </div>
          <Button data-testid="ship-repair" disabled={!canRepair} onClick={onRepair}>
            Repair
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ShipyardPanel({
  state,
  onBuy,
  onUpgrade,
}: {
  state: GameState;
  onBuy: (classId: string) => void;
  onUpgrade: () => void;
}) {
  const classes = ["sloop", "brig", "galleon"] as const;
  const running = state.voyage.status === "running";
  const maxLevel = getShipyardMaxLevelForUi();
  const nextLevel = state.shipyard.level + 1;
  const upgradeCost = getShipyardUpgradeCostForUi(nextLevel);
  const canUpgrade = !running && state.shipyard.level < maxLevel && state.resources.gold >= upgradeCost;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Shipyard</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-zinc-100">Upgrades</div>
            <div className="text-xs text-zinc-500 tabular-nums">
              level {state.shipyard.level}/{maxLevel} · fleet cap {state.fleet.maxShips}
            </div>
          </div>
          <div className="mt-1 text-xs text-zinc-400">
            Upgrade increases <span className="text-zinc-200">fleet cap</span> by{" "}
            <span className="tabular-nums text-zinc-200">+1</span> (max 5).
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button data-testid="shipyard-upgrade" disabled={!canUpgrade} onClick={onUpgrade}>
              {state.shipyard.level >= maxLevel ? "Max Level" : `Upgrade (${upgradeCost.toString(10)}g)`}
            </Button>
            {running ? <div className="text-xs text-zinc-500">Dock to upgrade.</div> : null}
          </div>
        </div>
        {classes.map((id) => {
          const def = SHIP_CLASS_BY_ID[id];
          const cost = BigInt(def.buyCostGold);
          const isCurrent = state.ship.classId === id;
          const canBuy = !running && !isCurrent && state.resources.gold >= cost;
          const testId = id === "brig" ? "shipyard-buy-brig" : id === "galleon" ? "shipyard-buy-galleon" : undefined;

          return (
            <div key={id} className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-zinc-100">{def.name}</div>
                <div className="text-xs text-zinc-500 tabular-nums">
                  hold {def.holdCap} · crew {def.crewCap} · speed {getShipSpeedPctForUi(def.id)}% · rum/min {def.rumPerMinute}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button data-testid={testId} disabled={!canBuy} onClick={() => onBuy(def.id)}>
                  {isCurrent ? "Current" : `Buy (${cost.toString(10)}g)`}
                </Button>
                {running ? <div className="text-xs text-zinc-500">Dock to buy.</div> : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FlagshipPanel({ state, onContribute }: { state: GameState; onContribute: () => void }) {
  const built = state.unlocks.includes("flagship_built");
  const portId = state.location.islandId;
  const wh = state.storage.warehouses[portId];
  const cosmetics = wh?.inv.cosmetics ?? 0n;
  const flagship = getFlagshipForUi();
  const costGold = flagship.contributeGold;
  const costCosmetics = flagship.contributeCosmetics;
  const running = state.voyage.status === "running";
  const complete = state.flagship.progress >= state.flagship.required;
  const canContribute =
    !running && !built && !complete && state.resources.gold >= costGold && cosmetics >= costCosmetics;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Flagship Project</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            Progress:{" "}
            <span className="font-medium tabular-nums text-zinc-100">
              {state.flagship.progress}/{state.flagship.required}
            </span>
          </div>
          <div className="text-xs text-zinc-500">
            Reward: <span className="text-zinc-200">+{flagship.voyageGoldBonusPct}%</span> voyage gold (permanent)
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GoldPill gold={state.resources.gold} />
          <ResourcePill label="Cosmetics" value={cosmetics} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button data-testid="flagship-contribute" disabled={!canContribute} onClick={onContribute}>
            {built ? "Built" : `Contribute (${costGold.toString(10)}g + ${costCosmetics.toString(10)} cosmetics)`}
          </Button>
          {running ? <div className="text-xs text-zinc-500">Dock to contribute.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function FleetPanel({
  state,
  onBuyShip,
  onSetActive,
  onSetAutomation,
}: {
  state: GameState;
  onBuyShip: (classId: string) => void;
  onSetActive: (shipId: string) => void;
  onSetAutomation: (shipId: string, next: { enabled: boolean; routeId: string | null; autoCollect: boolean }) => void;
}) {
  const allShips = React.useMemo(() => {
    const active = {
      id: state.shipId,
      name: state.shipName,
      locationId: state.location.islandId,
      classId: state.ship.classId,
      voyageStatus: state.voyage.status,
      automation: state.automation,
      isActive: true,
    };
    const rest = state.fleet.ships.map((s) => ({
      id: s.id,
      name: s.name,
      locationId: s.location.islandId,
      classId: s.ship.classId,
      voyageStatus: s.voyage.status,
      automation: s.automation,
      isActive: false,
    }));
    return [active, ...rest];
  }, [state]);

  const canBuyMore = 1 + state.fleet.ships.length < state.fleet.maxShips;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Fleet</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            Ships:{" "}
            <span className="font-medium tabular-nums text-zinc-100">
              {1 + state.fleet.ships.length}/{state.fleet.maxShips}
            </span>
          </div>
          <div className="text-xs text-zinc-500">Use automation to loop routes (return route auto-picked).</div>
        </div>

        <div className="grid gap-2">
          {allShips.map((s) => {
            const routesHere = ROUTES.filter(
              (r) =>
                state.unlocks.includes(`route:${r.id}`) &&
                (r.fromIslandId === s.locationId || r.toIslandId === s.locationId)
            );
            const routeValue = s.automation.routeId ?? "";
            const enableTestId = `fleet-auto-enable-${s.id}`;
            const collectTestId = `fleet-auto-collect-${s.id}`;
            const routeTestId = `fleet-auto-route-${s.id}`;
            const activeTestId = `fleet-set-active-${s.id}`;

            return (
              <div key={s.id} className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100">{s.name}</span>
                    {s.isActive ? (
                      <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">active</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {s.classId} · {s.locationId} · {s.voyageStatus}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-zinc-400">Auto route</label>
                    <select
                      data-testid={routeTestId}
                      className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                      value={routeValue}
                      onChange={(e) =>
                        onSetAutomation(s.id, {
                          ...s.automation,
                          routeId: e.target.value ? e.target.value : null,
                        })
                      }
                    >
                      <option value="">—</option>
                      {routesHere.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      data-testid={enableTestId}
                      variant={s.automation.enabled ? "default" : "secondary"}
                      className={cn("w-full", s.automation.enabled ? "" : "bg-zinc-950 text-zinc-100 hover:bg-zinc-900")}
                      disabled={!s.automation.routeId}
                      onClick={() => onSetAutomation(s.id, { ...s.automation, enabled: !s.automation.enabled })}
                    >
                      {s.automation.enabled ? "Auto: ON" : "Auto: OFF"}
                    </Button>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      data-testid={collectTestId}
                      variant={s.automation.autoCollect ? "default" : "secondary"}
                      className={cn("w-full", s.automation.autoCollect ? "" : "bg-zinc-950 text-zinc-100 hover:bg-zinc-900")}
                      onClick={() => onSetAutomation(s.id, { ...s.automation, autoCollect: !s.automation.autoCollect })}
                    >
                      Collect: {s.automation.autoCollect ? "ON" : "OFF"}
                    </Button>
                  </div>
                </div>

                {!s.isActive ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      data-testid={activeTestId}
                      variant="secondary"
                      className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                      onClick={() => onSetActive(s.id)}
                    >
                      Make Active
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button data-testid="fleet-buy-brig" disabled={!canBuyMore} onClick={() => onBuyShip("brig")}>
            Buy Brig
          </Button>
          <Button
            data-testid="fleet-buy-galleon"
            disabled={!canBuyMore}
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            onClick={() => onBuyShip("galleon")}
          >
            Buy Galleon
          </Button>
          {!canBuyMore ? <div className="text-xs text-zinc-500">Fleet at cap.</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CrewPanel({
  state,
  onHire,
  onFire,
}: {
  state: GameState;
  onHire: (qty: string) => void;
  onFire: (qty: string) => void;
}) {
  const shipDef = SHIP_CLASS_BY_ID[state.ship.classId];
  const cap = shipDef?.crewCap ?? 0;
  const [qty, setQty] = React.useState("1");

  const hireCost = getCrewHireCostGoldForUi();
  const wagePerMin = getCrewWageGoldPerCrewPerMinForUi();

  const free = Math.max(0, cap - state.crew.hired);
  const canHire = free > 0 && state.resources.gold >= hireCost;
  const canFire = state.crew.hired > 0;

  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
      <CardHeader>
        <CardTitle>Crew</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            Hired:{" "}
            <span className="font-medium tabular-nums text-zinc-100">
              {state.crew.hired}/{cap}
            </span>
          </div>
          <div className="text-xs text-zinc-400">
            Wages:{" "}
            <span className="tabular-nums text-zinc-100">
              {wagePerMin.toString(10)} gold/min
            </span>{" "}
            per crew
          </div>
        </div>

        <div className="rounded-md border border-zinc-800 bg-black p-3 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-400">Qty</label>
              <Input
                data-testid="crew-qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button data-testid="crew-hire" disabled={!canHire} onClick={() => onHire(qty)}>
                Hire
              </Button>
              <Button
                data-testid="crew-fire"
                variant="secondary"
                className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                disabled={!canFire}
                onClick={() => onFire(qty)}
              >
                Fire
              </Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Hiring costs <span className="tabular-nums text-zinc-100">{hireCost.toString(10)} gold</span> per crew. Free
            berths: <span className="tabular-nums text-zinc-100">{free}</span>.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="text-xs text-zinc-500">Sailing XP</div>
            <div className="font-medium tabular-nums text-zinc-100">{state.crew.skills.sailingXp}</div>
          </div>
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="text-xs text-zinc-500">Gunnery XP</div>
            <div className="font-medium tabular-nums text-zinc-100">{state.crew.skills.gunneryXp}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VoyagePanel({
  state,
  onStart,
  onPrepare,
  onCollect,
  onBuyChart,
}: {
  state: GameState;
  onStart: (routeId: string) => void;
  onPrepare: (routeId: string) => void;
  onCollect: () => void;
  onBuyChart: (chartId: string) => void;
}) {
  const v = state.voyage;
  const portId = state.location.islandId;
  const hold = state.storage.shipHold;
  const wh = state.storage.warehouses[portId];
  const whRum = wh?.inv.rum ?? 0n;
  const whCannonballs = wh?.inv.cannonballs ?? 0n;
  const routesFromHere = ROUTES.filter((r) => r.fromIslandId === portId);
  const isUnlocked = (routeId: string) => state.unlocks.includes(`route:${routeId}`);
  const chartsFromHere = CHARTS.filter((c) => ROUTE_BY_ID[c.routeId]?.fromIslandId === portId);
  const unlockedRoutes = routesFromHere.filter((r) => isUnlocked(r.id));
  const voyageStatusMeta =
    v.status === "completed"
      ? { icon: CheckCircle2, tone: "text-emerald-300", label: "Ready to collect" }
      : v.status === "running"
        ? { icon: Timer, tone: "text-[color:var(--sog-accent)]", label: `${v.remainingMs}ms remaining` }
        : { icon: CircleDot, tone: "text-zinc-300", label: "—" };

  const elapsedMs = v.status === "running" ? Math.max(0, v.durationMs - v.remainingMs) : 0;
  const VoyageStatusIcon = voyageStatusMeta.icon;
  return (
    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100 sog-animate-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sailboat aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
          Voyage
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="text-sm text-zinc-300">
          Voyages consume <span className="font-medium text-zinc-100">Rum</span> from your{" "}
          <span className="font-medium text-zinc-100">hold</span> and pay out on completion. Completing{" "}
          <span className="font-medium text-zinc-100">Starter Run</span> unlocks more routes.
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="rounded-md border border-zinc-800 bg-black px-2 py-1">
            Hold rum <span className="tabular-nums text-zinc-200">{hold.inv.rum.toString(10)}</span>
          </span>
          <span className="rounded-md border border-zinc-800 bg-black px-2 py-1">
            Warehouse rum <span className="tabular-nums text-zinc-200">{whRum.toString(10)}</span>
          </span>
          <span className="rounded-md border border-zinc-800 bg-black px-2 py-1">
            Hold cannonballs <span className="tabular-nums text-zinc-200">{hold.inv.cannonballs.toString(10)}</span>
          </span>
          <span className="rounded-md border border-zinc-800 bg-black px-2 py-1">
            Warehouse cannonballs <span className="tabular-nums text-zinc-200">{whCannonballs.toString(10)}</span>
          </span>
        </div>
        <div className="sog-surface-muted rounded-md px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Compass aria-hidden="true" className="h-3.5 w-3.5" />
              Route map from this port
            </span>
            <span className="tabular-nums">
              {unlockedRoutes.length}/{routesFromHere.length} unlocked
            </span>
          </div>
          <svg aria-hidden="true" viewBox="0 0 180 42" className="h-11 w-full">
            <rect x="2" y="20" width="20" height="4" rx="2" fill="rgba(255,255,255,0.28)" />
            {routesFromHere.slice(0, 8).map((route, idx) => {
              const y = 6 + idx * 4.5;
              const unlocked = isUnlocked(route.id);
              return (
                <g key={route.id}>
                  <path
                    d={`M 22 22 C 44 ${y} 90 ${y} 156 ${22 + (idx % 2 === 0 ? -8 : 8)}`}
                    fill="none"
                    stroke={unlocked ? "rgba(210,162,74,0.9)" : "rgba(120,132,138,0.35)"}
                    strokeWidth={unlocked ? 1.8 : 1.1}
                    strokeDasharray={unlocked ? "0" : "2.5 2.5"}
                  />
                </g>
              );
            })}
            <circle cx="22" cy="22" r="3.5" fill="rgba(76,175,115,0.8)" />
            <circle cx="156" cy="22" r="3.5" fill="rgba(210,162,74,0.82)" />
          </svg>
        </div>

        {chartsFromHere.length > 0 ? (
          <div className="rounded-md border border-zinc-800 bg-black p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium text-zinc-100">Charts</div>
              <div className="text-xs text-zinc-500">Unlock new routes from this port.</div>
            </div>
            <div className="mt-2 grid gap-2">
              {chartsFromHere.map((chart) => {
                const routeUnlock = `route:${chart.routeId}`;
                const owned = state.unlocks.includes(chart.id) || state.unlocks.includes(routeUnlock);
                const cost = getChartCostGoldForUi(chart.id);
                const canBuy = !owned && v.status === "idle" && state.resources.gold >= cost;
                return (
                  <div
                    key={chart.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-zinc-100">{chart.name}</span>
                      <span className="text-zinc-500 tabular-nums">cost {cost.toString(10)}g</span>
                      <span className="text-zinc-500">{chart.routeId}</span>
                    </div>
                    <Button
                      data-testid={`voyage-buy-chart-${chart.id}`}
                      variant="secondary"
                      className="h-7 bg-zinc-950 px-2 text-zinc-100 hover:bg-zinc-900"
                      disabled={!canBuy}
                      onClick={() => onBuyChart(chart.id)}
                    >
                      {owned ? "Owned" : "Buy"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="rounded-md border border-zinc-800 bg-black p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <VoyageStatusIcon aria-hidden="true" className={cn("h-3.5 w-3.5", voyageStatusMeta.tone)} />
              Status: <span className="font-medium text-zinc-100">{v.status}</span>
            </div>
            <div className={cn("text-xs tabular-nums", voyageStatusMeta.tone)}>
              {voyageStatusMeta.label}
            </div>
          </div>
          {v.status === "completed" ? (
            <div className="mt-2 text-xs text-zinc-300 tabular-nums">
              Pending reward: <span className="font-medium text-zinc-100">{v.pendingGold.toString(10)}</span> gold ·{" "}
              <span className="font-medium text-zinc-100">{v.pendingInfluence}</span> influence
            </div>
          ) : null}
          {v.status === "running" && v.encounters.length > 0 ? (
            <div className="mt-3 grid gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">Encounters</div>
              {v.encounters.map((e, idx) => {
                const isPast = elapsedMs >= e.atMs;
                const label =
                  e.status === "success"
                    ? "success"
                    : e.status === "fail"
                      ? "fail"
                      : isPast
                        ? "resolving"
                        : "pending";
                return (
                  <div
                    key={`${e.atMs}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 tabular-nums">t+{e.atMs}ms</span>
                      <span className="text-zinc-400">cost</span>
                      <span className="text-zinc-200 tabular-nums">{e.cannonballsCost}</span>
                    </div>
                    <div className={cn("font-medium", label === "success" ? "text-emerald-300" : label === "fail" ? "text-rose-300" : "text-zinc-200")}>
                      {label === "success" ? <CheckCircle2 aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> : null}
                      {label === "fail" ? <AlertTriangle aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> : null}
                      {label}
                    </div>
                  </div>
                );
              })}
              <div className="text-xs text-zinc-500">
                Uses cannonballs from your hold when an encounter triggers. If you run out, you take condition damage and lose a
                portion of gold.
              </div>
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          {routesFromHere.length === 0 ? (
            <div className="text-sm text-zinc-400">No known routes from this port yet.</div>
          ) : (
            routesFromHere.map((route) => {
              const unlocked = isUnlocked(route.id);
              const hasChart = chartsFromHere.some((c) => c.routeId === route.id);
              const req = getVoyageStartRequirements(state, state.ship.classId, route.id);
              const totalRum = req?.totalRum ?? BigInt(route.rumCost);
              const fareRum = req?.fareRum ?? BigInt(route.rumCost);
              const baselineRum = req?.baselineRum ?? 0n;
              const durMs = getVoyageDurationMsForUi(state, state.ship.classId, route.id);
              const baseS = Math.round(route.durationMs / 1000);
              const effS = Math.round(durMs / 1000);
              const canStart = v.status === "idle" && unlocked && hold.inv.rum >= totalRum;
              const canPrepare = v.status === "idle" && unlocked;
              const startTestId = route.id === "starter_run" ? "voyage-start" : `voyage-start-${route.id}`;
              const prepareTestId = route.id === "starter_run" ? "voyage-prepare-starter_run" : `voyage-prepare-${route.id}`;

              return (
                <div
                  key={route.id}
                  className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium text-zinc-100">{route.name}</div>
                    <div className="text-xs text-zinc-500">
                      {route.fromIslandId} → {route.toIslandId}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 tabular-nums">
                    <span>
                      rum{" "}
                      <span className="text-zinc-200">
                        {req ? totalRum.toString(10) : route.rumCost}
                      </span>{" "}
                      {req ? (
                        <span className="text-zinc-500">
                          (fare <span className="text-zinc-300">{fareRum.toString(10)}</span> + baseline{" "}
                          <span className="text-zinc-300">{baselineRum.toString(10)}</span>)
                        </span>
                      ) : null}
                    </span>
                    {req && req.expectedCannonballs > 0n ? (
                      <span>
                        cannonballs <span className="text-zinc-200">{req.expectedCannonballs.toString(10)}</span>
                      </span>
                    ) : null}
                    <span>
                      time{" "}
                      <span className="text-zinc-200">
                        {effS}s
                      </span>
                      {effS !== baseS ? <span className="text-zinc-500"> (base {baseS}s)</span> : null}
                    </span>
                    <span>
                      gold <span className="text-zinc-200">{route.goldReward}</span>
                    </span>
                    <span>
                      inf <span className="text-zinc-200">{route.influenceReward}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      data-testid={prepareTestId}
                      variant="secondary"
                      className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                      disabled={!canPrepare}
                      onClick={() => onPrepare(route.id)}
                      title="Load missing rum/cannonballs from this port's warehouse into your hold (up to capacity)."
                    >
                      Prepare
                    </Button>
                    <Button data-testid={startTestId} disabled={!canStart} onClick={() => onStart(route.id)}>
                      {unlocked ? "Start" : "Locked"}
                    </Button>
                    {!unlocked ? (
                      <div className="text-xs text-zinc-500">
                        {hasChart ? "Unlock by buying its chart above." : "Unlock by completing Starter Run."}
                      </div>
                    ) : hold.inv.rum < totalRum ? (
                      <div className="text-xs text-zinc-500">
                        Need <span className="tabular-nums">{(totalRum - hold.inv.rum).toString(10)}</span> more rum in hold.
                        {whRum > 0n ? (
                          <span className="ml-2 text-zinc-500">Tip: click Prepare to load from warehouse.</span>
                        ) : (
                          <span className="ml-2 text-zinc-500">Tip: make rum (contracts → distillery), then load cargo.</span>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            data-testid="voyage-collect"
            variant="secondary"
            className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
            disabled={v.status !== "completed"}
            onClick={onCollect}
          >
            Collect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PoliticsPanel({
  state,
  onSetAffiliation,
  onDonate,
  onTaxReliefStart,
  onTaxReliefAbort,
  onConquestStart,
  onConquestAbort,
}: {
  state: GameState;
  onSetAffiliation: (flagId: string) => void;
  onDonate: (flagId: string, gold: string) => void;
  onTaxReliefStart: () => void;
  onTaxReliefAbort: () => void;
  onConquestStart: (targetIslandId: string) => void;
  onConquestAbort: () => void;
}) {
  const [affiliation, setAffiliation] = React.useState(state.politics.affiliationFlagId);
  const [donateFlag, setDonateFlag] = React.useState(state.politics.affiliationFlagId);
  const [donateGold, setDonateGold] = React.useState("50");
  const [targetIslandId, setTargetIslandId] = React.useState("turtle_cay");

  React.useEffect(() => setAffiliation(state.politics.affiliationFlagId), [state.politics.affiliationFlagId]);

  const influenceByFlagId = state.politics.influenceByFlagId;

  const currentPortId = state.location.islandId;
  const currentPort = ISLAND_BY_ID[currentPortId] ?? { id: currentPortId, name: currentPortId, tier: 1, controllerFlagId: "player" };
  const currentControllerFlagId = state.world.controllerByIslandId[currentPortId] ?? currentPort.controllerFlagId;
  const currentBaseTaxBps = FLAG_BY_ID[currentControllerFlagId]?.taxBps ?? 0;
  const currentEffectiveTaxBps = getEffectivePortTaxBpsForUi(state, currentPortId);

  React.useEffect(() => {
    if (ISLAND_BY_ID[targetIslandId]) return;
    setTargetIslandId(ISLANDS[0]?.id ?? "home_port");
  }, [targetIslandId]);

  const target = ISLAND_BY_ID[targetIslandId];
  const attackerFlagId = state.politics.affiliationFlagId;
  const controllerFlagId = target
    ? state.world.controllerByIslandId[target.id] ?? target.controllerFlagId
    : null;
  const conquestReq = target ? getConquestRequirementsForUi(target.tier) : null;
  const requiredInf = conquestReq?.requiredInfluence ?? 0;
  const warChest = conquestReq?.warChestGold ?? 0n;
  const attackerInf = influenceByFlagId[attackerFlagId] ?? 0;
  const canStartConquest =
    !!target &&
    state.conquest.status !== "running" &&
    controllerFlagId !== attackerFlagId &&
    attackerInf >= requiredInf &&
    state.resources.gold >= warChest;

  const taxRelief = getTaxReliefCampaignForUi(currentPortId);
  const perkHere = state.politics.portPerksByIslandId[currentPortId];
  const perkRemainingMs = perkHere?.remainingMs ?? 0;
  const controllerInfHere = influenceByFlagId[currentControllerFlagId] ?? 0;
  const trCampaign = state.politics.campaign;
  const canStartTaxRelief =
    currentBaseTaxBps > 0 &&
    trCampaign.status !== "running" &&
    perkRemainingMs <= 0 &&
    controllerInfHere >= taxRelief.requiredInfluence &&
    state.resources.gold >= taxRelief.goldCost;
  const canAbortTaxRelief =
    trCampaign.status === "running" && trCampaign.kind === "tax_relief" && trCampaign.portId === currentPortId;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-100">Politics — Flags</div>
      </div>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Port Control</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {ISLANDS.map((island) => {
            const controller = state.world.controllerByIslandId[island.id] ?? island.controllerFlagId;
            const flag = FLAG_BY_ID[controller];
            const effectiveTaxBps = getEffectivePortTaxBpsForUi(state, island.id);
            return (
              <div
                key={island.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-100">{island.name}</span>
                  <span className="text-xs text-zinc-500">
                    {island.id} · tier {island.tier}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <span className="text-zinc-500">controller</span>
                  <span className="font-medium text-zinc-200">{flag?.name ?? controller}</span>
                  <span className="text-zinc-500">tax</span>
                  <span className="tabular-nums">{flag?.taxBps ?? 0}bps</span>
                  <span className="text-zinc-500">you</span>
                  <span className="tabular-nums">{effectiveTaxBps}bps</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Affiliation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-zinc-300">
            Your affiliation affects taxes where your flag controls the port. Earn influence via voyages or donations.
          </div>
          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-400">
            Current port: <span className="text-zinc-200">{currentPort.name}</span> · controller{" "}
            <span className="text-zinc-200">{FLAG_BY_ID[currentControllerFlagId]?.name ?? currentControllerFlagId}</span> ·
            base tax <span className="tabular-nums text-zinc-200">{currentBaseTaxBps}bps</span> · your effective tax{" "}
            <span className="tabular-nums text-zinc-200">{currentEffectiveTaxBps}bps</span>
            {currentEffectiveTaxBps < currentBaseTaxBps ? (
              <>
                {" "}
                (discount <span className="tabular-nums text-zinc-200">{currentBaseTaxBps - currentEffectiveTaxBps}bps</span>)
              </>
            ) : null}
            .
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-400">Flag</label>
              <select
                data-testid="politics-affiliation-flag"
                className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
              >
                {FLAGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                data-testid="politics-affiliation-set"
                disabled={affiliation === state.politics.affiliationFlagId}
                onClick={() => onSetAffiliation(affiliation)}
              >
                Set
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Donate Gold</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-400">Flag</label>
              <select
                data-testid="politics-donate-flag"
                className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                value={donateFlag}
                onChange={(e) => setDonateFlag(e.target.value)}
              >
                {FLAGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Gold</label>
              <Input
                data-testid="politics-donate-gold"
                value={donateGold}
                onChange={(e) => setDonateGold(e.target.value)}
                inputMode="numeric"
                className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button data-testid="politics-donate-submit" onClick={() => onDonate(donateFlag, donateGold)}>
                Donate
              </Button>
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            Conversion:{" "}
            <span className="tabular-nums text-zinc-200">{getDonationGoldPerInfluenceForUi().toString(10)}</span> gold ⇒ +1
            influence (floored).
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Influence</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {FLAGS.map((f) => {
            const inf = influenceByFlagId[f.id] ?? 0;
            const rel = getFactionStandingForUi(state, f.id);
            const isAff = state.politics.affiliationFlagId === f.id;
            return (
              <div
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-100">{f.name}</span>
                  {isAff ? <span className="rounded bg-zinc-900 px-2 py-0.5 text-xs text-zinc-300">affiliated</span> : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-300">
                  <span className="tabular-nums">influence {inf}</span>
                  <span className="text-zinc-500">standing</span>
                  <span className="font-medium text-zinc-200">{rel}</span>
                  <span className="text-zinc-500">tax</span>
                  <span className="tabular-nums">{f.taxBps}bps</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Tax Relief Campaign</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-zinc-300">
            Spend influence with the current controller and pay a non-refundable fee to reduce contract taxes at this port for a limited time.
          </div>

          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-xs text-zinc-400">
            Target: <span className="text-zinc-200">{currentPort.name}</span> · controller{" "}
            <span className="text-zinc-200">{FLAG_BY_ID[currentControllerFlagId]?.name ?? currentControllerFlagId}</span> · base tax{" "}
            <span className="tabular-nums text-zinc-200">{currentBaseTaxBps}bps</span> · effective{" "}
            <span className="tabular-nums text-zinc-200">{currentEffectiveTaxBps}bps</span>.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2 text-xs text-zinc-500">
              Requirements:{" "}
              <span className="tabular-nums text-zinc-200">{taxRelief.requiredInfluence}</span> influence with{" "}
              <span className="text-zinc-200">{FLAG_BY_ID[currentControllerFlagId]?.name ?? currentControllerFlagId}</span> (you:{" "}
              <span className="tabular-nums text-zinc-200">{controllerInfHere}</span>) · fee{" "}
              <span className="tabular-nums text-zinc-200">{taxRelief.goldCost.toString(10)}g</span>.
              <div className="mt-1">
                On success: -<span className="tabular-nums text-zinc-200">{taxRelief.taxDiscountBps}</span>bps tax for{" "}
                <span className="tabular-nums text-zinc-200">{Math.floor(taxRelief.perkDurationMs / 60_000)}</span> minutes.
              </div>
            </div>
            <div className="flex items-end gap-2">
              <Button data-testid="politics-taxrelief-start" disabled={!canStartTaxRelief} onClick={onTaxReliefStart}>
                Start
              </Button>
              <Button
                data-testid="politics-taxrelief-abort"
                variant="secondary"
                className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                disabled={!canAbortTaxRelief}
                onClick={onTaxReliefAbort}
              >
                Abort
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                Campaign: <span className="font-medium text-zinc-100">{trCampaign.status}</span>
              </div>
              <div className="text-xs text-zinc-400 tabular-nums">
                {trCampaign.status === "running"
                  ? `${trCampaign.remainingMs}ms remaining`
                  : trCampaign.status === "success"
                    ? "Completed"
                    : trCampaign.status === "fail"
                      ? "Failed"
                      : "—"}
              </div>
            </div>
            {perkHere && perkHere.remainingMs > 0 ? (
              <div className="mt-1 text-xs text-zinc-400">
                Active perk: <span className="text-zinc-200">{perkHere.id}</span> ·{" "}
                <span className="tabular-nums text-zinc-200">{perkHere.taxDiscountBps}</span>bps ·{" "}
                <span className="tabular-nums text-zinc-200">{perkHere.remainingMs}ms</span> remaining
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <CardHeader>
          <CardTitle>Conquest Campaign</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-zinc-300">
            Launch a timed campaign to take control of a port. Requires influence and a non-refundable war chest.
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-zinc-400">Target</label>
              <select
                data-testid="conquest-target"
                disabled={state.conquest.status === "running"}
                className="h-9 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30"
                value={targetIslandId}
                onChange={(e) => setTargetIslandId(e.target.value)}
              >
                {ISLANDS.map((island) => (
                  <option key={island.id} value={island.id}>
                    {island.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                data-testid="conquest-start"
                disabled={!canStartConquest}
                onClick={() => onConquestStart(targetIslandId)}
              >
                Start
              </Button>
              <Button
                data-testid="conquest-abort"
                variant="secondary"
                className="bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                disabled={state.conquest.status !== "running"}
                onClick={onConquestAbort}
              >
                Abort
              </Button>
            </div>
          </div>

          {target ? (
            <div className="text-xs text-zinc-500">
              Requirements:{" "}
              <span className="tabular-nums text-zinc-200">{requiredInf}</span> influence with{" "}
              <span className="text-zinc-200">{FLAG_BY_ID[attackerFlagId]?.name ?? attackerFlagId}</span> (you:{" "}
              <span className="tabular-nums text-zinc-200">{attackerInf}</span>) · war chest{" "}
              <span className="tabular-nums text-zinc-200">{warChest.toString(10)}g</span>. Current controller:{" "}
              <span className="text-zinc-200">
                {controllerFlagId ? FLAG_BY_ID[controllerFlagId]?.name ?? controllerFlagId : "—"}
              </span>
              .
            </div>
          ) : null}

          <div className="rounded-md border border-zinc-800 bg-black px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                Status: <span className="font-medium text-zinc-100">{state.conquest.status}</span>
              </div>
              <div className="text-xs text-zinc-400 tabular-nums">
                {state.conquest.status === "running"
                  ? `${state.conquest.remainingMs}ms remaining · stage ${state.conquest.stage + 1}/3`
                  : state.conquest.status === "success"
                    ? "Victory"
                    : state.conquest.status === "fail"
                      ? "Failed"
                      : "—"}
              </div>
            </div>
            {state.conquest.status === "running" ? (
              <div className="mt-1 text-xs text-zinc-400">
                Attacker:{" "}
                <span className="text-zinc-200">
                  {state.conquest.attackerFlagId
                    ? FLAG_BY_ID[state.conquest.attackerFlagId]?.name ?? state.conquest.attackerFlagId
                    : "—"}
                </span>{" "}
                · war chest paid{" "}
                <span className="tabular-nums text-zinc-200">{state.conquest.warChestPaid.toString(10)}g</span>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function GameClient() {
  const store = React.useMemo(() => createIdleStore(), []);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const offline = store.getOfflineCatchupReport();

  const [activeNav, setActiveNav] = React.useState<NavKey>("port");
  const [showCannon, setShowCannon] = React.useState(false);
  const [showRigging, setShowRigging] = React.useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = React.useState(false);
  const [isAutomation, setIsAutomation] = React.useState(false);
  const [forceDebugUi, setForceDebugUi] = React.useState(false);
  const [quickAdvanceMinutes, setQuickAdvanceMinutes] = React.useState("10");
  const [quickAdvanceNote, setQuickAdvanceNote] = React.useState<string | null>(null);
  const debugUi = isAutomation || forceDebugUi;

  React.useEffect(() => {
    window.render_game_to_text = () =>
      store.renderGameToText({
        ui: {
          activeNav,
          openMinigame: showCannon ? "cannon_volley" : showRigging ? "rigging_run" : null,
          realtimeEnabled,
          isAutomation,
        },
      });
    window.advanceTime = (ms: number) => store.advanceTime(ms);
    window.__idle = {
      version: IDLE_API_VERSION,
      exportSave: () => store.exportSave(),
      importSave: (save: string) => store.importSave(save),
      hardReset: () => store.hardReset(),
      setSeed: (seed: number) => store.setSeed(seed),
      validate: () => store.validate(),
      debug: {
        getLog: () => store.getDebugLog(),
        clear: () => store.clearDebugLog(),
      },
    };
  }, [activeNav, isAutomation, realtimeEnabled, showCannon, showRigging, store]);

  React.useEffect(() => {
    const auto = typeof navigator !== "undefined" && navigator.webdriver;
    let forceDebug = false;
    if (typeof window !== "undefined") {
      const raw = new URLSearchParams(window.location.search).get("debug");
      forceDebug = raw === "1" || raw === "true" || raw === "on";
    }
    setIsAutomation(!!auto);
    setForceDebugUi(forceDebug);
    setRealtimeEnabled(!auto);
  }, []);

  React.useEffect(() => {
    if (!realtimeEnabled) return;

    let rafId = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      acc += delta;

      if (acc >= 100) {
        const ms = Math.floor(acc);
        acc -= ms;
        store.advanceTime(ms);
      }

      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, [realtimeEnabled, store]);

  const startNewGame = () => {
    store.dispatch({ type: "START_NEW_GAME" });
    store.clearOfflineCatchupReport();
    setActiveNav("port");
    setShowCannon(false);
    setShowRigging(false);
    setQuickAdvanceNote(null);
  };
  const importSaveFromTitle = (save: string) => {
    store.importSave(save);
    store.clearOfflineCatchupReport();
    setActiveNav("port");
    setShowCannon(false);
    setShowRigging(false);
    setQuickAdvanceNote(null);
  };

  const placeContract = (commodityId: string, qtyStr: string, bidStr: string) => {
    const qty = parseBigintFromUi(qtyStr);
    const bidPrice = parseBigintFromUi(bidStr) ?? 0n;
    if (qty == null) return;
    store.dispatch({ type: "PLACE_CONTRACT", commodityId, qty, bidPrice });
  };

  const collectFirstFilled = () => {
    store.dispatch({ type: "COLLECT_CONTRACT_ALL" });
  };

  const collectOne = (contractId: string) => {
    store.dispatch({ type: "COLLECT_CONTRACT", contractId });
  };

  const cancelContract = (contractId: string) => {
    store.dispatch({ type: "CANCEL_CONTRACT", contractId });
  };

  const cannonStart = () => {
    store.dispatch({ type: "CANNON_START" });
  };

  const cannonFire = () => {
    store.dispatch({ type: "CANNON_FIRE" });
  };

  const riggingStart = () => {
    store.dispatch({ type: "RIGGING_START" });
  };

  const riggingTug = () => {
    store.dispatch({ type: "RIGGING_TUG" });
  };

  const setRecipeEnabled = (recipeId: string, enabled: boolean) => {
    store.dispatch({ type: "PRODUCTION_SET_ENABLED", recipeId, enabled });
  };

  const voyageStart = (routeId: string) => {
    store.dispatch({ type: "VOYAGE_START", routeId });
  };

  const voyagePrepare = (routeId: string) => {
    store.dispatch({ type: "VOYAGE_PREPARE", routeId });
  };

  const voyageCollect = () => {
    store.dispatch({ type: "VOYAGE_COLLECT" });
  };

  const buyChart = (chartId: string) => {
    store.dispatch({ type: "BUY_CHART", chartId });
  };

  const warehouseUpgrade = () => {
    store.dispatch({ type: "UPGRADE_WAREHOUSE" });
  };

  const shipRepair = () => {
    store.dispatch({ type: "SHIP_REPAIR" });
  };

  const shipBuyClass = (classId: string) => {
    store.dispatch({ type: "SHIP_BUY_CLASS", classId });
  };

  const shipyardUpgrade = () => {
    store.dispatch({ type: "SHIPYARD_UPGRADE" });
  };

  const fleetBuyShip = (classId: string) => {
    store.dispatch({ type: "FLEET_BUY_SHIP", classId });
  };

  const fleetSetActive = (shipId: string) => {
    store.dispatch({ type: "FLEET_SET_ACTIVE_SHIP", shipId });
  };

  const fleetSetAutomation = (shipId: string, next: { enabled: boolean; routeId: string | null; autoCollect: boolean }) => {
    store.dispatch({
      type: "FLEET_SET_AUTOMATION",
      shipId,
      enabled: next.enabled,
      routeId: next.routeId,
      autoCollect: next.autoCollect,
    });
  };

  const vanityBuy = (itemId: string) => {
    store.dispatch({ type: "VANITY_BUY", itemId });
  };

  const flagshipContribute = () => {
    store.dispatch({ type: "FLAGSHIP_CONTRIBUTE" });
  };

  const loadToHold = (commodityId: string, qtyStr: string) => {
    const qty = parseBigintFromUi(qtyStr);
    if (qty == null) return;
    store.dispatch({ type: "LOAD_TO_HOLD", commodityId, qty });
  };

  const unloadFromHold = (commodityId: string, qtyStr: string) => {
    const qty = parseBigintFromUi(qtyStr);
    if (qty == null) return;
    store.dispatch({ type: "UNLOAD_FROM_HOLD", commodityId, qty });
  };

  const crewHire = (qtyStr: string) => {
    const n = Number.parseInt(qtyStr, 10);
    if (!Number.isFinite(n)) return;
    store.dispatch({ type: "CREW_HIRE", qty: n });
  };

  const crewFire = (qtyStr: string) => {
    const n = Number.parseInt(qtyStr, 10);
    if (!Number.isFinite(n)) return;
    store.dispatch({ type: "CREW_FIRE", qty: n });
  };

  const politicsSetAffiliation = (flagId: string) => {
    store.dispatch({ type: "POLITICS_SET_AFFILIATION", flagId });
  };

  const politicsDonate = (flagId: string, goldStr: string) => {
    const gold = parseBigintFromUi(goldStr);
    if (gold == null) return;
    store.dispatch({ type: "POLITICS_DONATE", flagId, gold });
  };

  const politicsTaxReliefStart = () => {
    store.dispatch({ type: "POLITICS_CAMPAIGN_START_TAX_RELIEF" });
  };

  const politicsTaxReliefAbort = () => {
    store.dispatch({ type: "POLITICS_CAMPAIGN_ABORT" });
  };

  const dockWorkStart = () => {
    store.dispatch({ type: "DOCK_WORK_START" });
  };

  const dockAutomateBuy = () => {
    store.dispatch({ type: "DOCK_AUTOMATE_BUY" });
  };

  const conquestStart = (targetIslandId: string) => {
    store.dispatch({ type: "CONQUEST_START", targetIslandId });
  };

  const conquestAbort = () => {
    store.dispatch({ type: "CONQUEST_ABORT" });
  };

  const quickAdvance = () => {
    const minutes = Number.parseInt(quickAdvanceMinutes, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const ms = Math.min(24 * 60, Math.floor(minutes)) * 60_000;
    store.advanceTime(ms);
    setQuickAdvanceNote(`Advanced ${Math.floor(ms / 60_000)} minutes.`);
  };

  if (state.mode === "title") {
    return <TitleScreen onStart={startNewGame} onImport={importSaveFromTitle} />;
  }

  const portId = state.location.islandId;
  const island = ISLAND_BY_ID[portId] || { id: portId, name: portId };
  const wh = state.storage.warehouses[portId];
  const whUsed = wh ? invUsed(wh.inv) : 0n;
  const openContractsHere = state.economy.contracts.filter((c) => c.portId === portId && c.status === "open").length;
  const timersLabelBits: string[] = [];
  if (openContractsHere > 0) timersLabelBits.push(`${openContractsHere} contracts`);
  if (state.voyage.status === "running") timersLabelBits.push(`voyage ${state.voyage.remainingMs}ms`);
  if (state.conquest.status === "running") timersLabelBits.push(`conquest ${state.conquest.remainingMs}ms`);
  if (state.politics.campaign.status === "running") timersLabelBits.push(`campaign ${state.politics.campaign.remainingMs}ms`);
  const perkHere = state.politics.portPerksByIslandId[portId] ?? null;
  const tutorialStepId = state.tutorial.stepId;
  const inDockIntro = tutorialStepId === "tut:dock_intro";
  const inEconomyIntro = tutorialStepId === "tut:economy_intro";
  const hasCrafting =
    state.unlocks.includes("recipe:forge_cannonballs") ||
    state.unlocks.includes("recipe:craft_parts") ||
    state.unlocks.includes("recipe:assemble_repair_kits") ||
    state.unlocks.includes("recipe:brew_dye") ||
    state.unlocks.includes("recipe:weave_cloth") ||
    state.unlocks.includes("recipe:tailor_cosmetics");
  const debugEvents = store.getDebugLog();

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="border-b border-zinc-900 bg-zinc-950/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tracking-tight">
              <Waves aria-hidden="true" className="h-4 w-4 text-[color:var(--sog-accent)]" />
              Sea of Gold <span className="text-zinc-500">·</span>{" "}
              <span className="text-zinc-300">{island.name}</span>
            </div>
            <GoldPill gold={state.resources.gold} />
            <div className="hidden items-center gap-2 lg:flex">
              <WarehousePill
                used={whUsed}
                cap={wh?.cap ?? 0n}
              />
              <ResourcePill label="Wood" value={wh?.inv.wood ?? 0n} />
              <ResourcePill label="Sugar" value={wh?.inv.sugar ?? 0n} />
              <ResourcePill label="Rum" value={wh?.inv.rum ?? 0n} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              data-testid="realtime-toggle"
              variant="secondary"
              className="h-7 bg-zinc-950 px-2 text-xs text-zinc-100 hover:bg-zinc-900"
              disabled={isAutomation}
              onClick={() => setRealtimeEnabled((v) => !v)}
              title={isAutomation ? "Disabled under automation" : "Toggle real-time stepping (deterministic advanceTime still works)"}
            >
              Realtime: {realtimeEnabled ? "ON" : "OFF"}
            </Button>
            {offline ? (
              <button
                type="button"
                data-testid="offline-summary"
                className="hidden rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-900 md:block"
                onClick={() => store.clearOfflineCatchupReport()}
                title={`Applied offline catch-up: ${formatDurationCompact(offline.appliedMs)} (${offline.goldGained}g gained)${offline.wasCapped ? " (capped)" : ""}. Click to dismiss.`}
              >
                <Timer aria-hidden="true" className="mr-1.5 inline h-3 w-3 align-[-1px]" />
                Offline: +{formatDurationCompact(offline.appliedMs)} · +{offline.goldGained}g{offline.wasCapped ? " (cap)" : ""}
              </button>
            ) : null}
            {timersLabelBits.length > 0 ? (
              <div className="hidden whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-xs text-zinc-300 md:block">
                <Timer aria-hidden="true" className="mr-1.5 inline h-3 w-3 align-[-1px] text-[color:var(--sog-accent)]" />
                {timersLabelBits.join(" · ")}
              </div>
            ) : null}
            <PortPerkPill perk={perkHere} />
            <BuffsPill buffs={state.buffs} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-2 rounded-lg border border-zinc-900 bg-zinc-950/30 p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Port Modules
          </div>

          <NavButton active={activeNav === "port"} icon={NAV_GLYPH_BY_KEY.port} testId="nav-port" onClick={() => setActiveNav("port")}>
            Port
          </NavButton>
          {!inDockIntro ? (
            <>
              {state.unlocks.includes("economy") ? (
                <NavButton
                  active={activeNav === "economy"}
                  icon={NAV_GLYPH_BY_KEY.economy}
                  testId="nav-economy"
                  onClick={() => setActiveNav("economy")}
                >
                  Economy
                </NavButton>
              ) : null}
              {!inEconomyIntro ? (
                <>
                  {state.unlocks.includes("crew") ? (
                    <NavButton active={activeNav === "crew"} icon={NAV_GLYPH_BY_KEY.crew} testId="nav-crew" onClick={() => setActiveNav("crew")}>
                      Crew
                    </NavButton>
                  ) : null}
                  {state.unlocks.includes("voyage") ? (
                    <NavButton
                      active={activeNav === "voyage"}
                      icon={NAV_GLYPH_BY_KEY.voyage}
                      testId="nav-voyage"
                      onClick={() => setActiveNav("voyage")}
                    >
                      Voyage
                    </NavButton>
                  ) : null}
                  {state.unlocks.includes("politics") ? (
                    <NavButton
                      active={activeNav === "politics"}
                      icon={NAV_GLYPH_BY_KEY.politics}
                      testId="nav-politics"
                      onClick={() => setActiveNav("politics")}
                    >
                      Politics
                    </NavButton>
                  ) : null}

                  {state.unlocks.includes("minigame:cannon") || state.unlocks.includes("minigame:rigging") ? (
                    <div className="mt-3 border-t border-zinc-900 pt-3">
                      {state.unlocks.includes("minigame:cannon") ? (
                        <Button
                          data-testid="minigame-cannon-open"
                          variant="secondary"
                          className="w-full bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                          onClick={() => {
                            setShowCannon(true);
                            setShowRigging(false);
                          }}
                        >
                          <Crosshair aria-hidden="true" className="h-4 w-4" />
                          Cannon Volley
                        </Button>
                      ) : null}
                      {state.unlocks.includes("minigame:rigging") ? (
                        <Button
                          data-testid="minigame-rigging-open"
                          variant="secondary"
                          className="mt-2 w-full bg-zinc-950 text-zinc-100 hover:bg-zinc-900"
                          onClick={() => {
                            setShowRigging(true);
                            setShowCannon(false);
                          }}
                        >
                          <Wind aria-hidden="true" className="h-4 w-4" />
                          Rigging Run
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-2 text-xs text-zinc-500">
                  Locked: place your first contract to unlock Crew, minigames, and voyages.
                </div>
              )}
            </>
          ) : (
            <div className="mt-2 text-xs text-zinc-500">
              Locked: buy Dock Automation to unlock Economy.
            </div>
          )}
        </aside>

        <main className="sog-stagger grid gap-4">
          {showCannon ? (
            <CannonPanel
              state={state}
              onStart={cannonStart}
              onFire={cannonFire}
              onClose={() => setShowCannon(false)}
            />
          ) : null}
          {showRigging ? (
            <RiggingPanel
              state={state}
              onStart={riggingStart}
              onTug={riggingTug}
              onClose={() => setShowRigging(false)}
            />
          ) : null}

          {activeNav === "port" ? (
            <div className="grid gap-4">
              {inDockIntro ? (
                <DockIntroPanel state={state} onWork={dockWorkStart} onBuyAutomation={dockAutomateBuy} />
              ) : (
                <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
                  <CardHeader>
                    <CardTitle>Dock</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-zinc-300">
                    {(() => {
                      const dockPerSec = getDockPassiveGoldPerSecForUi(state);
                      const wagePerCrewPerMin = getCrewWageGoldPerCrewPerMinForUi();
                      const flow = getPortGoldFlowPerMinForUi(state);
                      const netPerMin = flow.netGoldPerMin;
                      return (
                        <>
                          <div>
                            Passive:{" "}
                            <span className="font-medium text-zinc-100 tabular-nums">{dockPerSec.toString(10)} gold/sec</span>{" "}
                            (
                            <span className="tabular-nums text-zinc-100">
                              {flow.dockGoldPerMin.toString(10)} gold/min
                            </span>
                            )
                          </div>
                          <div>
                            Wages:{" "}
                            <span className="tabular-nums text-zinc-100">
                              {wagePerCrewPerMin.toString(10)} gold/min
                            </span>{" "}
                            per crew ·{" "}
                            <span className="tabular-nums text-zinc-100">{flow.crewTotal}</span> crew ={" "}
                            <span className="tabular-nums text-zinc-100">{flow.wagesGoldPerMin.toString(10)} gold/min</span>
                          </div>
                          <div>
                            Net:{" "}
                            <span className="font-medium tabular-nums text-zinc-100">
                              {netPerMin >= 0n ? "+" : ""}
                              {netPerMin.toString(10)} gold/min
                            </span>
                          </div>
                        </>
                      );
                    })()}
                    <div className="text-xs text-zinc-500">
                      Deterministic{" "}
                      <code className="rounded bg-black px-1.5 py-0.5 text-xs text-zinc-200">advanceTime</code> or real-time
                      when enabled.
                    </div>
                  </CardContent>
                </Card>
              )}

              {!inDockIntro ? (
                inEconomyIntro ? (
                  <EconomyIntroPanel onOpenEconomy={() => setActiveNav("economy")} />
                ) : (
                  <>
                    <CommandDeckPanel
                      state={state}
                      activeNav={activeNav}
                      onOpenNav={setActiveNav}
                      onWork={dockWorkStart}
                      onBuyAutomation={dockAutomateBuy}
                      onCollectContracts={collectFirstFilled}
                      onPrepareVoyage={voyagePrepare}
                      onStartVoyage={voyageStart}
                      onCollectVoyage={voyageCollect}
                      onOpenCannon={() => {
                        setShowCannon(true);
                        setShowRigging(false);
                      }}
                    />
                    {debugUi ? <CaptainsLogPanel events={debugEvents} /> : null}
                    {debugUi ? <MidgameScalingPanel state={state} /> : null}

                    {debugUi ? (
                      <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
                        <CardHeader>
                          <CardTitle>Captain’s Ledger</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                          <div className="text-sm text-zinc-300">
                            Fast-forward deterministically (no real-world time). Useful for testing loops and “offline” simulation.
                          </div>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                            <div className="sm:col-span-2">
                              <label className="mb-1 block text-xs text-zinc-400">Minutes</label>
                              <Input
                                data-testid="quick-advance-minutes"
                                value={quickAdvanceMinutes}
                                onChange={(e) => setQuickAdvanceMinutes(e.target.value)}
                                inputMode="numeric"
                                className="border-zinc-800 bg-black text-zinc-100 placeholder:text-zinc-600"
                              />
                            </div>
                            <div className="flex items-end gap-2">
                              <Button data-testid="quick-advance-go" onClick={quickAdvance}>
                                Advance
                              </Button>
                            </div>
                          </div>
                          {quickAdvanceNote ? <div className="text-xs text-zinc-500">{quickAdvanceNote}</div> : null}
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card className="border-zinc-900 bg-zinc-950/30 text-zinc-100">
                      <CardHeader>
                        <CardTitle>Next Goals</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm text-zinc-300">
                        {(() => {
                          const goals = getNextGoalsForUi(state);
                          const items = goals.length > 0 ? goals : ["Run voyages, grow influence, and expand your fleet."];
                          return items.map((g, idx) => (
                            <div key={idx} className="rounded-md border border-zinc-800 bg-black px-3 py-2">
                              {g}
                            </div>
                          ));
                        })()}
                      </CardContent>
                    </Card>

                    <WarehousePanel state={state} onUpgrade={warehouseUpgrade} />
                    {state.unlocks.includes("recipe:distill_rum") ? (
                      <DistilleryPanel state={state} onSetEnabled={(enabled) => setRecipeEnabled("distill_rum", enabled)} />
                    ) : null}
                    {state.unlocks.includes("voyage") ? (
                      <ShipHoldPanel state={state} onLoad={loadToHold} onUnload={unloadFromHold} />
                    ) : null}
                    {state.unlocks.includes("voyage") || state.ship.condition < state.ship.maxCondition ? (
                      <ShipPanel state={state} onRepair={shipRepair} />
                    ) : null}
                    {state.unlocks.includes("crew") ? (
                      <ShipyardPanel state={state} onBuy={shipBuyClass} onUpgrade={shipyardUpgrade} />
                    ) : null}
                    {state.fleet.maxShips > 2 || state.fleet.ships.length > 0 ? (
                      <FleetPanel
                        state={state}
                        onBuyShip={fleetBuyShip}
                        onSetActive={fleetSetActive}
                        onSetAutomation={fleetSetAutomation}
                      />
                    ) : null}
                    {state.unlocks.includes("politics") || state.flagship.progress > 0 ? (
                      <FlagshipPanel state={state} onContribute={flagshipContribute} />
                    ) : null}
                    {hasCrafting ? <CraftingPanel state={state} onSetEnabled={setRecipeEnabled} /> : null}
                    {state.unlocks.includes("vanity_shop") ? <VanityShopPanel state={state} onBuy={vanityBuy} /> : null}
                  </>
                )
              ) : null}
            </div>
          ) : null}

          {activeNav === "economy" ? (
            <EconomyPanel
              state={state}
              debugUi={debugUi}
              onPlace={placeContract}
              onCollectAll={collectFirstFilled}
              onCancel={cancelContract}
              onCollectOne={collectOne}
            />
          ) : null}

          {activeNav === "crew" ? (
            <CrewPanel state={state} onHire={crewHire} onFire={crewFire} />
          ) : null}

          {activeNav === "voyage" ? (
            <VoyagePanel state={state} onStart={voyageStart} onPrepare={voyagePrepare} onCollect={voyageCollect} onBuyChart={buyChart} />
          ) : null}

          {activeNav === "politics" ? (
            <PoliticsPanel
              state={state}
              onSetAffiliation={politicsSetAffiliation}
              onDonate={politicsDonate}
              onTaxReliefStart={politicsTaxReliefStart}
              onTaxReliefAbort={politicsTaxReliefAbort}
              onConquestStart={conquestStart}
              onConquestAbort={conquestAbort}
            />
          ) : null}

          <DebugDispatchPanel
            enabled={debugUi && !inDockIntro}
            onDispatch={(action) => store.dispatch(action)}
            onOffline={(ms) => store.simulateOfflineCatchup(ms)}
            onClearOffline={() => store.clearOfflineCatchupReport()}
          />
        </main>
      </div>
    </div>
  );
}
