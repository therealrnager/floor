'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TopicFolder } from "@/lib/topics";
import type { TopicSelection } from "../state/roundStore";
import { useRoundStore } from "../state/roundStore";

interface SetupRoundFormProps {
  topicFolders: TopicFolder[];
}

export const SetupRoundForm = ({ topicFolders }: SetupRoundFormProps) => {
  const router = useRouter();
  const configureRound = useRoundStore((state) => state.configureRound);
  const resetRound = useRoundStore((state) => state.resetRound);

  const [challengerName, setChallengerName] = useState("");
  const [challengeeName, setChallengeeName] = useState("");
  const folderEntries = useMemo(
    () =>
      topicFolders.length > 0
        ? topicFolders
        : [{ folder: "topics", topics: [] }],
    [topicFolders]
  );
  const [activeFolder, setActiveFolder] = useState(() => {
    if (folderEntries.some((entry) => entry.folder === "topics")) {
      return "topics";
    }
    return folderEntries[0]?.folder ?? "topics";
  });
  const topicsByFolder = useMemo(
    () => new Map(folderEntries.map((entry) => [entry.folder, entry.topics])),
    [folderEntries]
  );
  const topics = topicsByFolder.get(activeFolder) ?? [];
  const [topicId, setTopicId] = useState(() => topics[0]?.id ?? "");
  const [durationSeconds, setDurationSeconds] = useState("");

  const topicsById = useMemo(() => {
    return new Map(topics.map((topic) => [topic.id, topic]));
  }, [topics]);

  const selectedTopicId = topicsById.has(topicId) ? topicId : "";

  useEffect(() => {
    resetRound();
  }, [resetRound]);

  useEffect(() => {
    setActiveFolder((current) => {
      if (topicsByFolder.has(current)) {
        return current;
      }
      if (topicsByFolder.has("topics")) {
        return "topics";
      }
      return folderEntries[0]?.folder ?? "topics";
    });
  }, [folderEntries, topicsByFolder]);

  useEffect(() => {
    setTopicId((previous) => {
      if (topicsById.has(previous)) {
        return previous;
      }
      return topics[0]?.id ?? "";
    });
  }, [topics, topicsById]);

  const canStart =
    challengerName.trim().length > 0 &&
    challengeeName.trim().length > 0 &&
    topicsById.has(selectedTopicId);

  const handleStart = () => {
    if (!canStart) {
      return;
    }
    const topic = topicsById.get(selectedTopicId)!;
    const trimmedDuration = durationSeconds.trim();
    const parsedSeconds = Number(trimmedDuration);
    const roundDurationMs =
      trimmedDuration.length > 0 && Number.isFinite(parsedSeconds)
        ? Math.max(1, Math.min(3_600, Math.floor(parsedSeconds))) * 1000
        : undefined;
    configureRound({
      challengerName: challengerName.trim(),
      challengeeName: challengeeName.trim(),
      topic,
      roundDurationMs,
    });
    router.push("/round");
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 rounded-3xl bg-white/80 p-12 shadow-xl backdrop-blur-md ring-1 ring-zinc-200">
      <header className="space-y-3 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-indigo-600">
          The Floor
        </p>
        <h1 className="text-4xl font-semibold text-zinc-900">
          Launch a Head-to-Head Round
        </h1>
        <p className="text-base text-zinc-600">
          Enter each contestant and pick a topic deck (PDF exported from your
          slides). Drop decks anywhere under{" "}
          <code className="rounded bg-zinc-100 px-2 py-1 text-sm">public/</code>{" "}
          and select the folder below.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">
            Challenger Name
          </span>
          <input
            type="text"
            value={challengerName}
            onChange={(event) => setChallengerName(event.target.value)}
            placeholder="e.g. billy"
            className="h-12 rounded-xl border border-zinc-200 px-4 text-base text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-700">
            Challengee Name
          </span>
          <input
            type="text"
            value={challengeeName}
            onChange={(event) => setChallengeeName(event.target.value)}
            placeholder="e.g. bob"
            className="h-12 rounded-xl border border-zinc-200 px-4 text-base text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700">
          Topic folder (inside <code>public/</code>)
        </span>
        <select
          value={activeFolder}
          onChange={(event) => setActiveFolder(event.target.value)}
          className="h-12 rounded-xl border border-zinc-200 px-4 text-base text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        >
          {folderEntries.map((entry) => (
            <option key={entry.folder} value={entry.folder}>
              {entry.folder}{" "}
              {entry.topics.length > 0
                ? `(${entry.topics.length} decks)`
                : "(empty)"}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700">
          Topic Deck (PDF in <code>public/{activeFolder}</code>)
        </span>
        <select
          value={selectedTopicId}
          onChange={(event) => setTopicId(event.target.value)}
          className="h-12 rounded-xl border border-zinc-200 px-4 text-base text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        >
          {topics.length === 0 ? (
            <option value="">No topics detected</option>
          ) : (
            topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))
          )}
        </select>
        {topics.length === 0 && (
          <p className="text-sm text-amber-600">
            Drop exported PDF decks into{" "}
            <code>public/{activeFolder}</code> and refresh this page.
          </p>
        )}
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-zinc-700">
          Round duration (seconds)
        </span>
        <input
          type="number"
          min={1}
          max={3600}
          step={1}
          value={durationSeconds}
          onChange={(event) => setDurationSeconds(event.target.value)}
          placeholder="60"
          className="h-12 rounded-xl border border-zinc-200 px-4 text-base text-zinc-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        />
        <p className="text-xs text-zinc-500">
          Defaults to 60 seconds if left empty or outside 1–3600.
        </p>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="h-14 flex-1 rounded-2xl bg-indigo-600 text-lg font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          Start Round
        </button>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.open(
                "/stage",
                "the-floor-stage",
                "noopener=yes,width=1280,height=720"
              );
            }
          }}
          className="h-14 flex-1 rounded-2xl border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
        >
          Open Stage Display
        </button>
      </div>

      <aside className="rounded-2xl bg-indigo-50 px-6 py-5 text-sm text-indigo-800">
        <strong className="font-semibold">Hotkeys</strong>:{" "}
        <code className="font-medium">W</code> next question / correct answer,{" "}
        <code className="font-medium">D</code> pass (−3s penalty),{" "}
        <code className="font-medium">A</code> switch (3 per player),{" "}
        <code className="font-medium">Z</code> undo last action. Buttons on the
        round screen trigger the same actions. Press <code className="font-medium">H</code> to
        hide or show the host answer card.
      </aside>
    </div>
  );
};
