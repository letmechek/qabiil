"use client";

import { useEffect, useState } from "react";

const PROFILE_STEPS = [
  "Requesting person record from database...",
  "Resolving father and mother references...",
  "Preparing profile sections and actions...",
  "Rendering profile view...",
] as const;

const TREE_STEPS = [
  "Requesting root person record from database...",
  "Parsing genealogy for lineage trace...",
  "Collecting direct descendants from children groups...",
  "Expanding descendants tree levels...",
  "Rendering lineage and descendants sections...",
] as const;

export function LoadingStatusNote({ kind = "profile" }: { kind?: "profile" | "tree" }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const steps = kind === "tree" ? TREE_STEPS : PROFILE_STEPS;

  useEffect(() => {
    const startedAt = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    const stepTimers = steps.map((_, idx) =>
      window.setTimeout(() => {
        setStepIndex((current) => (idx > current ? idx : current));
      }, idx * 1250),
    );

    return () => {
      window.clearInterval(elapsedTimer);
      stepTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [kind, steps]);

  const activeStep = steps[Math.min(stepIndex, steps.length - 1)];
  const isLongWait = elapsedSeconds >= 6;

  return (
    <div className="fixed right-4 bottom-4 z-[70] rounded-xl border border-cyan-200 bg-white/95 px-4 py-3 text-sm text-cyan-800 shadow-lg">
      <p className="font-semibold">{activeStep}</p>
      <p className="mt-1 text-xs text-slate-500">
        Step {Math.min(stepIndex + 1, steps.length)}/{steps.length} • {elapsedSeconds}s elapsed
      </p>
      {isLongWait ? (
        <p className="mt-1 text-xs text-slate-500">
          Still processing deeper data. You can keep scrolling while we finish.
        </p>
      ) : null}
    </div>
  );
}
