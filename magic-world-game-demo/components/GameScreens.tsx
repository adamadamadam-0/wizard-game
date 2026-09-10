"use client"

import { useState, useRef } from "react"
import {
  ELEMENTS, ELEMENT_ORDER, skillDamage,
  type Stage, type ElementKind,
} from "@/hooks/useGameEngine"

interface ScreenProps {
  onStart: () => void
  onRestart: () => void
  stage: Stage
}

const pixelFont = { fontFamily: "'Press Start 2P', monospace" }

// ─── Pixel art wizard icon drawn with divs ────────────────────────────────────
function WizardIcon({ element, scale = 1 }: { element?: ElementKind; scale?: number }) {
  const c = element ? ELEMENTS[element].colors : null
  const hat = c?.dark ?? "#5b21b6"
  const hatTop = c?.secondary ?? "#4c1d95"
  const robe = c?.primary ?? "#6d28d9"
  const orb = c?.core ?? "#8b5cf6"
  return (
    <div style={{ width: 48 * scale, height: 64 * scale, position: "relative", imageRendering: "pixelated", transform: `scale(${scale})`, transformOrigin: "top left" }}>
      <div style={{ width: 48, height: 64, position: "relative" }}>
        {/* Hat */}
        <div style={{ position: "absolute", top: 0, left: 6, width: 36, height: 10, background: hat }} />
        <div style={{ position: "absolute", top: 2, left: 14, width: 20, height: 14, background: hatTop }} />
        <div style={{ position: "absolute", top: 4, left: 21, width: 6, height: 6, background: orb }} />
        {/* Head */}
        <div style={{ position: "absolute", top: 10, left: 10, width: 28, height: 22, background: "#fde68a" }} />
        {/* Eyes */}
        <div style={{ position: "absolute", top: 16, left: 15, width: 6, height: 6, background: "#1e1b4b" }} />
        <div style={{ position: "absolute", top: 16, left: 27, width: 6, height: 6, background: "#1e1b4b" }} />
        {/* Beard */}
        <div style={{ position: "absolute", top: 28, left: 14, width: 4, height: 6, background: "#e2e8f0" }} />
        <div style={{ position: "absolute", top: 28, left: 24, width: 4, height: 6, background: "#e2e8f0" }} />
        {/* Robe */}
        <div style={{ position: "absolute", top: 32, left: 6, width: 36, height: 24, background: robe }} />
        {/* Staff */}
        <div style={{ position: "absolute", top: 14, left: 40, width: 4, height: 42, background: "#92400e" }} />
        <div style={{ position: "absolute", top: 10, left: 37, width: 10, height: 10, background: orb, borderRadius: 2, boxShadow: `0 0 10px ${robe}` }} />
      </div>
    </div>
  )
}

