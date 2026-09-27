import { LIBRARY_DISCLAIMER, EXERCISE_SAFETY_NOTICE } from "../data/healthLibrary";
import "../pages/HealthLibrary.css";

// Detail popup for an Exercise & Yoga card — same overlay pattern as the
// health-topic modal, on the same page with no extra routes. Shows what the
// exercise is, basic steps, general benefits, difficulty, and safety notes.
// Renders nothing when no exercise is given.
export default function ExerciseDetailModal({ exercise, onClose }) {
  if (!exercise) return null;
  return (
    <div className="library-modal-overlay" onClick={onClose}>
      <div
        className="library-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={exercise.title}
      >
        <div className="library-modal-header">
          <div className="library-modal-title">
            <span className="library-modal-icon" aria-hidden="true">
              {exercise.icon ?? "🧘"}
            </span>
            <div>
              <h2>{exercise.title}</h2>
              <span className="library-modal-cat">{exercise.subsection}</span>
            </div>
          </div>
          <button
            type="button"
            className="library-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="library-modal-subhead">What it is</p>
        <p className="library-modal-about">{exercise.about}</p>
        {Array.isArray(exercise.steps) && exercise.steps.length > 0 && (
          <>
            <p className="library-modal-subhead">How to perform (basic steps)</p>
            <ol className="library-list">
              {exercise.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        )}
        <p className="library-modal-subhead">General benefits</p>
        <p className="library-modal-about">{exercise.benefit}</p>
        <p className="library-modal-subhead">Difficulty</p>
        <p className="library-modal-about">
          <span className={`library-difficulty ${exercise.difficulty === "Intermediate" ? "diff-intermediate" : ""}`}>
            {exercise.difficulty}
          </span>
        </p>
        {exercise.safety && (
          <>
            <p className="library-modal-subhead">Safety note</p>
            <p className="library-modal-seek">{exercise.safety}</p>
          </>
        )}
        <p className="library-modal-seek" style={{ marginTop: "8px" }}>
          {EXERCISE_SAFETY_NOTICE}
        </p>
        <p className="library-note" style={{ marginTop: "12px" }}>
          {LIBRARY_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
