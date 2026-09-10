"use client"

import { useRef, useEffect, useState } from "react"
import { useGameEngine, CANVAS_W, CANVAS_H, isPlayingStage, type GameState, type ElementKind } from "@/hooks/useGameEngine"
import GameCanvas from "@/components/GameCanvas"
import GameHUD from "@/components/GameHUD"
import { TitleScreen, CharacterSelect, WinScreen, GameOverScreen, StageTransition } from "@/components/GameScreens"

export default function GameClient() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { stage, stateRef, startStage, testMode, setTestMode, element, setElement } = useGameEngine(canvasRef)

  // Title → character select → play
  const [choosing, setChoosing] = useState(false)

  // Debug handle, opt-in via ?debug=1 — lets you jump stages from the console:
  // window.__wizard.startStage("stage12"); window.__wizard.stateRef.current
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return
    ;(window as unknown as Record<string, unknown>).__wizard = { stateRef, startStage, setElement, setTestMode }
  }, [stateRef, startStage, setElement, setTestMode])

  // Force re-render every frame for React HUD
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf: number
    const loop = () => { setTick(t => t + 1); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Stage transition banner: show for ~2s when stage changes
  const [showBanner, setShowBanner] = useState(false)
  const prevStageRef = useRef(stage)
  useEffect(() => {
    if (stage !== prevStageRef.current && isPlayingStage(stage)) {
      setShowBanner(true)
      const t = setTimeout(() => setShowBanner(false), 2500)
      prevStageRef.current = stage
      return () => clearTimeout(t)
    }
    prevStageRef.current = stage
  }, [stage])

  const gs: GameState = stateRef.current

  const isPlaying = isPlayingStage(stage)

  const handleStartTestMode = () => {
    setTestMode(true)
    setChoosing(true)
  }

  const handleStartNormal = () => {
    setTestMode(false)
    setChoosing(true)
  }

  const handleChooseElement = (el: ElementKind) => {
    setElement(el)
    setChoosing(false)
    startStage("stage1")
  }

  const handleReturnToTitle = () => {
    setTestMode(false)
    setChoosing(false)
    startStage("title")
  }

  const handleRetry = () => {
    setChoosing(false)
    startStage("stage1")
  }

  // Scale canvas to fit viewport while keeping aspect ratio (client-only to avoid hydration mismatch)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const updateScale = () => {
      setScale(Math.min(
        window.innerWidth / CANVAS_W,
        window.innerHeight / CANVAS_H,
        1.5,
      ))
    }
    updateScale()
    window.addEventListener("resize", updateScale)
    return () => window.removeEventListener("resize", updateScale)
  }, [])

  return (
    <main
      className="flex items-center justify-center w-screen h-screen bg-black"
      style={{ overflow: "hidden" }}
    >
      {/* Game viewport wrapper */}
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {/* The canvas — always rendered so the engine loop can draw on it */}
        <GameCanvas canvasRef={canvasRef} />

        {/* React HUD overlay — only while playing */}
        {isPlaying && tick > 0 && (
          <GameHUD gameState={gs} stage={stage} testMode={testMode} element={element} />
        )}

        {/* Stage transition banner */}
        {isPlaying && showBanner && (
          <StageTransition stage={stage} />
        )}

        {/* Screen overlays */}
        {stage === "title" && !choosing && (
          <TitleScreen onStart={handleStartNormal} onStartTestMode={handleStartTestMode} />
        )}
        {stage === "title" && choosing && (
          <CharacterSelect
            onChoose={handleChooseElement}
            onBack={() => setChoosing(false)}
            testMode={testMode}
          />
        )}
        {stage === "win" && (
          <WinScreen onRestart={handleReturnToTitle} element={element} />
        )}
        {stage === "gameover" && (
          <GameOverScreen onRestart={handleRetry} onTitle={handleReturnToTitle} />
        )}

        {/* Scanline overlay for retro effect */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          }}
        />
      </div>
    </main>
  )
}
