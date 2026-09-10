"use client"

import React, { useEffect, useRef, useCallback, useState } from "react"

// ─── Constants ────────────────────────────────────────────────────────────────
export const CANVAS_W = 800
export const CANVAS_H = 450
export const GRAVITY = 0.55
export const PLAYER_SPEED = 3.2
export const JUMP_FORCE = -13
export const FIREBALL_SPEED = 10
export const MAX_ENERGY = 3              // level 1 stage 1
export const MAX_ENERGY_S2 = 5          // level 1 stage 2
export const MAX_ENERGY_S3 = 7          // level 1 stage 3 + level 2
export const MAX_ENERGY_L3 = 9          // level 3
export const MAX_ENERGY_L4 = 11         // levels 4-6
// Legacy fire-element defaults. Live cooldowns/costs now come from ELEMENTS.
export const SKILL_COOLDOWN = 3000       // ms
export const SKILL2_COOLDOWN = 6000      // ms
export const SKILL3_COOLDOWN = 9000      // ms
export const COMET_COOLDOWN = 12000      // ms
export const COMET_COST = 4
export const ENERGY_REGEN_INTERVAL = 5000  // ms  (energy orb regen: 5s)
export const GROUND_Y = CANVAS_H - 56    // pixel ground line

// ─── Sprite assets ────────────────────────────────────────────────────────────
const WIZARD_SPRITE_W = 48
const WIZARD_SPRITE_H = 48
const WIZARD_FRAME_COUNT = 12
const FIREBALL_SPRITE_W = 24
const FIREBALL_SPRITE_H = 24
const FIREBALL_FRAME_COUNT = 5

let wizardImg: HTMLImageElement | null = null
let fireballImg: HTMLImageElement | null = null
let spritesLoaded = false
function ensureSpritesLoaded() {
  if (spritesLoaded) return
  if (typeof window === "undefined") return
  if (!wizardImg) {
    wizardImg = new Image()
    wizardImg.src = "/wizard-spritesheet.png"
  }
  if (!fireballImg) {
    fireballImg = new Image()
    fireballImg.src = "/fireball-spritesheet.png"
  }
  spritesLoaded = wizardImg.complete && wizardImg.naturalWidth > 0 && fireballImg.complete && fireballImg.naturalWidth > 0
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type Stage =
  | "title"
  | "stage1" | "stage2" | "stage3"     // Level 1 — Dark Lord
  | "stage4" | "stage5" | "stage6"     // Level 2 — Laputa / Colonel Muska
  | "stage7" | "stage8" | "stage9"     // Level 3 — Heaven / God
  | "stage10" | "stage11" | "stage12"  // Level 4 — Deep Sea / Leviathan
  | "stage13" | "stage14" | "stage15"  // Level 5 — Volcano / Ifrit
  | "stage16" | "stage17" | "stage18"  // Level 6 — Computer / AI Core
  | "win" | "gameover"
export type EnemyType = "goblin" | "orc" | "skeleton" | "boss" | "orcBrute" | "robot" | "robotElite" | "angel" | "seraph"
  | "fishman" | "jellyfish" | "imp" | "lavaGolem" | "virus" | "firewall"
export type BossKind = "darklord" | "muska" | "god" | "leviathan" | "ifrit" | "ai"

// ─── Stage helpers ────────────────────────────────────────────────────────────
const L4_STAGES: Stage[] = ["stage10", "stage11", "stage12", "stage13", "stage14", "stage15", "stage16", "stage17", "stage18"]

export function maxEnergyForStage(s: Stage): number {
  if (L4_STAGES.includes(s)) return MAX_ENERGY_L4
  if (s === "stage7" || s === "stage8" || s === "stage9") return MAX_ENERGY_L3
  if (s === "stage3" || s === "stage4" || s === "stage5" || s === "stage6") return MAX_ENERGY_S3
  if (s === "stage2") return MAX_ENERGY_S2
  return MAX_ENERGY
}

export function isBossStage(s: Stage): boolean {
  return s === "stage3" || s === "stage6" || s === "stage9" || s === "stage12" || s === "stage15" || s === "stage18"
}

export function isPlayingStage(s: Stage): boolean {
  return s === "stage1" || s === "stage2" || s === "stage3" || s === "stage4" || s === "stage5" || s === "stage6" || s === "stage7" || s === "stage8" || s === "stage9"
    || s === "stage10" || s === "stage11" || s === "stage12" || s === "stage13" || s === "stage14" || s === "stage15" || s === "stage16" || s === "stage17" || s === "stage18"
}

/** Skill slot 2 unlocks at level 1-2, slot 3 at level 1-3, slot 4 at level 2-2. */
export function hasSkill2Unlocked(s: Stage): boolean {
  return s !== "stage1" && isPlayingStage(s)
}

export function hasSkill3Unlocked(s: Stage): boolean {
  return s !== "stage1" && s !== "stage2" && isPlayingStage(s)
}

export function hasSkill4Unlocked(s: Stage): boolean {
  return s === "stage5" || s === "stage6" || s === "stage7" || s === "stage8" || s === "stage9" || L4_STAGES.includes(s)
}

// Legacy aliases (fire-flavoured names) kept so existing callers keep working.
export const hasFireRainUnlocked = hasSkill2Unlocked
export const hasFireStormUnlocked = hasSkill3Unlocked
export const hasCometUnlocked = hasSkill4Unlocked

/** Which skill slots are usable on a given stage. */
export function unlockedSlots(s: Stage): boolean[] {
  return [true, hasSkill2Unlocked(s), hasSkill3Unlocked(s), hasSkill4Unlocked(s)]
}

export function nextStageOf(s: Stage): Stage {
  const order: Partial<Record<Stage, Stage>> = {
    stage1: "stage2", stage2: "stage3", stage3: "stage4",
    stage4: "stage5", stage5: "stage6", stage6: "stage7",
    stage7: "stage8", stage8: "stage9", stage9: "stage10",
    stage10: "stage11", stage11: "stage12", stage12: "stage13",
    stage13: "stage14", stage14: "stage15", stage15: "stage16",
    stage16: "stage17", stage17: "stage18",
  }
  return order[s] ?? "stage1"
}

export function maxHpForStage(s: Stage): number {
  if (L4_STAGES.includes(s)) return 300
  if (s === "stage7" || s === "stage8" || s === "stage9") return 250
  if (s === "stage1") return 100
  return 200
}

// ─── Attack / hurt animation FX ──────────────────────────────────────────────
/** Themed one-shot animations played when something swings, casts or shoots. */
export type AttackStyle =
  | "claw" | "axe" | "bone" | "hammer"          // Level 1 - forest & castle
  | "laser" | "rotor"                            // Level 2 - Laputa machines
  | "holy" | "featherslash"                      // Level 3 - heaven
  | "trident" | "shock" | "splash"               // Level 4 - deep sea
  | "flame" | "magma"                            // Level 5 - volcano
  | "data" | "grid"                              // Level 6 - computer
  | "darkcast" | "gunshot" | "divinecast" | "tidecast" | "infernocast" | "systemcast"
  | "hurt"

export interface AttackFx {
  id: number
  x: number; y: number
  facing: 1 | -1
  style: AttackStyle
  timer: number; maxTimer: number
  color: string
  color2: string
  scale: number
  rot: number
}

// ─── Elements (playable wizard characters) ───────────────────────────────────
export type ElementKind = "fire" | "water" | "light"

export interface SkillDef {
  name: string
  hotkey: string
  cost: number
  cooldown: number      // ms
  baseDamage: number
  dmgPerLevel: number   // damage added per weapon level (EXP upgrade)
  radius: number
  blurb: string
}

export interface ElementDef {
  id: ElementKind
  name: string          // element name
  title: string         // character class name
  tagline: string
  colors: { primary: string; secondary: string; core: string; dark: string; aura: string }
  skills: [SkillDef, SkillDef, SkillDef, SkillDef]
  boltSpeed: number
  pierce: number        // extra enemies a bolt punches through
  slowFrames: number    // frames of slow applied on bolt hit (water)
  castFx: AttackStyle   // themed cast flourish drawn on the wizard
}

/** Weapon level is driven by EXP — every level adds flat damage to all 4 skills. */
export const MAX_WEAPON_LEVEL = 10

export const ELEMENTS: Record<ElementKind, ElementDef> = {
  fire: {
    id: "fire",
    name: "FIRE",
    title: "PYROMANCER",
    tagline: "Raw burst damage. Melts single targets and bosses.",
    colors: { primary: "#f97316", secondary: "#ef4444", core: "#fef08a", dark: "#7c2d12", aura: "#fbbf24" },
    boltSpeed: 10,
    pierce: 0,
    slowFrames: 0,
    castFx: "flame",
    skills: [
      { name: "FIREBALL",    hotkey: "Z/J", cost: 1, cooldown: 3000,  baseDamage: 30,  dmgPerLevel: 15, radius: 0,   blurb: "Hurls a burning sphere" },
      { name: "FIRE RAIN",   hotkey: "X",   cost: 2, cooldown: 6000,  baseDamage: 50,  dmgPerLevel: 20, radius: 260, blurb: "Meteors fall around you" },
      { name: "FIRE TYPHOON",hotkey: "C",   cost: 3, cooldown: 9000,  baseDamage: 70,  dmgPerLevel: 25, radius: 320, blurb: "Spiralling firestorm" },
      { name: "COMET",       hotkey: "V/K", cost: 4, cooldown: 12000, baseDamage: 120, dmgPerLevel: 40, radius: 160, blurb: "Drops a blazing comet" },
    ],
  },
  water: {
    id: "water",
    name: "WATER",
    title: "TIDECALLER",
    tagline: "Wide crowd control. Bolts chill enemies and slow them down.",
    colors: { primary: "#38bdf8", secondary: "#0ea5e9", core: "#e0f2fe", dark: "#0c4a6e", aura: "#7dd3fc" },
    boltSpeed: 9,
    pierce: 0,
    slowFrames: 90,
    castFx: "splash",
    skills: [
      { name: "AQUA BOLT",   hotkey: "Z/J", cost: 1, cooldown: 2600,  baseDamage: 26,  dmgPerLevel: 13, radius: 0,   blurb: "Chilling jet - slows on hit" },
      { name: "TIDAL WAVE",  hotkey: "X",   cost: 2, cooldown: 6000,  baseDamage: 46,  dmgPerLevel: 18, radius: 320, blurb: "A crashing wall of water" },
      { name: "MAELSTROM",   hotkey: "C",   cost: 3, cooldown: 9000,  baseDamage: 62,  dmgPerLevel: 22, radius: 360, blurb: "Huge spinning whirlpool" },
      { name: "GLACIER",     hotkey: "V/K", cost: 4, cooldown: 12000, baseDamage: 110, dmgPerLevel: 36, radius: 190, blurb: "Drops a frozen iceberg" },
    ],
  },
  light: {
    id: "light",
    name: "LIGHT",
    title: "LUMINAR",
    tagline: "Piercing precision. Lances punch through whole enemy rows.",
    colors: { primary: "#fbbf24", secondary: "#fde68a", core: "#ffffff", dark: "#b45309", aura: "#fef3c7" },
    boltSpeed: 13,
    pierce: 2,
    slowFrames: 0,
    castFx: "holy",
    skills: [
      { name: "LIGHT LANCE", hotkey: "Z/J", cost: 1, cooldown: 3200,  baseDamage: 34,  dmgPerLevel: 17, radius: 0,   blurb: "Pierces up to 3 enemies" },
      { name: "STAR FALL",   hotkey: "X",   cost: 2, cooldown: 6500,  baseDamage: 54,  dmgPerLevel: 21, radius: 240, blurb: "Calls down falling stars" },
      { name: "RADIANT NOVA",hotkey: "C",   cost: 3, cooldown: 9500,  baseDamage: 76,  dmgPerLevel: 27, radius: 300, blurb: "Expanding rings of light" },
      { name: "JUDGMENT",    hotkey: "V/K", cost: 4, cooldown: 13000, baseDamage: 135, dmgPerLevel: 45, radius: 150, blurb: "A pillar of holy fire" },
    ],
  },
}

export const ELEMENT_ORDER: ElementKind[] = ["fire", "water", "light"]

/** Damage for a skill slot (1-4) at the current weapon level. */
export function skillDamage(el: ElementKind, slot: 1 | 2 | 3 | 4, weaponLevel: number): number {
  const s = ELEMENTS[el].skills[slot - 1]
  return Math.round(s.baseDamage + (weaponLevel - 1) * s.dmgPerLevel)
}

/** EXP needed to reach the next weapon level. */
export function expForWeaponLevel(level: number): number {
  return Math.round(100 * Math.pow(1.35, level - 1))
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface Player {
  x: number; y: number; w: number; h: number
  vx: number; vy: number
  onGround: boolean
  facing: 1 | -1   // 1=right -1=left
  hp: number; maxHp: number
  energy: number
  animFrame: number
  animTimer: number
  state: "idle" | "run" | "jump" | "cast" | "hurt" | "dead"
  hurtTimer: number
  hurtDir: 1 | -1         // knock-back direction for the hurt animation
  flashTimer: number      // white impact flash frames
  castTimer: number
  castMax: number         // length of the current cast, for cast-pose easing
  castSlot: 1 | 2 | 3 | 4 // which skill is being cast (drives the cast pose)
  element: ElementKind
}

type PlayerState = Player["state"]

export interface Enemy {
  id: number; type: EnemyType
  x: number; y: number; w: number; h: number
  vx: number; vy: number
  onGround: boolean
  hp: number; maxHp: number
  facing: 1 | -1
  animFrame: number; animTimer: number
  state: "idle" | "walk" | "attack" | "hurt" | "dead"
  hurtTimer: number
  hurtDir: 1 | -1         // knock-back direction for the hurt animation
  flashTimer: number      // white impact flash frames
  deathTimer: number      // death dissolve animation frames
  slowTimer: number       // frames left chilled (water element)
  attackTimer: number
  attackAnim: number
  attackAnimMax: number
  attackPhase: "windup" | "strike" | "recover"
  aggroRange: number; attackRange: number
  groundY: number   // which platform ground
  patrolDir: 1 | -1
  patrolTimer: number
  // boss specific
  phase?: 1 | 2
  bossKind?: BossKind
  bossAttackPattern?: number
  bossProjectileCooldown?: number
  // ranged attacker
  ranged?: boolean
  shots?: number
  // special AOE attack
  specialCooldown?: number
  specialTelegraph?: number
  specialType?: "slam" | "poisonNova" | "skybeam" | "holyNova" | "featherRain" | "airstrike" | "lightning"
  specialRadius?: number
  // flying attack (Level 2 robots)
  flying?: boolean
  flyY?: number
  flyBaseY?: number
  flyTimer?: number
  flyDir?: number
  diveTimer?: number
  diveAnim?: number
}

export interface Fireball {
  id: number; x: number; y: number; w: number; h: number
  vx: number; vy: number
  fromPlayer: boolean
  active: boolean
  type?: "fireball" | "rain" | "storm" | "typhoon" | "enemy" | "robotBullet"
  frame?: number
  element?: ElementKind
  pierce?: number       // enemies this bolt can still punch through
  hitIds?: number[]     // enemies already damaged by this bolt
  enemyStyle?: AttackStyle  // themed look for enemy projectiles
  // Typhoon spiral data
  angle?: number
  radius?: number
  spinSpeed?: number
  expandSpeed?: number
  originX?: number
  originY?: number
  typhoonWave?: number
}

export interface Comet {
  id: number; x: number; y: number; w: number; h: number
  vx: number; vy: number
  active: boolean
  exploded: boolean
  frame: number
  element: ElementKind
}

export interface Platform { x: number; y: number; w: number; h: number; type: "ground" | "platform" }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
export interface FloatingText { x: number; y: number; vy: number; text: string; color: string; life: number; maxLife: number }
export interface Potion { id: number; x: number; y: number; w: number; h: number; bobOffset: number; active: boolean }

export interface AoeEffect {
  id: number
  x: number
  y: number
  radius: number
  type: "telegraph" | "burst" | "hazard"
  timer: number
  maxTimer: number
  color: string
  damage?: number
  tickTimer?: number
  tickInterval?: number
  // telegraph behaviour
  followPlayer?: boolean   // telegraph tracks the player until it detonates
  spawnHazard?: boolean    // leave a lingering hazard pool after detonation
  hazardRadius?: number
  hazardDuration?: number
  hazardDamage?: number
  hazardColor?: string
  lightning?: boolean      // render lightning bolt telegraph
  playerOwned?: boolean    // a hazard the player created — burns enemies, not the wizard
}

export interface GameState {
  stage: Stage
  player: Player
  enemies: Enemy[]
  fireballs: Fireball[]
  comets: Comet[]
  platforms: Platform[]
  particles: Particle[]
  floatingTexts: FloatingText[]
  potions: Potion[]
  aoeEffects: AoeEffect[]
  attackFx: AttackFx[]
  element: ElementKind
  skillCooldown: number       // ms remaining — fireball
  skill2Cooldown: number      // ms remaining — fire rain
  skill3Cooldown: number      // ms remaining — fire storm
  cometCooldown: number       // ms remaining — comet
  dashCooldown: number        // ms remaining — dash
  exp: number                 // exp toward next weapon upgrade
  expToNext: number
  weaponLevel: number         // 1..3 — upgraded at each level boss
  lastFireTime: number
  lastEnergyRegen: number
  cameraX: number
  stageWidth: number
  killCount: number
  totalEnemies: number
  bossActivated: boolean
  screenShake: number
  frameCount: number
  testMode: boolean
}

export interface InputState {
  left: boolean; right: boolean; jump: boolean; fire: boolean
  skill2: boolean; skill3: boolean; comet: boolean; dash: boolean
  jumpPressed: boolean  // edge detect
  firePressed: boolean
  skill2Pressed: boolean
  skill3Pressed: boolean
  cometPressed: boolean
  dashPressed: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _idCounter = 0
const nextId = () => ++_idCounter

function rectOverlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

function spawnParticles(state: GameState, x: number, y: number, count: number, color: string, spread = 3) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * spread * 2,
      vy: (Math.random() - 1) * spread,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      color,
      size: 2 + Math.random() * 3,
    })
  }
}

function spawnFloatingText(state: GameState, x: number, y: number, text: string, color: string) {
  state.floatingTexts.push({ x, y, vy: -1.2, text, color, life: 60, maxLife: 60 })
}

/** Queue a themed one-shot attack animation (slash arc, muzzle flash, rune…). */
function spawnAttackFx(
  state: GameState, x: number, y: number, facing: 1 | -1,
  style: AttackStyle, color: string, color2: string, scale = 1, frames?: number,
) {
  const dur = frames ?? (style === "hurt" ? 10 : 16)
  state.attackFx.push({
    id: nextId(), x, y, facing, style,
    timer: dur, maxTimer: dur,
    color, color2, scale,
    rot: (Math.random() - 0.5) * 0.3,
  })
}

/** Damage the wizard, with recoil + flash so hits read clearly. */
function hurtPlayer(state: GameState, dmg: number, fromX: number, color = "#ef4444", shake = 4) {
  const p = state.player
  if (state.testMode || p.hp <= 0 || p.state === "dead" || p.hurtTimer > 0) return
  p.hp = Math.max(0, p.hp - dmg)
  p.hurtDir = fromX <= p.x + p.w / 2 ? 1 : -1
  p.hurtTimer = 28
  p.flashTimer = 12
  p.x = clamp(p.x + p.hurtDir * 7, 0, state.stageWidth - p.w)
  state.screenShake = Math.max(state.screenShake, shake)
  spawnFloatingText(state, p.x, p.y - 10, `-${dmg}`, "#ef4444")
  spawnParticles(state, p.x + p.w / 2, p.y + p.h / 2, 9, color, 4)
  spawnAttackFx(state, p.x + p.w / 2 - p.hurtDir * (p.w / 2), p.y + p.h / 2, p.hurtDir, "hurt", color, "#ffffff", 1)
}

