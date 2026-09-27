import { LIBRARY_CATEGORIES, LIBRARY_DISCLAIMER } from "../data/healthLibrary";
import "../pages/HealthLibrary.css";

function categoryIcon(category) {
  return LIBRARY_CATEGORIES.find((c) => c.name === category)?.icon ?? "📚";
}

// Read-more modal for a health-library topic — same overlay pattern as the
// medicine details modal. General education only, plus a clear pointer to
// professional care. Renders nothing when no topic is given.
export default function HealthTopicModal({ topic, onClose }) {
  if (!topic) return null;
  return (
    <div className="library-modal-overlay" onClick={onClose}>
      <div
        className="library-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={topic.title}
      >
        <div className="library-modal-header">
          <div className="library-modal-title">
            <span className="library-modal-icon" aria-hidden="true">
              {categoryIcon(topic.category)}
            </span>
            <div>
              <h2>{topic.title}</h2>
              <span className="library-modal-cat">{topic.category}</span>
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
        <p className="library-modal-about">{topic.about}</p>
        {Array.isArray(topic.goodToKnow) && topic.goodToKnow.length > 0 && (
          <>
            <p className="library-modal-subhead">Good to know</p>
            <ul className="library-list">
              {topic.goodToKnow.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </>
        )}
        {topic.whenToSeek && (
          <>
            <p className="library-modal-subhead">When to seek medical care</p>
            <p className="library-modal-seek">{topic.whenToSeek}</p>
          </>
        )}
        <p className="library-note" style={{ marginTop: "12px" }}>
          {LIBRARY_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
