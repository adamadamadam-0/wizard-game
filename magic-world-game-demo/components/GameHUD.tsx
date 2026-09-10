"use client"

import {
  ENERGY_REGEN_INTERVAL, MAX_WEAPON_LEVEL,
  ELEMENTS, skillDamage, unlockedSlots,
  maxEnergyForStage, isBossStage,
  type GameState, type Stage, type ElementKind,
} from "@/hooks/useGameEngine"

interface GameHUDProps {
  gameState: GameState
  stage: Stage
  testMode?: boolean
  element?: ElementKind
}

const stageNames: Record<string, string> = {
  stage1: "LEVEL 1-1 - Enchanted Forest",
  stage2: "LEVEL 1-2 - Dark Castle",
  stage3: "LEVEL 1-3 - Castle Rooftop",
  stage4: "LEVEL 2-1 - Laputa Approach",
  stage5: "LEVEL 2-2 - Sky Fortress",
  stage6: "LEVEL 2-3 - Muska's Sanctum",
  stage7: "LEVEL 3-1 - Gates of Heaven",
  stage8: "LEVEL 3-2 - Golden Clouds",
  stage9: "LEVEL 3-3 - Throne of God",
  stage10: "LEVEL 4-1 - Sunken Depths",
  stage11: "LEVEL 4-2 - Abyssal Trench",
  stage12: "LEVEL 4-3 - Leviathan's Lair",
  stage13: "LEVEL 5-1 - Volcano Base",
  stage14: "LEVEL 5-2 - Lava Caverns",
  stage15: "LEVEL 5-3 - Ifrit's Forge",
  stage16: "LEVEL 6-1 - System Boot",
  stage17: "LEVEL 6-2 - Circuit Core",
  stage18: "LEVEL 6-3 - AI Mainframe",
}

const bossDisplay: Record<string, { name: string; color: string; bar: string; barPhase2: string }> = {
  darklord: { name: "DARK LORD", color: "#a855f7", bar: "linear-gradient(90deg,#4c1d95,#7c3aed)", barPhase2: "linear-gradient(90deg,#991b1b,#ef4444)" },
  muska: { name: "COLONEL MUSKA", color: "#93c5fd", bar: "linear-gradient(90deg,#1e3a8a,#93c5fd)", barPhase2: "linear-gradient(90deg,#1e3a8a,#ef4444)" },
  god: { name: "GOD", color: "#fbbf24", bar: "linear-gradient(90deg,#ca8a04,#fbbf24)", barPhase2: "linear-gradient(90deg,#b45309,#f59e0b)" },
  leviathan: { name: "LEVIATHAN", color: "#38bdf8", bar: "linear-gradient(90deg,#0c4a6e,#38bdf8)", barPhase2: "linear-gradient(90deg,#0c4a6e,#ef4444)" },
  ifrit: { name: "IFRIT", color: "#f97316", bar: "linear-gradient(90deg,#7c2d12,#f97316)", barPhase2: "linear-gradient(90deg,#7c2d12,#fef08a)" },
  ai: { name: "AI CORE", color: "#22d3ee", bar: "linear-gradient(90deg,#164e63,#22d3ee)", barPhase2: "linear-gradient(90deg,#164e63,#ef4444)" },
}

function getMaxEnergy(stage: Stage): number {
  return maxEnergyForStage(stage)
}

interface SkillBarProps {
  label: string
  hotkey: string
  cooldownMs: number
  maxCooldownMs: number
  energyCost: number
  currentEnergy: number
  color: string
  glowColor: string
  damage: number
}

/**
 * One skill tile. Four of these sit in a 2x2 grid so all of an element's
 * skills fit inside the 450px-tall canvas.
 */
