import { useState, useEffect } from "react";

const KICKOFF = new Date("2026-06-11T00:00:00Z").getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getTimeLeft(): TimeLeft {
  const diff = Math.max(0, KICKOFF - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-mono text-3xl sm:text-4xl font-bold text-yc-green tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-yc-text-tertiary text-xs uppercase tracking-widest mt-1">
        {label}
      </span>
    </div>
  );
}

export default function Countdown() {
  const [time, setTime] = useState(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <TimeBlock value={time.days} label="days" />
      <span className="text-yc-text-tertiary text-2xl font-light">:</span>
      <TimeBlock value={time.hours} label="hrs" />
      <span className="text-yc-text-tertiary text-2xl font-light">:</span>
      <TimeBlock value={time.minutes} label="min" />
      <span className="text-yc-text-tertiary text-2xl font-light">:</span>
      <TimeBlock value={time.seconds} label="sec" />
    </div>
  );
}