// ─── Stage Builders ───────────────────────────────────────────────────────────
function buildStage1(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    // ground
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    // floating platforms
    { x: 220, y: gY - 90, w: 120, h: 16, type: "platform" },
    { x: 460, y: gY - 130, w: 100, h: 16, type: "platform" },
    { x: 660, y: gY - 80, w: 130, h: 16, type: "platform" },
    { x: 900, y: gY - 110, w: 110, h: 16, type: "platform" },
    { x: 1100, y: gY - 70, w: 140, h: 16, type: "platform" },
    { x: 1350, y: gY - 130, w: 120, h: 16, type: "platform" },
    { x: 1600, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1820, y: gY - 140, w: 100, h: 16, type: "platform" },
    { x: 2050, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("goblin", 350, gY - 28, gY),
    mkEnemy("goblin", 550, gY - 28, gY),
    mkEnemy("orc",    750, gY - 32, gY),
    mkEnemy("goblin", 950, gY - 28, gY),
    mkEnemy("goblin", 1050, gY - 28, gY),
    mkEnemy("orc",    1200, gY - 32, gY),
    mkEnemy("goblin", 1400, gY - 28, gY),
    mkEnemy("skeleton",1600, gY - 30, gY),
    mkEnemy("orc",    1800, gY - 32, gY),
    mkEnemy("skeleton",2000, gY - 30, gY),
    mkEnemy("goblin", 2200, gY - 28, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage2(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    // castle staircase-like platforms
    { x: 150, y: gY - 80, w: 110, h: 16, type: "platform" },
    { x: 320, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 490, y: gY - 240, w: 110, h: 16, type: "platform" },
    { x: 680, y: gY - 160, w: 130, h: 16, type: "platform" },
    { x: 860, y: gY - 80, w: 130, h: 16, type: "platform" },
    { x: 1050, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1230, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1420, y: gY - 170, w: 130, h: 16, type: "platform" },
    { x: 1620, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 1800, y: gY - 180, w: 100, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("skeleton", 280, gY - 30, gY),
    mkEnemy("orc",      500, gY - 32, gY),
    mkEnemy("skeleton", 700, gY - 30, gY),
    mkEnemy("orc",      900, gY - 32, gY),
    mkEnemy("skeleton", 1100, gY - 30, gY),
    mkEnemy("orc",      1300, gY - 32, gY),
    mkEnemy("skeleton", 1500, gY - 30, gY),
    mkEnemy("skeleton", 1700, gY - 30, gY),
    mkEnemy("orcBrute", 1850, gY, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage3(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("darklord", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Level 2: Laputa ─────────────────────────────────────────────────────────
function buildStage4(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 200, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 440, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 680, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 920, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 1150, y: gY - 100, w: 130, h: 16, type: "platform" },
    { x: 1400, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1650, y: gY - 110, w: 120, h: 16, type: "platform" },
    { x: 1900, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 2150, y: gY - 90, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("robot", 350, gY, gY),
    mkEnemy("robot", 550, gY, gY),
    mkEnemy("robot", 750, gY, gY),
    mkEnemy("robotElite", 950, gY, gY),
    mkEnemy("robot", 1150, gY, gY),
    mkEnemy("robot", 1350, gY, gY),
    mkEnemy("robotElite", 1550, gY, gY),
    mkEnemy("robot", 1750, gY, gY),
    mkEnemy("robot", 1950, gY, gY),
    mkEnemy("robotElite", 2150, gY, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage5(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 150, y: gY - 90, w: 110, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 110, h: 16, type: "platform" },
    { x: 510, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 700, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 890, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1100, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1290, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1480, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1700, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("robot", 300, gY, gY),
    mkEnemy("robotElite", 500, gY, gY),
    mkEnemy("robot", 700, gY, gY),
    mkEnemy("robot", 900, gY, gY),
    mkEnemy("robotElite", 1100, gY, gY),
    mkEnemy("robot", 1300, gY, gY),
    mkEnemy("robot", 1500, gY, gY),
    mkEnemy("robotElite", 1700, gY, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage6(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("muska", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Level 3: Heaven ─────────────────────────────────────────────────────────
function buildStage7(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 220, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 470, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 720, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 960, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 1200, y: gY - 100, w: 130, h: 16, type: "platform" },
    { x: 1450, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1700, y: gY - 110, w: 120, h: 16, type: "platform" },
    { x: 1950, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 2180, y: gY - 90, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("angel", 350, gY, gY),
    mkEnemy("angel", 550, gY, gY),
    mkEnemy("seraph", 750, gY, gY),
    mkEnemy("angel", 950, gY, gY),
    mkEnemy("angel", 1150, gY, gY),
    mkEnemy("seraph", 1350, gY, gY),
    mkEnemy("angel", 1550, gY, gY),
    mkEnemy("angel", 1750, gY, gY),
    mkEnemy("seraph", 1950, gY, gY),
    mkEnemy("angel", 2150, gY, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage8(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 160, y: gY - 90, w: 110, h: 16, type: "platform" },
    { x: 340, y: gY - 170, w: 110, h: 16, type: "platform" },
    { x: 520, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 710, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 900, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1110, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1300, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1490, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1710, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("angel", 300, gY, gY),
    mkEnemy("seraph", 500, gY, gY),
    mkEnemy("angel", 700, gY, gY),
    mkEnemy("angel", 900, gY, gY),
    mkEnemy("seraph", 1100, gY, gY),
    mkEnemy("angel", 1300, gY, gY),
    mkEnemy("seraph", 1500, gY, gY),
    mkEnemy("angel", 1700, gY, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage9(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("god", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Level 4: Deep Sea ───────────────────────────────────────────────────────
function buildStage10(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 210, y: gY - 90, w: 120, h: 16, type: "platform" },
    { x: 450, y: gY - 140, w: 110, h: 16, type: "platform" },
    { x: 690, y: gY - 80, w: 130, h: 16, type: "platform" },
    { x: 930, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 1160, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1410, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1660, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 1910, y: gY - 140, w: 110, h: 16, type: "platform" },
    { x: 2160, y: gY - 80, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("fishman", 350, gY - 34, gY),
    mkEnemy("fishman", 550, gY - 34, gY),
    mkEnemy("jellyfish", 750, gY - 30, gY),
    mkEnemy("fishman", 950, gY - 34, gY),
    mkEnemy("fishman", 1150, gY - 34, gY),
    mkEnemy("jellyfish", 1350, gY - 30, gY),
    mkEnemy("fishman", 1550, gY - 34, gY),
    mkEnemy("jellyfish", 1750, gY - 30, gY),
    mkEnemy("fishman", 1950, gY - 34, gY),
    mkEnemy("fishman", 2150, gY - 34, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage11(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 150, y: gY - 80, w: 110, h: 16, type: "platform" },
    { x: 330, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 510, y: gY - 240, w: 110, h: 16, type: "platform" },
    { x: 700, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 890, y: gY - 80, w: 130, h: 16, type: "platform" },
    { x: 1100, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1290, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1480, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1700, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("fishman", 300, gY - 34, gY),
    mkEnemy("jellyfish", 500, gY - 30, gY),
    mkEnemy("fishman", 700, gY - 34, gY),
    mkEnemy("fishman", 900, gY - 34, gY),
    mkEnemy("jellyfish", 1100, gY - 30, gY),
    mkEnemy("fishman", 1300, gY - 34, gY),
    mkEnemy("jellyfish", 1500, gY - 30, gY),
    mkEnemy("fishman", 1700, gY - 34, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage12(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("leviathan", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Level 5: Volcano ────────────────────────────────────────────────────────
function buildStage13(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 220, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 460, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 700, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 940, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 1170, y: gY - 100, w: 130, h: 16, type: "platform" },
    { x: 1420, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1670, y: gY - 110, w: 120, h: 16, type: "platform" },
    { x: 1920, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 2170, y: gY - 90, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("imp", 350, gY - 26, gY),
    mkEnemy("imp", 550, gY - 26, gY),
    mkEnemy("lavaGolem", 750, gY - 44, gY),
    mkEnemy("imp", 950, gY - 26, gY),
    mkEnemy("imp", 1150, gY - 26, gY),
    mkEnemy("lavaGolem", 1350, gY - 44, gY),
    mkEnemy("imp", 1550, gY - 26, gY),
    mkEnemy("imp", 1750, gY - 26, gY),
    mkEnemy("lavaGolem", 1950, gY - 44, gY),
    mkEnemy("imp", 2150, gY - 26, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage14(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 160, y: gY - 90, w: 110, h: 16, type: "platform" },
    { x: 340, y: gY - 170, w: 110, h: 16, type: "platform" },
    { x: 520, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 710, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 900, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1110, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1300, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1490, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1710, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("imp", 300, gY - 26, gY),
    mkEnemy("lavaGolem", 500, gY - 44, gY),
    mkEnemy("imp", 700, gY - 26, gY),
    mkEnemy("imp", 900, gY - 26, gY),
    mkEnemy("lavaGolem", 1100, gY - 44, gY),
    mkEnemy("imp", 1300, gY - 26, gY),
    mkEnemy("lavaGolem", 1500, gY - 44, gY),
    mkEnemy("imp", 1700, gY - 26, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage15(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("ifrit", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Level 6: Computer ───────────────────────────────────────────────────────
function buildStage16(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2400
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 200, y: gY - 100, w: 120, h: 16, type: "platform" },
    { x: 440, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 680, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 920, y: gY - 160, w: 110, h: 16, type: "platform" },
    { x: 1150, y: gY - 100, w: 130, h: 16, type: "platform" },
    { x: 1400, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1650, y: gY - 110, w: 120, h: 16, type: "platform" },
    { x: 1900, y: gY - 150, w: 110, h: 16, type: "platform" },
    { x: 2150, y: gY - 90, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("virus", 350, gY - 28, gY),
    mkEnemy("virus", 550, gY - 28, gY),
    mkEnemy("firewall", 750, gY - 44, gY),
    mkEnemy("virus", 950, gY - 28, gY),
    mkEnemy("virus", 1150, gY - 28, gY),
    mkEnemy("firewall", 1350, gY - 44, gY),
    mkEnemy("virus", 1550, gY - 28, gY),
    mkEnemy("virus", 1750, gY - 28, gY),
    mkEnemy("firewall", 1950, gY - 44, gY),
    mkEnemy("virus", 2150, gY - 28, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage17(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = 2000
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 150, y: gY - 90, w: 110, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 110, h: 16, type: "platform" },
    { x: 510, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 700, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 890, y: gY - 90, w: 130, h: 16, type: "platform" },
    { x: 1100, y: gY - 170, w: 120, h: 16, type: "platform" },
    { x: 1290, y: gY - 250, w: 110, h: 16, type: "platform" },
    { x: 1480, y: gY - 160, w: 120, h: 16, type: "platform" },
    { x: 1700, y: gY - 100, w: 120, h: 16, type: "platform" },
  ]
  const enemies: Enemy[] = [
    mkEnemy("virus", 300, gY - 28, gY),
    mkEnemy("firewall", 500, gY - 44, gY),
    mkEnemy("virus", 700, gY - 28, gY),
    mkEnemy("virus", 900, gY - 28, gY),
    mkEnemy("firewall", 1100, gY - 44, gY),
    mkEnemy("virus", 1300, gY - 28, gY),
    mkEnemy("firewall", 1500, gY - 44, gY),
    mkEnemy("virus", 1700, gY - 28, gY),
  ]
  return { platforms, enemies, stageWidth }
}

function buildStage18(): { platforms: Platform[]; enemies: Enemy[]; stageWidth: number } {
  const stageWidth = CANVAS_W   // single-screen boss arena
  const gY = GROUND_Y
  const platforms: Platform[] = [
    { x: 0, y: gY, w: stageWidth, h: 56, type: "ground" },
    { x: 60,  y: gY - 100, w: 100, h: 16, type: "platform" },
    { x: 330, y: gY - 170, w: 140, h: 16, type: "platform" },
    { x: 600, y: gY - 100, w: 100, h: 16, type: "platform" },
  ]
  const boss = mkBoss("ai", stageWidth / 2 - 32, gY - 64, gY)
  return { platforms, enemies: [boss], stageWidth }
}

// ─── Boss tuning ─────────────────────────────────────────────────────────────
/**
 * Boss HP ramp. Every level's boss has at least +20% HP over the previous one
 * (actual steps here are +50%, +44%, +31%, +29%, +27%).
 */
export const BOSS_HP: Record<BossKind, number> = {
  darklord: 300,
  muska: 450,
  god: 650,
  leviathan: 850,
  ifrit: 1100,
  ai: 1400,
}

/** Themed melee/cast flourish for every enemy type, matching its level theme. */
export const ENEMY_ATTACK_STYLE: Record<EnemyType, AttackStyle> = {
  goblin: "claw", orc: "axe", skeleton: "bone", orcBrute: "hammer",
  robot: "laser", robotElite: "rotor",
  angel: "holy", seraph: "featherslash",
  fishman: "trident", jellyfish: "shock",
  imp: "flame", lavaGolem: "magma",
  virus: "data", firewall: "grid",
  boss: "darkcast",
}

/** Themed cast flourish for each boss. */
export const BOSS_ATTACK_STYLE: Record<BossKind, AttackStyle> = {
  darklord: "darkcast",
  muska: "gunshot",
  god: "divinecast",
  leviathan: "tidecast",
  ifrit: "infernocast",
  ai: "systemcast",
}

/** Two-tone palette used by each enemy's attack FX so it reads as its level. */
export const ENEMY_FX_COLORS: Record<EnemyType, [string, string]> = {
  goblin: ["#4ade80", "#bbf7d0"],
  orc: ["#fb923c", "#fed7aa"],
  skeleton: ["#e2e8f0", "#94a3b8"],
  orcBrute: ["#f59e0b", "#fde68a"],
  robot: ["#38bdf8", "#e0f2fe"],
  robotElite: ["#93c5fd", "#ffffff"],
  angel: ["#fde68a", "#ffffff"],
  seraph: ["#fbbf24", "#fef3c7"],
  fishman: ["#38bdf8", "#7dd3fc"],
  jellyfish: ["#c084fc", "#f0abfc"],
  imp: ["#f97316", "#fef08a"],
  lavaGolem: ["#f97316", "#fbbf24"],
  virus: ["#22c55e", "#4ade80"],
  firewall: ["#ef4444", "#22d3ee"],
  boss: ["#a855f7", "#e9d5ff"],
}

export function bossFxColors(kind: BossKind): [string, string] {
  switch (kind) {
    case "muska": return ["#93c5fd", "#ffffff"]
    case "god": return ["#fbbf24", "#fef3c7"]
    case "leviathan": return ["#38bdf8", "#e0f2fe"]
    case "ifrit": return ["#f97316", "#fef08a"]
    case "ai": return ["#22d3ee", "#4ade80"]
    default: return ["#a855f7", "#e9d5ff"]
  }
}

function mkEnemy(type: EnemyType, x: number, y: number, groundY: number): Enemy {
  const sizes: Record<EnemyType, { w: number; h: number }> = {
    goblin:     { w: 24, h: 28 },
    orc:        { w: 30, h: 36 },
    skeleton:   { w: 24, h: 32 },
    boss:       { w: 64, h: 64 },
    orcBrute:   { w: 44, h: 48 },
    robot:      { w: 26, h: 34 },
    robotElite: { w: 38, h: 46 },
    angel:      { w: 26, h: 34 },
    seraph:     { w: 30, h: 38 },
    fishman:    { w: 26, h: 34 },
    jellyfish:  { w: 28, h: 30 },
    imp:        { w: 22, h: 26 },
    lavaGolem:  { w: 40, h: 44 },
    virus:      { w: 24, h: 28 },
    firewall:   { w: 34, h: 44 },
  }
  const hpMap: Record<EnemyType, number> = {
    goblin: 30, orc: 60, skeleton: 45, boss: BOSS_HP.darklord, orcBrute: 150,
    robot: 80, robotElite: 180, angel: 110, seraph: 140,
    fishman: 130, jellyfish: 90, imp: 100, lavaGolem: 240, virus: 120, firewall: 280,
  }
  const aggroMap: Record<EnemyType, number> = {
    goblin: 180, orc: 200, skeleton: 220, boss: 600, orcBrute: 280,
    robot: 320, robotElite: 320, angel: 260, seraph: 340,
    fishman: 260, jellyfish: 300, imp: 260, lavaGolem: 280, virus: 320, firewall: 280,
  }
  const attackMap: Record<EnemyType, number> = {
    goblin: 40, orc: 50, skeleton: 45, boss: 80, orcBrute: 75,
    robot: 240, robotElite: 240, angel: 55, seraph: 260,
    fishman: 55, jellyfish: 240, imp: 50, lavaGolem: 80, virus: 240, firewall: 75,
  }
  const s = sizes[type]
  const base: Enemy = {
    id: nextId(), type, x, y: y - s.h, w: s.w, h: s.h,
    vx: 0, vy: 0, onGround: true,
    hp: hpMap[type], maxHp: hpMap[type],
    facing: -1, animFrame: 0, animTimer: 0,
    state: "idle", hurtTimer: 0, hurtDir: 1, flashTimer: 0, deathTimer: 0, slowTimer: 0, attackTimer: 0,
    attackAnim: 0, attackAnimMax: 0, attackPhase: "windup",
    aggroRange: aggroMap[type], attackRange: attackMap[type],
    groundY, patrolDir: 1, patrolTimer: 60,
    phase: type === "boss" ? 1 : undefined,
    bossProjectileCooldown: type === "boss" ? 120 : undefined,
  }
  if (type === "robot") {
    base.ranged = true
    base.shots = 1
    base.flying = true
    base.flyBaseY = y
    base.flyY = y
    base.flyTimer = 0
    base.flyDir = 1
    base.diveTimer = 60
    base.diveAnim = 0
  }
  if (type === "robotElite") {
    base.ranged = true
    base.shots = 2
    base.specialCooldown = 220
    base.specialType = "slam"
    base.specialRadius = 120
    base.flying = true
    base.flyBaseY = y
    base.flyY = y
    base.flyTimer = 0
    base.flyDir = 1
    base.diveTimer = 80
    base.diveAnim = 0
  }
  if (type === "angel") {
    base.ranged = true
    base.shots = 1
    base.specialCooldown = 240
    base.specialType = "lightning"
    base.specialRadius = 120
  }
  if (type === "seraph") {
    base.ranged = true
    base.shots = 3
    base.specialCooldown = 300
    base.specialType = "lightning"
    base.specialRadius = 150
  }
  if (type === "jellyfish") {
    base.ranged = true
    base.shots = 1
    base.specialCooldown = 220
    base.specialType = "lightning"
    base.specialRadius = 120
  }
  if (type === "virus") {
    base.ranged = true
    base.shots = 2
    base.specialCooldown = 240
    base.specialType = "lightning"
    base.specialRadius = 130
  }
  if (type === "lavaGolem") {
    base.specialCooldown = 180
    base.specialType = "slam"
    base.specialRadius = 140
  }
  if (type === "firewall") {
    base.specialCooldown = 170
    base.specialType = "slam"
    base.specialRadius = 140
  }
  if (type === "boss") {
    base.bossKind = "darklord"
    base.specialCooldown = 240
    base.specialType = "poisonNova"
    base.specialRadius = 200
  }
  if (type === "orcBrute") {
    base.specialCooldown = 160
    base.specialType = "slam"
    base.specialRadius = 130
  }
  return base
}

function mkBoss(kind: BossKind, x: number, y: number, groundY: number): Enemy {
  const boss = mkEnemy("boss", x, y, groundY)
  boss.bossKind = kind
  if (kind === "muska") {
    boss.hp = boss.maxHp = BOSS_HP.muska
    boss.specialType = "airstrike"
    boss.specialRadius = 150
    boss.specialCooldown = 220
  } else if (kind === "god") {
    boss.hp = boss.maxHp = BOSS_HP.god
    boss.specialType = "holyNova"
    boss.specialRadius = 210
    boss.specialCooldown = 200
    boss.bossAttackPattern = 0
  } else if (kind === "leviathan") {
    boss.hp = boss.maxHp = BOSS_HP.leviathan
    boss.specialType = "poisonNova"
    boss.specialRadius = 210
    boss.specialCooldown = 200
  } else if (kind === "ifrit") {
    boss.hp = boss.maxHp = BOSS_HP.ifrit
    boss.specialType = "airstrike"
    boss.specialRadius = 180
    boss.specialCooldown = 190
  } else if (kind === "ai") {
    boss.hp = boss.maxHp = BOSS_HP.ai
    boss.specialType = "holyNova"
    boss.specialRadius = 210
    boss.specialCooldown = 180
    boss.bossAttackPattern = 0
  }
  return boss
}

function makeInitialPlayer(stage: Stage = "stage1", prevPlayer?: Player, element: ElementKind = "fire"): Player {
  const maxHp = maxHpForStage(stage)
  const maxEnergy = maxEnergyForStage(stage)
  // carry over HP on stage transition (capped to new maxHp), energy refills fully
  const hp = prevPlayer ? Math.min(prevPlayer.hp, maxHp) : maxHp
  return {
    x: 60, y: GROUND_Y - 48, w: 24, h: 40,
    vx: 0, vy: 0, onGround: false, facing: 1,
    hp, maxHp, energy: maxEnergy,
    animFrame: 0, animTimer: 0,
    state: "idle", hurtTimer: 0, hurtDir: 1, flashTimer: 0,
    castTimer: 0, castMax: 1, castSlot: 1,
    element,
  }
}

// ─── Physics helpers ──────────────────────────────────────────────────────────
function applyPlatformCollision(
  entity: { x: number; y: number; w: number; h: number; vy: number; onGround: boolean },
  platforms: Platform[],
  prevY: number,
) {
  entity.onGround = false
  for (const p of platforms) {
    if (
      entity.x + entity.w > p.x && entity.x < p.x + p.w &&
      entity.y + entity.h > p.y && entity.y + entity.h <= p.y + 20 &&
      prevY + entity.h <= p.y + 4 && entity.vy >= 0
    ) {
      entity.y = p.y - entity.h
      entity.vy = 0
      entity.onGround = true
    }
  }
}

// ─── Main Game Engine Hook ────────────────────────────────────────────────────
export function useGameEngine(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const testModeRef = useRef(false)
  const elementRef = useRef<ElementKind>("fire")
  const stateRef = useRef<GameState>(createInitialState("title"))
  const inputRef = useRef<InputState>({ left: false, right: false, jump: false, fire: false, skill2: false, skill3: false, comet: false, dash: false, jumpPressed: false, firePressed: false, skill2Pressed: false, skill3Pressed: false, cometPressed: false, dashPressed: false })
  const rafRef = useRef<number>(0)
  const [stage, setStage] = useState<Stage>("title")
  const [renderTick, setRenderTick] = useState(0)
  const [testMode, setTestMode] = useState(false)
  const [element, setElementState] = useState<ElementKind>("fire")

  // expose a shallow snapshot for React rendering
  const forceRender = useCallback(() => setRenderTick(t => t + 1), [])

  const setElement = useCallback((el: ElementKind) => {
    elementRef.current = el
    stateRef.current.element = el
    stateRef.current.player.element = el
    setElementState(el)
    forceRender()
  }, [forceRender])

  const setTestModeEnabled = useCallback((enabled: boolean) => {
    testModeRef.current = enabled
    stateRef.current.testMode = enabled
    setTestMode(enabled)
    forceRender()
  }, [forceRender])

  function createInitialState(s: Stage, prev?: GameState): GameState {
    const { platforms, enemies, stageWidth } =
      s === "stage1" ? buildStage1()
      : s === "stage2" ? buildStage2()
      : s === "stage3" ? buildStage3()
      : s === "stage4" ? buildStage4()
      : s === "stage5" ? buildStage5()
      : s === "stage6" ? buildStage6()
      : s === "stage7" ? buildStage7()
      : s === "stage8" ? buildStage8()
      : s === "stage9" ? buildStage9()
      : s === "stage10" ? buildStage10()
      : s === "stage11" ? buildStage11()
      : s === "stage12" ? buildStage12()
      : s === "stage13" ? buildStage13()
      : s === "stage14" ? buildStage14()
      : s === "stage15" ? buildStage15()
      : s === "stage16" ? buildStage16()
      : s === "stage17" ? buildStage17()
      : s === "stage18" ? buildStage18()
      : { platforms: [], enemies: [], stageWidth: CANVAS_W }
    return {
      stage: s,
      player: makeInitialPlayer(s, prev?.player, elementRef.current),
      enemies,
      fireballs: [],
      comets: [],
      platforms,
      particles: [],
      floatingTexts: [],
      potions: [],
      aoeEffects: [],
      attackFx: [],
      element: elementRef.current,
      skillCooldown: 0,
      skill2Cooldown: 0,
      skill3Cooldown: 0,
      cometCooldown: 0,
      dashCooldown: 0,
      exp: prev?.exp ?? 0,
      expToNext: prev?.expToNext ?? expForWeaponLevel(1),
      weaponLevel: prev?.weaponLevel ?? 1,
      lastFireTime: 0,
      lastEnergyRegen: 0,
      cameraX: 0,
      stageWidth,
      killCount: 0,
      totalEnemies: enemies.length,
      bossActivated: false,
      screenShake: 0,
      frameCount: 0,
      testMode: testModeRef.current,
    }
  }

  const startStage = useCallback((s: Stage, carryOverHp = false) => {
    stateRef.current = createInitialState(s, carryOverHp ? stateRef.current : undefined)
    setStage(s)
    forceRender()

    // Boss intro text
    const bossNames: Partial<Record<Stage, string>> = {
      stage3: "DARK LORD",
      stage6: "COLONEL MUSKA",
      stage9: "GOD",
      stage12: "LEVIATHAN",
      stage15: "IFRIT",
      stage18: "AI CORE",
    }
    const name = bossNames[s]
    if (name) {
      const gs = stateRef.current
      spawnFloatingText(gs, gs.player.x + 40, gs.player.y - 50, name, "#fbbf24")
    }
  }, [])

  // ─── Input setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const inp = inputRef.current
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")  { inp.left = true }
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") { inp.right = true }
      if (e.key === " " && !inp.jump) { inp.jump = true; inp.jumpPressed = true; e.preventDefault() }
      if ((e.key === "j" || e.key === "J" || e.key === "z" || e.key === "Z") && !inp.fire) { inp.fire = true; inp.firePressed = true }
      if ((e.key === "x" || e.key === "X") && !inp.skill2) { inp.skill2 = true; inp.skill2Pressed = true }
      if ((e.key === "c" || e.key === "C") && !inp.skill3) { inp.skill3 = true; inp.skill3Pressed = true }
      if ((e.key === "v" || e.key === "V" || e.key === "k" || e.key === "K") && !inp.comet) { inp.comet = true; inp.cometPressed = true }
      if (e.key === "Shift" && !inp.dash) { inp.dash = true; inp.dashPressed = true }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft")  { inp.left = false }
      if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") { inp.right = false }
      if (e.key === " ") { inp.jump = false }
      if (e.key === "j" || e.key === "J" || e.key === "z" || e.key === "Z") { inp.fire = false }
      if (e.key === "x" || e.key === "X") { inp.skill2 = false }
      if (e.key === "c" || e.key === "C") { inp.skill3 = false }
      if (e.key === "v" || e.key === "V" || e.key === "k" || e.key === "K") { inp.comet = false }
      if (e.key === "Shift") { inp.dash = false }
    }
    window.addEventListener("keydown", onDown)
    window.addEventListener("keyup", onUp)
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp) }
  }, [])

  // ─── Game Loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let lastTime = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(now - lastTime, 50)
      lastTime = now
      const gs = stateRef.current
      const inp = inputRef.current

      if (gs.stage !== "title" && gs.stage !== "win" && gs.stage !== "gameover") {
        update(gs, inp, dt)
      }

      draw(canvasRef.current, stateRef.current)
      inp.jumpPressed = false
      inp.firePressed = false
      inp.skill2Pressed = false
      inp.skill3Pressed = false
      inp.cometPressed = false
      inp.dashPressed = false
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [canvasRef])

  // ─── Update ──────────────────────────────────────────────────────────────────
  function update(gs: GameState, inp: InputState, dt: number) {
    gs.frameCount++
    const now = performance.now()

    // Screen shake decay
    if (gs.screenShake > 0) gs.screenShake = Math.max(0, gs.screenShake - 0.5)

    // Test mode: infinite energy, instant cooldowns, invincibility
    if (gs.testMode) {
      const maxEnergy = maxEnergyForStage(gs.stage)
      gs.player.energy = maxEnergy
      gs.player.hp = gs.player.maxHp
      gs.skillCooldown = 0
      gs.skill2Cooldown = 0
      gs.skill3Cooldown = 0
      gs.cometCooldown = 0
      gs.dashCooldown = 0
    } else {
      // Skill / dash cooldowns
      if (gs.skillCooldown > 0)  gs.skillCooldown  = Math.max(0, gs.skillCooldown  - dt)
      if (gs.skill2Cooldown > 0) gs.skill2Cooldown = Math.max(0, gs.skill2Cooldown - dt)
      if (gs.skill3Cooldown > 0) gs.skill3Cooldown = Math.max(0, gs.skill3Cooldown - dt)
      if (gs.cometCooldown > 0)  gs.cometCooldown  = Math.max(0, gs.cometCooldown  - dt)
      if (gs.dashCooldown > 0)   gs.dashCooldown    = Math.max(0, gs.dashCooldown    - dt)

      // Energy regen — stage-aware cap
      const maxEnergy = maxEnergyForStage(gs.stage)
      if (gs.player.energy < maxEnergy && now - gs.lastEnergyRegen >= ENERGY_REGEN_INTERVAL) {
        gs.player.energy = Math.min(maxEnergy, gs.player.energy + 1)
        gs.lastEnergyRegen = now
        spawnFloatingText(gs, gs.player.x, gs.player.y - 10, "+1 Energy", "#a78bfa")
      }
    }

    updatePlayer(gs, inp, now)
    updateEnemies(gs, now)
    updateFireballs(gs)
    updateComets(gs)
    updateAoeEffects(gs)
    updateAttackFx(gs)
    updatePotions(gs)
    updateParticles(gs)
    checkWinCondition(gs)
  }

  function updatePlayer(gs: GameState, inp: InputState, now: number) {
    const p = gs.player
    if (p.state === "dead") return

    // Hurt / flash / cast timers
    if (p.hurtTimer > 0) p.hurtTimer--
    if (p.flashTimer > 0) p.flashTimer--
    if (p.castTimer > 0) p.castTimer--

    const prevY = p.y

    // Horizontal movement
    p.vx = 0
    if (inp.left)  { p.vx = -PLAYER_SPEED; p.facing = -1 }
    if (inp.right) { p.vx =  PLAYER_SPEED; p.facing =  1 }

    // Jump
    if (inp.jumpPressed && p.onGround) {
      p.vy = JUMP_FORCE
      p.onGround = false
      spawnParticles(gs, p.x + p.w / 2, p.y + p.h, 4, "#86efac", 2)
    }

    // Dash
    if (inp.dashPressed && gs.dashCooldown <= 0 && p.castTimer <= 0) {
      gs.dashCooldown = 2000
      p.x = clamp(p.x + p.facing * 130, 0, gs.stageWidth - p.w)
      p.hurtTimer = Math.max(p.hurtTimer, 15)
      spawnParticles(gs, p.x + p.w / 2, p.y + p.h / 2, 12, "#c4b5fd", 4)
      spawnFloatingText(gs, p.x, p.y - 10, "DASH!", "#c4b5fd")
    }

    // Gravity
    p.vy = Math.min(p.vy + GRAVITY, 18)
    p.x += p.vx
    p.y += p.vy

    // World bounds
    p.x = clamp(p.x, 0, gs.stageWidth - p.w)
    if (p.y > CANVAS_H + 50) {
      // fell off
      if (!gs.testMode) p.hp = 0
      else {
        // Respawn player at ground in test mode
        p.y = GROUND_Y - p.h
        p.vy = 0
      }
    }

    // Platform collision
    const wasOnGround = p.onGround
    applyPlatformCollision(p, gs.platforms, prevY)
    if (!wasOnGround && p.onGround) {
      spawnParticles(gs, p.x + p.w / 2, p.y + p.h, 5, "#d6d3d1", 2)
    }

    // Camera follow
    const targetCX = p.x - CANVAS_W / 2 + p.w / 2
    gs.cameraX = clamp(targetCX, 0, gs.stageWidth - CANVAS_W)
    gs.cameraX += (Math.random() - 0.5) * gs.screenShake

    // ── Skills ───────────────────────────────────────────────────────────────
    // All four slots are shared by every element; the element decides what
    // each slot looks like, how much it costs and how hard it hits.
    const el = ELEMENTS[p.element]

    // Slot 1 — bolt (Z/J)
    const s1 = el.skills[0]
    if (inp.firePressed && gs.skillCooldown <= 0 && p.energy >= s1.cost && p.castTimer <= 0) {
      p.energy -= s1.cost
      gs.skillCooldown = s1.cooldown
      gs.lastEnergyRegen = now
      beginCast(p, 14, 1)
      castBolt(gs)
    }

    // Slot 2 — rain / wave / starfall (X)
    const s2 = el.skills[1]
    if (inp.skill2Pressed && hasSkill2Unlocked(gs.stage) && gs.skill2Cooldown <= 0 && p.energy >= s2.cost && p.castTimer <= 0) {
      p.energy -= s2.cost
      gs.skill2Cooldown = s2.cooldown
      gs.lastEnergyRegen = now
      beginCast(p, 22, 2)
      castRain(gs)
    }

    // Slot 3 — storm / maelstrom / nova (C)
    const s3 = el.skills[2]
    if (inp.skill3Pressed && hasSkill3Unlocked(gs.stage) && gs.skill3Cooldown <= 0 && p.energy >= s3.cost && p.castTimer <= 0) {
      p.energy -= s3.cost
      gs.skill3Cooldown = s3.cooldown
      gs.lastEnergyRegen = now
      beginCast(p, 30, 3)
      castStorm(gs)
    }

    // Slot 4 — comet / glacier / judgment (V/K)
    const s4 = el.skills[3]
    if (inp.cometPressed && hasSkill4Unlocked(gs.stage) && gs.cometCooldown <= 0 && p.energy >= s4.cost && p.castTimer <= 0) {
      p.energy -= s4.cost
      gs.cometCooldown = s4.cooldown
      gs.lastEnergyRegen = now
      beginCast(p, 38, 4)
      castHeavy(gs)
    }

    // Animate
    if (p.castTimer > 0) p.state = "cast"
    else if (p.hurtTimer > 0) p.state = "hurt"
    else if (!p.onGround) p.state = "jump"
    else if (p.vx !== 0) p.state = "run"
    else p.state = "idle"

    p.animTimer++
    if (p.animTimer >= 8) { p.animTimer = 0; p.animFrame = (p.animFrame + 1) % 4 }

    // Death
    if (p.hp <= 0) {
      p.state = "dead"
      p.hp = 0
      setTimeout(() => {
        stateRef.current.stage = "gameover"
        setStage("gameover")
        forceRender()
      }, 1200)
    }
  }

  function updateEnemies(gs: GameState, now: number) {
    const p = gs.player
    for (const e of gs.enemies) {
      if (e.state === "dead") { if (e.deathTimer > 0) e.deathTimer--; continue }
      if (e.hurtTimer > 0) e.hurtTimer--
      if (e.flashTimer > 0) e.flashTimer--
      if (e.slowTimer > 0) e.slowTimer--

      const prevY = e.y
      const dx = p.x + p.w / 2 - (e.x + e.w / 2)
      const dist = Math.abs(dx)

      // Boss phase 2
      if (e.type === "boss" && e.phase === 1 && e.hp <= e.maxHp / 2) {
        e.phase = 2
        gs.screenShake = 12
        const name = e.bossKind === "muska" ? "MUSKA ENRAGED"
          : e.bossKind === "god" ? "GOD AWAKENS"
          : e.bossKind === "leviathan" ? "LEVIATHAN ENRAGED"
          : e.bossKind === "ifrit" ? "IFRIT BURNS"
          : e.bossKind === "ai" ? "AI OVERCLOCKED"
          : "PHASE 2!"
        spawnFloatingText(gs, e.x, e.y - 20, name, "#ef4444")
        spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, 20, "#ef4444", 5)
      }

      // Special AOE / skills
      let isCastingSpecial = false
      if (e.specialCooldown !== undefined) {
        if (e.specialTelegraph !== undefined && e.specialTelegraph > 0) {
          isCastingSpecial = true
          e.specialTelegraph--
          e.vx = 0
          e.state = "attack"
          e.facing = dx > 0 ? 1 : -1
        } else {
          e.specialCooldown--
          if (e.specialCooldown <= 0 && dist < (e.specialRadius || 250) && p.state !== "dead") {
            startEnemySpecial(gs, e)
          }
        }
      }

      // Aggro / patrol logic
      if (!isCastingSpecial) {
        if (dist < e.aggroRange && p.state !== "dead") {
          e.facing = dx > 0 ? 1 : -1
          if (e.ranged && dist <= e.attackRange) {
            if (e.flying && (e.type === "robot" || e.type === "robotElite")) {
              // Flying robot attack: hover + occasional dive-bomb
              e.flyTimer = (e.flyTimer || 0) + 1
              const hoverAmp = e.type === "robotElite" ? 18 : 12
              const hoverSpeed = e.type === "robotElite" ? 0.08 : 0.06
              e.state = "attack"

              // Dive logic
              const diveRate = e.type === "robotElite" ? 140 : 100
              const diveDuration = e.type === "robotElite" ? 45 : 35
              if ((e.diveAnim || 0) > 0) {
                // Currently diving
                e.diveAnim!--
                e.vx = e.facing * 4
                if (e.onGround) {
                  e.diveAnim = 0
                  e.vy = -6 // bounce back up
                }
              } else {
                // Hover in place
                e.flyY = (e.flyBaseY || e.y) + Math.sin((e.flyTimer || 0) * hoverSpeed) * hoverAmp
                e.y = e.flyY
                e.vx = e.facing * 0.6
                e.vy = 0
                if ((e.diveTimer || 0) <= 0) {
                  e.diveTimer = diveRate
                  e.diveAnim = diveDuration
                  e.vy = 8
                  spawnFloatingText(gs, e.x, e.y - 20, "DIVE!", "#93c5fd")
                }
                e.diveTimer = (e.diveTimer || 0) - 1
              }

              // Shoot while flying
              if (e.attackAnim <= 0) {
                e.attackPhase = "windup"
                e.attackAnim = 25
                e.attackAnimMax = 25
              }
              e.attackAnim--
              if (e.attackPhase === "windup" && e.attackAnim <= 0) {
                e.attackPhase = "recover"
                e.attackAnim = 35
                e.attackAnimMax = 35
                shootEnemyProjectile(gs, e)
              } else if (e.attackPhase === "recover" && e.attackAnim <= 0) {
                e.attackPhase = "windup"
                e.attackAnim = 0
              }
            } else {
              // Ranged enemy: stand still and shoot with wind-up animation
              e.vx = 0
              e.state = "attack"
              const windup = e.type === "seraph" ? 45 : 35
              const recover = e.type === "seraph" ? 45 : 45
              if (e.attackAnim <= 0) {
                e.attackPhase = "windup"
                e.attackAnim = windup
                e.attackAnimMax = windup
              }
              e.attackAnim--
              if (e.attackPhase === "windup" && e.attackAnim <= 0) {
                e.attackPhase = "recover"
                e.attackAnim = recover
                e.attackAnimMax = recover
                shootEnemyProjectile(gs, e)
              } else if (e.attackPhase === "recover" && e.attackAnim <= 0) {
                e.attackPhase = "windup"
                e.attackAnim = 0
              }
            }
          } else if (dist > e.attackRange) {
            // Walk/fly toward player
            const baseSpd = e.type === "boss" ? (e.phase === 2 ? 2.8 : 1.8)
              : e.type === "angel" ? 2.4
              : e.type === "orc" ? 1.4
              : e.type === "robot" || e.type === "robotElite" ? 1.1
              : e.type === "seraph" ? 1.4
              : e.type === "imp" ? 2.6
              : e.type === "fishman" ? 2.0
              : e.type === "lavaGolem" || e.type === "firewall" ? 1.2
              : 1.8
            e.vx = e.facing * baseSpd * (e.hurtTimer > 0 ? 0.3 : 1) * (e.slowTimer > 0 ? 0.45 : 1)
            e.state = "walk"
            e.attackAnim = 0
            e.attackPhase = "windup"
            e.diveAnim = 0
            // Flying robots hover while approaching
            if (e.flying && (e.type === "robot" || e.type === "robotElite")) {
              e.flyTimer = (e.flyTimer || 0) + 1
              const hoverAmp = e.type === "robotElite" ? 14 : 10
              const hoverSpeed = e.type === "robotElite" ? 0.07 : 0.05
              e.flyY = (e.flyBaseY || e.y) + Math.sin((e.flyTimer || 0) * hoverSpeed) * hoverAmp
              e.y = e.flyY
              e.vy = 0
            }
          } else {
            // Melee attack with windup / strike / recover animation
            e.vx = 0
            e.state = "attack"

            const windup = e.type === "boss" ? (e.phase === 2 ? 35 : 55)
              : e.type === "orcBrute" ? 45
              : e.type === "orc" ? 35
              : e.type === "angel" ? 28
              : e.type === "lavaGolem" ? 50
              : e.type === "firewall" ? 40
              : e.type === "fishman" ? 32
              : e.type === "imp" ? 24
              : 30
            const recover = e.type === "boss" ? (e.phase === 2 ? 25 : 35)
              : e.type === "orcBrute" ? 40
              : e.type === "orc" ? 35
              : e.type === "angel" ? 30
              : e.type === "lavaGolem" ? 45
              : e.type === "firewall" ? 38
              : e.type === "fishman" ? 30
              : e.type === "imp" ? 26
              : 30
            const dmg = e.type === "boss" ? (e.phase === 2 ? 18 : 12)
              : e.type === "orcBrute" ? 15
              : e.type === "orc" ? 12
              : e.type === "angel" ? 14
              : e.type === "lavaGolem" ? 17
              : e.type === "firewall" ? 15
              : e.type === "fishman" ? 12
              : e.type === "imp" ? 10
              : 8

            if (e.attackAnim <= 0) {
              // Start a new attack cycle
              e.attackPhase = "windup"
              e.attackAnim = windup
              e.attackAnimMax = windup
            }

            e.attackAnim--

            if (e.attackPhase === "windup") {
              if (e.attackAnim <= 0) {
                // STRIKE!
                e.attackPhase = "recover"
                e.attackAnim = recover
                e.attackAnimMax = recover
                // Themed swing animation fires whether or not the blow lands
                const [fxA, fxB] = e.type === "boss"
                  ? bossFxColors(e.bossKind ?? "darklord")
                  : ENEMY_FX_COLORS[e.type]
                const style = e.type === "boss"
                  ? BOSS_ATTACK_STYLE[e.bossKind ?? "darklord"]
                  : ENEMY_ATTACK_STYLE[e.type]
                spawnAttackFx(
                  gs,
                  e.x + e.w / 2 + e.facing * (e.w * 0.7),
                  e.y + e.h * 0.45,
                  e.facing, style, fxA, fxB,
                  e.type === "boss" ? 2.2 : e.w / 26,
                )
                const verticalDiff = Math.abs((p.y + p.h) - (e.y + e.h))
                if (!gs.testMode && p.hurtTimer <= 0 && p.hp > 0 && verticalDiff < 80) {
                  hurtPlayer(gs, dmg, e.x + e.w / 2, fxA, e.type === "boss" ? 7 : 3)
                  p.vy = -5
                }
              }
            } else if (e.attackPhase === "recover") {
              if (e.attackAnim <= 0) {
                e.attackPhase = "windup"
                e.attackAnim = 0
              }
            }
          }

          // Boss volleys (any range within aggro)
          if (e.type === "boss" && e.bossProjectileCooldown !== undefined) {
            e.bossProjectileCooldown--
            if (e.bossProjectileCooldown <= 0) {
              const baseShots = e.bossKind === "muska" ? 3 : e.bossKind === "god" ? 3 : e.bossKind === "ai" ? 4 : e.bossKind === "ifrit" ? 3 : e.bossKind === "leviathan" ? 2 : 1
              const shots = e.phase === 2 ? baseShots + 2 : baseShots
              const spd = e.bossKind === "muska" ? 6 : e.bossKind === "ai" ? 6 : e.bossKind === "ifrit" || e.bossKind === "leviathan" ? 5 : 4.5
              const w = e.bossKind === "muska" ? 8 : e.bossKind === "ai" ? 8 : 12
              const h = e.bossKind === "muska" ? 6 : e.bossKind === "ai" ? 8 : 12
              const bulletType = e.bossKind === "ai" ? "robotBullet" as const : "enemy" as const
              const px = p.x + p.w / 2, py = p.y + p.h / 2
              const ex = e.x + e.w / 2, ey = e.y + e.h / 3
              const baseAngle = Math.atan2(py - ey, px - ex)
              for (let i = 0; i < shots; i++) {
                const angle = shots > 1 ? baseAngle + (i - (shots - 1) / 2) * 0.25 : baseAngle
                gs.fireballs.push({
                  id: nextId(), x: ex, y: ey, w, h,
                  vx: Math.cos(angle) * spd,
                  vy: Math.sin(angle) * spd,
                  fromPlayer: false, active: true,
                  type: bulletType, frame: i,
                })
              }
              e.bossProjectileCooldown = e.phase === 2 ? 70 : 120
            }
          }
        } else {
          // Patrol
          e.patrolTimer--
          if (e.patrolTimer <= 0) {
            e.patrolDir = e.patrolDir === 1 ? -1 : 1
            e.patrolTimer = 80 + Math.floor(Math.random() * 60)
          }
          e.vx = e.patrolDir * 0.8
          e.facing = e.patrolDir
          e.state = "walk"
          e.attackAnim = 0
          e.attackPhase = "windup"
        }
      }

      // Gravity
      const isFlyingRobot = e.flying && (e.type === "robot" || e.type === "robotElite")
      if (isFlyingRobot) {
        e.vy = e.vy * 0.85 // dampen vertical momentum
        // Floor bounce so flying robots don't disappear underground
        if (e.y > GROUND_Y - 10) {
          e.y = GROUND_Y - 10
          e.vy = -6
        }
      } else {
        e.vy = Math.min(e.vy + GRAVITY, 18)
      }
      e.x += e.vx
      e.y += e.vy
      e.x = clamp(e.x, 0, gs.stageWidth - e.w)
      if (!isFlyingRobot) {
        applyPlatformCollision(e, gs.platforms, prevY)
      }

      // Animate
      e.animTimer++
      const rate = e.type === "boss" ? 10 : 8
      if (e.animTimer >= rate) { e.animTimer = 0; e.animFrame = (e.animFrame + 1) % 4 }
    }
  }

  function startEnemySpecial(gs: GameState, e: Enemy) {
    const p = gs.player
    if (e.type === "boss" && (e.bossKind === "god" || e.bossKind === "ai")) {
      e.bossAttackPattern = ((e.bossAttackPattern ?? 0) + 1) % 4
    }

    let label = ""
    let color = "#ef4444"
    let radius = e.specialRadius || 140
    let duration = 90
    let damage = 25
    let follow = false
    let hazard = false
    let hazardRadius = 90, hazardDuration = 240, hazardDamage = 8, hazardColor = "#7e22ce"
    let cooldown = 240
    let lightning = false
    const specialType = e.specialType ?? "slam"

    if (e.type === "boss") {
      if (e.bossKind === "darklord") {
        label = "POISON NOVA!"
        color = "#a855f7"
        radius = 200
        damage = e.phase === 2 ? 35 : 25
        hazard = true
        cooldown = e.phase === 2 ? 260 : 360
      } else if (e.bossKind === "muska") {
        label = "AIR STRIKE!"
        color = "#93c5fd"
        radius = 150
        damage = 30
        follow = true
        duration = 100
        cooldown = 280
      } else if (e.bossKind === "god") {
        const pattern = e.bossAttackPattern ?? 0
        if (pattern === 0) {
          label = "HOLY NOVA!"
          color = "#fde68a"
          radius = 210
          damage = e.phase === 2 ? 40 : 30
          hazard = true
          hazardColor = "#f59e0b"
          cooldown = 260
        } else if (pattern === 1) {
          label = "DIVINE BEAM!"
          color = "#fbbf24"
          radius = 110
          damage = 35
          follow = true
          duration = 80
          cooldown = 240
        } else if (pattern === 2) {
          label = "FEATHER STORM!"
          color = "#e9d5ff"
          cooldown = 280
        } else {
          label = "DIVINE LIGHTNING!"
          color = "#22d3ee"
          radius = 180
          damage = e.phase === 2 ? 45 : 35
          follow = true
          duration = 70
          cooldown = 260
          lightning = true
        }
      } else if (e.bossKind === "leviathan") {
        label = "ABYSSAL NOVA!"
        color = "#38bdf8"
        radius = 210
        damage = e.phase === 2 ? 40 : 30
        hazard = true
        hazardColor = "#0ea5e9"
        cooldown = e.phase === 2 ? 240 : 320
      } else if (e.bossKind === "ifrit") {
        label = "ERUPTION!"
        color = "#f97316"
        radius = 180
        damage = e.phase === 2 ? 45 : 35
        follow = true
        duration = 90
        hazard = true
        hazardColor = "#dc2626"
        hazardDamage = 10
        cooldown = e.phase === 2 ? 220 : 280
      } else if (e.bossKind === "ai") {
        const pattern = e.bossAttackPattern ?? 0
        if (pattern === 0) {
          label = "VIRUS NOVA!"
          color = "#4ade80"
          radius = 210
          damage = e.phase === 2 ? 40 : 30
          hazard = true
          hazardColor = "#16a34a"
          cooldown = 240
        } else if (pattern === 1) {
          label = "DATA BEAM!"
          color = "#22d3ee"
          radius = 110
          damage = 35
          follow = true
          duration = 80
          cooldown = 220
        } else if (pattern === 2) {
          label = "GLITCH STORM!"
          color = "#4ade80"
          cooldown = 260
        } else {
          label = "SYSTEM LIGHTNING!"
          color = "#22d3ee"
          radius = 180
          damage = e.phase === 2 ? 45 : 35
          follow = true
          duration = 70
          cooldown = 240
          lightning = true
        }
      }
    } else if (specialType === "slam") {
      label = "GROUND SLAM!"
      color = "#ef4444"
      radius = e.specialRadius || 130
      damage = e.type === "robotElite" ? 30 : 25
      cooldown = e.type === "robotElite" ? 260 : 220
    } else if (specialType === "skybeam") {
      label = "HOLY BEAM!"
      color = "#fbbf24"
      radius = e.specialRadius || 90
      damage = 20
      follow = true
      duration = 80
      cooldown = 320
    } else if (specialType === "lightning") {
      label = "LIGHTNING!"
      color = "#22d3ee"
      radius = e.specialRadius || 120
      damage = e.type === "seraph" ? 28 : 22
      follow = true
      duration = 70
      cooldown = e.type === "seraph" ? 280 : 240
      lightning = true
    }

    const isStormRain = label === "FEATHER STORM!" || label === "GLITCH STORM!"
    e.specialTelegraph = isStormRain ? 30 : duration
    e.specialCooldown = cooldown
    const ex = e.x + e.w / 2
    const ey = e.y + e.h / 2

    if (isStormRain) {
      featherRain(gs, e)
    } else {
      gs.aoeEffects.push({
        id: nextId(),
        x: follow ? p.x + p.w / 2 : ex,
        y: follow ? p.y + p.h / 2 : ey,
        radius,
        type: "telegraph",
        timer: duration,
        maxTimer: duration,
        color,
        damage,
        followPlayer: follow,
        spawnHazard: hazard,
        hazardRadius,
        hazardDuration,
        hazardDamage,
        hazardColor,
        lightning,
      })
    }
    spawnFloatingText(gs, e.x, e.y - 24, label, color)
    // Themed cast flourish on the caster
    const castStyle = e.type === "boss"
      ? BOSS_ATTACK_STYLE[e.bossKind ?? "darklord"]
      : ENEMY_ATTACK_STYLE[e.type]
    const [cA, cB] = e.type === "boss" ? bossFxColors(e.bossKind ?? "darklord") : ENEMY_FX_COLORS[e.type]
    spawnAttackFx(gs, ex, ey, e.facing, castStyle, color || cA, cB, e.type === "boss" ? 2.8 : 1.4, 40)
  }

  function shootEnemyProjectile(gs: GameState, e: Enemy) {
    const p = gs.player
    const px = p.x + p.w / 2, py = p.y + p.h / 2
    const ex = e.x + e.w / 2, ey = e.y + e.h / 3
    const baseAngle = Math.atan2(py - ey, px - ex)
    const shots = e.shots || 1
    const spd = e.type === "robotElite" ? 4 : e.type === "seraph" || e.type === "virus" ? 3.5 : 3
    const bulletType = e.type === "robot" || e.type === "robotElite" || e.type === "virus" ? "robotBullet" : "enemy"
    const style = ENEMY_ATTACK_STYLE[e.type]
    const [fxA, fxB] = ENEMY_FX_COLORS[e.type]
    for (let i = 0; i < shots; i++) {
      const angle = shots > 1 ? baseAngle + (i - (shots - 1) / 2) * 0.22 : baseAngle
      gs.fireballs.push({
        id: nextId(), x: ex, y: ey, w: 10, h: 10,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        fromPlayer: false, active: true,
        type: bulletType, frame: i,
        enemyStyle: style,
      })
    }
    // Muzzle / channel flourish, themed to the enemy's level
    spawnAttackFx(gs, ex + e.facing * (e.w * 0.6), ey, e.facing, style, fxA, fxB, e.w / 30)
    spawnParticles(gs, ex, ey, 4, fxA, 2)
  }

  function featherRain(gs: GameState, e: Enemy) {
    const p = gs.player
    for (let i = 0; i < 10; i++) {
      const ox = (Math.random() - 0.5) * 260
      const x = clamp(p.x + p.w / 2 + ox, 20, gs.stageWidth - 20)
      gs.fireballs.push({
        id: nextId(), x, y: -20,
        w: 10, h: 16,
        vx: 0, vy: 4 + Math.random() * 2,
        fromPlayer: false, active: true,
        type: "enemy", frame: i,
      })
    }
    spawnParticles(gs, p.x + p.w / 2, p.y, 18, "#e9d5ff", 5)
    gs.screenShake = 6
  }

  function updateAoeEffects(gs: GameState) {
    const p = gs.player
    for (const fx of gs.aoeEffects) {
      fx.timer--
      if (fx.type === "telegraph") {
        if (fx.followPlayer) {
          fx.x = p.x + p.w / 2
          fx.y = p.y + p.h / 2
        }
        if (fx.timer <= 0) {
          // Detonate: burst visual
          gs.aoeEffects.push({
            id: nextId(), x: fx.x, y: fx.y, radius: fx.radius,
            type: "burst", timer: 30, maxTimer: 30, color: fx.color,
          })
          spawnParticles(gs, fx.x, fx.y, 24, fx.color, 6)
          spawnAttackFx(gs, fx.x, fx.y, 1, fx.lightning ? "shock" : "hurt", fx.color, "#ffffff", fx.radius / 60, 18)
          gs.screenShake = fx.radius > 150 ? 10 : 7
          // Damage player if inside (skip in test mode)
          if (!gs.testMode && p.hurtTimer <= 0 && p.hp > 0 && p.state !== "dead") {
            const px = p.x + p.w / 2, py = p.y + p.h / 2
            const d = Math.sqrt((px - fx.x) ** 2 + (py - fx.y) ** 2)
            if (d <= fx.radius + Math.max(p.w, p.h) / 2) {
              hurtPlayer(gs, fx.damage || 25, fx.x, fx.color, 8)
            }
          }
          // Lingering hazard pool
          if (fx.spawnHazard) {
            gs.aoeEffects.push({
              id: nextId(),
              x: fx.x, y: fx.y,
              radius: fx.hazardRadius || fx.radius * 0.6,
              type: "hazard",
              timer: fx.hazardDuration || 240,
              maxTimer: fx.hazardDuration || 240,
              color: fx.hazardColor || "#7e22ce",
              damage: fx.hazardDamage || 8,
              tickTimer: fx.tickInterval || 40,
              tickInterval: fx.tickInterval || 40,
            })
          }
        }
      } else if (fx.type === "hazard" && fx.playerOwned) {
        // Player-made hazard: keeps burning / freezing / searing enemies inside it
        if (fx.tickTimer !== undefined) fx.tickTimer--
        if (fx.tickTimer !== undefined && fx.tickTimer <= 0) {
          damageEnemiesAt(gs, fx.x, fx.y, fx.radius, fx.damage || 8, fx.color)
          fx.tickTimer = fx.tickInterval || 40
        }
      } else if (fx.type === "hazard") {
        if (fx.tickTimer !== undefined) fx.tickTimer--
        if (!gs.testMode && fx.tickTimer !== undefined && fx.tickTimer <= 0 && p.hurtTimer <= 0 && p.hp > 0 && p.state !== "dead") {
          const px = p.x + p.w / 2
          const py = p.y + p.h / 2
          const d = Math.sqrt((px - fx.x) ** 2 + (py - fx.y) ** 2)
          if (d <= fx.radius + Math.max(p.w, p.h) / 2) {
            const dmg = fx.damage || 8
            p.hp = Math.max(0, p.hp - dmg)
            p.hurtTimer = 25
            spawnFloatingText(gs, p.x, p.y - 10, `-${dmg}`, fx.color)
            spawnParticles(gs, px, py, 6, fx.color, 3)
          }
          fx.tickTimer = fx.tickInterval || 40
        }
      }
    }
    gs.aoeEffects = gs.aoeEffects.filter(fx => fx.timer > 0)
  }

  const EXP_MAP: Record<EnemyType, number> = {
    goblin: 10, orc: 20, skeleton: 15, boss: 100, orcBrute: 50,
    robot: 25, robotElite: 60, angel: 30, seraph: 45,
    fishman: 35, jellyfish: 30, imp: 30, lavaGolem: 70, virus: 40, firewall: 80,
  }

  /**
   * EXP is the weapon track: filling the bar raises the weapon level, and every
   * weapon level adds flat damage to all four of the element's skills.
   */
  function grantExp(gs: GameState, type: EnemyType) {
    if (gs.weaponLevel >= MAX_WEAPON_LEVEL) { gs.exp = gs.expToNext; return }
    gs.exp += EXP_MAP[type]
    while (gs.exp >= gs.expToNext && gs.weaponLevel < MAX_WEAPON_LEVEL) {
      gs.exp -= gs.expToNext
      gs.weaponLevel++
      gs.expToNext = expForWeaponLevel(gs.weaponLevel)
      spawnFloatingText(gs, gs.player.x, gs.player.y - 40, `WEAPON LV ${gs.weaponLevel}!`, "#fbbf24")
      spawnParticles(gs, gs.player.x + 12, gs.player.y + 20, 24, "#fbbf24", 6)
    }
    if (gs.weaponLevel >= MAX_WEAPON_LEVEL) gs.exp = gs.expToNext
  }

  /** Roll a health potion drop where an enemy fell. */
  function dropPotion(gs: GameState, e: Enemy) {
    if (e.type === "boss" || Math.random() >= 0.5) return
    gs.potions.push({
      id: nextId(),
      x: e.x + e.w / 2 - 6,
      y: e.groundY - 16,
      w: 12, h: 16,
      bobOffset: Math.random() * Math.PI * 2,
      active: true,
    })
  }

  /**
   * Single entry point for hurting an enemy. Drives the hurt animation
   * (flash + recoil + knock-back direction) and the death dissolve.
   */
  function damageEnemy(gs: GameState, e: Enemy, dmg: number, color: string, fromX?: number, slowFrames = 0) {
    if (e.state === "dead") return
    e.hp -= dmg
    const src = fromX ?? gs.player.x + gs.player.w / 2
    e.hurtDir = src <= e.x + e.w / 2 ? 1 : -1
    e.hurtTimer = 18
    e.flashTimer = 10
    e.state = "hurt"
    if (slowFrames > 0) e.slowTimer = Math.max(e.slowTimer, slowFrames)
    spawnFloatingText(gs, e.x, e.y - 12, `-${dmg}`, "#fbbf24")
    spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, 10, color, 4)
    // Impact spark on the struck side
    spawnAttackFx(gs, e.x + e.w / 2 - e.hurtDir * (e.w / 2), e.y + e.h / 2, e.hurtDir, "hurt", color, "#ffffff", 0.8 + e.w / 60)

    if (e.hp <= 0) {
      e.hp = 0
      e.state = "dead"
      e.deathTimer = 26
      gs.killCount++
      grantExp(gs, e.type)
      spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, e.type === "boss" ? 40 : 20, "#fbbf24", 5)
      spawnFloatingText(gs, e.x, e.y - 20, e.type === "boss" ? "BOSS SLAIN!" : "+EXP", "#22c55e")
      dropPotion(gs, e)
    }
  }

  /** Damage every living enemy inside a circle. */
  function damageEnemiesAt(gs: GameState, cx: number, cy: number, radius: number, dmg: number, color: string, slowFrames = 0) {
    for (const e of gs.enemies) {
      if (e.state === "dead") continue
      const ex = e.x + e.w / 2
      const ey = e.y + e.h / 2
      if (Math.sqrt((ex - cx) ** 2 + (ey - cy) ** 2) <= radius) {
        damageEnemy(gs, e, dmg, color, cx, slowFrames)
      }
    }
  }

  /** AOE centred on the wizard (used by skill slots 2 and 3). */
  function applyAoeDamage(gs: GameState, dmg: number, radius: number, color: string) {
    const p = gs.player
    const slow = ELEMENTS[p.element].slowFrames
    damageEnemiesAt(gs, p.x + p.w / 2, p.y + p.h / 2, radius, dmg, color, slow)
    gs.screenShake = Math.max(gs.screenShake, 6)
  }

  // ── Player skill casts (element-driven) ──────────────────────────────────
  function beginCast(p: Player, frames: number, slot: 1 | 2 | 3 | 4) {
    p.castTimer = frames
    p.castMax = frames
    p.castSlot = slot
    p.state = "cast"
  }

  /** Slot 1 — a travelling bolt. Fire burns, water chills, light pierces. */
  function castBolt(gs: GameState) {
    const p = gs.player
    const el = ELEMENTS[p.element]
    const wl = gs.weaponLevel
    const w = 14 + Math.min(wl - 1, 5) * 3
    const h = 12 + Math.min(wl - 1, 5) * 2
    const x = p.facing === 1 ? p.x + p.w + 8 : p.x - w - 8
    const y = p.y + 10
    gs.fireballs.push({
      id: nextId(), x, y, w, h,
      vx: el.boltSpeed * p.facing, vy: 0,
      fromPlayer: true, active: true,
      type: "fireball", frame: 0,
      element: p.element,
      pierce: el.pierce,
      hitIds: [],
    })
    spawnParticles(gs, x, p.y + p.h / 2, 6, el.colors.primary, 2)
    // Muzzle flourish on the wand, themed to the element
    spawnAttackFx(gs, x, y + h / 2, p.facing, el.castFx, el.colors.primary, el.colors.core, 1)
  }

  /** Slot 2 — falling projectiles + an instant area hit around the wizard. */
  function castRain(gs: GameState) {
    const p = gs.player
    const el = ELEMENTS[p.element]
    const wl = gs.weaponLevel
    const c = el.colors
    const cx = p.x + p.w / 2
    const count = 8 + Math.min(wl - 1, 4)
    const skill = el.skills[1]
    const spread = skill.radius * 0.9

    for (let i = 0; i < count; i++) {
      const ox = (i / (count - 1)) * spread - spread / 2
      gs.fireballs.push({
        id: nextId(),
        x: cx + ox, y: p.y - 60 - Math.random() * 30,
        w: 10, h: 14,
        vx: ox * 0.02, vy: 5 + Math.random() * 2,
        fromPlayer: true, active: true,
        type: "rain", frame: Math.floor(Math.random() * 4),
        element: p.element, hitIds: [],
      })
    }
    spawnParticles(gs, cx, p.y, 32, c.secondary, 6)
    spawnFloatingText(gs, p.x, p.y - 28, skill.name + "!", c.primary)
    spawnAttackFx(gs, cx, p.y + p.h / 2, p.facing, el.castFx, c.primary, c.core, 2.2)
    applyAoeDamage(gs, skillDamage(p.element, 2, wl), skill.radius, c.secondary)
  }

  /** Slot 3 — a spiralling storm of orbiting projectiles. */
  function castStorm(gs: GameState) {
    const p = gs.player
    const el = ELEMENTS[p.element]
    const c = el.colors
    const wl = gs.weaponLevel
    const skill = el.skills[2]
    const cx = p.x + p.w / 2
    const cy = p.y + p.h / 2
    const baseCount = wl >= 3 ? 16 : 12
    const waves = wl >= 3 ? 5 : 4
    const spinSpeed = 0.12
    const expandSpeed = 2.4 + Math.min(wl - 1, 5) * 0.3

    for (let w = 0; w < waves; w++) {
      const waveOffset = (w / waves) * Math.PI * 2
      for (let i = 0; i < baseCount; i++) {
        const angle = (i / baseCount) * Math.PI * 2 + waveOffset
        gs.fireballs.push({
          id: nextId(),
          x: cx, y: cy,
          w: 10 + Math.min(wl - 1, 4) * 2,
          h: 10 + Math.min(wl - 1, 4) * 2,
          vx: 0, vy: 0,
          fromPlayer: true, active: true,
          type: "typhoon", frame: i,
          element: p.element, hitIds: [],
          angle,
          radius: 12 + w * 14,
          spinSpeed: spinSpeed + (i % 2 === 0 ? 0.02 : -0.02),
          expandSpeed: expandSpeed + w * 0.3,
          originX: cx, originY: cy,
          typhoonWave: w,
        })
      }
    }

    gs.aoeEffects.push({
      id: nextId(), x: cx, y: cy, radius: 60,
      type: "burst", timer: 40, maxTimer: 40, color: c.primary,
    })
    spawnParticles(gs, cx, cy, 64, c.primary, 10)
    spawnFloatingText(gs, p.x, p.y - 28, skill.name + "!", c.primary)
    spawnAttackFx(gs, cx, cy, p.facing, el.castFx, c.primary, c.core, 3)
    gs.screenShake = 12
    applyAoeDamage(gs, skillDamage(p.element, 3, wl), skill.radius, c.primary)
  }

  /** Slot 4 — the heavy finisher that falls from the sky. */
  function castHeavy(gs: GameState) {
    const p = gs.player
    const el = ELEMENTS[p.element]
    const c = el.colors
    const cx = p.x + p.w / 2
    const size = 40 + Math.min(gs.weaponLevel - 1, 5) * 6
    gs.comets.push({
      id: nextId(),
      x: cx - size / 2, y: -size - 10,
      w: size, h: size,
      vx: 0,
      vy: 7 + Math.min(gs.weaponLevel, 6),
      active: true, exploded: false, frame: 0,
      element: p.element,
    })
    spawnParticles(gs, cx, p.y - 40, 40, c.primary, 8)
    spawnFloatingText(gs, p.x, p.y - 36, el.skills[3].name + "!", c.primary)
    spawnAttackFx(gs, cx, p.y + p.h / 2, p.facing, el.castFx, c.primary, c.core, 2.6)
    gs.screenShake = 6
  }

  function updateComets(gs: GameState) {
    const p = gs.player
    for (const c of gs.comets) {
      if (!c.active) continue
      c.frame++
      c.vy += GRAVITY * 0.7
      c.x += c.vx
      c.y += c.vy

      // Trail smoke while falling
      if (c.frame % 2 === 0) {
        spawnParticles(gs, c.x + c.w / 2, c.y + c.h / 2, 3, "#f97316", 3)
        spawnParticles(gs, c.x + c.w / 2, c.y + c.h / 2, 2, "#78350f", 2)
      }

      // World bounds
      if (c.x < gs.cameraX - 80 || c.x > gs.cameraX + CANVAS_W + 80 || c.y > CANVAS_H + 80) {
        c.active = false
        continue
      }

      // Comet passes through platforms; only explode on ground collision
      let hit = false
      // Explode if it falls below ground line
      if (c.y + c.h > GROUND_Y + 20) {
        hit = true
      }
      if (hit) {
        explodeComet(gs, c)
        continue
      }
      // Explode on enemy hit
      for (const e of gs.enemies) {
        if (e.state === "dead") continue
        if (rectOverlap(c, e)) {
          explodeComet(gs, c)
          break
        }
      }
    }
    gs.comets = gs.comets.filter(c => c.active)
  }

  function explodeComet(gs: GameState, c: Comet) {
    if (c.exploded) return
    c.exploded = true
    c.active = false
    const el = ELEMENTS[c.element]
    const cc = el.colors
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    const radius = el.skills[3].radius + Math.min(gs.weaponLevel, 6) * 10
    const dmg = skillDamage(c.element, 4, gs.weaponLevel)
    spawnParticles(gs, cx, cy, 60, cc.primary, 9)
    spawnParticles(gs, cx, cy, 40, cc.dark, 7)
    spawnFloatingText(gs, cx, cy - 24, c.element === "water" ? "SHATTER!" : c.element === "light" ? "JUDGED!" : "BOOM!", cc.core)
    spawnAttackFx(gs, cx, cy, 1, el.castFx, cc.primary, cc.core, 4)
    gs.screenShake = 14
    // AOE damage
    applyAoeDamage(gs, dmg, radius, cc.primary)
    // Lingering hazard: burning ground / freezing pool / consecrated light
    gs.aoeEffects.push({
      id: nextId(),
      x: cx, y: cy,
      radius: radius * 0.6,
      type: "hazard",
      timer: 180,
      maxTimer: 180,
      color: cc.secondary,
      damage: 10,
      tickTimer: 35,
      tickInterval: 35,
      playerOwned: true,
    })
  }

  function updateFireballs(gs: GameState) {
    for (const fb of gs.fireballs) {
      if (!fb.active) continue

      // Typhoon spiral motion
      if (fb.type === "typhoon" && fb.angle !== undefined && fb.radius !== undefined && fb.spinSpeed !== undefined && fb.expandSpeed !== undefined && fb.originX !== undefined && fb.originY !== undefined) {
        fb.angle += fb.spinSpeed
        fb.radius += fb.expandSpeed
        fb.x = fb.originX + Math.cos(fb.angle) * fb.radius - fb.w / 2
        fb.y = fb.originY + Math.sin(fb.angle) * fb.radius - fb.h / 2
        fb.vx = Math.cos(fb.angle + Math.PI / 2) * fb.radius * fb.spinSpeed
        fb.vy = Math.sin(fb.angle + Math.PI / 2) * fb.radius * fb.spinSpeed
        if (fb.radius > 360) { fb.active = false; continue }
      } else {
        fb.x += fb.vx
        fb.y += fb.vy
      }

      if (fb.frame !== undefined) fb.frame++
      else fb.frame = 0

      // Animate trail / smoke while traveling, in the element's colours
      if (fb.fromPlayer && fb.frame) {
        const tc = ELEMENTS[fb.element ?? "fire"].colors
        if (fb.type === "fireball" && fb.frame % 4 === 0) spawnParticles(gs, fb.x + fb.w / 2, fb.y + fb.h / 2, 2, tc.aura, 1)
        else if (fb.type === "rain" && fb.frame % 3 === 0) spawnParticles(gs, fb.x + fb.w / 2, fb.y, 2, tc.primary, 1.5)
        else if (fb.type === "storm" && fb.frame % 3 === 0) spawnParticles(gs, fb.x + fb.w / 2, fb.y + fb.h / 2, 2, tc.aura, 1.5)
        else if (fb.type === "typhoon" && fb.frame % 2 === 0) spawnParticles(gs, fb.x + fb.w / 2, fb.y + fb.h / 2, 2, tc.core, 2)
      }

      // Hit world bounds
      if (fb.x < gs.cameraX - 40 || fb.x > gs.cameraX + CANVAS_W + 40 || fb.y < -20 || fb.y > CANVAS_H + 20) {
        fb.active = false; continue
      }

      // Platform collision
      for (const pl of gs.platforms) {
        if (rectOverlap(fb, pl)) {
          fb.active = false
          const impactColor = fb.fromPlayer
            ? ELEMENTS[fb.element ?? "fire"].colors.primary
            : "#a855f7"
          spawnParticles(gs, fb.x + fb.w / 2, fb.y + fb.h / 2, fb.type === "storm" ? 12 : fb.type === "rain" ? 10 : fb.type === "typhoon" ? 14 : 6, impactColor, fb.type === "storm" || fb.type === "typhoon" ? 4 : 3)
          break
        }
      }
      if (!fb.active) continue

      if (fb.fromPlayer) {
        // Hit enemies — bolts may pierce, storm/rain hits once each
        const el = ELEMENTS[fb.element ?? gs.element]
        const slot: 1 | 2 | 3 | 4 = fb.type === "rain" ? 2 : fb.type === "typhoon" || fb.type === "storm" ? 3 : 1
        for (const e of gs.enemies) {
          if (e.state === "dead") continue
          if (fb.hitIds && fb.hitIds.includes(e.id)) continue
          if (!rectOverlap(fb, e)) continue

          const dmg = Math.round(skillDamage(el.id, slot, gs.weaponLevel) * (slot === 1 ? 1 : 0.35))
          damageEnemy(gs, e, dmg, el.colors.primary, fb.x + fb.w / 2, el.slowFrames)
          fb.hitIds?.push(e.id)
          spawnParticles(gs, e.x + e.w / 2, e.y + e.h / 2, 12, el.colors.core, 4)
          gs.screenShake = fb.type === "typhoon" ? 5 : 3

          if ((fb.pierce ?? 0) > 0) {
            fb.pierce = (fb.pierce ?? 0) - 1
          } else {
            fb.active = false
            break
          }
        }
      } else {
        // Enemy fireball hits player
        const p = gs.player
        if (!gs.testMode && p.hurtTimer <= 0 && p.hp > 0 && rectOverlap(fb, p)) {
          const dmg = 10
          fb.active = false
          hurtPlayer(gs, dmg, fb.x + fb.w / 2, fb.type === "robotBullet" ? "#38bdf8" : "#a855f7")
        }
      }
    }
    // Remove inactive
    gs.fireballs = gs.fireballs.filter(f => f.active)
  }

  function updatePotions(gs: GameState) {
    const p = gs.player
    for (const pot of gs.potions) {
      if (!pot.active) continue
      // Bob up and down using frame count
      pot.bobOffset += 0.08
      // Check if player walks over potion
      if (rectOverlap(p, pot)) {
        const healAmt = 30
        const prevHp = p.hp
        p.hp = Math.min(p.maxHp, p.hp + healAmt)
        const actual = p.hp - prevHp
        pot.active = false
        spawnParticles(gs, pot.x + 6, pot.y + 8, 10, "#34d399", 3)
        spawnFloatingText(gs, pot.x, pot.y - 10, `+${actual} HP`, "#34d399")
      }
    }
    gs.potions = gs.potions.filter(pot => pot.active)
  }

  function updateAttackFx(gs: GameState) {
    for (const fx of gs.attackFx) fx.timer--
    gs.attackFx = gs.attackFx.filter(fx => fx.timer > 0)
  }

  function updateParticles(gs: GameState) {
    gs.particles = gs.particles.filter(p => p.life > 0)
    for (const p of gs.particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--
    }
    gs.floatingTexts = gs.floatingTexts.filter(t => t.life > 0)
    for (const t of gs.floatingTexts) { t.y += t.vy; t.life-- }
  }

  /** Clearing a level boss always grants a guaranteed weapon level + full heal. */
  function upgradeWeapon(gs: GameState) {
    if (gs.weaponLevel < MAX_WEAPON_LEVEL) {
      gs.weaponLevel++
      gs.exp = 0
      gs.expToNext = expForWeaponLevel(gs.weaponLevel)
      spawnFloatingText(gs, gs.player.x, gs.player.y - 40, `WEAPON UP! LV ${gs.weaponLevel}`, "#fbbf24")
    } else {
      spawnFloatingText(gs, gs.player.x, gs.player.y - 40, "MAX WEAPON!", "#22c55e")
    }
    gs.player.hp = gs.player.maxHp
    spawnParticles(gs, gs.player.x + 12, gs.player.y + 20, 26, "#fbbf24", 6)
  }

  function checkWinCondition(gs: GameState) {
    const s = gs.stage
    const alive = gs.enemies.filter(e => e.state !== "dead").length
    const boss = gs.enemies.find(e => e.type === "boss")

    if (isBossStage(s)) {
      if (boss && boss.state === "dead") {
        gs.stage = "win"
        if (s === "stage18") {
          setTimeout(() => {
            stateRef.current.stage = "win"
            setStage("win")
            forceRender()
          }, 1800)
        } else {
          upgradeWeapon(gs)
          setTimeout(() => { startStage(nextStageOf(s), true) }, 1800)
        }
      }
    } else if (alive === 0) {
      setTimeout(() => { startStage(nextStageOf(s), true) }, 1500)
      gs.stage = "win"
      spawnFloatingText(gs, gs.player.x, gs.player.y - 30, "Stage Clear!", "#22c55e")
    }
  }

  return {
    stage, stateRef, startStage, inputRef,
    skill2Cooldown: stateRef.current.skill2Cooldown,
    skill3Cooldown: stateRef.current.skill3Cooldown,
    testMode, setTestMode: setTestModeEnabled,
    element, setElement,
  }
}

// ─── Canvas Renderer ──────────────────────────────────────────────────────────
// Colors palette
const PALETTE = {
  // Forest (stage1)
  skyForest: "#1a2744",
  groundForest: "#2d5a1b",
  grassForest: "#4a7c3f",
  treeForest: "#1a3a10",
  // Castle (stage2)
  skyCastle: "#1a1a2e",
  groundCastle: "#4a4a5a",
  wallCastle: "#2a2a3a",
  // Roof (stage3)
  skyRoof: "#0d0d1a",
  groundRoof: "#3a3a4a",
  // Laputa (stage4-6)
  skyLaputa: "#4a7ba6",
  skyLaputaDusk: "#2a4a6e",
  groundLaputa: "#5b7a4a",
  grassLaputa: "#86c06c",
  laputaRock: "#6b7280",
  // Heaven (stage7-9)
  skyHeaven: "#d9c58f",
  skyHeavenBright: "#efe0b0",
  groundHeaven: "#c9a86a",
  cloudHeaven: "#fef3c7",
  pillarHeaven: "#f5e6c8",
  // Deep Sea (stage10-12)
  skySea: "#0a2a4a",
  skySeaDeep: "#04142a",
  seaSand: "#1e3a55",
  seaSandTop: "#2e5a75",
  seaweed: "#1a6a4a",
  seaBubble: "#7dd3fc",
  // Volcano (stage13-15)
  skyVolcano: "#3a0a0a",
  skyVolcanoDark: "#1f0505",
  volcanoRock: "#2a2a2e",
  volcanoRockTop: "#4a4a52",
  lava: "#f97316",
  lavaBright: "#fbbf24",
  ember: "#fb923c",
  // Computer (stage16-18)
  skyComputer: "#020c08",
  circuit: "#0f3d2e",
  circuitBright: "#22c55e",
  cyber: "#22d3ee",
  metalGround: "#1a2028",
  metalTop: "#2a3a48",
  // Entities
  wizard: "#6d28d9",
  wizardRobe: "#4c1d95",
  wizardHat: "#5b21b6",
  wizardSkin: "#fde68a",
  fireball: "#f97316",
  fireballCore: "#fef08a",
  goblinSkin: "#4ade80",
  goblinDark: "#166534",
  orcSkin: "#fb923c",
  orcDark: "#9a3412",
  skeletonBone: "#e2e8f0",
  skeletonDark: "#94a3b8",
  bossBody: "#7c3aed",
  bossGlow: "#a855f7",
  bossDark: "#4c1d95",
  enemyFireball: "#a855f7",
  // UI
  hpFill: "#22c55e",
  hpBg: "#166534",
  energyFill: "#8b5cf6",
  energyBg: "#4c1d95",
  uiBg: "rgba(0,0,0,0.75)",
  uiBorder: "#fbbf24",
}

function draw(canvas: HTMLCanvasElement | null, gs: GameState) {
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.imageSmoothingEnabled = false

  const cam = gs.cameraX

  // Background
  drawBackground(ctx, gs.stage, cam, gs.stageWidth, gs.frameCount)

  // Platforms
  drawPlatforms(ctx, gs.platforms, cam, gs.stage)

  // Enemies (dead ones stay for the length of their death animation)
  for (const e of gs.enemies) {
    if (e.state === "dead" && e.deathTimer <= 0) continue
    drawEnemy(ctx, e, cam)
  }

  // Player
  if (gs.player.state !== "dead") {
    drawPlayer(ctx, gs.player, cam, gs.frameCount)
  }

  // Potions
  for (const pot of gs.potions) {
    if (pot.active) drawPotion(ctx, pot, cam)
  }

  // Fireballs
  for (const fb of gs.fireballs) {
    drawFireball(ctx, fb, cam)
  }

  // Comets
  for (const c of gs.comets) {
    if (c.active) drawComet(ctx, c, cam)
  }

  // AOE effects (telegraphs, bursts, hazards)
  drawAoeEffects(ctx, gs.aoeEffects, cam)

  // Themed attack / hurt flourishes
  drawAttackFx(ctx, gs.attackFx, cam)

  // Particles
  for (const p of gs.particles) {
    const alpha = p.life / p.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x - cam), Math.round(p.y), p.size, p.size)
  }
  ctx.globalAlpha = 1

  // Floating texts
  for (const t of gs.floatingTexts) {
    const alpha = t.life / t.maxLife
    ctx.globalAlpha = alpha
    ctx.fillStyle = t.color
    ctx.font = "bold 9px 'Press Start 2P', monospace"
    ctx.textAlign = "center"
    ctx.fillText(t.text, t.x + 12 - cam, t.y)
  }
  ctx.globalAlpha = 1
  ctx.textAlign = "left"

}

function drawBackground(ctx: CanvasRenderingContext2D, stage: Stage, cam: number, stageWidth: number, frame: number) {
  const isSea = stage === "stage10" || stage === "stage11" || stage === "stage12"
  const isVolcano = stage === "stage13" || stage === "stage14" || stage === "stage15"
  const isComputer = stage === "stage16" || stage === "stage17" || stage === "stage18"

  let sky = PALETTE.skyForest
  if (stage === "stage2") sky = PALETTE.skyCastle
  if (stage === "stage3") sky = PALETTE.skyRoof
  if (stage === "stage4" || stage === "stage5") sky = PALETTE.skyLaputa
  if (stage === "stage6") sky = PALETTE.skyLaputaDusk
  if (stage === "stage7" || stage === "stage8") sky = PALETTE.skyHeaven
  if (stage === "stage9" || stage === "win") sky = PALETTE.skyHeavenBright
  if (isSea) sky = PALETTE.skySea
  if (isVolcano) sky = PALETTE.skyVolcano
  if (isComputer) sky = PALETTE.skyComputer

  ctx.fillStyle = sky
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Stars for dark stages
  if (stage === "stage2" || stage === "stage3" || stage === "stage6" || stage === "win") {
    ctx.fillStyle = "#ffffff"
    const seed = 42
    for (let i = 0; i < 60; i++) {
      const sx = ((seed * (i * 137 + 7)) % stageWidth) - (cam * 0.3) % CANVAS_W
      const sy = (seed * (i * 97 + 13)) % (CANVAS_H * 0.6)
      ctx.fillRect(((sx % CANVAS_W) + CANVAS_W) % CANVAS_W, sy, 2, 2)
    }
  }

  // Forest trees (parallax)
  if (stage === "stage1") {
    ctx.fillStyle = PALETTE.treeForest
    for (let i = 0; i < 18; i++) {
      const treeWorldX = i * 160
      const screenX = treeWorldX - cam * 0.5
      if (screenX > -80 && screenX < CANVAS_W + 80) {
        drawTree(ctx, screenX, GROUND_Y - 100, 28, 90)
      }
    }
  }

  // Castle walls (stage2 + stage3)
  if (stage === "stage2") {
    ctx.fillStyle = PALETTE.wallCastle
    for (let i = 0; i < 8; i++) {
      const wx = i * 260 - cam * 0.6
      if (wx > -300 && wx < CANVAS_W + 100) {
        ctx.fillRect(wx, GROUND_Y - 250, 200, 260)
        for (let j = 0; j < 4; j++) {
          ctx.fillRect(wx + j * 50, GROUND_Y - 270, 30, 20)
        }
      }
    }
  }

  // Stage 3 moon
  if (stage === "stage3") {
    ctx.fillStyle = "#fef9c3"
    ctx.beginPath()
    ctx.arc(CANVAS_W - 100 - cam * 0.05, 70, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PALETTE.skyRoof
    ctx.beginPath()
    ctx.arc(CANVAS_W - 80 - cam * 0.05, 60, 38, 0, Math.PI * 2)
    ctx.fill()
  }

  // Laputa sky (stage4-6): clouds + floating islands
  if (stage === "stage4" || stage === "stage5" || stage === "stage6") {
    drawClouds(ctx, cam, stageWidth, "#ffffff", 0.15)
    drawFloatingIslands(ctx, cam, stageWidth)
    if (stage === "stage6") drawLaputaCastle(ctx, cam)
  }

  // Heaven (stage7-9): golden clouds + light pillars
  if (stage === "stage7" || stage === "stage8" || stage === "stage9") {
    drawClouds(ctx, cam, stageWidth, PALETTE.cloudHeaven, 0.25)
    drawLightPillars(ctx, cam, stageWidth)
  }

  // Deep Sea (stage10-12): light rays, bubbles, seaweed, fish
  if (isSea) {
    drawSeaLightRays(ctx, cam, stageWidth)
    drawSeaBubbles(ctx, cam, stageWidth, frame)
    drawSeaweed(ctx, cam, stageWidth, frame)
    drawSeaFish(ctx, cam, stageWidth, frame)
  }

  // Volcano (stage13-15): volcano silhouette, smoke, embers, lava glow
  if (isVolcano) {
    drawVolcanoSilhouette(ctx, cam)
    drawVolcanoSmoke(ctx, cam, stageWidth)
    drawVolcanoEmbers(ctx, cam, stageWidth, frame)
    drawLavaGlow(ctx, frame)
  }

  // Computer (stage16-18): grid, circuits, binary rain
  if (isComputer) {
    drawComputerGrid(ctx, cam)
    drawCircuits(ctx, cam, stageWidth, frame)
    drawBinaryRain(ctx, cam, stageWidth, frame)
  }
}

// ─── Deep Sea background helpers ─────────────────────────────────────────────
function drawSeaLightRays(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number) {
  ctx.globalAlpha = 0.08
  ctx.fillStyle = PALETTE.seaBubble
  const seed = 23
  for (let i = 0; i < 7; i++) {
    const wx = ((seed * (i * 281 + 37)) % stageWidth)
    const sx = wx - cam * 0.1
    const w = 24 + (i % 3) * 16
    if (sx + w < -60 || sx > CANVAS_W + 60) continue
    ctx.fillRect(sx, 0, w, CANVAS_H * 0.7)
  }
  ctx.globalAlpha = 1
}

function drawSeaBubbles(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  ctx.fillStyle = PALETTE.seaBubble
  const seed = 29
  for (let i = 0; i < 26; i++) {
    const wx = ((seed * (i * 157 + 11)) % stageWidth)
    const sx = wx - cam * 0.4
    if (sx < -10 || sx > CANVAS_W + 10) continue
    const speed = 0.6 + (i % 3) * 0.3
    const startY = (seed * (i * 71 + 5)) % CANVAS_H
    const sy = CANVAS_H - ((frame * speed + startY) % (CANVAS_H + 20))
    const size = 2 + (i % 3)
    ctx.globalAlpha = 0.25 + (i % 4) * 0.1
    ctx.fillRect(sx, sy, size, size)
  }
  ctx.globalAlpha = 1
}

function drawSeaweed(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  const seed = 31
  for (let i = 0; i < 16; i++) {
    const wx = ((seed * (i * 211 + 43)) % stageWidth)
    const sx = wx - cam * 0.7
    if (sx < -30 || sx > CANVAS_W + 30) continue
    const h = 30 + (i % 4) * 12
    const sway = Math.sin(frame * 0.03 + i) * 3
    ctx.fillStyle = PALETTE.seaweed
    ctx.fillRect(sx + sway, GROUND_Y - h, 5, h)
    ctx.fillRect(sx + sway - 3, GROUND_Y - h + 8, 3, 8)
    ctx.fillRect(sx + sway + 5, GROUND_Y - h + 12, 3, 8)
  }
}

function drawSeaFish(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  ctx.fillStyle = PALETTE.skySeaDeep
  const seed = 37
  for (let i = 0; i < 8; i++) {
    const wx = ((seed * (i * 331 + 17)) % (stageWidth + 400))
    const dir = i % 2 === 0 ? 1 : -1
    const swim = (frame * (0.4 + (i % 3) * 0.2) * dir)
    const sx = wx - cam * 0.3 + swim
    const wrapped = ((sx % (CANVAS_W + 120)) + CANVAS_W + 120) % (CANVAS_W + 120) - 60
    const sy = 40 + (seed * (i * 89 + 23)) % 200
    const w = 14 + (i % 3) * 6
    ctx.globalAlpha = 0.5
    // Body
    ctx.fillRect(wrapped, sy, w, 5)
    // Tail
    ctx.fillRect(dir === 1 ? wrapped - 4 : wrapped + w, sy + 1, 4, 3)
  }
  ctx.globalAlpha = 1
}

// ─── Volcano background helpers ──────────────────────────────────────────────
function drawVolcanoSilhouette(ctx: CanvasRenderingContext2D, cam: number) {
  const sx = CANVAS_W / 2 - 160 - cam * 0.08
  // Mountain body (two stacked trapezoid-ish rects)
  ctx.fillStyle = "#1a0a0a"
  ctx.fillRect(sx - 60, GROUND_Y - 120, 440, 120)
  ctx.fillRect(sx + 40, GROUND_Y - 220, 240, 110)
  ctx.fillRect(sx + 110, GROUND_Y - 260, 100, 50)
  // Glowing crater
  ctx.fillStyle = PALETTE.lava
  ctx.globalAlpha = 0.8
  ctx.fillRect(sx + 105, GROUND_Y - 262, 110, 8)
  ctx.fillStyle = PALETTE.lavaBright
  ctx.fillRect(sx + 125, GROUND_Y - 260, 70, 4)
  ctx.globalAlpha = 1
  // Lava streams down the mountain
  ctx.fillStyle = PALETTE.lava
  ctx.globalAlpha = 0.5
  ctx.fillRect(sx + 130, GROUND_Y - 254, 8, 130)
  ctx.fillRect(sx + 190, GROUND_Y - 254, 6, 100)
  ctx.globalAlpha = 1
}

function drawVolcanoSmoke(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number) {
  ctx.fillStyle = "#57534e"
  const seed = 41
  for (let i = 0; i < 12; i++) {
    const wx = ((seed * (i * 197 + 29)) % stageWidth)
    const sx = wx - cam * 0.15
    const sy = 20 + (seed * (i * 67 + 13)) % 120
    const w = 50 + (i % 4) * 24
    if (sx + w < -40 || sx > CANVAS_W + 40) continue
    ctx.globalAlpha = 0.18
    ctx.fillRect(sx, sy, w, 16)
  }
  ctx.globalAlpha = 1
}

function drawVolcanoEmbers(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  const seed = 43
  for (let i = 0; i < 30; i++) {
    const wx = ((seed * (i * 149 + 7)) % stageWidth)
    const sx = wx - cam * 0.5
    if (sx < -10 || sx > CANVAS_W + 10) continue
    const speed = 0.8 + (i % 3) * 0.4
    const startY = (seed * (i * 83 + 19)) % CANVAS_H
    const sy = CANVAS_H - ((frame * speed + startY) % (CANVAS_H + 30))
    const flicker = 0.3 + Math.abs(Math.sin(frame * 0.1 + i)) * 0.4
    ctx.globalAlpha = flicker
    ctx.fillStyle = i % 3 === 0 ? PALETTE.lavaBright : PALETTE.ember
    const size = 2 + (i % 2)
    ctx.fillRect(sx + Math.sin(frame * 0.05 + i) * 4, sy, size, size)
  }
  ctx.globalAlpha = 1
}

function drawLavaGlow(ctx: CanvasRenderingContext2D, frame: number) {
  // Pulsing lava glow along the bottom of the screen
  const pulse = 0.25 + Math.abs(Math.sin(frame * 0.02)) * 0.15
  ctx.globalAlpha = pulse
  ctx.fillStyle = PALETTE.lava
  ctx.fillRect(0, CANVAS_H - 14, CANVAS_W, 14)
  ctx.fillStyle = PALETTE.lavaBright
  ctx.fillRect(0, CANVAS_H - 6, CANVAS_W, 6)
  ctx.globalAlpha = 1
}

// ─── Computer background helpers ─────────────────────────────────────────────
function drawComputerGrid(ctx: CanvasRenderingContext2D, cam: number) {
  ctx.strokeStyle = PALETTE.circuit
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1
  // Vertical lines (parallax)
  const offset = -(cam * 0.2) % 40
  for (let x = offset; x < CANVAS_W; x += 40) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, CANVAS_H)
    ctx.stroke()
  }
  // Horizontal lines
  for (let y = 0; y < CANVAS_H; y += 40) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(CANVAS_W, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

function drawCircuits(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  const seed = 47
  for (let i = 0; i < 10; i++) {
    const wx = ((seed * (i * 263 + 31)) % stageWidth)
    const sx = wx - cam * 0.4
    if (sx < -120 || sx > CANVAS_W + 120) continue
    const sy = 30 + (seed * (i * 107 + 3)) % 300
    const len = 40 + (i % 4) * 30
    // Trace line
    ctx.strokeStyle = PALETTE.circuitBright
    ctx.globalAlpha = 0.3
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + len, sy)
    ctx.lineTo(sx + len, sy + 20)
    ctx.stroke()
    // Node at the end — pulses
    const pulse = 0.4 + Math.abs(Math.sin(frame * 0.06 + i * 1.3)) * 0.5
    ctx.globalAlpha = pulse
    ctx.fillStyle = PALETTE.cyber
    ctx.fillRect(sx + len - 3, sy + 17, 6, 6)
    ctx.fillRect(sx - 2, sy - 2, 4, 4)
  }
  ctx.globalAlpha = 1
}

function drawBinaryRain(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, frame: number) {
  ctx.font = "8px monospace"
  const seed = 53
  for (let i = 0; i < 18; i++) {
    const wx = ((seed * (i * 173 + 41)) % stageWidth)
    const sx = wx - cam * 0.25
    if (sx < -20 || sx > CANVAS_W + 20) continue
    const speed = 1.2 + (i % 4) * 0.5
    const startY = (seed * (i * 61 + 9)) % (CANVAS_H * 2)
    const headY = ((frame * speed + startY) % (CANVAS_H * 1.5)) - 40
    // Trail of fading glyphs above the head
    for (let t = 0; t < 6; t++) {
      const gy = headY - t * 12
      if (gy < -10 || gy > CANVAS_H + 10) continue
      const bit = (seed * (i * 7 + t * 13) + Math.floor(frame / 12)) % 2
      ctx.globalAlpha = t === 0 ? 0.7 : 0.5 - t * 0.08
      ctx.fillStyle = t === 0 ? "#a7f3d0" : PALETTE.circuitBright
      ctx.fillText(bit === 0 ? "0" : "1", sx, gy)
    }
  }
  ctx.globalAlpha = 1
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(x + w / 2 - 4, y + h - 20, 8, 20)
  ctx.fillRect(x, y, w, h - 10)
  ctx.fillStyle = "#15501e"
  ctx.fillRect(x + 4, y - 20, w - 8, 24)
}

function drawClouds(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number, color: string, alpha: number) {
  ctx.fillStyle = color
  ctx.globalAlpha = alpha
  const seed = 13
  for (let i = 0; i < 24; i++) {
    const wx = ((seed * (i * 191 + 31)) % stageWidth)
    const sx = wx - cam * (0.1 + (i % 3) * 0.05)
    const sy = 30 + (seed * (i * 53 + 17)) % 180
    const w = 40 + (i % 4) * 20
    ctx.fillRect(((sx % CANVAS_W) + CANVAS_W) % CANVAS_W, sy, w, 14)
  }
  ctx.globalAlpha = 1
}

function drawFloatingIslands(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number) {
  const seed = 7
  for (let i = 0; i < 14; i++) {
    const wx = ((seed * (i * 271 + 41)) % stageWidth)
    const sx = wx - cam * 0.25
    const sy = 80 + (seed * (i * 113 + 19)) % 160
    const w = 70 + (i % 5) * 30
    if (sx + w < -40 || sx > CANVAS_W + 40) continue
    // Rock underside
    ctx.fillStyle = PALETTE.laputaRock
    ctx.fillRect(sx + 8, sy + 10, w - 16, 24)
    // Grass top
    ctx.fillStyle = PALETTE.grassLaputa
    ctx.fillRect(sx, sy, w, 14)
    // Highlight
    ctx.fillStyle = "#a3e635"
    ctx.fillRect(sx + 4, sy + 2, w - 8, 4)
  }
}

function drawLaputaCastle(ctx: CanvasRenderingContext2D, cam: number) {
  // Big castle silhouette in the distance
  const sx = CANVAS_W / 2 - 140 - cam * 0.08
  ctx.fillStyle = "#1e293b"
  ctx.fillRect(sx, GROUND_Y - 220, 280, 170)
  // Tower
  ctx.fillRect(sx + 30, GROUND_Y - 300, 60, 100)
  ctx.fillRect(sx + 190, GROUND_Y - 280, 50, 80)
  // Windows / glow
  ctx.fillStyle = "#fbbf24"
  ctx.globalAlpha = 0.4
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(sx + 50 + (i % 3) * 70, GROUND_Y - 180 + Math.floor(i / 3) * 50, 16, 22)
  }
  ctx.globalAlpha = 1
}

function drawLightPillars(ctx: CanvasRenderingContext2D, cam: number, stageWidth: number) {
  ctx.globalAlpha = 0.12
  ctx.fillStyle = PALETTE.pillarHeaven
  const seed = 17
  for (let i = 0; i < 8; i++) {
    const wx = ((seed * (i * 331 + 23)) % stageWidth)
    const sx = wx - cam * 0.12
    const w = 30 + (i % 3) * 20
    if (sx + w < -60 || sx > CANVAS_W + 60) continue
    ctx.fillRect(sx, 0, w, CANVAS_H)
  }
  ctx.globalAlpha = 1
}

function drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], cam: number, stage: Stage) {
  const isLaputa = stage === "stage4" || stage === "stage5" || stage === "stage6"
  const isHeaven = stage === "stage7" || stage === "stage8" || stage === "stage9"
  const isSea = stage === "stage10" || stage === "stage11" || stage === "stage12"
  const isVolcano = stage === "stage13" || stage === "stage14" || stage === "stage15"
  const isComputer = stage === "stage16" || stage === "stage17" || stage === "stage18"
  for (const p of platforms) {
    const sx = p.x - cam
    if (sx + p.w < 0 || sx > CANVAS_W) continue
    if (p.type === "ground") {
      // Ground
      let topColor = "#4a7c3f", fillColor = "#2d5a1b", detailColor = "#3d6b2e"
      if (stage === "stage2" || stage === "win") { topColor = "#5a5a6a"; fillColor = "#3a3a4a"; detailColor = "#4a4a5a" }
      if (stage === "stage3") { topColor = "#5a5a6a"; fillColor = "#2a2a3a"; detailColor = "#3a3a4a" }
      if (isLaputa) { topColor = PALETTE.grassLaputa; fillColor = PALETTE.groundLaputa; detailColor = "#4a6b3a" }
      if (isHeaven) { topColor = "#f5e0a0"; fillColor = PALETTE.groundHeaven; detailColor = "#b08d55" }
      if (isSea) { topColor = PALETTE.seaSandTop; fillColor = PALETTE.seaSand; detailColor = "#16293d" }
      if (isVolcano) { topColor = PALETTE.volcanoRockTop; fillColor = PALETTE.volcanoRock; detailColor = "#7a2a1a" }
      if (isComputer) { topColor = PALETTE.metalTop; fillColor = PALETTE.metalGround; detailColor = PALETTE.circuit }
      ctx.fillStyle = fillColor
      ctx.fillRect(sx, p.y, p.w, p.h)
      ctx.fillStyle = topColor
      ctx.fillRect(sx, p.y, p.w, 8)
      // detail lines
      ctx.fillStyle = detailColor
      for (let i = 0; i < p.w; i += 32) {
        ctx.fillRect(sx + i, p.y + 10, 20, 3)
      }
      // Volcano ground: glowing lava cracks
      if (isVolcano) {
        ctx.fillStyle = PALETTE.lava
        ctx.globalAlpha = 0.6
        for (let i = 16; i < p.w; i += 64) {
          ctx.fillRect(sx + i, p.y + 20, 12, 3)
          ctx.fillRect(sx + i + 5, p.y + 23, 3, 8)
        }
        ctx.globalAlpha = 1
      }
      // Computer ground: circuit traces
      if (isComputer) {
        ctx.fillStyle = PALETTE.circuitBright
        ctx.globalAlpha = 0.5
        for (let i = 8; i < p.w; i += 48) {
          ctx.fillRect(sx + i, p.y + 14, 24, 2)
          ctx.fillRect(sx + i + 22, p.y + 14, 2, 10)
        }
        ctx.globalAlpha = 1
      }
    } else {
      // Floating platform
      let topC = "#6b5c2e", bodyC = "#4a3d1e"
      if (stage === "stage2" || stage === "win") { topC = "#6a6a7a"; bodyC = "#4a4a5a" }
      if (stage === "stage3") { topC = "#7a6a8a"; bodyC = "#4a3a5a" }
      if (isLaputa) { topC = "#a3e635"; bodyC = PALETTE.laputaRock }
      if (isHeaven) { topC = "#fef3c7"; bodyC = "#d4b87a" }
      if (isSea) { topC = "#3e7a9a"; bodyC = "#1e4a63" }
      if (isVolcano) { topC = "#6a4a3a"; bodyC = "#3a2a26" }
      if (isComputer) { topC = PALETTE.cyber; bodyC = "#16303a" }
      ctx.fillStyle = bodyC
      ctx.fillRect(sx, p.y, p.w, p.h)
      ctx.fillStyle = topC
      ctx.fillRect(sx, p.y, p.w, 6)
    }
  }
}

// ─── Offscreen compositor (hit flash / element tint) ─────────────────────────
// Sprites are drawn into a scratch canvas so a tint can be composited with
// `source-atop` — that keeps the flash on the character instead of the level.
const FX_PAD = 76
let scratch: HTMLCanvasElement | null = null
let scratchCtx: CanvasRenderingContext2D | null = null
function getScratch(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null
  if (!scratch) {
    scratch = document.createElement("canvas")
    scratch.width = 256
    scratch.height = 256
  }
  if (scratch.width < w || scratch.height < h) {
    scratch.width = Math.max(scratch.width, w)
    scratch.height = Math.max(scratch.height, h)
    scratchCtx = null
  }
  if (!scratchCtx) {
    scratchCtx = scratch.getContext("2d")
    if (scratchCtx) scratchCtx.imageSmoothingEnabled = false
  }
  if (!scratchCtx) return null
  scratchCtx.setTransform(1, 0, 0, 1, 0, 0)
  scratchCtx.globalAlpha = 1
  scratchCtx.globalCompositeOperation = "source-over"
  scratchCtx.clearRect(0, 0, scratch.width, scratch.height)
  return scratchCtx
}

/** Paint `color` over only the pixels already drawn in the scratch canvas. */
function tintScratch(sctx: CanvasRenderingContext2D, color: string, alpha: number, w: number, h: number) {
  if (alpha <= 0) return
  sctx.save()
  sctx.setTransform(1, 0, 0, 1, 0, 0)
  sctx.globalCompositeOperation = "source-atop"
  sctx.globalAlpha = alpha
  sctx.fillStyle = color
  sctx.fillRect(0, 0, w, h)
  sctx.restore()
  sctx.globalCompositeOperation = "source-over"
  sctx.globalAlpha = 1
}

// ─── Player ──────────────────────────────────────────────────────────────────
function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, cam: number, frame: number) {
  ensureSpritesLoaded()
  const sx = Math.round(p.x - cam)
  const el = ELEMENTS[p.element]
  // Wizard sprite faces left natively, so flip horizontally when moving right
  const flip = p.facing === 1

  // Cast progress 0→1, used to swing the wand and pulse the aura
  const castT = p.castTimer > 0 ? 1 - p.castTimer / Math.max(1, p.castMax) : 0
  const hurtT = p.hurtTimer > 0 ? p.hurtTimer / 28 : 0
  // Recoil away from the hit, easing back out
  const recoil = hurtT > 0 ? p.hurtDir * hurtT * 7 : 0
  const tilt = hurtT > 0 ? p.hurtDir * hurtT * 0.22 : 0

  // Shadow under sprite
  ctx.globalAlpha = 0.3
  ctx.fillStyle = "#000"
  ctx.fillRect(sx + p.w / 2 - 12, p.y + p.h - 3, 24, 4)
  ctx.globalAlpha = 1

  // Elemental aura that swells while casting
  const auraR = 16 + castT * 16
  ctx.globalAlpha = (p.castTimer > 0 ? 0.28 + Math.sin(frame * 0.4) * 0.08 : 0.12)
  ctx.fillStyle = el.colors.primary
  ctx.beginPath()
  ctx.arc(sx + p.w / 2 + recoil, p.y + p.h / 2, auraR, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1

  // Determine animation frame from sprite sheet
  let frameIndex = 0
  if (p.state === "cast") {
    // Wind up on frames 8-10, then hold the release frame
    frameIndex = castT < 0.45 ? 8 + Math.floor(castT / 0.15) : 11
  } else if (p.state === "hurt") {
    frameIndex = 1
  } else if (p.state === "jump") {
    frameIndex = 1
  } else if (p.state === "run") {
    frameIndex = Math.floor(frame / 6) % 6
  } else {
    frameIndex = 0
  }
  frameIndex = Math.max(0, Math.min(WIZARD_FRAME_COUNT - 1, frameIndex))

  // Sprite frames have ~6px of empty space at the bottom; push down to plant feet
  const drawX = sx + p.w / 2 - WIZARD_SPRITE_W / 2
  const drawY = p.y + p.h - WIZARD_SPRITE_H + 6

  const sctx = getScratch(WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8)
  if (spritesLoaded && wizardImg && sctx) {
    sctx.save()
    if (flip) {
      sctx.translate(4 + WIZARD_SPRITE_W, 4)
      sctx.scale(-1, 1)
      sctx.drawImage(wizardImg, frameIndex * WIZARD_SPRITE_W, 0, WIZARD_SPRITE_W, WIZARD_SPRITE_H, 0, 0, WIZARD_SPRITE_W, WIZARD_SPRITE_H)
    } else {
      sctx.drawImage(wizardImg, frameIndex * WIZARD_SPRITE_W, 0, WIZARD_SPRITE_W, WIZARD_SPRITE_H, 4, 4, WIZARD_SPRITE_W, WIZARD_SPRITE_H)
    }
    sctx.restore()

    // Element robe tint (fire keeps the sheet's native colours)
    if (p.element !== "fire") {
      tintScratch(sctx, el.colors.primary, 0.34, WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8)
    }
    // Cast glow, then the white hit flash on top
    if (p.castTimer > 0) tintScratch(sctx, el.colors.core, 0.18 + castT * 0.2, WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8)
    if (p.flashTimer > 0) tintScratch(sctx, "#ffffff", Math.min(0.85, p.flashTimer / 12), WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8)

    ctx.save()
    ctx.translate(drawX + WIZARD_SPRITE_W / 2 + recoil, drawY + WIZARD_SPRITE_H / 2)
    ctx.rotate(tilt)
    // Flicker while invulnerable so the i-frames read
    ctx.globalAlpha = p.hurtTimer > 0 && Math.floor(p.hurtTimer / 3) % 2 === 0 ? 0.55 : 1
    ctx.drawImage(scratch!, 0, 0, WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8,
      -WIZARD_SPRITE_W / 2 - 4, -WIZARD_SPRITE_H / 2 - 4, WIZARD_SPRITE_W + 8, WIZARD_SPRITE_H + 8)
    ctx.globalAlpha = 1
    ctx.restore()
  } else {
    // Fallback blocky wizard while images load
    const sy = Math.round(p.y)
    ctx.fillStyle = el.colors.dark
    ctx.fillRect(sx + 2 + recoil, sy + 14, 20, 22)
    ctx.fillStyle = PALETTE.wizardSkin
    ctx.fillRect(sx + 5 + recoil, sy + 6, 14, 14)
    ctx.fillStyle = el.colors.primary
    ctx.fillRect(sx + 3 + recoil, sy, 18, 8)
    ctx.fillRect(sx + 7 + recoil, sy - 8, 10, 10)
  }

  // Wand tip spark that tracks the cast
  if (p.castTimer > 0) {
    const tipX = sx + p.w / 2 + p.facing * (12 + castT * 10) + recoil
    const tipY = p.y + 8 - castT * 6
    ctx.globalAlpha = 0.5 + Math.sin(frame * 0.8) * 0.3
    ctx.fillStyle = el.colors.core
    ctx.beginPath()
    ctx.arc(tipX, tipY, 3 + castT * 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

// ─── Enemies ─────────────────────────────────────────────────────────────────
function drawEnemyBody(ctx: CanvasRenderingContext2D, e: Enemy) {
  if (e.type === "goblin") drawGoblin(ctx, e)
  else if (e.type === "orc") drawOrc(ctx, e)
  else if (e.type === "skeleton") drawSkeleton(ctx, e)
  else if (e.type === "boss") drawBoss(ctx, e)
  else if (e.type === "orcBrute") drawOrcBrute(ctx, e)
  else if (e.type === "robot" || e.type === "robotElite") drawRobot(ctx, e)
  else if (e.type === "angel" || e.type === "seraph") drawAngel(ctx, e)
  else if (e.type === "fishman") drawFishman(ctx, e)
  else if (e.type === "jellyfish") drawJellyfish(ctx, e)
  else if (e.type === "imp") drawImp(ctx, e)
  else if (e.type === "lavaGolem") drawLavaGolem(ctx, e)
  else if (e.type === "virus") drawVirus(ctx, e)
  else if (e.type === "firewall") drawFirewall(ctx, e)
}

/** 0→1 through the current swing; used to lean back then lunge forward. */
export function attackProgress(e: Enemy): number {
  if (e.state !== "attack" || e.attackAnimMax <= 0) return 0
  return clamp(1 - e.attackAnim / e.attackAnimMax, 0, 1)
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, cam: number) {
  const sx = Math.round(e.x - cam)
  const sy = Math.round(e.y)
  if (sx + e.w < -80 || sx > CANVAS_W + 80) return

  const flip = e.facing === 1
  const hover = (e.type === "angel" || e.type === "seraph" || e.type === "jellyfish" || e.type === "virus")
    ? Math.sin(e.animFrame * 0.6) * 3 : 0

  // Attack pose: coil backwards during wind-up, punch forwards on the strike
  const t = attackProgress(e)
  let lunge = 0
  let crouch = 0
  let lean = 0
  if (e.state === "attack") {
    if (e.attackPhase === "windup") {
      lunge = -e.facing * t * 5
      crouch = t * 3
      lean = -e.facing * t * 0.16
    } else {
      const punch = Math.max(0, 1 - t * 2.2)
      lunge = e.facing * punch * 9
      crouch = -punch * 2
      lean = e.facing * punch * 0.2
    }
  }

  // Hurt pose: knocked away from the hit and tilted
  const hurtT = e.hurtTimer > 0 ? e.hurtTimer / 18 : 0
  const recoil = hurtT > 0 ? e.hurtDir * hurtT * 6 : 0
  const hurtTilt = hurtT > 0 ? e.hurtDir * hurtT * 0.25 : 0
  const jitter = hurtT > 0.5 ? (Math.random() - 0.5) * 2 : 0

  // Death dissolve: fade, drift up and fall over
  const dying = e.state === "dead"
  if (dying && e.deathTimer <= 0) return
  const deathT = dying ? 1 - e.deathTimer / 26 : 0

  const pw = e.w + FX_PAD * 2
  const ph = e.h + FX_PAD * 2
  const sctx = getScratch(pw, ph)
  if (!sctx) return

  sctx.save()
  if (flip) { sctx.translate(FX_PAD + e.w, FX_PAD); sctx.scale(-1, 1) } else { sctx.translate(FX_PAD, FX_PAD) }
  drawEnemyBody(sctx, e)
  sctx.restore()

  // Chilled (water element) reads as a blue wash; hits flash white
  if (e.slowTimer > 0) tintScratch(sctx, "#7dd3fc", 0.35, pw, ph)
  if (e.flashTimer > 0) tintScratch(sctx, "#ffffff", Math.min(0.9, e.flashTimer / 10), pw, ph)
  if (dying) tintScratch(sctx, "#fbbf24", 0.4 + deathT * 0.4, pw, ph)

  ctx.save()
  const cx = sx + e.w / 2 + lunge + recoil + jitter
  const cy = sy + hover + e.h / 2 + crouch - (dying ? deathT * 12 : 0)
  ctx.translate(cx, cy)
  ctx.rotate(lean + hurtTilt + (dying ? deathT * 1.1 * e.hurtDir * -1 : 0))
  if (dying) ctx.scale(1 + deathT * 0.25, 1 - deathT * 0.15)
  ctx.globalAlpha = dying ? Math.max(0, 1 - deathT) : 1

  // Shadow (unrotated-ish, good enough at these sizes)
  if (!dying) {
    ctx.globalAlpha = 0.3
    ctx.fillStyle = "#000"
    ctx.fillRect(-e.w / 2 - 2, e.h / 2 - 4, e.w + 4, 4)
    ctx.globalAlpha = 1
  }

  ctx.drawImage(scratch!, 0, 0, pw, ph, -e.w / 2 - FX_PAD, -e.h / 2 - FX_PAD, pw, ph)
  ctx.restore()
  ctx.globalAlpha = 1

  // Wind-up telegraph ring so incoming attacks are readable
  if (e.state === "attack" && e.attackPhase === "windup" && t > 0.5) {
    const [fxA] = e.type === "boss" ? bossFxColors(e.bossKind ?? "darklord") : ENEMY_FX_COLORS[e.type]
    ctx.globalAlpha = (t - 0.5) * 0.8
    ctx.strokeStyle = fxA
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(sx + e.w / 2, sy + hover + e.h / 2, e.w * 0.75 + (1 - t) * 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.lineWidth = 1
  }

  // HP bar above enemy
  if (!dying && e.hp < e.maxHp) {
    const bw = e.w + 8, bh = 4
    const bx = sx - 4, by = sy - 10
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(bx, by, bw, bh)
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? "#22c55e" : e.hp / e.maxHp > 0.25 ? "#f59e0b" : "#ef4444"
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh)
  }
  // Chill icon
  if (!dying && e.slowTimer > 0) {
    ctx.fillStyle = "#7dd3fc"
    ctx.globalAlpha = 0.7 + Math.sin(e.animFrame * 0.8) * 0.3
    ctx.fillRect(sx + e.w / 2 - 1, sy - 18, 2, 6)
    ctx.fillRect(sx + e.w / 2 - 3, sy - 16, 6, 2)
    ctx.globalAlpha = 1
  }
}

function drawGoblin(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Body
  ctx.fillStyle = PALETTE.goblinSkin
  ctx.fillRect(4, 6, 16, 18)
  // Head
  ctx.fillRect(3, 0, 18, 10)
  // Ears
  ctx.fillRect(0, 2, 4, 5)
  ctx.fillRect(20, 2, 4, 5)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#ff0000"
  ctx.fillRect(5, 2, 3, 3)
  ctx.fillRect(16, 2, 3, 3)
  // Mouth / teeth
  ctx.fillStyle = "#166534"
  ctx.fillRect(8, 6, 8, 3)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(9, 5, 2, 3)
  ctx.fillRect(13, 5, 2, 3)
  // Legs
  ctx.fillStyle = PALETTE.goblinDark
  ctx.fillRect(5, 22, 5, 6)
  ctx.fillRect(14, 22, 5, 6)
  // Club weapon - raised during attack
  ctx.fillStyle = "#92400e"
  if (attacking) {
    const armBob = windup ? -4 : 2
    ctx.fillRect(1, 4 + armBob, 3, 14)
    ctx.fillStyle = "#78350f"
    ctx.fillRect(-1, 2 + armBob, 6, 6)
    // Attack flash
    if (windup) {
      ctx.globalAlpha = 0.4 + Math.sin(e.attackAnim * 0.5) * 0.2
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(-4, -2, 8, 8)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(1, 8, 3, 14)
    ctx.fillStyle = "#78350f"
    ctx.fillRect(-1, 6, 6, 6)
  }
}

function drawOrc(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Body - big and bulky
  ctx.fillStyle = PALETTE.orcSkin
  ctx.fillRect(4, 10, 22, 22)
  // Head
  ctx.fillRect(5, 2, 20, 12)
  // Tusks
  ctx.fillStyle = "#fef3c7"
  ctx.fillRect(8, 11, 4, 6)
  ctx.fillRect(18, 11, 4, 6)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#dc2626"
  ctx.fillRect(9, 4, 4, 4)
  ctx.fillRect(17, 4, 4, 4)
  // Armor
  ctx.fillStyle = "#374151"
  ctx.fillRect(4, 14, 22, 10)
  ctx.fillRect(2, 18, 3, 6)  // shoulder pad
  ctx.fillRect(25, 18, 3, 6)
  // Legs
  ctx.fillStyle = PALETTE.orcDark
  ctx.fillRect(5, 30, 8, 6)
  ctx.fillRect(17, 30, 8, 6)
  // Axe - raised during attack
  ctx.fillStyle = "#6b7280"
  if (attacking) {
    const raise = windup ? -8 : 0
    ctx.fillRect(0, 6 + raise, 3, 18)
    ctx.fillRect(-4, 2 + raise, 8, 8)
    if (windup) {
      ctx.globalAlpha = 0.4 + Math.sin(e.attackAnim * 0.5) * 0.2
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(-6, -4, 10, 6)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(0, 6, 3, 18)
    ctx.fillRect(-4, 4, 8, 8)
  }
}

function drawOrcBrute(ctx: CanvasRenderingContext2D, e: Enemy) {
  const c = e.specialTelegraph && e.specialTelegraph > 0 ? "#f87171" : PALETTE.orcSkin
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Body - bigger and armored
  ctx.fillStyle = c
  ctx.fillRect(6, 12, 32, 26)
  // Armor plate
  ctx.fillStyle = "#374151"
  ctx.fillRect(6, 14, 32, 12)
  ctx.fillStyle = "#111827"
  ctx.fillRect(10, 16, 24, 8)
  // Head
  ctx.fillStyle = c
  ctx.fillRect(8, 2, 28, 14)
  // Helmet horns
  ctx.fillStyle = "#4b5563"
  ctx.fillRect(4, 0, 4, 10)
  ctx.fillRect(36, 0, 4, 10)
  // Tusks
  ctx.fillStyle = "#fef3c7"
  ctx.fillRect(10, 12, 5, 7)
  ctx.fillRect(25, 12, 5, 7)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#dc2626"
  ctx.fillRect(12, 6, 5, 5)
  ctx.fillRect(25, 6, 5, 5)
  // Legs
  ctx.fillStyle = PALETTE.orcDark
  ctx.fillRect(8, 36, 10, 8)
  ctx.fillRect(24, 36, 10, 8)
  // Giant hammer - raised during attack
  ctx.fillStyle = "#4b5563"
  if (attacking) {
    const raise = windup ? -12 : -4
    ctx.save()
    ctx.translate(2, 20)
    ctx.rotate(windup ? -0.4 : 0.3)
    ctx.fillRect(-2, -15, 5, 30)
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(-8, -19, 16, 12)
    ctx.restore()
    if (windup) {
      ctx.globalAlpha = 0.5 + Math.sin(e.attackAnim * 0.4) * 0.2
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(-10, -8, 14, 6)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(0, 8, 5, 30)
    ctx.fillStyle = "#1f2937"
    ctx.fillRect(-6, 4, 16, 12)
  }
  // Telegraph indicator
  if (e.specialTelegraph && e.specialTelegraph > 0) {
    ctx.fillStyle = "#ef4444"
    ctx.globalAlpha = 0.6 + Math.sin(e.specialTelegraph * 0.3) * 0.3
    ctx.fillRect(12, -10, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawRobot(ctx: CanvasRenderingContext2D, e: Enemy) {
  const elite = e.type === "robotElite"
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const bodyColor = elite ? "#374151" : "#4b5563"
  const eyeColor = e.specialTelegraph && e.specialTelegraph > 0 ? "#ef4444" : windup ? "#fbbf24" : "#ef4444"
  // Body
  ctx.fillStyle = bodyColor
  ctx.fillRect(2, 8, e.w - 4, e.h - 12)
  // Chest plate
  ctx.fillStyle = elite ? "#111827" : "#1f2937"
  ctx.fillRect(5, 12, e.w - 10, 10)
  // Eye / sensor
  ctx.fillStyle = eyeColor
  ctx.globalAlpha = 0.8 + Math.sin(e.animFrame * 0.5) * 0.2
  ctx.fillRect(6, 4, e.w - 12, 6)
  ctx.globalAlpha = 1
  // Antenna
  ctx.fillStyle = "#9ca3af"
  ctx.fillRect(e.w / 2 - 1, 0, 2, 6)
  if (elite) {
    ctx.fillStyle = windup ? "#ef4444" : "#fbbf24"
    ctx.fillRect(e.w / 2 - 2, -2, 4, 4)
  }
  // Legs
  ctx.fillStyle = "#1f2937"
  if (e.flying) {
    // Legs tucked back while flying
    ctx.fillRect(7, e.h - 6, 5, 6)
    ctx.fillRect(e.w - 12, e.h - 6, 5, 6)
  } else {
    ctx.fillRect(5, e.h - 10, 6, 10)
    ctx.fillRect(e.w - 11, e.h - 10, 6, 10)
  }
  // Jetpack / thruster flames when flying
  if (e.flying) {
    ctx.globalAlpha = 0.6 + Math.sin((e.flyTimer || 0) * 0.5) * 0.3
    ctx.fillStyle = "#38bdf8"
    ctx.fillRect(4, e.h - 2, 4, 6 + Math.random() * 4)
    ctx.fillRect(e.w - 8, e.h - 2, 4, 6 + Math.random() * 4)
    ctx.globalAlpha = 1
  }
  // Arms / gun - extended forward during attack
  ctx.fillStyle = "#6b7280"
  if (attacking) {
    const extend = windup ? 4 : 8
    ctx.fillRect(e.w - 2, 14, 4 + extend, 12)
    // Muzzle glow / charge
    ctx.globalAlpha = 0.6 + Math.sin((e.attackAnim || 0) * 0.6) * 0.3
    ctx.fillStyle = windup ? "#fbbf24" : "#93c5fd"
    ctx.fillRect(e.w + 2 + extend, 16, 6, 8)
    ctx.globalAlpha = 1
  } else {
    ctx.fillRect(-2, 14, 4, 12)
    ctx.fillRect(e.w - 2, 14, 4, 12)
  }
  // Telegraph indicator
  if (e.specialTelegraph && e.specialTelegraph > 0) {
    ctx.fillStyle = "#ef4444"
    ctx.globalAlpha = 0.6 + Math.sin(e.specialTelegraph * 0.3) * 0.3
    ctx.fillRect(e.w / 2 - 4, -10, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawAngel(ctx: CanvasRenderingContext2D, e: Enemy) {
  const seraph = e.type === "seraph"
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Wings
  ctx.fillStyle = seraph ? "#fde68a" : "#ffffff"
  ctx.globalAlpha = 0.9
  const wingFlap = Math.sin(e.animFrame * 0.6) * 2
  ctx.fillRect(-10 + wingFlap, 8, 10, 22)
  ctx.fillRect(e.w - wingFlap, 8, 10, 22)
  if (seraph) {
    ctx.fillRect(-14 + wingFlap, 10, 8, 18)
    ctx.fillRect(e.w + 6 - wingFlap, 10, 8, 18)
  }
  ctx.globalAlpha = 1
  // Body / robe
  ctx.fillStyle = seraph ? "#fbbf24" : "#e2e8f0"
  ctx.fillRect(4, 10, e.w - 8, e.h - 12)
  // Head
  ctx.fillStyle = "#fde68a"
  ctx.fillRect(6, 2, e.w - 12, 10)
  // Halo
  ctx.fillStyle = seraph ? "#fbbf24" : "#fde68a"
  ctx.fillRect(4, -2, e.w - 8, 3)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#1e1b4b"
  ctx.fillRect(8, 5, 3, 3)
  ctx.fillRect(e.w - 11, 5, 3, 3)
  // Raised hand / orb during attack
  if (attacking) {
    ctx.fillStyle = seraph ? "#fde68a" : "#e2e8f0"
    ctx.fillRect(e.w - 2, 12, 6, 10)
    ctx.globalAlpha = 0.6 + Math.sin((e.attackAnim || 0) * 0.6) * 0.3
    ctx.fillStyle = windup ? "#fbbf24" : "#93c5fd"
    ctx.beginPath()
    ctx.arc(e.w + 4, 14, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  // Telegraph indicator
  if (e.specialTelegraph && e.specialTelegraph > 0) {
    ctx.fillStyle = "#fbbf24"
    ctx.globalAlpha = 0.6 + Math.sin(e.specialTelegraph * 0.3) * 0.3
    ctx.fillRect(e.w / 2 - 4, -12, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawFishman(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Body - scaly green-blue
  ctx.fillStyle = "#2e8b8b"
  ctx.fillRect(4, 10, 18, 20)
  // Belly
  ctx.fillStyle = "#7dd3fc"
  ctx.fillRect(8, 14, 10, 14)
  // Head - fish face
  ctx.fillStyle = "#2e8b8b"
  ctx.fillRect(3, 0, 20, 12)
  // Fish lips / snout
  ctx.fillStyle = "#1a5a6a"
  ctx.fillRect(0, 4, 5, 6)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#ffffff"
  ctx.fillRect(6, 2, 4, 4)
  ctx.fillRect(14, 2, 4, 4)
  ctx.fillStyle = "#0f172a"
  ctx.fillRect(7, 3, 2, 2)
  ctx.fillRect(15, 3, 2, 2)
  // Fin on head
  ctx.fillStyle = "#f97316"
  ctx.fillRect(10, -4, 4, 5)
  // Gills
  ctx.fillStyle = "#1a5a6a"
  ctx.fillRect(20, 4, 2, 5)
  // Legs
  ctx.fillStyle = "#1a5a6a"
  ctx.fillRect(6, 30, 5, 4)
  ctx.fillRect(15, 30, 5, 4)
  // Trident - raised during attack
  ctx.fillStyle = "#94a3b8"
  if (attacking) {
    const raise = windup ? -8 : 0
    ctx.fillRect(22, 2 + raise, 2, 24)
    ctx.fillRect(18, 0 + raise, 2, 6)
    ctx.fillRect(22, -2 + raise, 2, 6)
    ctx.fillRect(26, 0 + raise, 2, 6)
    if (windup) {
      ctx.globalAlpha = 0.4 + Math.sin(e.attackAnim * 0.5) * 0.2
      ctx.fillStyle = "#38bdf8"
      ctx.fillRect(16, -6, 12, 4)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(22, 6, 2, 24)
    ctx.fillRect(18, 4, 2, 6)
    ctx.fillRect(22, 2, 2, 6)
    ctx.fillRect(26, 4, 2, 6)
  }
}

function drawJellyfish(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glow = e.specialTelegraph && e.specialTelegraph > 0
  // Bell (dome) - translucent pink/purple
  ctx.fillStyle = glow ? "#f0abfc" : "#c084fc"
  ctx.globalAlpha = 0.85
  ctx.fillRect(2, 0, 24, 12)
  ctx.fillRect(0, 4, 28, 8)
  ctx.globalAlpha = 1
  // Inner glow
  ctx.fillStyle = "#e9d5ff"
  ctx.fillRect(8, 3, 12, 5)
  // Eyes
  ctx.fillStyle = windup ? "#fbbf24" : "#4c1d95"
  ctx.fillRect(8, 6, 3, 3)
  ctx.fillRect(17, 6, 3, 3)
  // Tentacles - wavy
  ctx.fillStyle = "#a855f7"
  const wave = Math.sin(e.animFrame * 0.8) * 2
  ctx.fillRect(3 + wave, 12, 3, 14)
  ctx.fillRect(9 - wave, 12, 3, 16)
  ctx.fillRect(15 + wave, 12, 3, 15)
  ctx.fillRect(21 - wave, 12, 3, 14)
  ctx.fillRect(25 + wave, 12, 2, 12)
  // Sting tips
  ctx.fillStyle = "#e9d5ff"
  ctx.fillRect(3 + wave, 24, 3, 2)
  ctx.fillRect(15 + wave, 25, 3, 2)
  // Charge orb while attacking
  if (attacking) {
    ctx.globalAlpha = 0.6 + Math.sin((e.attackAnim || 0) * 0.6) * 0.3
    ctx.fillStyle = windup ? "#fbbf24" : "#93c5fd"
    ctx.beginPath()
    ctx.arc(14, 16, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  // Telegraph indicator
  if (glow) {
    ctx.fillStyle = "#f0abfc"
    ctx.globalAlpha = 0.6 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.fillRect(10, -8, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawImp(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Body - small red demon
  ctx.fillStyle = "#dc2626"
  ctx.fillRect(4, 8, 14, 14)
  // Head
  ctx.fillRect(4, 0, 14, 10)
  // Horns
  ctx.fillStyle = "#7f1d1d"
  ctx.fillRect(2, -4, 3, 6)
  ctx.fillRect(17, -4, 3, 6)
  // Eyes - yellow glow
  ctx.fillStyle = windup ? "#ffffff" : "#fef08a"
  ctx.fillRect(6, 3, 3, 3)
  ctx.fillRect(13, 3, 3, 3)
  // Grin
  ctx.fillStyle = "#7f1d1d"
  ctx.fillRect(7, 7, 8, 2)
  // Belly
  ctx.fillStyle = "#f97316"
  ctx.fillRect(7, 12, 8, 8)
  // Legs
  ctx.fillStyle = "#991b1b"
  ctx.fillRect(5, 22, 4, 4)
  ctx.fillRect(13, 22, 4, 4)
  // Tail with arrow tip
  ctx.fillStyle = "#dc2626"
  ctx.fillRect(18, 14, 4, 2)
  ctx.fillRect(20, 12, 2, 4)
  // Fireball in hand while attacking
  if (attacking) {
    ctx.fillStyle = windup ? "#fbbf24" : "#f97316"
    ctx.globalAlpha = 0.6 + Math.sin((e.attackAnim || 0) * 0.5) * 0.3
    ctx.fillRect(-4, windup ? -2 : 4, 6, 6)
    ctx.globalAlpha = 1
  }
}

function drawLavaGolem(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glow = e.specialTelegraph && e.specialTelegraph > 0
  // Body - dark volcanic rock
  ctx.fillStyle = glow ? "#4a2a2a" : "#292524"
  ctx.fillRect(4, 12, 32, 26)
  // Lava cracks
  ctx.fillStyle = PALETTE.lava
  ctx.globalAlpha = 0.7 + Math.sin(e.animFrame * 0.5) * 0.3
  ctx.fillRect(10, 16, 3, 18)
  ctx.fillRect(20, 14, 2, 22)
  ctx.fillRect(28, 18, 3, 14)
  ctx.fillRect(12, 24, 16, 2)
  ctx.globalAlpha = 1
  // Head
  ctx.fillStyle = "#292524"
  ctx.fillRect(8, 0, 24, 14)
  // Eyes - molten
  ctx.fillStyle = windup ? "#fef08a" : PALETTE.lava
  ctx.fillRect(12, 4, 5, 5)
  ctx.fillRect(23, 4, 5, 5)
  // Mouth glow
  ctx.fillStyle = PALETTE.lavaBright
  ctx.fillRect(16, 10, 8, 2)
  // Arms - big rocky fists
  ctx.fillStyle = "#1c1917"
  if (attacking) {
    const raise = windup ? -10 : -2
    ctx.fillRect(-2, 14 + raise, 8, 18)
    ctx.fillRect(34, 14 + raise, 8, 18)
    if (windup) {
      ctx.globalAlpha = 0.5 + Math.sin(e.attackAnim * 0.4) * 0.2
      ctx.fillStyle = PALETTE.lava
      ctx.fillRect(-4, 8 + raise, 10, 6)
      ctx.fillRect(34, 8 + raise, 10, 6)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(-2, 16, 8, 18)
    ctx.fillRect(34, 16, 8, 18)
  }
  // Legs
  ctx.fillStyle = "#1c1917"
  ctx.fillRect(8, 38, 8, 6)
  ctx.fillRect(24, 38, 8, 6)
  // Telegraph indicator
  if (glow) {
    ctx.fillStyle = PALETTE.lava
    ctx.globalAlpha = 0.6 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.fillRect(16, -8, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawVirus(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glow = e.specialTelegraph && e.specialTelegraph > 0
  // Glitchy pixel bug body - green matrix style
  ctx.fillStyle = glow ? "#4ade80" : "#16a34a"
  ctx.fillRect(4, 8, 16, 16)
  // Glitch fragments floating off the body
  ctx.fillStyle = "#22c55e"
  const glitch = Math.sin(e.animFrame * 1.2) * 2
  ctx.fillRect(0 + glitch, 6, 3, 3)
  ctx.fillRect(21 - glitch, 12, 3, 3)
  ctx.fillRect(2 - glitch, 20, 2, 2)
  // Screen face
  ctx.fillStyle = "#052e16"
  ctx.fillRect(6, 10, 12, 8)
  // Eyes - cyan pixels
  ctx.fillStyle = windup ? "#fbbf24" : PALETTE.cyber
  ctx.fillRect(8, 12, 3, 3)
  ctx.fillRect(14, 12, 3, 3)
  // Mouth - scanline
  ctx.fillStyle = "#22c55e"
  ctx.fillRect(9, 16, 7, 1)
  // Legs - wireframe
  ctx.fillStyle = "#16a34a"
  ctx.fillRect(6, 24, 3, 4)
  ctx.fillRect(15, 24, 3, 4)
  // Antenna
  ctx.fillRect(11, 2, 2, 6)
  ctx.fillStyle = PALETTE.cyber
  ctx.fillRect(10, 0, 4, 3)
  // Data orb while attacking
  if (attacking) {
    ctx.globalAlpha = 0.6 + Math.sin((e.attackAnim || 0) * 0.6) * 0.3
    ctx.fillStyle = windup ? "#fbbf24" : PALETTE.cyber
    ctx.fillRect(22, 10, 5, 5)
    ctx.globalAlpha = 1
  }
  // Telegraph indicator
  if (glow) {
    ctx.fillStyle = "#4ade80"
    ctx.globalAlpha = 0.6 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.fillRect(8, -6, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawFirewall(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glow = e.specialTelegraph && e.specialTelegraph > 0
  // Body - red brick firewall with circuitry
  ctx.fillStyle = glow ? "#7f1d1d" : "#991b1b"
  ctx.fillRect(2, 8, 30, 30)
  // Brick lines
  ctx.fillStyle = "#450a0a"
  ctx.fillRect(2, 16, 30, 2)
  ctx.fillRect(2, 26, 30, 2)
  ctx.fillRect(10, 8, 2, 8)
  ctx.fillRect(22, 18, 2, 8)
  ctx.fillRect(12, 28, 2, 8)
  // Circuit glow on bricks
  ctx.fillStyle = PALETTE.cyber
  ctx.globalAlpha = 0.5 + Math.sin(e.animFrame * 0.5) * 0.2
  ctx.fillRect(4, 10, 8, 2)
  ctx.fillRect(20, 20, 8, 2)
  ctx.fillRect(6, 30, 10, 2)
  ctx.globalAlpha = 1
  // Head - security camera / sensor
  ctx.fillStyle = "#1f2937"
  ctx.fillRect(7, 0, 20, 8)
  // Eye - scanning lens
  ctx.fillStyle = windup ? "#fbbf24" : "#ef4444"
  ctx.globalAlpha = 0.8 + Math.sin(e.animFrame * 0.7) * 0.2
  ctx.fillRect(14, 2, 6, 4)
  ctx.globalAlpha = 1
  // Arms - firewall shields
  ctx.fillStyle = "#7f1d1d"
  if (attacking) {
    const raise = windup ? -8 : 0
    ctx.fillRect(-4, 12 + raise, 6, 20)
    ctx.fillRect(32, 12 + raise, 6, 20)
    if (windup) {
      ctx.globalAlpha = 0.5 + Math.sin(e.attackAnim * 0.4) * 0.2
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(-6, 6 + raise, 8, 6)
      ctx.fillRect(32, 6 + raise, 8, 6)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(-4, 14, 6, 20)
    ctx.fillRect(32, 14, 6, 20)
  }
  // Legs
  ctx.fillStyle = "#450a0a"
  ctx.fillRect(6, 38, 8, 6)
  ctx.fillRect(20, 38, 8, 6)
  // Telegraph indicator
  if (glow) {
    ctx.fillStyle = "#ef4444"
    ctx.globalAlpha = 0.6 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.fillRect(13, -8, 8, 4)
    ctx.globalAlpha = 1
  }
}

function drawSkeleton(ctx: CanvasRenderingContext2D, e: Enemy) {
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  // Skull
  ctx.fillStyle = PALETTE.skeletonBone
  ctx.fillRect(5, 0, 14, 14)
  // Eye sockets
  ctx.fillStyle = "#0f172a"
  ctx.fillRect(7, 3, 4, 4)
  ctx.fillRect(13, 3, 4, 4)
  ctx.fillStyle = windup ? "#fbbf24" : "#ef4444"
  ctx.fillRect(8, 4, 2, 2)
  ctx.fillRect(14, 4, 2, 2)
  // Jaw
  ctx.fillStyle = PALETTE.skeletonBone
  ctx.fillRect(7, 12, 10, 5)
  ctx.fillStyle = "#0f172a"
  ctx.fillRect(9, 14, 2, 3); ctx.fillRect(13, 14, 2, 3)
  // Ribcage
  ctx.fillStyle = PALETTE.skeletonBone
  ctx.fillRect(6, 17, 12, 12)
  ctx.fillStyle = "#1e293b"
  for (let i = 0; i < 3; i++) ctx.fillRect(7, 19 + i * 3, 10, 2)
  // Arms
  ctx.fillStyle = PALETTE.skeletonBone
  if (attacking) {
    // Sword arm raised
    ctx.fillRect(2, 17, 4, 12)
    ctx.save()
    ctx.translate(20, 19)
    ctx.rotate(windup ? -0.6 : 0.5)
    ctx.fillRect(0, -10, 2, 18)
    ctx.fillStyle = "#fbbf24"
    ctx.fillRect(-2, -4, 6, 2)
    ctx.restore()
    if (windup) {
      ctx.globalAlpha = 0.4 + Math.sin(e.attackAnim * 0.5) * 0.2
      ctx.fillStyle = "#ef4444"
      ctx.fillRect(18, -4, 6, 6)
      ctx.globalAlpha = 1
    }
  } else {
    ctx.fillRect(2, 17, 4, 12); ctx.fillRect(18, 17, 4, 12)
  }
  // Pelvis + legs
  ctx.fillStyle = PALETTE.skeletonBone
  ctx.fillRect(6, 29, 12, 4)
  ctx.fillRect(6, 33, 4, 8); ctx.fillRect(14, 33, 4, 8)
  // Sword (drawn above if not attacking)
  if (!attacking) {
    ctx.fillStyle = "#94a3b8"
    ctx.fillRect(0, 10, 2, 18)
    ctx.fillStyle = "#fbbf24"
    ctx.fillRect(-2, 16, 6, 2)
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, e: Enemy) {
  if (e.bossKind === "muska") return drawMuska(ctx, e)
  if (e.bossKind === "god") return drawGod(ctx, e)
  if (e.bossKind === "leviathan") return drawLeviathan(ctx, e)
  if (e.bossKind === "ifrit") return drawIfrit(ctx, e)
  if (e.bossKind === "ai") return drawAI(ctx, e)

  // Dark Lord
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glowColor = phase2 ? "#ef4444" : windup ? "#fbbf24" : PALETTE.bossGlow
  const bodyColor = phase2 ? "#7f1d1d" : PALETTE.bossBody
  const pulse = Math.sin(e.animFrame * 0.8) * 3

  // Aura glow
  ctx.globalAlpha = 0.25 + Math.abs(Math.sin(e.animFrame * 0.5)) * 0.15
  ctx.fillStyle = glowColor
  ctx.fillRect(-8 - pulse, -8 - pulse, e.w + 16 + pulse * 2, e.h + 16 + pulse * 2)
  ctx.globalAlpha = 1

  // Body
  ctx.fillStyle = bodyColor
  ctx.fillRect(8, 16, 48, 44)

  // Robe trim
  ctx.fillStyle = phase2 ? "#dc2626" : "#5b21b6"
  ctx.fillRect(8, 16, 48, 6)
  ctx.fillRect(8, 52, 48, 8)

  // Head
  ctx.fillStyle = phase2 ? "#991b1b" : PALETTE.bossDark
  ctx.fillRect(10, 4, 44, 16)

  // Crown
  ctx.fillStyle = "#fbbf24"
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(15 + i * 12, -4, 8, 10)
  }
  ctx.fillRect(10, 0, 44, 6)

  // Eyes
  ctx.fillStyle = phase2 ? "#fef08a" : windup ? "#fbbf24" : "#fbbf24"
  ctx.fillRect(16, 7, 8, 8)
  ctx.fillRect(40, 7, 8, 8)
  ctx.fillStyle = phase2 ? "#ef4444" : "#1e1b4b"
  ctx.fillRect(18, 9, 4, 4)
  ctx.fillRect(42, 9, 4, 4)

  // Arms
  ctx.fillStyle = bodyColor
  ctx.fillRect(0, 18, 10, 28)
  ctx.fillRect(54, 18, 10, 28)

  // Hands with orbs
  ctx.fillStyle = glowColor
  ctx.fillRect(-4, 42, 10, 10)
  ctx.fillRect(58, 42, 10, 10)

  // Staff - raised and pulsing during attack
  ctx.save()
  if (attacking) {
    ctx.translate(62, 48)
    ctx.rotate(windup ? -0.35 : 0.15)
    ctx.fillStyle = "#78350f"
    ctx.fillRect(-2, -48, 4, 50)
    ctx.fillStyle = glowColor
    ctx.globalAlpha = 0.7 + Math.sin((e.attackAnim || 0) * 0.4) * 0.3
    ctx.fillRect(-6, -54, 12, 12)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = "#78350f"
    ctx.fillRect(60, 0, 4, 50)
    ctx.fillStyle = glowColor
    ctx.fillRect(56, -6, 12, 12)
  }
  ctx.restore()

  // Legs
  ctx.fillStyle = PALETTE.bossDark
  ctx.fillRect(12, 58, 16, 8)
  ctx.fillRect(36, 58, 16, 8)

  // Channelling the poison nova: a void orb swells above him
  if ((e.specialTelegraph ?? 0) > 0) {
    const ch = 1 - (e.specialTelegraph ?? 0) / 90
    ctx.globalAlpha = 0.5 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.fillStyle = "#a855f7"
    ctx.beginPath()
    ctx.arc(32, -20 - ch * 6, 8 + ch * 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#e9d5ff"
    ctx.beginPath()
    ctx.arc(32, -20 - ch * 6, 3 + ch * 5, 0, Math.PI * 2)
    ctx.fill()
    // Motes spiralling inward
    ctx.fillStyle = "#7e22ce"
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + ch * 6
      const r = 30 - ch * 18
      ctx.fillRect(32 + Math.cos(ang) * r - 2, -20 + Math.sin(ang) * r - 2, 4, 4)
    }
    ctx.globalAlpha = 1
  }

  // Phase 2 cracks
  if (phase2) {
    ctx.fillStyle = "#fef08a"
    ctx.fillRect(22, 20, 2, 20)
    ctx.fillRect(38, 24, 2, 16)
    ctx.fillRect(28, 32, 2, 12)
  }
}

function drawMuska(ctx: CanvasRenderingContext2D, e: Enemy) {
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const t = attackProgress(e)
  const casting = (e.specialTelegraph ?? 0) > 0
  // Muska levels his pistol on the wind-up, then it kicks on the shot
  const aim = attacking ? (windup ? -6 * t : 4 * Math.max(0, 1 - t * 2.4)) : 0
  const kick = attacking && !windup ? Math.max(0, 1 - t * 3) * 6 : 0

  // White uniform
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(10, 16, 44, 42)
  // Gold trim
  ctx.fillStyle = "#fbbf24"
  ctx.fillRect(10, 16, 44, 5)
  ctx.fillRect(10, 24, 44, 3)
  // Head
  ctx.fillStyle = "#fde68a"
  ctx.fillRect(14, 4, 36, 14)
  // Hair
  ctx.fillStyle = "#78350f"
  ctx.fillRect(14, 2, 36, 5)
  // Glasses — flare white when he takes aim
  ctx.fillStyle = windup || casting ? "#e0f2fe" : "#111827"
  ctx.fillRect(18, 8, 10, 5)
  ctx.fillRect(36, 8, 10, 5)
  ctx.fillStyle = "#111827"
  ctx.fillRect(28, 10, 8, 2)
  // Off arm
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(2, 22, 10, 24)
  // Gun arm — raises to fire
  ctx.save()
  ctx.translate(52 - kick, 22 + aim)
  ctx.rotate(attacking ? (windup ? -0.35 * t : 0.12) : 0)
  ctx.fillStyle = "#f8fafc"
  ctx.fillRect(0, 0, 10, 24)
  // Pistol
  ctx.fillStyle = "#1f2937"
  ctx.fillRect(4, 2, 14, 8)
  ctx.fillRect(6, 10, 5, 6)
  // Muzzle flash on the shot
  if (attacking && !windup && t < 0.35) {
    ctx.globalAlpha = 1 - t / 0.35
    ctx.fillStyle = "#fef08a"
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const r = i % 2 === 0 ? 12 : 5
      ctx.lineTo(19 + Math.cos(ang) * r, 6 + Math.sin(ang) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 1
  }
  // Charge glow while lining up the shot
  if (windup) {
    ctx.globalAlpha = 0.4 + Math.sin(e.attackAnim * 0.5) * 0.3
    ctx.fillStyle = "#93c5fd"
    ctx.fillRect(16, 3, 6, 6)
    ctx.globalAlpha = 1
  }
  ctx.restore()
  // Legs
  ctx.fillStyle = "#e2e8f0"
  ctx.fillRect(16, 56, 12, 8)
  ctx.fillRect(36, 56, 12, 8)

  // Air-strike call: he raises a hand and a targeting reticle blinks overhead
  if (casting) {
    const pulse = 0.5 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.4
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(2, 6, 10, 18)          // raised signalling arm
    ctx.globalAlpha = pulse
    ctx.strokeStyle = "#93c5fd"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(32, -18, 12, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(32, -32); ctx.lineTo(32, -4)
    ctx.moveTo(18, -18); ctx.lineTo(46, -18)
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.globalAlpha = 1
  }
  // Phase 2 red eye glow
  if (phase2) {
    ctx.fillStyle = "#ef4444"
    ctx.fillRect(19, 9, 3, 3)
    ctx.fillRect(37, 9, 3, 3)
  }
}

function drawGod(ctx: CanvasRenderingContext2D, e: Enemy) {
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const t = attackProgress(e)
  const casting = (e.specialTelegraph ?? 0) > 0
  const pulse = Math.sin(e.animFrame * 0.8) * 4
  // Arms sweep up while smiting, wings flare wide on the strike
  const armRaise = attacking ? (windup ? -14 * t : -4) : casting ? -16 : 0
  const wingSpread = attacking && !windup ? Math.max(0, 1 - t * 2) * 8 : casting ? 6 : 0

  // Radiant aura
  ctx.globalAlpha = 0.25 + Math.abs(Math.sin(e.animFrame * 0.5)) * 0.15 + (casting ? 0.2 : 0)
  ctx.fillStyle = phase2 ? "#f59e0b" : "#fde68a"
  ctx.fillRect(-10 - pulse, -10 - pulse, e.w + 20 + pulse * 2, e.h + 20 + pulse * 2)
  ctx.globalAlpha = 1
  // Wings
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(-14 - wingSpread, 14 - wingSpread / 2, 18, 40 + wingSpread)
  ctx.fillRect(e.w - 4 + wingSpread, 14 - wingSpread / 2, 18, 40 + wingSpread)
  // Body / robe
  ctx.fillStyle = "#fef3c7"
  ctx.fillRect(12, 14, 40, 44)
  // Sash
  ctx.fillStyle = "#fbbf24"
  ctx.fillRect(12, 24, 40, 6)
  // Head
  ctx.fillStyle = "#fde68a"
  ctx.fillRect(18, 2, 28, 14)
  // Halo — spins up while casting
  ctx.fillStyle = "#fbbf24"
  const haloW = 44 + (casting ? Math.sin((e.specialTelegraph || 0) * 0.25) * 8 : 0)
  ctx.fillRect(32 - haloW / 2, -6, haloW, 6)
  // Eyes — blaze white when judgement is coming
  ctx.fillStyle = casting || windup ? "#ffffff" : phase2 ? "#ef4444" : "#1e1b4b"
  ctx.fillRect(24, 7, 4, 4)
  ctx.fillRect(38, 7, 4, 4)
  // Arms
  ctx.fillStyle = "#fef3c7"
  ctx.fillRect(2, 20 + armRaise, 10, 26)
  ctx.fillRect(52, 20 + armRaise, 10, 26)
  // Hands, holding gathering light
  ctx.fillStyle = "#fbbf24"
  ctx.fillRect(-2, 42 + armRaise, 10, 10)
  ctx.fillRect(56, 42 + armRaise, 10, 10)
  if (attacking || casting) {
    const g = 0.5 + Math.sin((e.attackAnim || e.specialTelegraph || 0) * 0.4) * 0.4
    ctx.globalAlpha = g
    ctx.fillStyle = "#ffffff"
    ctx.beginPath(); ctx.arc(3, 46 + armRaise, 8, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(61, 46 + armRaise, 8, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }
  // Legs
  ctx.fillStyle = "#f5e6c8"
  ctx.fillRect(18, 56, 10, 8)
  ctx.fillRect(36, 56, 10, 8)

  // Judgement beam gathering above him while a skill is telegraphed
  if (casting) {
    const a = 0.35 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.25
    ctx.globalAlpha = a
    ctx.fillStyle = "#fef08a"
    ctx.fillRect(26, -68, 12, 64)
    ctx.globalAlpha = a * 0.6
    ctx.fillRect(20, -68, 24, 64)
    ctx.globalAlpha = 1
  }
  // Strike flash: pillars of light slam down beside him
  if (attacking && !windup && t < 0.4) {
    ctx.globalAlpha = (1 - t / 0.4) * 0.8
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(-16, -58, 8, 118)
    ctx.fillRect(e.w + 8, -58, 8, 118)
    ctx.globalAlpha = 1
  }
}

function drawLeviathan(ctx: CanvasRenderingContext2D, e: Enemy) {
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glowColor = phase2 ? "#ef4444" : windup ? "#fbbf24" : "#38bdf8"
  const bodyColor = phase2 ? "#0c4a6e" : "#155e75"
  const pulse = Math.sin(e.animFrame * 0.8) * 3

  // Water aura
  ctx.globalAlpha = 0.25 + Math.abs(Math.sin(e.animFrame * 0.5)) * 0.15
  ctx.fillStyle = glowColor
  ctx.fillRect(-8 - pulse, -8 - pulse, e.w + 16 + pulse * 2, e.h + 16 + pulse * 2)
  ctx.globalAlpha = 1

  // Sea serpent body - long and scaled
  ctx.fillStyle = bodyColor
  ctx.fillRect(6, 18, 52, 40)
  // Belly scales
  ctx.fillStyle = "#7dd3fc"
  ctx.fillRect(10, 34, 44, 22)
  ctx.fillStyle = bodyColor
  for (let i = 0; i < 4; i++) ctx.fillRect(10, 36 + i * 5, 44, 2)
  // Back fins
  ctx.fillStyle = "#0ea5e9"
  ctx.fillRect(14, 8, 6, 12)
  ctx.fillRect(30, 4, 6, 16)
  ctx.fillRect(46, 8, 6, 12)
  // Head - serpent
  ctx.fillStyle = bodyColor
  ctx.fillRect(8, 0, 40, 20)
  // Snout
  ctx.fillRect(0, 6, 10, 10)
  // Jaw with fangs
  ctx.fillStyle = "#0c4a6e"
  ctx.fillRect(2, 14, 12, 5)
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(3, 13, 2, 4)
  ctx.fillRect(8, 13, 2, 4)
  // Eyes - glowing deep sea
  ctx.fillStyle = phase2 ? "#fef08a" : windup ? "#fbbf24" : "#38bdf8"
  ctx.fillRect(14, 4, 7, 7)
  ctx.fillRect(32, 4, 7, 7)
  ctx.fillStyle = phase2 ? "#ef4444" : "#0f172a"
  ctx.fillRect(16, 6, 3, 3)
  ctx.fillRect(34, 6, 3, 3)
  // Head crest
  ctx.fillStyle = "#0ea5e9"
  ctx.fillRect(20, -6, 4, 8)
  ctx.fillRect(28, -6, 4, 8)
  // Arms with claws
  ctx.fillStyle = bodyColor
  ctx.fillRect(0, 24, 10, 22)
  ctx.fillRect(54, 24, 10, 22)
  ctx.fillStyle = glowColor
  ctx.fillRect(-4, 42, 10, 8)
  ctx.fillRect(58, 42, 10, 8)
  // Water orb staff - raised during attack
  ctx.save()
  if (attacking) {
    ctx.translate(62, 48)
    ctx.rotate(windup ? -0.35 : 0.15)
    ctx.fillStyle = "#155e75"
    ctx.fillRect(-2, -48, 4, 50)
    ctx.fillStyle = glowColor
    ctx.globalAlpha = 0.7 + Math.sin((e.attackAnim || 0) * 0.4) * 0.3
    ctx.beginPath()
    ctx.arc(0, -50, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = "#155e75"
    ctx.fillRect(60, 0, 4, 50)
    ctx.fillStyle = glowColor
    ctx.beginPath()
    ctx.arc(62, -2, 7, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  // Tail / lower body
  ctx.fillStyle = "#0c4a6e"
  ctx.fillRect(12, 56, 16, 8)
  ctx.fillRect(36, 56, 16, 8)

  // Channelling the abyssal nova: water spirals up around him
  if ((e.specialTelegraph ?? 0) > 0) {
    const ch = 1 - (e.specialTelegraph ?? 0) / 90
    ctx.globalAlpha = 0.45 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.25
    ctx.fillStyle = "#38bdf8"
    for (let i = 0; i < 10; i++) {
      const ang = i * 0.9 + ch * 8
      const yy = 60 - i * 9 - ch * 14
      ctx.fillRect(32 + Math.cos(ang) * (22 - i) - 3, yy, 6, 6)
    }
    ctx.fillStyle = "#e0f2fe"
    ctx.beginPath()
    ctx.arc(32, -18, 6 + ch * 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  // Phase 2 glowing cracks
  if (phase2) {
    ctx.fillStyle = "#7dd3fc"
    ctx.fillRect(22, 22, 2, 20)
    ctx.fillRect(38, 26, 2, 16)
    ctx.fillRect(28, 34, 2, 12)
  }
}

function drawIfrit(ctx: CanvasRenderingContext2D, e: Enemy) {
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glowColor = phase2 ? "#fef08a" : windup ? "#fbbf24" : PALETTE.lava
  const bodyColor = phase2 ? "#7f1d1d" : "#991b1b"
  const pulse = Math.sin(e.animFrame * 0.8) * 3

  // Fire aura
  ctx.globalAlpha = 0.25 + Math.abs(Math.sin(e.animFrame * 0.5)) * 0.15
  ctx.fillStyle = glowColor
  ctx.fillRect(-8 - pulse, -8 - pulse, e.w + 16 + pulse * 2, e.h + 16 + pulse * 2)
  ctx.globalAlpha = 1

  // Body - muscular fire demon
  ctx.fillStyle = bodyColor
  ctx.fillRect(8, 16, 48, 42)
  // Chest magma core
  ctx.fillStyle = PALETTE.lava
  ctx.globalAlpha = 0.8 + Math.sin(e.animFrame * 0.6) * 0.2
  ctx.fillRect(24, 24, 16, 16)
  ctx.fillStyle = PALETTE.lavaBright
  ctx.fillRect(28, 28, 8, 8)
  ctx.globalAlpha = 1
  // Head
  ctx.fillStyle = bodyColor
  ctx.fillRect(12, 2, 40, 16)
  // Demon horns - big curved
  ctx.fillStyle = "#450a0a"
  ctx.fillRect(4, -8, 6, 14)
  ctx.fillRect(2, -12, 4, 6)
  ctx.fillRect(54, -8, 6, 14)
  ctx.fillRect(58, -12, 4, 6)
  // Eyes - burning
  ctx.fillStyle = phase2 ? "#ffffff" : windup ? "#fbbf24" : PALETTE.lavaBright
  ctx.fillRect(18, 6, 8, 6)
  ctx.fillRect(38, 6, 8, 6)
  // Grinning fangs
  ctx.fillStyle = "#450a0a"
  ctx.fillRect(22, 13, 20, 3)
  ctx.fillStyle = "#fef3c7"
  ctx.fillRect(24, 12, 3, 4)
  ctx.fillRect(37, 12, 3, 4)
  // Arms - flaming
  ctx.fillStyle = bodyColor
  ctx.fillRect(0, 20, 10, 26)
  ctx.fillRect(54, 20, 10, 26)
  // Flame hands
  ctx.fillStyle = glowColor
  ctx.globalAlpha = 0.7 + Math.sin(e.animFrame * 0.7) * 0.3
  ctx.fillRect(-4, 42, 12, 12)
  ctx.fillRect(56, 42, 12, 12)
  ctx.fillStyle = PALETTE.lavaBright
  ctx.fillRect(-2, 38, 6, 8)
  ctx.fillRect(58, 38, 6, 8)
  ctx.globalAlpha = 1
  // Flame sword - raised during attack
  ctx.save()
  if (attacking) {
    ctx.translate(62, 48)
    ctx.rotate(windup ? -0.4 : 0.15)
    ctx.fillStyle = "#450a0a"
    ctx.fillRect(-2, -46, 4, 48)
    ctx.fillStyle = glowColor
    ctx.globalAlpha = 0.7 + Math.sin((e.attackAnim || 0) * 0.4) * 0.3
    ctx.fillRect(-4, -54, 8, 12)
    ctx.fillStyle = PALETTE.lavaBright
    ctx.fillRect(-2, -58, 4, 6)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = "#450a0a"
    ctx.fillRect(60, 0, 4, 48)
    ctx.fillStyle = glowColor
    ctx.fillRect(58, -8, 8, 12)
    ctx.fillStyle = PALETTE.lavaBright
    ctx.fillRect(60, -12, 4, 6)
  }
  ctx.restore()
  // Legs
  ctx.fillStyle = "#450a0a"
  ctx.fillRect(12, 56, 16, 8)
  ctx.fillRect(36, 56, 16, 8)

  // Channelling the eruption: the ground splits and fire jets climb his body
  if ((e.specialTelegraph ?? 0) > 0) {
    const ch = 1 - (e.specialTelegraph ?? 0) / 90
    ctx.globalAlpha = 0.5 + Math.sin((e.specialTelegraph || 0) * 0.35) * 0.3
    ctx.fillStyle = PALETTE.lava
    for (let i = 0; i < 7; i++) {
      const xx = 2 + i * 9
      const hh = 8 + ((i * 37) % 17) + ch * 26
      ctx.fillRect(xx, 64 - hh, 5, hh)
    }
    ctx.fillStyle = PALETTE.lavaBright
    for (let i = 0; i < 5; i++) ctx.fillRect(6 + i * 13, 62 - ch * 40 - i * 4, 3, 6)
    ctx.globalAlpha = 1
  }

  // Phase 2: extra fire jets on shoulders
  if (phase2) {
    ctx.fillStyle = PALETTE.lava
    ctx.globalAlpha = 0.6 + Math.sin(e.animFrame * 0.9) * 0.3
    ctx.fillRect(6, 8, 6, 10)
    ctx.fillRect(52, 8, 6, 10)
    ctx.globalAlpha = 1
  }
}

function drawAI(ctx: CanvasRenderingContext2D, e: Enemy) {
  const phase2 = e.phase === 2
  const attacking = e.state === "attack"
  const windup = attacking && e.attackPhase === "windup"
  const glowColor = phase2 ? "#ef4444" : windup ? "#fbbf24" : PALETTE.cyber
  const pulse = Math.sin(e.animFrame * 0.8) * 3

  // Digital aura
  ctx.globalAlpha = 0.25 + Math.abs(Math.sin(e.animFrame * 0.5)) * 0.15
  ctx.fillStyle = glowColor
  ctx.fillRect(-8 - pulse, -8 - pulse, e.w + 16 + pulse * 2, e.h + 16 + pulse * 2)
  ctx.globalAlpha = 1

  // Body - big computer mainframe / monitor
  ctx.fillStyle = "#1f2937"
  ctx.fillRect(8, 14, 48, 44)
  // Screen face
  ctx.fillStyle = "#020617"
  ctx.fillRect(12, 18, 40, 28)
  // Scanlines on screen
  ctx.fillStyle = "#0f172a"
  for (let i = 0; i < 4; i++) ctx.fillRect(12, 20 + i * 6, 40, 2)
  // Eyes on screen - glowing cyan
  ctx.fillStyle = phase2 ? "#ef4444" : windup ? "#fbbf24" : PALETTE.cyber
  ctx.fillRect(18, 24, 8, 8)
  ctx.fillRect(38, 24, 8, 8)
  ctx.fillStyle = "#e0f2fe"
  ctx.fillRect(20, 26, 3, 3)
  ctx.fillRect(40, 26, 3, 3)
  // Mouth - digital waveform
  ctx.fillStyle = glowColor
  const wave = Math.sin(e.animFrame * 0.8) * 2
  ctx.fillRect(20, 38, 4, 2 + wave)
  ctx.fillRect(26, 38, 4, 4 - wave)
  ctx.fillRect(32, 38, 4, 2 + wave)
  ctx.fillRect(38, 38, 4, 4 - wave)
  // Antenna with blinking light
  ctx.fillStyle = "#4b5563"
  ctx.fillRect(30, 4, 4, 10)
  ctx.fillStyle = Math.floor(e.animFrame / 2) % 2 === 0 ? "#ef4444" : "#7f1d1d"
  ctx.fillRect(29, 0, 6, 5)
  // Side panels with circuit lights
  ctx.fillStyle = "#374151"
  ctx.fillRect(2, 20, 6, 30)
  ctx.fillRect(56, 20, 6, 30)
  ctx.fillStyle = PALETTE.circuitBright
  ctx.globalAlpha = 0.6 + Math.sin(e.animFrame * 0.6) * 0.3
  ctx.fillRect(3, 24, 4, 2)
  ctx.fillRect(3, 32, 4, 2)
  ctx.fillRect(57, 28, 4, 2)
  ctx.fillRect(57, 38, 4, 2)
  ctx.globalAlpha = 1
  // Arms - robotic with data orbs
  ctx.fillStyle = "#374151"
  ctx.fillRect(0, 22, 8, 24)
  ctx.fillRect(56, 22, 8, 24)
  ctx.fillStyle = glowColor
  ctx.fillRect(-4, 42, 10, 10)
  ctx.fillRect(58, 42, 10, 10)
  // Data cannon - raised during attack
  ctx.save()
  if (attacking) {
    ctx.translate(62, 48)
    ctx.rotate(windup ? -0.35 : 0.15)
    ctx.fillStyle = "#4b5563"
    ctx.fillRect(-2, -46, 4, 48)
    ctx.fillStyle = glowColor
    ctx.globalAlpha = 0.7 + Math.sin((e.attackAnim || 0) * 0.4) * 0.3
    ctx.fillRect(-5, -52, 10, 10)
    ctx.fillStyle = "#e0f2fe"
    ctx.fillRect(-2, -49, 4, 4)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = "#4b5563"
    ctx.fillRect(60, 0, 4, 48)
    ctx.fillStyle = glowColor
    ctx.fillRect(57, -6, 10, 10)
    ctx.fillStyle = "#e0f2fe"
    ctx.fillRect(60, -3, 4, 4)
  }
  ctx.restore()
  // Legs - metal base
  ctx.fillStyle = "#111827"
  ctx.fillRect(12, 56, 16, 8)
  ctx.fillRect(36, 56, 16, 8)

  // Compiling an attack: holographic rings and a scan sweep over the screen
  if ((e.specialTelegraph ?? 0) > 0) {
    const ch = 1 - (e.specialTelegraph ?? 0) / 90
    ctx.globalAlpha = 0.5 + Math.sin((e.specialTelegraph || 0) * 0.3) * 0.3
    ctx.strokeStyle = PALETTE.cyber
    ctx.lineWidth = 2
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath()
      ctx.ellipse(32, 30, 26 + ring * 8 + ch * 10, 8 + ring * 3, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.lineWidth = 1
    ctx.fillStyle = PALETTE.circuitBright
    ctx.fillRect(12, 18 + ((e.animFrame * 4) % 28), 40, 2)
    ctx.globalAlpha = 1
  }

  // Phase 2: glitch fragments
  if (phase2) {
    ctx.fillStyle = "#ef4444"
    const g = Math.sin(e.animFrame * 1.5) * 3
    ctx.fillRect(-6 + g, 10, 4, 4)
    ctx.fillRect(66 - g, 30, 4, 4)
    ctx.fillRect(20 + g, -4, 3, 3)
  }
}

function drawPotion(ctx: CanvasRenderingContext2D, pot: Potion, cam: number) {
  const sx = Math.round(pot.x - cam)
  const bob = Math.sin(pot.bobOffset) * 2  // float up/down by 2px
  const sy = Math.round(pot.y + bob)
  if (sx < -20 || sx > CANVAS_W + 20) return

  // Glow aura
  ctx.globalAlpha = 0.35
  ctx.fillStyle = "#34d399"
  ctx.fillRect(sx - 3, sy - 3, pot.w + 6, pot.h + 6)
  ctx.globalAlpha = 1

  // Bottle body (green)
  ctx.fillStyle = "#059669"
  ctx.fillRect(sx + 2, sy + 4, 8, 10)   // main body

  // Bottle neck
  ctx.fillStyle = "#047857"
  ctx.fillRect(sx + 3, sy + 1, 5, 4)    // neck

  // Cork
  ctx.fillStyle = "#d97706"
  ctx.fillRect(sx + 3, sy, 5, 2)        // cork

  // Liquid highlight
  ctx.fillStyle = "#6ee7b7"
  ctx.fillRect(sx + 3, sy + 5, 3, 5)    // shine on body

  // Star sparkle above
  ctx.fillStyle = "#ffffff"
  ctx.globalAlpha = 0.8 + Math.sin(pot.bobOffset * 2) * 0.2
  ctx.fillRect(sx + 5, sy - 5, 2, 2)
  ctx.globalAlpha = 1
}

function drawFireball(ctx: CanvasRenderingContext2D, fb: Fireball, cam: number) {
  ensureSpritesLoaded()
  const sx = Math.round(fb.x - cam)
  const sy = Math.round(fb.y)
  if (sx < -40 || sx > CANVAS_W + 40 || sy < -40 || sy > CANVAS_H + 40) return
  const frame = fb.frame ?? 0
  const flicker = 0.75 + Math.sin(frame * 0.5) * 0.25

  const type = fb.type ?? (fb.fromPlayer ? "fireball" : "enemy")

  if (fb.fromPlayer) {
    const el = ELEMENTS[fb.element ?? "fire"]
    const col = el.colors
    const cx = sx + fb.w / 2
    const cy = sy + fb.h / 2

    if (type === "fireball") {
      if (el.id === "fire" && spritesLoaded && fireballImg) {
        // Animated fireball sprite sheet
        const fbFrame = Math.floor(frame / 4) % FIREBALL_FRAME_COUNT
        ctx.save()
        const drawX = cx - FIREBALL_SPRITE_W / 2
        const drawY = cy - FIREBALL_SPRITE_H / 2
        if (fb.vx < 0) {
          ctx.translate(drawX + FIREBALL_SPRITE_W, drawY)
          ctx.scale(-1, 1)
          ctx.drawImage(fireballImg, fbFrame * FIREBALL_SPRITE_W, 0, FIREBALL_SPRITE_W, FIREBALL_SPRITE_H, 0, 0, FIREBALL_SPRITE_W, FIREBALL_SPRITE_H)
        } else {
          ctx.drawImage(fireballImg, fbFrame * FIREBALL_SPRITE_W, 0, FIREBALL_SPRITE_W, FIREBALL_SPRITE_H, drawX, drawY, FIREBALL_SPRITE_W, FIREBALL_SPRITE_H)
        }
        ctx.restore()
      } else if (el.id === "water") {
        // Aqua bolt: a streaming jet of water with a droplet head
        const dir = Math.sign(fb.vx) || 1
        ctx.globalAlpha = 0.4 * flicker
        ctx.fillStyle = col.primary
        ctx.fillRect(cx - dir * 22, cy - fb.h / 2 - 2, 22, fb.h + 4)
        ctx.globalAlpha = 1
        ctx.fillStyle = col.secondary
        ctx.beginPath()
        ctx.ellipse(cx, cy, fb.w * 0.6, fb.h * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = col.core
        ctx.beginPath()
        ctx.ellipse(cx + dir * 2, cy - 1, fb.w * 0.28, fb.h * 0.28, 0, 0, Math.PI * 2)
        ctx.fill()
        // Trailing spray
        ctx.globalAlpha = 0.5
        ctx.fillStyle = col.aura
        for (let i = 1; i <= 3; i++) ctx.fillRect(cx - dir * (8 * i), cy - 2 + Math.sin(frame * 0.4 + i) * 3, 3, 3)
        ctx.globalAlpha = 1
      } else {
        // Light lance: a piercing spear of light
        const dir = Math.sign(fb.vx) || 1
        ctx.save()
        ctx.translate(cx, cy)
        ctx.scale(dir, 1)
        ctx.globalAlpha = 0.35 * flicker
        ctx.fillStyle = col.primary
        ctx.fillRect(-26, -fb.h / 2 - 3, 40, fb.h + 6)
        ctx.globalAlpha = 1
        ctx.fillStyle = col.secondary
        ctx.beginPath()
        ctx.moveTo(fb.w * 0.9, 0)
        ctx.lineTo(-fb.w * 0.6, -fb.h * 0.5)
        ctx.lineTo(-fb.w * 1.4, 0)
        ctx.lineTo(-fb.w * 0.6, fb.h * 0.5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = col.core
        ctx.fillRect(-fb.w * 0.7, -1.5, fb.w * 1.5, 3)
        ctx.restore()
      }
    } else if (type === "rain") {
      // Falling projectile with a long trail — meteor / rain shard / star
      const headW = fb.w + 4
      const headH = fb.h + 4
      ctx.globalAlpha = 0.4 * flicker
      ctx.fillStyle = col.secondary
      ctx.fillRect(sx - 2, sy - 2, headW, headH)
      ctx.globalAlpha = 0.85
      ctx.fillStyle = col.primary
      ctx.fillRect(sx, sy, fb.w, fb.h)
      ctx.fillStyle = col.aura
      ctx.fillRect(sx + 2, sy + 2, fb.w - 4, fb.h - 4)
      ctx.fillStyle = col.core
      ctx.fillRect(sx + 4, sy + 4, fb.w - 8, fb.h - 8)
      ctx.globalAlpha = 0.55
      ctx.fillStyle = col.primary
      const trailLen = 18 + Math.sin(frame * 0.4) * 4
      ctx.fillRect(cx - 2, sy - trailLen, 4, trailLen)
      ctx.globalAlpha = 0.3
      ctx.fillStyle = col.aura
      ctx.fillRect(cx - 1, sy - trailLen * 1.4, 2, trailLen * 1.4)
      ctx.globalAlpha = 1
    } else if (type === "storm" || type === "typhoon") {
      // Orbiting storm spark
      const spin = frame * 0.5
      const f2 = 0.7 + Math.sin(frame * 0.6) * 0.3
      ctx.globalAlpha = 0.35 * f2
      ctx.fillStyle = col.primary
      ctx.beginPath()
      ctx.arc(cx, cy, fb.w * 1.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.8 * f2
      ctx.fillStyle = col.aura
      ctx.beginPath()
      ctx.arc(cx, cy, fb.w * 0.55, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = col.core
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(spin)
      ctx.fillRect(-1, -fb.h * 0.35, 2, fb.h * 0.7)
      ctx.fillRect(-fb.w * 0.35, -1, fb.w * 0.7, 2)
      ctx.restore()
      ctx.globalAlpha = 0.35
      ctx.fillStyle = col.primary
      ctx.beginPath()
      ctx.arc(cx - fb.vx * 3, cy - fb.vy * 3, fb.w * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  } else {
    // Enemy projectiles, themed by the shooter's level
    const style = fb.enemyStyle
    const bulletColor =
      style === "trident" ? "#38bdf8" :
      style === "shock" ? "#c084fc" :
      style === "holy" || style === "featherslash" ? "#fde68a" :
      style === "data" ? "#22c55e" :
      style === "flame" ? "#f97316" :
      type === "robotBullet" ? "#38bdf8" : PALETTE.enemyFireball
    const coreColor =
      style === "data" ? "#4ade80" :
      style === "holy" || style === "featherslash" ? "#ffffff" :
      type === "robotBullet" ? "#e0f2fe" : "#e9d5ff"
    const cx = sx + fb.w / 2
    const cy = sy + fb.h / 2

    ctx.globalAlpha = 0.35 * flicker
    ctx.fillStyle = bulletColor
    ctx.fillRect(sx - 2, sy - 2, fb.w + 4, fb.h + 4)
    ctx.globalAlpha = 1

    if (style === "featherslash" || style === "holy") {
      // Heaven: a falling feather / holy dart
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(Math.atan2(fb.vy, fb.vx))
      ctx.fillStyle = bulletColor
      ctx.fillRect(-fb.w / 2, -2, fb.w, 4)
      ctx.fillRect(-2, -fb.h / 2, 4, fb.h)
      ctx.fillStyle = coreColor
      ctx.fillRect(-1, -fb.h / 2 + 1, 2, fb.h - 2)
      ctx.restore()
    } else if (style === "data") {
      // Machine: a glitching data packet
      ctx.fillStyle = bulletColor
      ctx.fillRect(sx, sy, fb.w, fb.h)
      ctx.fillStyle = coreColor
      ctx.fillRect(sx + 2, sy + 2 + (frame % 3), fb.w - 4, 2)
    } else if (style === "shock") {
      // Deep sea: a crackling sting
      ctx.strokeStyle = bulletColor
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx, cy)
      ctx.lineTo(cx, sy + (frame % 2 ? 0 : fb.h))
      ctx.lineTo(sx + fb.w, cy)
      ctx.stroke()
      ctx.lineWidth = 1
      ctx.fillStyle = coreColor
      ctx.fillRect(cx - 2, cy - 2, 4, 4)
    } else {
      ctx.fillStyle = bulletColor
      ctx.fillRect(sx, sy + 2, fb.w, fb.h - 4)
      ctx.fillStyle = coreColor
      ctx.fillRect(sx + 2, sy + 3, fb.w - 6, fb.h - 6)
    }
    // Motion trail
    ctx.globalAlpha = 0.5
    ctx.fillStyle = bulletColor
    ctx.fillRect(sx - fb.vx * 2, sy + 3, 6, Math.max(2, fb.h - 6))
    ctx.globalAlpha = 1
  }
}

function drawComet(ctx: CanvasRenderingContext2D, c: Comet, cam: number) {
  const sx = Math.round(c.x - cam)
  const sy = Math.round(c.y)
  if (sx < -80 || sx > CANVAS_W + 80 || sy > CANVAS_H + 80) return

  const el = ELEMENTS[c.element]
  const col = el.colors
  const cx = sx + c.w / 2
  const cy = sy + c.h / 2
  const frame = c.frame
  const flicker = 0.7 + Math.sin(frame * 0.3) * 0.3

  // Elemental aura
  ctx.globalAlpha = 0.35 * flicker
  ctx.fillStyle = col.primary
  ctx.fillRect(sx - 8, sy - 8, c.w + 16, c.h + 16)
  ctx.globalAlpha = 0.5 * flicker
  ctx.fillStyle = col.aura
  ctx.fillRect(sx - 4, sy - 4, c.w + 8, c.h + 8)
  ctx.globalAlpha = 1

  if (c.element === "water") {
    // Glacier: a jagged iceberg
    ctx.fillStyle = "#7dd3fc"
    ctx.beginPath()
    ctx.moveTo(cx, sy)
    ctx.lineTo(sx + c.w, cy)
    ctx.lineTo(cx + 4, sy + c.h)
    ctx.lineTo(sx, cy + 4)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#e0f2fe"
    ctx.fillRect(cx - 6, cy - 10, 8, 18)
    ctx.fillRect(cx + 2, cy - 2, 6, 10)
    ctx.globalAlpha = 0.6
    ctx.fillStyle = "#0ea5e9"
    ctx.fillRect(sx + 6, cy + 4, c.w - 14, 6)
    ctx.globalAlpha = 1
  } else if (c.element === "light") {
    // Judgment: a burning star of light
    ctx.fillStyle = col.secondary
    ctx.beginPath()
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + frame * 0.05
      const r = (i % 2 === 0 ? c.w / 2 : c.w / 4.5)
      ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r)
    }
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.beginPath()
    ctx.arc(cx, cy, c.w / 5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // Comet: a burning rock
    ctx.fillStyle = "#57534e"
    ctx.fillRect(sx + 4, sy + 4, c.w - 8, c.h - 8)
    ctx.fillStyle = "#78716c"
    ctx.fillRect(sx + 10, sy + 8, c.w - 20, 6)
    ctx.fillRect(sx + 8, sy + 20, c.w - 16, 4)
    ctx.fillStyle = "#44403c"
    ctx.fillRect(sx + 12, sy + 14, 8, 8)
    ctx.fillRect(sx + c.w - 22, sy + 18, 10, 6)
    ctx.globalAlpha = 0.4
    ctx.fillStyle = col.secondary
    ctx.fillRect(sx + 6, sy + 6, c.w - 12, c.h - 12)
    ctx.globalAlpha = 1
    ctx.fillStyle = col.aura
    ctx.fillRect(sx + 10, sy + 10, 6, 6)
    ctx.fillRect(sx + c.w - 18, sy + 12, 8, 8)
    ctx.fillStyle = col.core
    ctx.fillRect(sx + 12, sy + 12, 3, 3)
  }

  // Long elemental trail
  const trailLen = 60 + Math.sin(frame * 0.25) * 10
  ctx.globalAlpha = 0.55
  ctx.fillStyle = col.primary
  ctx.fillRect(cx - 6, cy - trailLen, 12, trailLen)
  ctx.globalAlpha = 0.35
  ctx.fillStyle = col.aura
  ctx.fillRect(cx - 3, cy - trailLen * 1.3, 6, trailLen * 1.3)
  ctx.globalAlpha = 0.25
  ctx.fillStyle = col.dark
  ctx.fillRect(cx - 10, cy - trailLen * 0.7, 20, trailLen * 0.7)
  ctx.globalAlpha = 1
}

// ─── Themed attack / hurt animations ─────────────────────────────────────────
// Every enemy, boss and player element has its own flourish so a swing reads as
// part of its level: goblin claws in the forest, laser bolts over Laputa,
// tridents in the deep sea, magma fists in the volcano, glitch spikes in the AI
// mainframe, and so on.
function drawAttackFx(ctx: CanvasRenderingContext2D, list: AttackFx[], cam: number) {
  for (const fx of list) {
    const x = Math.round(fx.x - cam)
    const y = Math.round(fx.y)
    if (x < -120 || x > CANVAS_W + 120) continue
    const t = 1 - fx.timer / fx.maxTimer          // 0 → 1 over the animation
    const fade = Math.sin(Math.PI * Math.min(1, t * 1.05))  // ease in/out alpha
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(fx.facing, 1)
    ctx.scale(fx.scale, fx.scale)
    ctx.globalAlpha = fade
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    drawAttackFxStyle(ctx, fx, t, fade)
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.lineWidth = 1
  }
}

function arcSlash(ctx: CanvasRenderingContext2D, r: number, t: number, width: number, color: string) {
  const sweep = Math.PI * 1.05
  const start = -sweep / 2 + t * sweep * 0.55
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.arc(0, 0, r, start, start + sweep * (0.45 + t * 0.35))
  ctx.stroke()
}

function drawAttackFxStyle(ctx: CanvasRenderingContext2D, fx: AttackFx, t: number, fade: number) {
  const a = fx.color
  const b = fx.color2
  switch (fx.style) {
    // ── Level 1: forest & castle ─────────────────────────────────────────────
    case "claw": {
      // Three raking claw marks
      for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = i === 0 ? b : a
        ctx.lineWidth = 2.5 - Math.abs(i) * 0.8
        ctx.beginPath()
        ctx.moveTo(-8 + t * 6, -12 + i * 7)
        ctx.quadraticCurveTo(6 + t * 8, i * 6, 16 + t * 12, 12 + i * 7)
        ctx.stroke()
      }
      break
    }
    case "axe": {
      // Heavy crescent cleave with a trailing after-image
      arcSlash(ctx, 20, t, 7, a)
      ctx.globalAlpha = fade * 0.45
      arcSlash(ctx, 26, Math.max(0, t - 0.18), 4, b)
      break
    }
    case "bone": {
      // Thin bone sword arc plus splintering shards
      arcSlash(ctx, 18, t, 3.5, b)
      ctx.fillStyle = a
      for (let i = 0; i < 4; i++) {
        const ang = -0.9 + i * 0.55
        const d = 14 + t * 16
        ctx.fillRect(Math.cos(ang) * d, Math.sin(ang) * d, 4, 2)
      }
      break
    }
    case "hammer": {
      // Ground-shattering shockwave rings
      for (let i = 0; i < 3; i++) {
        const r = (t * 34) + i * 9
        ctx.globalAlpha = fade * (1 - i * 0.28) * (1 - t * 0.6)
        ctx.strokeStyle = i === 0 ? b : a
        ctx.lineWidth = 3 - i
        ctx.beginPath()
        ctx.ellipse(0, 8, r, r * 0.42, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = fade
      ctx.fillStyle = b
      for (let i = 0; i < 5; i++) ctx.fillRect(-16 + i * 8, 4 - t * 14 - i % 2 * 4, 3, 5)
      break
    }

    // ── Level 2: Laputa machines ─────────────────────────────────────────────
    case "laser": {
      // Charged beam lancing forward
      const len = 14 + t * 46
      ctx.globalAlpha = fade * 0.4
      ctx.fillStyle = a
      ctx.fillRect(0, -6, len, 12)
      ctx.globalAlpha = fade
      ctx.fillStyle = b
      ctx.fillRect(0, -2, len, 4)
      ctx.fillStyle = a
      ctx.beginPath()
      ctx.arc(0, 0, 7 - t * 4, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case "rotor": {
      // Spinning blade rotor
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      for (let i = 0; i < 4; i++) {
        const ang = t * 9 + (i * Math.PI) / 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(ang) * 5, Math.sin(ang) * 5)
        ctx.lineTo(Math.cos(ang) * (18 + t * 8), Math.sin(ang) * (18 + t * 8))
        ctx.stroke()
      }
      ctx.fillStyle = b
      ctx.beginPath()
      ctx.arc(0, 0, 4, 0, Math.PI * 2)
      ctx.fill()
      break
    }

    // ── Level 3: heaven ──────────────────────────────────────────────────────
    case "holy": {
      // Radiant cross flare + halo ring
      const r = 8 + t * 22
      ctx.strokeStyle = a
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = b
      const s = 22 * (1 - t * 0.35)
      ctx.fillRect(-2, -s, 4, s * 2)
      ctx.fillRect(-s, -2, s * 2, 4)
      ctx.globalAlpha = fade * 0.55
      ctx.fillRect(-1, -s * 1.4, 2, s * 2.8)
      break
    }
    case "featherslash": {
      // A fan of holy feathers thrown forward
      ctx.fillStyle = b
      for (let i = -2; i <= 2; i++) {
        const d = 8 + t * 30
        const yy = i * 8
        ctx.save()
        ctx.translate(d, yy)
        ctx.rotate(i * 0.18 + t * 0.5)
        ctx.fillStyle = i % 2 === 0 ? b : a
        ctx.fillRect(-5, -2, 10, 4)
        ctx.fillRect(-2, -4, 4, 8)
        ctx.restore()
      }
      break
    }

    // ── Level 4: deep sea ────────────────────────────────────────────────────
    case "trident": {
      // Three-prong stab
      const reach = 10 + t * 26
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      for (const yy of [-9, 0, 9]) {
        ctx.beginPath()
        ctx.moveTo(0, yy * 0.5)
        ctx.lineTo(reach, yy)
        ctx.stroke()
      }
      ctx.fillStyle = b
      for (const yy of [-9, 0, 9]) ctx.fillRect(reach - 3, yy - 2, 6, 4)
      break
    }
    case "shock": {
      // Branching electric arcs
      ctx.strokeStyle = b
      ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = fade * (1 - i * 0.25)
        ctx.beginPath()
        let px = 0, py = 0
        ctx.moveTo(px, py)
        for (let k = 0; k < 5; k++) {
          px += 7 + Math.random() * 5
          py += (Math.random() - 0.5) * 18
          ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = fade
      ctx.fillStyle = a
      ctx.beginPath()
      ctx.arc(0, 0, 6 - t * 3, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case "splash": {
      // Water crown: a ring plus flying droplets
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 6 + t * 20, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = b
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2 + fx.rot
        const d = 8 + t * 26
        ctx.beginPath()
        ctx.arc(Math.cos(ang) * d, Math.sin(ang) * d - t * 6, 3 - t * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    // ── Level 5: volcano ─────────────────────────────────────────────────────
    case "flame": {
      // Licking flame tongues
      for (let i = 0; i < 5; i++) {
        const ang = -0.8 + i * 0.4
        const d = 6 + t * 26
        ctx.fillStyle = i % 2 === 0 ? a : b
        ctx.globalAlpha = fade * (1 - i * 0.1)
        ctx.beginPath()
        ctx.moveTo(Math.cos(ang) * d, Math.sin(ang) * d)
        ctx.lineTo(Math.cos(ang) * (d + 10), Math.sin(ang) * (d + 10) - 4)
        ctx.lineTo(Math.cos(ang) * (d + 4), Math.sin(ang) * (d + 4) + 5)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case "magma": {
      // Cracked ground with molten light bleeding out
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath()
        ctx.moveTo(0, 6)
        ctx.lineTo(i * 9 * (0.4 + t), 6 + Math.abs(i) * 3 + t * 8)
        ctx.lineTo(i * 14 * (0.4 + t), 10 + t * 12)
        ctx.stroke()
      }
      ctx.fillStyle = b
      for (let i = 0; i < 6; i++) {
        ctx.globalAlpha = fade * (1 - t)
        ctx.fillRect(-18 + i * 7, 4 - t * 22 - (i % 3) * 5, 3, 3)
      }
      break
    }

    // ── Level 6: the machine ─────────────────────────────────────────────────
    case "data": {
      // Glitch blocks tearing forward
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = fade * (0.4 + Math.random() * 0.6)
        ctx.fillStyle = i % 2 === 0 ? a : b
        ctx.fillRect(t * 26 + Math.random() * 14 - 6, -14 + i * 4, 4 + Math.random() * 12, 3)
      }
      break
    }
    case "grid": {
      // Security laser grid snapping shut
      ctx.strokeStyle = a
      ctx.lineWidth = 1.5
      const w = 30, h = 26
      for (let i = 0; i <= 3; i++) {
        const p = (i / 3) * 2 - 1
        ctx.globalAlpha = fade * (0.5 + t * 0.5)
        ctx.beginPath(); ctx.moveTo(0, p * h); ctx.lineTo(w * (0.3 + t), p * h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(w * (0.3 + t) * ((i + 1) / 4), -h); ctx.lineTo(w * (0.3 + t) * ((i + 1) / 4), h); ctx.stroke()
      }
      ctx.strokeStyle = b
      ctx.lineWidth = 2
      ctx.strokeRect(0, -h, w * (0.3 + t), h * 2)
      break
    }

    // ── Boss cast flourishes ─────────────────────────────────────────────────
    case "darkcast": {
      // Sigil of the Dark Lord: counter-rotating runic rings
      for (let i = 0; i < 2; i++) {
        const r = 14 + i * 9 + t * 10
        ctx.strokeStyle = i === 0 ? b : a
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(0, 0, r, fx.rot + t * (i ? -4 : 4), fx.rot + t * (i ? -4 : 4) + Math.PI * 1.5)
        ctx.stroke()
      }
      ctx.fillStyle = a
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + t * 3
        ctx.fillRect(Math.cos(ang) * (20 + t * 8) - 2, Math.sin(ang) * (20 + t * 8) - 2, 4, 4)
      }
      break
    }
    case "gunshot": {
      // Muzzle star and smoke puff
      ctx.fillStyle = b
      const s = 16 * (1 - t)
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2
        const r = i % 2 === 0 ? s : s * 0.4
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r)
      }
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = fade * 0.5
      ctx.fillStyle = a
      for (let i = 0; i < 4; i++) ctx.fillRect(6 + i * 7 + t * 16, -3 + (i % 2) * 5, 5, 4)
      break
    }
    case "divinecast": {
      // Radiating shafts of divine light with a halo
      ctx.strokeStyle = b
      ctx.lineWidth = 2
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2 + fx.rot
        ctx.globalAlpha = fade * (i % 2 === 0 ? 1 : 0.5)
        ctx.beginPath()
        ctx.moveTo(Math.cos(ang) * 10, Math.sin(ang) * 10)
        ctx.lineTo(Math.cos(ang) * (26 + t * 22), Math.sin(ang) * (26 + t * 22))
        ctx.stroke()
      }
      ctx.globalAlpha = fade
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(0, -16, 20 - t * 4, 6, 0, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case "tidecast": {
      // Whirlpool spiral
      ctx.strokeStyle = a
      ctx.lineWidth = 3
      ctx.beginPath()
      for (let i = 0; i < 46; i++) {
        const ang = i * 0.32 + t * 5
        const r = i * 0.75 * (0.5 + t)
        const px = Math.cos(ang) * r
        const py = Math.sin(ang) * r * 0.6
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.fillStyle = b
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 - t * 6
        ctx.beginPath()
        ctx.arc(Math.cos(ang) * (18 + t * 12), Math.sin(ang) * (11 + t * 8), 3, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case "infernocast": {
      // Ring of fire with rising embers
      ctx.strokeStyle = a
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.ellipse(0, 10, 22 + t * 16, 8 + t * 5, 0, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2
        ctx.globalAlpha = fade * (1 - t * 0.5)
        ctx.fillStyle = i % 2 === 0 ? b : a
        ctx.fillRect(Math.cos(ang) * (20 + t * 12) - 2, 10 + Math.sin(ang) * 8 - t * 30, 4, 6)
      }
      break
    }
    case "systemcast": {
      // Holographic hex rings and a scanline sweep
      ctx.strokeStyle = a
      ctx.lineWidth = 2
      for (let ring = 0; ring < 2; ring++) {
        const r = 14 + ring * 10 + t * 12
        ctx.beginPath()
        for (let i = 0; i <= 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + fx.rot + (ring ? -t * 2 : t * 2)
          const px = Math.cos(ang) * r, py = Math.sin(ang) * r
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.fillStyle = b
      ctx.globalAlpha = fade * 0.7
      for (let i = 0; i < 5; i++) ctx.fillRect(-26, -22 + i * 11 + t * 10, 52, 2)
      break
    }

    // ── Shared impact ────────────────────────────────────────────────────────
    case "hurt":
    default: {
      // Impact star: a hard flash ring with radiating sparks
      ctx.strokeStyle = b
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(0, 0, 4 + t * 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = a
      ctx.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + fx.rot
        ctx.beginPath()
        ctx.moveTo(Math.cos(ang) * (5 + t * 8), Math.sin(ang) * (5 + t * 8))
        ctx.lineTo(Math.cos(ang) * (12 + t * 18), Math.sin(ang) * (12 + t * 18))
        ctx.stroke()
      }
      break
    }
  }
}

function drawAoeEffects(ctx: CanvasRenderingContext2D, effects: AoeEffect[], cam: number) {
  for (const fx of effects) {
    const sx = fx.x - cam
    const sy = fx.y
    const progress = 1 - fx.timer / fx.maxTimer

    if (fx.type === "telegraph") {
      if (fx.lightning) {
        // Lightning strike telegraph: cloud target + jagged bolt preview
        const r = fx.radius * progress
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = "#22d3ee"
        ctx.globalAlpha = 0.1 + progress * 0.15
        ctx.fill()
        ctx.strokeStyle = "#22d3ee"
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.5 + progress * 0.4
        ctx.stroke()
        // Jagged lightning bolt preview from sky to target
        ctx.globalAlpha = 0.4 + Math.sin(fx.timer * 0.8) * 0.2
        ctx.strokeStyle = "#67e8f9"
        ctx.lineWidth = 2
        ctx.beginPath()
        let lx = sx
        let ly = 0
        ctx.moveTo(lx, ly)
        while (ly < sy) {
          lx += (Math.random() - 0.5) * 16
          ly += 12 + Math.random() * 10
          ctx.lineTo(lx, Math.min(ly, sy))
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      } else {
        // Expanding warning circle
        const r = fx.radius * progress
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.fillStyle = fx.color
        ctx.globalAlpha = 0.15 + progress * 0.15
        ctx.fill()
        ctx.strokeStyle = fx.color
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.5 + progress * 0.4
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    } else if (fx.type === "burst") {
      // Expanding shockwave ring
      const r = fx.radius * progress
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.strokeStyle = fx.color
      ctx.lineWidth = 4
      ctx.globalAlpha = 1 - progress
      ctx.stroke()
      ctx.globalAlpha = 1
      // Lightning strike flash from sky
      if (fx.color === "#22d3ee") {
        ctx.globalAlpha = 1 - progress
        ctx.strokeStyle = "#e0f2fe"
        ctx.lineWidth = 3
        ctx.beginPath()
        let lx = sx
        let ly = 0
        ctx.moveTo(lx, ly)
        while (ly < sy) {
          lx += (Math.random() - 0.5) * 18
          ly += 10 + Math.random() * 10
          ctx.lineTo(lx, Math.min(ly, sy))
        }
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    } else if (fx.type === "hazard") {
      // Pulsing poison pool
      const pulse = Math.sin(progress * Math.PI * 4) * 4
      const r = fx.radius + pulse
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fillStyle = fx.color
      ctx.globalAlpha = 0.25 + Math.abs(Math.sin(progress * Math.PI * 3)) * 0.15
      ctx.fill()
      ctx.strokeStyle = "#a855f7"
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.5
      ctx.stroke()
      // Bubbles
      if (fx.timer % 20 < 10) {
        ctx.fillStyle = "#d8b4fe"
        ctx.globalAlpha = 0.6
        ctx.fillRect(sx - r * 0.4, sy - r * 0.3, 3, 3)
        ctx.fillRect(sx + r * 0.3, sy + r * 0.2, 2, 2)
        ctx.fillRect(sx + r * 0.1, sy - r * 0.5, 2, 2)
      }
      ctx.globalAlpha = 1
    }
  }
}

