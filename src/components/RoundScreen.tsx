'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PdfSlideViewer } from "@/components/PdfSlideViewer";
import { useKeyboardControls } from "@/hooks/useKeyboardControls";
import { useRoundClock } from "@/hooks/useRoundClock";
import { useRoundSync } from "@/hooks/useRoundSync";
import {
  MAX_SWITCHES_PER_PLAYER,
  PASS_PENALTY_MS,
  type PlayerRole,
  useRoundStore,
} from "@/state/roundStore";

const formatMs = (value: number) => {
  const clamped = Math.max(0, Math.floor(value));
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const tenths = Math.floor((clamped % 1000) / 100);
  const minPart = minutes.toString();
  const secPart = seconds.toString().padStart(2, "0");
  return `${minPart}:${secPart}.${tenths}`;
};

const toPercentRemaining = (value: number, total: number) =>
  Math.max(0, Math.min(100, total > 0 ? (value / total) * 100 : 0));

const playerLabels: Record<PlayerRole, string> = {
  challenger: "Challenger",
  challengee: "Challengee",
};

export const RoundScreen = () => {
  const router = useRouter();

  const players = useRoundStore((state) => state.players);
  const topic = useRoundStore((state) => state.topic);
  const currentPageIndex = useRoundStore((state) => state.currentPageIndex);
  const totalPages = useRoundStore((state) => state.totalPages);
  const phase = useRoundStore((state) => state.phase);
  const activePlayer = useRoundStore((state) => state.activePlayer);
  const resumeAt = useRoundStore((state) => state.resumeAt);
  const winner = useRoundStore((state) => state.winner);
  const answerKey = useRoundStore((state) => state.answerKey);
  const showAnswer = useRoundStore((state) => state.showAnswer);
  const roundDurationMs = useRoundStore((state) => state.roundDurationMs);
  const canUndo = useRoundStore((state) => state.history.length > 0);
  const undoLastAction = useRoundStore((state) => state.undoLastAction);
  const setAnswerKey = useRoundStore((state) => state.setAnswerKey);
  const toggleAnswerVisibility = useRoundStore(
    (state) => state.toggleAnswerVisibility
  );
  const markCorrect = useRoundStore((state) => state.markCorrect);
  const passQuestion = useRoundStore((state) => state.passQuestion);
  const switchTurn = useRoundStore((state) => state.switchTurn);
  const startRound = useRoundStore((state) => state.startRound);
  const setTotalPages = useRoundStore((state) => state.setTotalPages);
  const resetRound = useRoundStore((state) => state.resetRound);

  const [timestamp, setTimestamp] = useState(() => Date.now());
  const [stageWindow, setStageWindow] = useState<Window | null>(null);

  useRoundSync("host");
  useRoundClock();
  useKeyboardControls({ enabled: phase !== "idle" });

  useEffect(() => {
    if (!stageWindow) {
      return undefined;
    }
    const watcher = window.setInterval(() => {
      if (stageWindow.closed) {
        setStageWindow(null);
      }
    }, 2000);
    return () => window.clearInterval(watcher);
  }, [stageWindow]);

  useEffect(() => {
    if (!topic?.answerPath) {
      setAnswerKey([]);
      return;
    }

    let cancelled = false;

    const loadAnswers = async () => {
      try {
        const response = await fetch(topic.answerPath);
        if (!response.ok) {
          throw new Error("answer manifest missing");
        }
        const data = await response.json();
        if (cancelled) {
          return;
        }
        const answers = Array.isArray(data)
          ? data
          : Array.isArray(data.answers)
          ? data.answers
          : [];
        setAnswerKey(
          answers.map((entry) =>
            typeof entry === "string" ? entry : JSON.stringify(entry)
          )
        );
      } catch (error) {
        console.warn("No answer key for", topic.answerPath, error);
        if (!cancelled) {
          setAnswerKey([]);
        }
      }
    };

    loadAnswers();

    return () => {
      cancelled = true;
    };
  }, [topic?.answerPath, setAnswerKey]);

  useEffect(() => {
    if (phase === "ready" && totalPages > 0) {
      startRound();
    }
  }, [phase, startRound, totalPages]);

  useEffect(() => {
    if (phase !== "passDelay" || !resumeAt) {
      return undefined;
    }
    const frameId = window.requestAnimationFrame(() => {
      setTimestamp(Date.now());
    });
    const intervalId = window.setInterval(() => {
      setTimestamp(Date.now());
    }, 50);
    return () => {
      window.clearInterval(intervalId);
      window.cancelAnimationFrame(frameId);
    };
  }, [phase, resumeAt]);

  useEffect(() => {
    if (phase === "idle" || !topic) {
      router.replace("/");
    }
  }, [phase, router, topic]);

  const currentPageLabel = useMemo(() => {
    if (totalPages === 0) {
      return "Preparing deck…";
    }
    return `Question ${currentPageIndex + 1} of ${totalPages}`;
  }, [currentPageIndex, totalPages]);

  const passCountdown =
    phase === "passDelay" && resumeAt
      ? Math.max(0, resumeAt - timestamp)
      : 0;

  const actionDisabled = phase !== "running";
  const switchDisabled =
    actionDisabled ||
    !activePlayer ||
    players[activePlayer].switchesUsed >= MAX_SWITCHES_PER_PLAYER;

  const switchesRemaining = activePlayer
    ? MAX_SWITCHES_PER_PLAYER - players[activePlayer].switchesUsed
    : MAX_SWITCHES_PER_PLAYER;

  const handleReset = () => {
    resetRound();
    router.push("/");
  };

  const handleLaunchStage = () => {
    if (typeof window === "undefined") {
      return;
    }
    const existing = stageWindow && !stageWindow.closed ? stageWindow : null;
    const opened =
      existing ??
      window.open(
        "/stage",
        "the-floor-stage",
        "noopener=yes,width=1280,height=720"
      );
    opened?.focus();
    if (opened && opened !== existing) {
      setStageWindow(opened);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-gradient-to-br from-blue-900 via-gray-900 to-black px-6 py-10 text-white">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-indigo-300">
            The Floor · Live Round
          </p>
          <h1 className="text-3xl font-semibold text-white">
            {topic?.name ?? "Preparing Round"}
          </h1>
          <p className="text-sm text-indigo-200">{currentPageLabel}</p>
        </div>
        <div className="flex flex-col gap-3 self-start sm:flex-row md:self-auto">
          <button
            type="button"
            onClick={handleLaunchStage}
            className="rounded-2xl border border-indigo-300/60 px-5 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-200 hover:bg-indigo-500/20"
          >
            Launch stage display
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-2xl border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10"
          >
            Back to setup
          </button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {(
          Object.entries(players) as Array<
            [PlayerRole, (typeof players)[PlayerRole]]
          >
        ).map(([role, player]) => {
          const isActive = activePlayer === role && phase === "running";
          const hasLost = phase === "complete" && winner !== role;
          const barPercent = toPercentRemaining(
            player.remainingMs,
            player.initialMs || roundDurationMs
          );
          return (
            <div
              key={role}
              className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-6 shadow-lg transition ${
                isActive ? "border-indigo-300 shadow-indigo-500/30" : ""
              } ${hasLost ? "opacity-60" : ""}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">
                    {playerLabels[role]}
                  </p>
                  <h2 className="text-2xl font-semibold text-white">
                    {player.name || "—"}
                  </h2>
                </div>
                <span
                  className={`rounded-xl px-4 py-2 text-2xl font-mono ${
                    isActive ? "bg-indigo-500 text-white" : "bg-white/20"
                  }`}
                  title="Remaining time"
                >
                  {formatMs(player.remainingMs)}
                </span>
              </div>
              <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className={`h-full transition-[width] duration-150 ${
                    barPercent > 33
                      ? "bg-green-400"
                      : barPercent > 15
                      ? "bg-amber-400"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${barPercent}%` }}
                />
              </div>
              <div className="mt-4 flex justify-between text-xs text-indigo-200">
                <span>
                  Switches used: {player.switchesUsed} / {MAX_SWITCHES_PER_PLAYER}
                </span>
                {phase === "passDelay" && activePlayer === role && resumeAt ? (
                  <span className="font-semibold uppercase tracking-wide text-rose-200">
                    Penalty {(passCountdown / 1000).toFixed(1)}s
                  </span>
                ) : isActive ? (
                  <span className="font-semibold uppercase tracking-wide">
                    Active player
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full lg:w-2/5">
          <div className="flex flex-col gap-3 rounded-3xl bg-white/10 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Host Controls</h2>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">
              Keyboard: W (next), D (pass), A (switch), Z (undo), H (hide host answer)
            </p>
            <div className="grid gap-3">
              <button
                type="button"
                onClick={markCorrect}
                disabled={actionDisabled}
                className="rounded-2xl bg-indigo-500 px-5 py-3 text-lg font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/20"
              >
                Correct Answer (next question)
              </button>
              <button
                type="button"
                onClick={passQuestion}
                disabled={actionDisabled}
                className="rounded-2xl bg-amber-500/90 px-5 py-3 text-lg font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/20"
              >
                Pass (−{PASS_PENALTY_MS / 1000}s)
              </button>
              <button
                type="button"
                onClick={switchTurn}
                disabled={switchDisabled}
                className="rounded-2xl bg-cyan-500/90 px-5 py-3 text-lg font-semibold text-white transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-white/20"
              >
                Switch (remaining {switchesRemaining})
              </button>
              <button
                type="button"
                onClick={undoLastAction}
                disabled={!canUndo}
                className="rounded-2xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/60"
              >
                Undo last action (Z)
              </button>
            </div>
            {phase === "complete" && winner && (
              <div className="rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">
                {players[winner].name} wins the round!
              </div>
            )}
            {answerKey.length > 0 && (
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-indigo-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-200">
                    Host answer
                  </p>
                  <button
                    type="button"
                    onClick={toggleAnswerVisibility}
                    className="rounded-xl border border-indigo-200/40 px-2 py-1 text-[11px] font-medium text-indigo-100 transition hover:border-indigo-100 hover:bg-indigo-400/20"
                  >
                    {showAnswer ? "Hide (H)" : "Show (H)"}
                  </button>
                </div>
                <p className="pt-1 text-base font-semibold text-white">
                  {showAnswer ? answerKey[currentPageIndex] ?? "—" : "—"}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="w-full lg:flex-1">
          <PdfSlideViewer
            filePath={topic?.filePath ?? null}
            pageIndex={currentPageIndex}
            onPageCount={(count) => {
              if (count !== totalPages) {
                setTotalPages(count);
              }
            }}
          />
        </div>
      </section>
    </div>
  );
};
