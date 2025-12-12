import { create } from "zustand";

export type PlayerRole = "challenger" | "challengee";

export interface TopicSelection {
  id: string;
  name: string;
  folder: string;
  filePath: string; // e.g. /topics/math.pdf
  answerPath?: string;
}

export interface PlayerState {
  name: string;
  remainingMs: number;
  initialMs: number;
  switchesUsed: number;
}

export type RoundPhase = "idle" | "ready" | "running" | "passDelay" | "complete";

export interface RoundState {
  topic: TopicSelection | null;
  players: Record<PlayerRole, PlayerState>;
  activePlayer: PlayerRole | null;
  phase: RoundPhase;
  currentPageIndex: number;
  pendingPageIndex: number | null;
  totalPages: number;
  resumeAt: number | null;
  lastTickAt: number | null;
  answerKey: string[];
  showAnswer: boolean;
  roundDurationMs: number;
  winner: PlayerRole | null;
  history: RoundSnapshot[];
}

export interface RoundActions {
  configureRound: (config: {
    challengerName: string;
    challengeeName: string;
    topic: TopicSelection;
    roundDurationMs?: number;
  }) => void;
  setAnswerKey: (answers: string[]) => void;
  toggleAnswerVisibility: () => void;
  startRound: () => void;
  setTotalPages: (pages: number) => void;
  markCorrect: () => void;
  passQuestion: () => void;
  resumeAfterDelay: () => void;
  switchTurn: () => void;
  tick: (now: number) => void;
  hydrateFromSnapshot: (snapshot: RoundSnapshot) => void;
  resetRound: () => void;
  undoLastAction: () => void;
}

export const DEFAULT_ROUND_DURATION_MS = 60_000;
export const PASS_PENALTY_MS = 3_000;
export const ROUND_START_BONUS_MS = 1_000;
export const MAX_SWITCHES_PER_PLAYER = 3;
const MAX_HISTORY_ENTRIES = 10;

const initialPlayers = (
  durationMs: number = DEFAULT_ROUND_DURATION_MS
): Record<PlayerRole, PlayerState> => ({
  challenger: {
    name: "",
    remainingMs: durationMs,
    initialMs: durationMs,
    switchesUsed: 0,
  },
  challengee: {
    name: "",
    remainingMs: durationMs,
    initialMs: durationMs,
    switchesUsed: 0,
  },
});

const initialState: RoundState = {
  topic: null,
  players: initialPlayers(),
  activePlayer: null,
  phase: "idle",
  currentPageIndex: 0,
  pendingPageIndex: null,
  totalPages: 0,
  resumeAt: null,
  lastTickAt: null,
  answerKey: [],
  showAnswer: true,
  roundDurationMs: DEFAULT_ROUND_DURATION_MS,
  winner: null,
  history: [],
};

const applyTimeDeduction = (
  state: RoundState,
  now: number
): RoundState => {
  if (!state.activePlayer || state.phase !== "running") {
    return { ...state, lastTickAt: now };
  }

  const lastTickAt = state.lastTickAt ?? now;
  const delta = Math.max(0, now - lastTickAt);
  if (delta === 0) {
    return { ...state, lastTickAt: now };
  }

  const role = state.activePlayer;
  const active = state.players[role];
  const remaining = Math.max(0, active.remainingMs - delta);

  const players: RoundState["players"] = {
    ...state.players,
    [role]: {
      ...active,
      remainingMs: remaining,
    },
  };

  let phase: RoundPhase = state.phase;
  let winner: PlayerRole | null = state.winner;
  let activePlayer: PlayerRole | null = role;

  if (remaining <= 0) {
    phase = "complete";
    winner = role === "challenger" ? "challengee" : "challenger";
    activePlayer = null;
  }

  return {
    ...state,
    players,
    phase,
    winner,
    activePlayer,
    lastTickAt: now,
  };
};

export type RoundSnapshot = Omit<RoundState, "history">;

const clonePlayers = (players: Record<PlayerRole, PlayerState>) => ({
  challenger: { ...players.challenger },
  challengee: { ...players.challengee },
});

const pushHistory = (state: RoundState & RoundActions) => {
  const snapshot = selectRoundSnapshot(state);
  return [snapshot, ...state.history].slice(0, MAX_HISTORY_ENTRIES);
};