// ─── Title Screen ─────────────────────────────────────────────────────────────
export function TitleScreen({ onStart, onStartTestMode }: Pick<ScreenProps, "onStart"> & { onStartTestMode?: () => void }) {
  const [showPw, setShowPw] = useState(false)
  const [pwError, setPwError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleTestClick = () => {
    setShowPw(true)
    setPwError(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handlePwSubmit = () => {
    const value = inputRef.current?.value ?? ""
    if (value === "adamadam") {
      onStartTestMode?.()
    } else {
      setPwError(true)
      if (inputRef.current) inputRef.current.value = ""
      inputRef.current?.focus()
    }
  }

  const handlePwKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handlePwSubmit()
    if (e.key === "Escape") setShowPw(false)
  }

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #0d1117 0%, #1a0a2e 50%, #0d0d1a 100%)",
        ...pixelFont,
      }}
    >
      {/* Stars */}
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 73 + 17) % 100}%`,
            top: `${(i * 47 + 11) % 60}%`,
            width: (i % 3 === 0) ? 3 : 2,
            height: (i % 3 === 0) ? 3 : 2,
            background: "#ffffff",
            opacity: 0.4 + (i % 5) * 0.12,
          }}
        />
      ))}

      {/* Title card */}
      <div
        className="flex flex-col items-center gap-6 px-10 py-8 relative"
        style={{
          background: "rgba(0,0,0,0.85)",
          border: "3px solid #fbbf24",
          borderRadius: 4,
          boxShadow: "0 0 40px rgba(251,191,36,0.25), inset 0 0 30px rgba(0,0,0,0.5)",
          maxWidth: 520,
          width: "90%",
        }}
      >
        {/* Corner decorations */}
        <div style={{ position: "absolute", top: 6, left: 6, width: 12, height: 12, border: "2px solid #fbbf24", borderRight: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", top: 6, right: 6, width: 12, height: 12, border: "2px solid #fbbf24", borderLeft: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", bottom: 6, left: 6, width: 12, height: 12, border: "2px solid #fbbf24", borderRight: "none", borderTop: "none" }} />
        <div style={{ position: "absolute", bottom: 6, right: 6, width: 12, height: 12, border: "2px solid #fbbf24", borderLeft: "none", borderTop: "none" }} />

        <WizardIcon />

        <div className="flex flex-col items-center gap-1">
          <h1 style={{ fontSize: 20, color: "#fbbf24", textShadow: "0 0 20px rgba(251,191,36,0.8)", letterSpacing: 2, textAlign: "center" }}>
            WIZARD
          </h1>
          <h1 style={{ fontSize: 20, color: "#a78bfa", textShadow: "0 0 20px rgba(167,139,250,0.8)", letterSpacing: 2, textAlign: "center" }}>
            QUEST
          </h1>
        </div>

        <p style={{ fontSize: 7, color: "#9ca3af", textAlign: "center", lineHeight: 2.2 }}>
          SAVE THE HUMANS FROM<br />THE DARK LORD&apos;S CURSE
        </p>

        {/* Divider */}
        <div style={{ width: "100%", height: 2, background: "linear-gradient(90deg,transparent,#fbbf24,transparent)" }} />

        {/* Story */}
        <div
          className="w-full rounded px-4 py-3"
          style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)" }}
        >
          <p style={{ fontSize: 6, color: "#d1d5db", lineHeight: 2.4, textAlign: "center" }}>
            A powerful wizard must battle<br />
            through the enchanted forest,<br />
            storm the dark castle, soar to<br />
            the floating isle of Laputa,<br />
            ascend the golden gates of Heaven,<br />
            dive into the deep sea, brave the<br />
            volcano, and hack the AI mainframe.
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-3 flex-wrap justify-center">
          {[["A/D", "MOVE"], ["SPACE", "JUMP"], ["SHIFT", "DASH"], ["Z/J", "SKILL 1"], ["X", "SKILL 2"], ["C", "SKILL 3"], ["V/K", "SKILL 4"]].map(([k, v]) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <div
                className="rounded px-2 py-1"
                style={{ background: "#1f2937", border: "1px solid #fbbf24", fontSize: 7, color: "#fbbf24" }}
              >
                {k}
              </div>
              <span style={{ fontSize: 5, color: "#6b7280" }}>{v}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onStart}
          className="mt-2 px-8 py-3 rounded"
          style={{
            background: "#5b21b6",
            border: "3px solid #a78bfa",
            color: "#e9d5ff",
            fontSize: 10,
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 0 20px rgba(139,92,246,0.5)",
            transition: "all 0.15s",
            fontFamily: "'Press Start 2P', monospace",
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#7c3aed"; (e.target as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(139,92,246,0.8)" }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "#5b21b6"; (e.target as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(139,92,246,0.5)" }}
        >
          START GAME
        </button>

        {onStartTestMode && !showPw && (
          <button
            onClick={handleTestClick}
            className="px-6 py-2 rounded"
            style={{
              background: "#1f2937",
              border: "2px solid #ef4444",
              color: "#fca5a5",
              fontSize: 7,
              cursor: "pointer",
              letterSpacing: 1,
              boxShadow: "0 0 12px rgba(239,68,68,0.3)",
              transition: "all 0.15s",
              fontFamily: "'Press Start 2P', monospace",
              marginTop: -6,
            }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#374151"; (e.target as HTMLButtonElement).style.boxShadow = "0 0 18px rgba(239,68,68,0.5)" }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "#1f2937"; (e.target as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(239,68,68,0.3)" }}
          >
            TEST MODE
          </button>
        )}

        {onStartTestMode && showPw && (
          <div className="flex flex-col items-center gap-2" style={{ marginTop: -6 }}>
            <input
              ref={inputRef}
              type="password"
              placeholder="Enter password"
              onKeyDown={handlePwKeyDown}
              className="px-3 py-2 rounded text-center outline-none"
              style={{
                background: "#0f172a",
                border: `2px solid ${pwError ? "#ef4444" : "#ef4444"}`,
                color: "#fca5a5",
                fontSize: 8,
                fontFamily: "'Press Start 2P', monospace",
                width: 220,
              }}
            />
            {pwError && (
              <span style={{ fontSize: 6, color: "#ef4444" }}>WRONG PASSWORD</span>
            )}
            <div className="flex gap-2">
              <button
                onClick={handlePwSubmit}
                className="px-4 py-1.5 rounded"
                style={{
                  background: "#7f1d1d",
                  border: "2px solid #ef4444",
                  color: "#ffffff",
                  fontSize: 6,
                  cursor: "pointer",
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                ENTER
              </button>
              <button
                onClick={() => setShowPw(false)}
                className="px-4 py-1.5 rounded"
                style={{
                  background: "#1f2937",
                  border: "2px solid #6b7280",
                  color: "#9ca3af",
                  fontSize: 6,
                  cursor: "pointer",
                  fontFamily: "'Press Start 2P', monospace",
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 5, color: "#4b5563", marginTop: -8 }}>
          v2.0 - ELEMENTS EDITION
        </p>
      </div>
    </div>
  )
}

// ─── Win Screen ───────────────────────────────────────────────────────────────
export function WinScreen({ onRestart, element = "fire" }: Pick<ScreenProps, "onRestart"> & { element?: ElementKind }) {
  const el = ELEMENTS[element]
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.92)",
        ...pixelFont,
      }}
    >
      <div
        className="flex flex-col items-center gap-5 px-10 py-8 relative"
        style={{
          background: "rgba(0,0,0,0.9)",
          border: "3px solid #22c55e",
          borderRadius: 4,
          boxShadow: "0 0 60px rgba(34,197,94,0.3)",
          maxWidth: 480,
          width: "90%",
        }}
      >
        {/* Corner decorations */}
        <div style={{ position: "absolute", top: 6, left: 6, width: 12, height: 12, border: "2px solid #22c55e", borderRight: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", top: 6, right: 6, width: 12, height: 12, border: "2px solid #22c55e", borderLeft: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", bottom: 6, left: 6, width: 12, height: 12, border: "2px solid #22c55e", borderRight: "none", borderTop: "none" }} />
        <div style={{ position: "absolute", bottom: 6, right: 6, width: 12, height: 12, border: "2px solid #22c55e", borderLeft: "none", borderTop: "none" }} />

        {/* Trophy pixel art */}
        <div style={{ width: 40, height: 40, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 8, width: 24, height: 20, background: "#fbbf24" }} />
          <div style={{ position: "absolute", top: 4, left: 4, width: 4, height: 12, background: "#fbbf24" }} />
          <div style={{ position: "absolute", top: 4, left: 32, width: 4, height: 12, background: "#fbbf24" }} />
          <div style={{ position: "absolute", top: 20, left: 14, width: 12, height: 8, background: "#d97706" }} />
          <div style={{ position: "absolute", top: 28, left: 8, width: 24, height: 4, background: "#b45309" }} />
          <div style={{ position: "absolute", top: 8, left: 15, width: 10, height: 6, background: "#fef08a" }} />
        </div>

        <h2 style={{ fontSize: 18, color: "#22c55e", textShadow: "0 0 20px rgba(34,197,94,0.8)", textAlign: "center", letterSpacing: 2 }}>
          VICTORY!
        </h2>

        <div style={{ width: "100%", height: 2, background: "linear-gradient(90deg,transparent,#22c55e,transparent)" }} />

        <p style={{ fontSize: 8, color: "#86efac", textAlign: "center", lineHeight: 2.5 }}>
          THE DARK LORD, MUSKA, GOD,<br />LEVIATHAN, IFRIT, AND THE AI CORE<br />HAVE BEEN DEFEATED!
        </p>
        <p style={{ fontSize: 7, color: "#9ca3af", textAlign: "center", lineHeight: 2.5 }}>
          The humans are safe.<br />
          The wizard&apos;s quest is complete.<br />
          Peace returns to the realm.
        </p>
        <p style={{ fontSize: 6, color: el.colors.primary, textAlign: "center", lineHeight: 2.4 }}>
          CLEARED AS THE {el.name} {el.title}
          <br />
          <span style={{ color: "#6b7280" }}>TRY ANOTHER ELEMENT NEXT RUN</span>
        </p>

        <button
          onClick={onRestart}
          className="mt-2 px-8 py-3 rounded"
          style={{
            background: "#14532d",
            border: "3px solid #22c55e",
            color: "#bbf7d0",
            fontSize: 9,
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 0 20px rgba(34,197,94,0.4)",
            fontFamily: "'Press Start 2P', monospace",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#166534" }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "#14532d" }}
        >
          PLAY AGAIN
        </button>
      </div>
    </div>
  )
}

// ─── Game Over Screen ─────────────────────────────────────────────────────────
export function GameOverScreen({ onRestart, onTitle }: Pick<ScreenProps, "onRestart"> & { onTitle?: () => void }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.93)",
        ...pixelFont,
      }}
    >
      <div
        className="flex flex-col items-center gap-5 px-10 py-8 relative"
        style={{
          background: "rgba(0,0,0,0.9)",
          border: "3px solid #ef4444",
          borderRadius: 4,
          boxShadow: "0 0 60px rgba(239,68,68,0.25)",
          maxWidth: 440,
          width: "90%",
        }}
      >
        {/* Corner decorations */}
        <div style={{ position: "absolute", top: 6, left: 6, width: 12, height: 12, border: "2px solid #ef4444", borderRight: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", top: 6, right: 6, width: 12, height: 12, border: "2px solid #ef4444", borderLeft: "none", borderBottom: "none" }} />
        <div style={{ position: "absolute", bottom: 6, left: 6, width: 12, height: 12, border: "2px solid #ef4444", borderRight: "none", borderTop: "none" }} />
        <div style={{ position: "absolute", bottom: 6, right: 6, width: 12, height: 12, border: "2px solid #ef4444", borderLeft: "none", borderTop: "none" }} />

        {/* Skull pixel art */}
        <div style={{ width: 36, height: 40, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 4, width: 28, height: 24, background: "#e2e8f0" }} />
          <div style={{ position: "absolute", top: 6, left: 8, width: 7, height: 7, background: "#0f172a" }} />
          <div style={{ position: "absolute", top: 6, left: 21, width: 7, height: 7, background: "#0f172a" }} />
          <div style={{ position: "absolute", top: 8, left: 10, width: 3, height: 3, background: "#ef4444" }} />
          <div style={{ position: "absolute", top: 8, left: 23, width: 3, height: 3, background: "#ef4444" }} />
          <div style={{ position: "absolute", top: 22, left: 6, width: 24, height: 8, background: "#e2e8f0" }} />
          <div style={{ position: "absolute", top: 24, left: 10, width: 4, height: 6, background: "#0f172a" }} />
          <div style={{ position: "absolute", top: 24, left: 16, width: 4, height: 6, background: "#0f172a" }} />
          <div style={{ position: "absolute", top: 24, left: 22, width: 4, height: 6, background: "#0f172a" }} />
          <div style={{ position: "absolute", top: 30, left: 4, width: 28, height: 10, background: "#cbd5e1" }} />
        </div>

        <h2 style={{ fontSize: 16, color: "#ef4444", textShadow: "0 0 20px rgba(239,68,68,0.8)", textAlign: "center", letterSpacing: 2 }}>
          GAME OVER
        </h2>

        <div style={{ width: "100%", height: 2, background: "linear-gradient(90deg,transparent,#ef4444,transparent)" }} />

        <p style={{ fontSize: 7, color: "#9ca3af", textAlign: "center", lineHeight: 2.5 }}>
          The wizard has fallen...<br />
          The humans remain captive.<br />
          Will you try again?
        </p>

        <button
          onClick={onRestart}
          className="mt-2 px-8 py-3 rounded"
          style={{
            background: "#450a0a",
            border: "3px solid #ef4444",
            color: "#fecaca",
            fontSize: 9,
            cursor: "pointer",
            letterSpacing: 2,
            boxShadow: "0 0 20px rgba(239,68,68,0.4)",
            fontFamily: "'Press Start 2P', monospace",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#7f1d1d" }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "#450a0a" }}
        >
          TRY AGAIN
        </button>

        {onTitle && (
          <button
            onClick={onTitle}
            className="px-6 py-2 rounded"
            style={{
              background: "#1f2937",
              border: "2px solid #6b7280",
              color: "#9ca3af",
              fontSize: 6,
              cursor: "pointer",
              fontFamily: "'Press Start 2P', monospace",
              marginTop: -8,
            }}
          >
            CHANGE WIZARD
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Stage Transition Banner ──────────────────────────────────────────────────
export function StageTransition({ stage }: { stage: Stage }) {
  const labels: Partial<Record<Stage, string>> = {
    stage1: "LEVEL 1-1 - ENCHANTED FOREST",
    stage2: "LEVEL 1-2 - DARK CASTLE",
    stage3: "LEVEL 1-3 - CASTLE ROOFTOP",
    stage4: "LEVEL 2-1 - LAPUTA APPROACH",
    stage5: "LEVEL 2-2 - SKY FORTRESS",
    stage6: "LEVEL 2-3 - MUSKA'S SANCTUM",
    stage7: "LEVEL 3-1 - GATES OF HEAVEN",
    stage8: "LEVEL 3-2 - GOLDEN CLOUDS",
    stage9: "LEVEL 3-3 - THRONE OF GOD",
    stage10: "LEVEL 4-1 - SUNKEN DEPTHS",
    stage11: "LEVEL 4-2 - ABYSSAL TRENCH",
    stage12: "LEVEL 4-3 - LEVIATHAN'S LAIR",
    stage13: "LEVEL 5-1 - VOLCANO BASE",
    stage14: "LEVEL 5-2 - LAVA CAVERNS",
    stage15: "LEVEL 5-3 - IFRIT'S FORGE",
    stage16: "LEVEL 6-1 - SYSTEM BOOT",
    stage17: "LEVEL 6-2 - CIRCUIT CORE",
    stage18: "LEVEL 6-3 - AI MAINFRAME",
  }
  const label = labels[stage]
  if (!label) return null
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ background: "rgba(0,0,0,0)", ...pixelFont }}
    >
      <div
        className="px-10 py-4 flex flex-col items-center gap-2"
        style={{
          background: "rgba(0,0,0,0.85)",
          border: "2px solid #fbbf24",
          boxShadow: "0 0 30px rgba(251,191,36,0.2)",
          borderRadius: 2,
          animation: "fadeInOut 2.5s ease-in-out",
        }}
      >
        <span style={{ fontSize: 6, color: "#9ca3af", letterSpacing: 3 }}>NOW ENTERING</span>
        <span style={{ fontSize: 11, color: "#fbbf24", letterSpacing: 2, textAlign: "center" }}>{label}</span>
      </div>
    </div>
  )
}


// ─── Character Select ─────────────────────────────────────────────────────────
/**
 * Pick which elemental wizard to play. Each element is a full character with
 * its own four skills, colours, projectiles and cast animations.
 */
export function CharacterSelect({
  onChoose, onBack, testMode,
}: {
  onChoose: (el: ElementKind) => void
  onBack: () => void
  testMode?: boolean
}) {
  const [hovered, setHovered] = useState<ElementKind>("fire")

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{
        background: "linear-gradient(180deg, #05070f 0%, #140a24 55%, #05070f 100%)",
        ...pixelFont,
      }}
    >
      {/* Stars */}
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(i * 61 + 13) % 100}%`,
            top: `${(i * 37 + 7) % 90}%`,
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            background: "#ffffff",
            opacity: 0.25 + (i % 5) * 0.1,
          }}
        />
      ))}

      <div className="flex flex-col items-center" style={{ gap: 10, width: "96%", maxWidth: 760 }}>
        <div className="flex items-center" style={{ gap: 10 }}>
          <span style={{ fontSize: 12, color: "#fbbf24", letterSpacing: 3, textShadow: "0 0 16px rgba(251,191,36,0.7)" }}>
            CHOOSE YOUR WIZARD
          </span>
          {testMode && (
            <span style={{ fontSize: 6, color: "#fca5a5", border: "1px solid #ef4444", padding: "3px 6px", borderRadius: 3 }}>
              TEST MODE
            </span>
          )}
        </div>
        <span style={{ fontSize: 6, color: "#6b7280", letterSpacing: 1 }}>
          EACH ELEMENT HAS ITS OWN 4 SKILLS
        </span>

        {/* Element cards */}
        <div className="flex justify-center" style={{ gap: 10, width: "100%" }}>
          {ELEMENT_ORDER.map(id => {
            const el = ELEMENTS[id]
            const c = el.colors
            const active = hovered === id
            return (
              <button
                key={id}
                onClick={() => onChoose(id)}
                onMouseEnter={() => setHovered(id)}
                onFocus={() => setHovered(id)}
                className="flex flex-col items-center rounded"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "10px 8px 12px",
                  background: active ? "rgba(0,0,0,0.9)" : "rgba(0,0,0,0.72)",
                  border: `3px solid ${active ? c.primary : "#374151"}`,
                  boxShadow: active ? `0 0 22px ${c.primary}66, inset 0 0 22px ${c.dark}55` : "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  transform: active ? "translateY(-3px)" : "none",
                  fontFamily: "'Press Start 2P', monospace",
                  textAlign: "left",
                }}
              >
                <div style={{ height: 54, display: "flex", alignItems: "flex-start", justifyContent: "center", width: "100%" }}>
                  <WizardIcon element={id} scale={0.8} />
                </div>

                <span style={{ fontSize: 11, color: c.primary, letterSpacing: 2, textShadow: `0 0 12px ${c.primary}` }}>
                  {el.name}
                </span>
                <span style={{ fontSize: 6, color: c.secondary, letterSpacing: 1, marginTop: 4 }}>
                  {el.title}
                </span>

                <div style={{ width: "100%", height: 2, background: `linear-gradient(90deg,transparent,${c.primary},transparent)`, margin: "8px 0" }} />

                <p style={{ fontSize: 5, color: "#9ca3af", lineHeight: 2, minHeight: 30, textAlign: "center", width: "100%" }}>
                  {el.tagline}
                </p>

                {/* The element's four skills */}
                <div className="flex flex-col w-full" style={{ gap: 3, marginTop: 6 }}>
                  {el.skills.map((sk, i) => (
                    <div
                      key={sk.name}
                      className="flex items-center rounded"
                      style={{
                        gap: 4,
                        padding: "3px 4px",
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? c.dark : "#1f2937"}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 5, color: "#000", background: c.primary,
                          minWidth: 16, textAlign: "center", borderRadius: 2, padding: "2px 0",
                        }}
                      >
                        {sk.hotkey}
                      </span>
                      <span style={{ fontSize: 5, color: "#e5e7eb", flex: 1, minWidth: 0 }}>{sk.name}</span>
                      <span style={{ fontSize: 5, color: c.aura }}>{skillDamage(id, (i + 1) as 1 | 2 | 3 | 4, 1)}</span>
                    </div>
                  ))}
                </div>

                <div
                  className="rounded"
                  style={{
                    marginTop: 8, width: "100%", textAlign: "center",
                    padding: "5px 0", fontSize: 6, letterSpacing: 1,
                    background: active ? c.primary : "#1f2937",
                    color: active ? "#0b0b12" : "#6b7280",
                    border: `2px solid ${active ? c.core : "#374151"}`,
                  }}
                >
                  SELECT
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onBack}
          className="rounded px-5 py-2"
          style={{
            background: "#1f2937",
            border: "2px solid #6b7280",
            color: "#9ca3af",
            fontSize: 6,
            cursor: "pointer",
            fontFamily: "'Press Start 2P', monospace",
            marginTop: 2,
          }}
        >
          BACK
        </button>
      </div>
    </div>
  )
}