function SkillBar({ label, hotkey, cooldownMs, maxCooldownMs, energyCost, currentEnergy, color, glowColor, damage }: SkillBarProps) {
  const cdPct = cooldownMs > 0 ? (cooldownMs / maxCooldownMs) * 100 : 0
  const canUse = cooldownMs <= 0 && currentEnergy >= energyCost
  return (
    <div
      className="rounded"
      style={{
        padding: "3px 4px",
        background: "rgba(0,0,0,0.82)",
        border: `2px solid ${canUse ? color : "#374151"}`,
        boxShadow: canUse ? `0 0 6px ${glowColor}` : "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
        minWidth: 0,
      }}
    >
      <div className="flex items-center gap-1">
        <span
          className="rounded"
          style={{
            fontSize: 5,
            color: "#000",
            background: canUse ? color : "#6b7280",
            minWidth: 16,
            textAlign: "center",
            lineHeight: "10px",
            height: 10,
            display: "inline-block",
          }}
        >
          {hotkey}
        </span>
        <span
          style={{
            fontSize: 5, color: canUse ? color : "#6b7280",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
      </div>

      <div
        className="w-full rounded-sm overflow-hidden"
        style={{ height: 4, background: "#1f2937", border: "1px solid #374151", margin: "3px 0" }}
      >
        {cdPct > 0 ? (
          <div className="h-full" style={{ width: `${cdPct}%`, background: "#f59e0b", transition: "width 0.05s linear" }} />
        ) : (
          <div className="h-full" style={{ width: "100%", background: color, boxShadow: `0 0 4px ${glowColor}` }} />
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* energy cost dots */}
        <span style={{ display: "flex", gap: 1 }}>
          {Array.from({ length: energyCost }, (_, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 5, height: 5,
                borderRadius: 1,
                background: i < currentEnergy ? "#7c3aed" : "#1e1b4b",
                border: `1px solid ${i < currentEnergy ? "#a78bfa" : "#4c1d95"}`,
              }}
            />
          ))}
        </span>
        <span style={{ fontSize: 5, color: "#9ca3af" }}>{damage}</span>
        <span style={{ fontSize: 5, color: cdPct > 0 ? "#f59e0b" : "#22c55e", marginLeft: "auto" }}>
          {cdPct > 0 ? `${(cooldownMs / 1000).toFixed(1)}s` : "READY"}
        </span>
      </div>
    </div>
  )
}

export default function GameHUD({ gameState: gs, stage, testMode, element }: GameHUDProps) {
  const p = gs.player
  const hpPct = (p.hp / p.maxHp) * 100
  const boss = gs.enemies.find(e => e.type === "boss")
  const maxEnergy = getMaxEnergy(stage)

  const elId = element ?? gs.element ?? "fire"
  const el = ELEMENTS[elId]
  const ec = el.colors
  const slots = unlockedSlots(stage)
  const maxed = gs.weaponLevel >= MAX_WEAPON_LEVEL

  const hpColor =
    hpPct > 60 ? "#22c55e" :
    hpPct > 30 ? "#f59e0b" : "#ef4444"

  // Cooldown state per slot, in the same order as the element's skill list
  const cooldowns = [gs.skillCooldown, gs.skill2Cooldown, gs.skill3Cooldown, gs.cometCooldown]

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ fontFamily: "'Press Start 2P', monospace" }}
    >
      {/* Top-left: Player stats + skills panel */}
      <div className="absolute top-2 left-2 flex flex-col gap-1" style={{ width: 236 }}>

        {/* Element / character badge */}
        <div
          className="rounded px-2 py-1.5 flex items-center gap-2"
          style={{ background: "rgba(0,0,0,0.82)", border: `2px solid ${ec.primary}`, boxShadow: `0 0 8px ${ec.primary}55` }}
        >
          <span
            className="rounded"
            style={{
              width: 12, height: 12, display: "inline-block",
              background: ec.primary, boxShadow: `0 0 8px ${ec.primary}`,
            }}
          />
          <span style={{ fontSize: 7, color: ec.primary, letterSpacing: 1 }}>{el.name}</span>
          <span style={{ fontSize: 5, color: "#9ca3af", marginLeft: "auto" }}>{el.title}</span>
        </div>

        {/* HP Bar */}
        <div
          className="rounded px-2 py-1.5"
          style={{ background: "rgba(0,0,0,0.82)", border: "2px solid #fbbf24" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 7, color: "#fbbf24", letterSpacing: 1 }}>HP</span>
            <span style={{ fontSize: 7, color: hpColor, marginLeft: "auto" }}>{p.hp}/{p.maxHp}</span>
          </div>
          <div
            className="w-full rounded-sm overflow-hidden"
            style={{ height: 10, background: "#1f2937", border: "1px solid #374151" }}
          >
            <div
              className="h-full transition-all duration-100"
              style={{ width: `${hpPct}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}` }}
            />
          </div>
        </div>

        {/* EXP Bar + Weapon Level — EXP is the damage track */}
        <div
          className="rounded px-2 py-1.5"
          style={{ background: "rgba(0,0,0,0.82)", border: "2px solid #22c55e" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: 7, color: "#22c55e", letterSpacing: 1 }}>EXP</span>
            <span style={{ fontSize: 6, color: "#86efac", marginLeft: "auto" }}>
              WEAPON LV {gs.weaponLevel}{maxed ? " MAX" : `/${MAX_WEAPON_LEVEL}`}
            </span>
          </div>
          <div
            className="w-full rounded-sm overflow-hidden"
            style={{ height: 6, background: "#1f2937", border: "1px solid #374151" }}
          >
            <div
              className="h-full transition-all duration-100"
              style={{
                width: `${Math.min((gs.exp / gs.expToNext) * 100, 100)}%`,
                background: maxed ? "#fbbf24" : "#22c55e",
                boxShadow: `0 0 6px ${maxed ? "#fbbf24" : "#22c55e"}`,
              }}
            />
          </div>
          <div style={{ fontSize: 5, color: "#6b7280", marginTop: 2 }}>
            {maxed ? "MAX DAMAGE" : `${gs.exp}/${gs.expToNext} - levels add damage`}
          </div>
        </div>

        {/* Energy Orbs */}
        <div
          className="rounded px-2 py-1.5"
          style={{ background: "rgba(0,0,0,0.82)", border: "2px solid #7c3aed" }}
        >
          <div className="flex items-center gap-1 mb-1.5">
            <span style={{ fontSize: 7, color: "#a78bfa", letterSpacing: 1 }}>ENERGY</span>
            <span style={{ fontSize: 5, color: "#6d28d9", marginLeft: "auto" }}>
              REGEN {ENERGY_REGEN_INTERVAL / 1000}s
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: maxEnergy }, (_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  width: 14,
                  height: 14,
                  background: i < p.energy ? "#7c3aed" : "#1e1b4b",
                  border: `2px solid ${i < p.energy ? "#a78bfa" : "#4c1d95"}`,
                  boxShadow: i < p.energy ? "0 0 7px #7c3aed" : "none",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>
        </div>

        {/* The element's four skills, 2x2 so they fit the canvas */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {el.skills.map((sk, i) => slots[i] && (
            <SkillBar
              key={sk.name}
              label={sk.name}
              hotkey={sk.hotkey}
              cooldownMs={cooldowns[i]}
              maxCooldownMs={sk.cooldown}
              energyCost={sk.cost}
              currentEnergy={p.energy}
              color={i === 0 ? ec.primary : i === 1 ? ec.secondary : i === 2 ? ec.aura : ec.core}
              glowColor={ec.primary}
              damage={skillDamage(elId, (i + 1) as 1 | 2 | 3 | 4, gs.weaponLevel)}
            />
          ))}
        </div>
      </div>

      {/* Top-center: Stage name + enemy counter */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        {testMode && (
          <div
            className="rounded px-3 py-1"
            style={{ background: "rgba(239,68,68,0.85)", border: "2px solid #fbbf24" }}
          >
            <span style={{ fontSize: 7, color: "#ffffff", letterSpacing: 2 }}>TEST MODE</span>
          </div>
        )}
        <div
          className="rounded px-3 py-1"
          style={{ background: "rgba(0,0,0,0.75)", border: "2px solid #fbbf24" }}
        >
          <span style={{ fontSize: 7, color: "#fbbf24", letterSpacing: 1 }}>
            {stageNames[stage] ?? stage.toUpperCase()}
          </span>
        </div>
        {!isBossStage(stage) && (
          <div
            className="rounded px-2 py-1"
            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid #4b5563" }}
          >
            <span style={{ fontSize: 6, color: "#9ca3af" }}>
              ENEMIES: {gs.enemies.filter(e => e.state !== "dead").length}/{gs.totalEnemies}
            </span>
          </div>
        )}
      </div>

      {/* Boss HP bar — bottom center */}
      {isBossStage(stage) && boss && boss.state !== "dead" && (() => {
        const info = bossDisplay[boss.bossKind ?? "darklord"] ?? bossDisplay.darklord
        return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2" style={{ width: 360 }}>
            <div
              className="rounded px-3 py-2"
              style={{
                background: "rgba(0,0,0,0.9)",
                border: `2px solid ${info.color}`,
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span style={{ fontSize: 8, color: info.color }}>
                  {info.name}
                  {boss.phase === 2 ? " - PHASE 2" : ""}
                </span>
                <span style={{ fontSize: 7, color: "#e9d5ff" }}>{boss.hp}/{boss.maxHp}</span>
              </div>
              <div
                className="w-full rounded-sm overflow-hidden"
                style={{ height: 14, background: "#1e1b4b", border: "2px solid #4c1d95" }}
              >
                <div
                  className="h-full transition-all duration-150"
                  style={{
                    width: `${(boss.hp / boss.maxHp) * 100}%`,
                    background: boss.phase === 2 ? info.barPhase2 : info.bar,
                    boxShadow: boss.phase === 2 ? "0 0 10px #ef4444" : `0 0 10px ${info.color}`,
                  }}
                />
              </div>
              {boss.phase === 2 && (
                <div className="mt-1 text-center">
                  <span style={{ fontSize: 6, color: "#ef4444" }}>*** ENRAGED ***</span>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Bottom-right: Controls legend */}
      <div
        className="absolute bottom-3 right-3"
        style={{ background: "rgba(0,0,0,0.7)", border: "1px solid #374151", borderRadius: 4, padding: "6px 8px" }}
      >
        <div className="flex flex-col gap-1">
          {[
            ["A / D", "Move"],
            ["SPACE", "Jump"],
            ["SHIFT", "Dash"],
            ...el.skills
              .map((sk, i) => [sk.hotkey, `${sk.name}  (${sk.cost} energy)`] as [string, string])
              .filter((_, i) => slots[i]),
            ["WALK", "Pick up Potion"],
          ].map(([key, action]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="rounded px-1"
                style={{ fontSize: 5, color: "#fbbf24", background: "#1f2937", border: "1px solid #374151", minWidth: 32, textAlign: "center" }}
              >
                {key}
              </span>
              <span style={{ fontSize: 5, color: "#9ca3af" }}>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
