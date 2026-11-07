import { useCallback, useEffect, useState } from "react";
import type { Item } from "../lib/kb";

type Rating = "again" | "good" | "easy";

interface CardState {
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  due: string;
}

type Store = Record<string, CardState>;

interface QuizProps {
  sectionId: string;
  sectionTitle: string;
  items: Item[];
}

const STORAGE_KEY = "lp.progress.v1";

function isoDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function shuffle<T>(values: T[]): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function loadStore(): Store {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function persistStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable (private mode); progress just won't persist.
  }
}

function schedule(previous: CardState | undefined, rating: Rating): CardState {
  const today = isoDate();
  const base: CardState = previous ?? {
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    due: today,
  };

  let { interval, ease, reps, lapses } = base;

  if (rating === "again") {
    reps = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 1;
  } else if (rating === "good") {
    reps += 1;
    interval = reps === 1 ? 1 : reps === 2 ? 3 : Math.max(1, Math.round(Math.max(1, interval) * ease));
  } else {
    reps += 1;
    ease = Math.min(3, ease + 0.15);
    interval = reps === 1 ? 2 : Math.max(1, Math.round(Math.max(1, interval) * ease * 1.3));
  }

  return { interval, ease, reps, lapses, due: addDays(today, interval) };
}

function ratingLabel(rating: Rating, card: CardState | undefined): string {
  const next = schedule(card, rating);
  return `${rating === "again" ? "Again" : rating === "good" ? "Good" : "Easy"} · ${next.interval}d`;
}

export default function Quiz({ sectionTitle, items }: QuizProps) {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [store, setStore] = useState<Store>({});
  const [rated, setRated] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const loaded = loadStore();
    setStore(loaded);
    const today = isoDate();
    const due: Item[] = [];
    const later: Item[] = [];

    for (const item of items) {
      const card = loaded[item.id];
      if (!card || card.due <= today) due.push(item);
      else later.push(item);
    }

    setQueue([...shuffle(due), ...shuffle(later)]);
  }, [items]);

  const current = queue && index < queue.length ? queue[index] : null;

  const rate = useCallback(
    (rating: Rating) => {
      if (!queue || !current) return;

      const nextCard = schedule(store[current.id], rating);
      const nextStore = { ...store, [current.id]: nextCard };
      setStore(nextStore);
      persistStore(nextStore);
      setRated((value) => value + 1);

      if (index + 1 >= queue.length) {
        setDone(true);
        setRevealed(false);
      } else {
        setIndex((value) => value + 1);
        setRevealed(false);
      }
    },
    [current, index, queue, store],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (done || !current) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (!revealed && (event.code === "Space" || event.key === "Enter")) {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      if (revealed) {
        if (event.key === "1") rate("again");
        if (event.key === "2") rate("good");
        if (event.key === "3") rate("easy");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, done, rate, revealed]);

  function restart() {
    setQueue(shuffle(items));
    setIndex(0);
    setRevealed(false);
    setRated(0);
    setDone(false);
  }

  function resetProgress() {
    const confirmed = window.confirm(
      "Reset all saved progress for this browser? This cannot be undone.",
    );
    if (!confirmed) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setStore({});
    restart();
  }

  if (!queue) {
    return (
      <div className="quiz-topbar">
        <span>Preparing your session…</span>
      </div>
    );
  }

  if (done) {
    const dueNow = Object.values(store).filter((card) => card.due <= isoDate()).length;
    const scheduled = Object.keys(store).length;

    return (
      <div>
        <div className="quiz-topbar">
          <span>{sectionTitle}</span>
          <span>Session complete</span>
        </div>

        <div className="quiz-card">
          <h2>Nice work.</h2>
          <p className="muted">
            You reviewed {rated} card{rated === 1 ? "" : "s"} from this session.
            Progress is saved in this browser.
          </p>

          <div className="summary-grid">
            <div className="stat">
              <strong>{rated}</strong>
              <span>this session</span>
            </div>
            <div className="stat">
              <strong>{scheduled}</strong>
              <span>cards scheduled</span>
            </div>
            <div className="stat">
              <strong>{dueNow}</strong>
              <span>due now</span>
            </div>
          </div>

          <div className="row">
            <button className="btn btn-primary" type="button" onClick={restart}>
              Study again
            </button>
            <a className="btn" href="/">
              All sections
            </a>
            <button className="btn btn-ghost" type="button" onClick={resetProgress}>
              Reset progress
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <p className="empty-state">
        This section has no questions yet. Add items to{" "}
        <code>content/kb.json</code>.
      </p>
    );
  }

  const progress = Math.round((rated / queue.length) * 100);
  const card = store[current.id];

  return (
    <div>
      <div className="quiz-topbar">
        <span>{sectionTitle}</span>
        <span>
          Card {Math.min(rated + 1, queue.length)} of {queue.length}
        </span>
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Session progress"
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="quiz-card" aria-live="polite">
        <div className="row" style={{ gap: ".4rem" }}>
          {current.tags.map((tag) => (
            <span className="tag" key={tag}>
              {tag}
            </span>
          ))}
          <span className="badge">Difficulty {current.difficulty}</span>
        </div>

        <p className="quiz-question">{current.question}</p>

        {!revealed ? (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setRevealed(true)}
          >
            Show answer
          </button>
        ) : (
          <>
            <div className="reveal-box">
              <h4>Answer</h4>
              <p>{current.answer}</p>
              <h4>Reasoning</h4>
              <p>{current.reasoning}</p>
              {current.references.length > 0 && (
                <>
                  <h4>Further reading</h4>
                  <ul className="refs">
                    {current.references.map((reference) => (
                      <li key={reference.url}>
                        <a
                          href={reference.url}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {reference.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="rating-row">
              <button
                className="btn rating-again"
                type="button"
                onClick={() => rate("again")}
              >
                {ratingLabel("again", card)}
              </button>
              <button
                className="btn rating-good"
                type="button"
                onClick={() => rate("good")}
              >
                {ratingLabel("good", card)}
              </button>
              <button
                className="btn rating-easy"
                type="button"
                onClick={() => rate("easy")}
              >
                {ratingLabel("easy", card)}
              </button>
            </div>

            <p className="hint">
              Rate honestly: <kbd>1</kbd> again, <kbd>2</kbd> good,{" "}
              <kbd>3</kbd> easy. <kbd>Space</kbd> reveals the answer.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