export const selectRoundSnapshot = (
  state: RoundState & RoundActions
): RoundSnapshot => ({
  topic: state.topic,
  players: clonePlayers(state.players),
  activePlayer: state.activePlayer,
  phase: state.phase,
  currentPageIndex: state.currentPageIndex,
  pendingPageIndex: state.pendingPageIndex,
  totalPages: state.totalPages,
  resumeAt: state.resumeAt,
  lastTickAt: state.lastTickAt,
  answerKey: [...state.answerKey],
  showAnswer: state.showAnswer,
  roundDurationMs: state.roundDurationMs,
  winner: state.winner,
});

export const useRoundStore = create<RoundState & RoundActions>()((set) => ({
  ...initialState,
  configureRound: ({
    challengerName,
    challengeeName,
    topic,
    roundDurationMs,
  }) => {
    const sanitizedDuration = Number.isFinite(roundDurationMs)
      ? Math.max(1_000, Math.min(3_600_000, Math.floor(roundDurationMs!)))
      : DEFAULT_ROUND_DURATION_MS;

    const challengerInitialMs = sanitizedDuration + ROUND_START_BONUS_MS;
    const challengeeInitialMs = sanitizedDuration;

    set(() => ({
      topic,
      players: {
        challenger: {
          name: challengerName,
          remainingMs: challengerInitialMs,
          initialMs: challengerInitialMs,
          switchesUsed: 0,
        },
        challengee: {
          name: challengeeName,
          remainingMs: challengeeInitialMs,
          initialMs: challengeeInitialMs,
          switchesUsed: 0,
        },
      },
      activePlayer: "challenger",
      phase: "ready",
      currentPageIndex: 0,
      pendingPageIndex: null,
      totalPages: 0,
      resumeAt: null,
      lastTickAt: null,
      answerKey: [],
      showAnswer: true,
      roundDurationMs: sanitizedDuration,
      winner: null,
      history: [],
    }));
  },
  setAnswerKey: (answers) => {
    set(() => ({
      answerKey: [...answers],
    }));
  },
    toggleAnswerVisibility: () => {
      set((state) => ({
        showAnswer: !state.showAnswer,
      }));
    },
  startRound: () => {
    set((state) => {
      if (state.phase !== "ready") {
        return state;
      }
        const now = Date.now();
        return {
          ...state,
          phase: "running",
          activePlayer: "challenger",
          lastTickAt: now,
        };
      });
    },
    setTotalPages: (pages) => {
      set((state) => ({
        ...state,
        totalPages: pages,
      }));
    },
    markCorrect: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const history = pushHistory(state);
        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);

        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return { ...afterTick, history };
        }

        const currentRole = afterTick.activePlayer;
        const nextRole: PlayerRole =
          currentRole === "challenger" ? "challengee" : "challenger";

        return {
          ...afterTick,
          activePlayer: nextRole,
          currentPageIndex:
            afterTick.totalPages === 0
              ? afterTick.currentPageIndex
              : Math.min(
                  afterTick.currentPageIndex + 1,
                  Math.max(afterTick.totalPages - 1, 0)
                ),
          pendingPageIndex: null,
          lastTickAt: now,
          history,
        };
      });
    },
    passQuestion: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const history = pushHistory(state);
        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);
        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return { ...afterTick, history };
        }

        const role = afterTick.activePlayer;
        const active = afterTick.players[role];
        const penalizedRemaining = Math.max(
          0,
          active.remainingMs - PASS_PENALTY_MS
        );

        const players = {
          ...afterTick.players,
          [role]: { ...active, remainingMs: penalizedRemaining },
        };

        let phase: RoundPhase = afterTick.phase;
        let winner: PlayerRole | null = afterTick.winner;
        let activePlayer: PlayerRole | null = role;

        if (penalizedRemaining <= 0) {
          phase = "complete";
          winner = role === "challenger" ? "challengee" : "challenger";
          activePlayer = null;
        } else {
          phase = "passDelay";
        }

        const newIndex =
          afterTick.totalPages === 0
            ? afterTick.currentPageIndex
            : Math.min(
                afterTick.currentPageIndex + 1,
                Math.max(afterTick.totalPages - 1, 0)
              );

        return {
          ...afterTick,
          players,
          phase,
          activePlayer,
          winner,
          resumeAt: phase === "passDelay" ? now + PASS_PENALTY_MS : null,
          lastTickAt: null,
          pendingPageIndex:
            phase === "passDelay" ? newIndex : afterTick.pendingPageIndex,
          history,
        };
      });
    },
    resumeAfterDelay: () => {
      set((state) => {
        if (state.phase !== "passDelay" || !state.activePlayer) {
          return state;
        }
        const now = Date.now();
        return {
          ...state,
          phase: "running",
          resumeAt: null,
          lastTickAt: now,
          currentPageIndex:
            state.pendingPageIndex ?? state.currentPageIndex,
          pendingPageIndex: null,
        };
      });
    },
    switchTurn: () => {
      set((state) => {
        if (state.phase !== "running" || !state.activePlayer) {
          return state;
        }

        const history = pushHistory(state);
        const now = Date.now();
        const afterTick = applyTimeDeduction(state, now);
        if (afterTick.phase === "complete" || !afterTick.activePlayer) {
          return { ...afterTick, history };
        }

        const triggeringRole = afterTick.activePlayer;
        const triggeringPlayer = afterTick.players[triggeringRole];

        if (triggeringPlayer.switchesUsed >= MAX_SWITCHES_PER_PLAYER) {
          return afterTick;
        }

        const nextRole: PlayerRole =
          triggeringRole === "challenger" ? "challengee" : "challenger";

        return {
          ...afterTick,
          players: {
            ...afterTick.players,
            [triggeringRole]: {
              ...triggeringPlayer,
              switchesUsed: triggeringPlayer.switchesUsed + 1,
            },
          },
          activePlayer: nextRole,
          pendingPageIndex: null,
          lastTickAt: now,
          history,
        };
      });
    },
    tick: (now) => {
      set((state) => {
        if (state.phase === "passDelay" && state.resumeAt) {
          if (now >= state.resumeAt) {
            return {
              ...state,
              phase: "running",
              resumeAt: null,
              lastTickAt: now,
              currentPageIndex:
                state.pendingPageIndex ?? state.currentPageIndex,
              pendingPageIndex: null,
            };
          }
          return state;
        }

        if (state.phase !== "running" || !state.activePlayer) {
          return state.lastTickAt ? { ...state, lastTickAt: now } : state;
        }

        const lastTickAt = state.lastTickAt ?? now;
        const delta = Math.max(0, now - lastTickAt);
        if (delta < 50) {
          return state;
        }

        const role = state.activePlayer;
        const active = state.players[role];
        const remaining = Math.max(0, active.remainingMs - delta);

        const players = {
          ...state.players,
          [role]: { ...active, remainingMs: remaining },
        };

        if (remaining <= 0) {
          return {
            ...state,
            players,
            phase: "complete",
            winner: role === "challenger" ? "challengee" : "challenger",
            activePlayer: null,
            lastTickAt: now,
            pendingPageIndex: null,
          };
        }

        return {
          ...state,
          players,
          lastTickAt: now,
        };
      });
    },
    undoLastAction: () => {
      set((state) => {
        if (state.history.length === 0) {
          return state;
        }
        const [previous, ...rest] = state.history;
        return {
          ...previous,
          history: rest,
        };
      });
    },
    resetRound: () => {
      set(() => ({
        ...initialState,
        players: initialPlayers(),
      }));
    },
    hydrateFromSnapshot: (snapshot) => {
      set(() => ({
        topic: snapshot.topic,
        players: clonePlayers(snapshot.players),
        activePlayer: snapshot.activePlayer,
        phase: snapshot.phase,
        currentPageIndex: snapshot.currentPageIndex,
        pendingPageIndex: snapshot.pendingPageIndex,
        totalPages: snapshot.totalPages,
        resumeAt: snapshot.resumeAt,
        lastTickAt: snapshot.lastTickAt,
        answerKey: [...snapshot.answerKey],
        showAnswer: snapshot.showAnswer,
        roundDurationMs: snapshot.roundDurationMs,
        winner: snapshot.winner,
        history: [],
      }));
    },
}));

export const getRoundSnapshot = (): RoundSnapshot =>
  selectRoundSnapshot(useRoundStore.getState());
