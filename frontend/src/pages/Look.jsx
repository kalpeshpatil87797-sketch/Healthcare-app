import { useState, useRef } from "react";
import Layout from "../components/Layout";
import HealthTopicModal from "../components/HealthTopicModal";
import ExerciseDetailModal from "../components/ExerciseDetailModal";
import {
  LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_INFO,
  LIBRARY_TOPICS,
  LIBRARY_DISCLAIMER,
  EXERCISE_SUBSECTIONS,
  EXERCISE_GOAL_FILTERS,
  EXERCISE_SAFETY_NOTICE,
  LIBRARY_EXERCISES,
} from "../data/healthLibrary";
import "./HealthLibrary.css";

// Health Library (route /look — same page/route structure as the former
// Book placeholder). Frontend-only education content, same search +
// category + card-grid + read-more-modal pattern as the Medicine page.
function matchesLibrarySearch(topic, query) {
  if (query === "") return true;
  const q = query.toLowerCase();
  return [
    topic.title,
    topic.category,
    topic.description,
    ...(topic.keywords ?? []),
  ].some((f) => String(f ?? "").toLowerCase().includes(q));
}

function categoryIcon(name) {
  return LIBRARY_CATEGORIES.find((c) => c.name === name)?.icon ?? "📚";
}

// Exercise search covers names, poses, subsection, benefit, difficulty,
// goals, and keywords — the existing topic search above is unchanged.
function matchesExerciseSearch(exercise, query, goal) {
  if (goal !== "All" && !(exercise.goals ?? []).includes(goal)) return false;
  if (query === "") return true;
  const q = query.toLowerCase();
  return [
    exercise.title,
    exercise.subsection,
    exercise.description,
    exercise.benefit,
    exercise.difficulty,
    ...(exercise.goals ?? []),
    ...(exercise.keywords ?? []),
  ].some((f) => String(f ?? "").toLowerCase().includes(q));
}

function HealthLibrary() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeGoal, setActiveGoal] = useState("All");
  const [selected, setSelected] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const sectionsRef = useRef(null);

  const query = search.trim();

  function scrollToSections() {
    requestAnimationFrame(() => {
      sectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleCategoryClick(c) {
    setActiveCategory(c);
    setActiveGoal("All");
    scrollToSections();
  }

  const visibleCategories =
    activeCategory === "All"
      ? LIBRARY_CATEGORIES.map((c) => c.name)
      : [activeCategory];

  const sections = visibleCategories
    .map((category) => ({
      category,
      topics: LIBRARY_TOPICS.filter(
        (t) => t.category === category && matchesLibrarySearch(t, query)
      ),
    }))
    .filter((s) => s.topics.length > 0);

  // Exercise & Yoga lives in its own dataset with subsection grouping and
  // goal filtering. Topic sections above are untouched.
  const showExerciseSection =
    activeCategory === "All" || activeCategory === "Exercise & Yoga";

  const exerciseGroups = showExerciseSection
    ? EXERCISE_SUBSECTIONS.map((subsection) => ({
        subsection,
        exercises: LIBRARY_EXERCISES.filter(
          (ex) =>
            ex.subsection === subsection &&
            matchesExerciseSearch(ex, query, activeGoal)
        ),
      })).filter((g) => g.exercises.length > 0)
    : [];

  function closeModal() {
    setSelected(null);
  }

  function clearSearch() {
    setSearch("");
  }

  function renderExerciseCard(exercise) {
    function openDetails() {
      setSelectedExercise(exercise);
    }
    function openOnKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    }
    return (
      <div
        key={exercise.id}
        className="library-card library-clickable"
        onClick={openDetails}
        onKeyDown={openOnKey}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${exercise.title}`}
      >
        <div className="library-card-top">
          <span className="library-icon" aria-hidden="true">
            {exercise.icon}
          </span>
          <div className="library-card-info">
            <h3>{exercise.title}</h3>
            <p className="library-card-cat">{exercise.subsection}</p>
          </div>
        </div>
        <p className="library-card-desc">{exercise.description}</p>
        <p className="library-card-meta">
          <span className="library-meta-label">Benefit:</span> {exercise.benefit}
        </p>
        <p className="library-card-meta">
          <span className="library-meta-label">Difficulty:</span>{" "}
          <span className={`library-difficulty ${exercise.difficulty === "Intermediate" ? "diff-intermediate" : ""}`}>
            {exercise.difficulty}
          </span>
        </p>
        <button
          type="button"
          className="library-readmore"
          onClick={(e) => {
            e.stopPropagation();
            openDetails();
          }}
        >
          Read More
        </button>
      </div>
    );
  }

  function renderCard(topic) {
    function openDetails() {
      setSelected(topic);
    }
    function openOnKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    }
    return (
      <div
        key={topic.id}
        className="library-card library-clickable"
        onClick={openDetails}
        onKeyDown={openOnKey}
        role="button"
        tabIndex={0}
        aria-label={`Read more about ${topic.title}`}
      >
        <div className="library-card-top">
          <span className="library-icon" aria-hidden="true">
            {categoryIcon(topic.category)}
          </span>
          <div className="library-card-info">
            <h3>{topic.title}</h3>
            <p className="library-card-cat">{topic.category}</p>
          </div>
        </div>
        <p className="library-card-desc">{topic.description}</p>
        <button
          type="button"
          className="library-readmore"
          onClick={(e) => {
            e.stopPropagation();
            openDetails();
          }}
        >
          Read More
        </button>
      </div>
    );
  }

  return (
    <Layout>
      <div className="library-page">
        <span className="library-badge">📚 Health Education</span>
        <h1 className="library-heading">Health Library</h1>
        <p className="library-sub">
          Learn about common health conditions, prevention, healthy habits, and when to seek medical care.
        </p>

        <div className="library-search-wrap">
          <span className="library-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="library-search"
            placeholder="Search health topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search health topics, exercises, and yoga poses"
          />
          {query !== "" && (
            <button
              type="button"
              className="library-search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="library-categories" aria-label="Health library categories">
          <button
            type="button"
            className={`library-cat-btn ${activeCategory === "All" ? "active" : ""}`}
            onClick={() => handleCategoryClick("All")}
          >
            All
          </button>
          {LIBRARY_CATEGORIES.map((c) => (
            <button
              key={c.name}
              type="button"
              className={`library-cat-btn ${activeCategory === c.name ? "active" : ""}`}
              onClick={() => handleCategoryClick(c.name)}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        <div ref={sectionsRef} className="library-sections">
          {sections.length === 0 && exerciseGroups.length === 0 ? (
            <div className="library-empty">
              <span className="library-empty-icon" aria-hidden="true">📚</span>
              <p className="library-empty-title">No health topics found.</p>
              <p className="library-empty-sub">Try another topic name or category.</p>
            </div>
          ) : (
            <>
              {sections.map(({ category, topics }) => (
                <section key={category} aria-label={category}>
                  <h2 className="library-section-title">
                    <span>
                      {categoryIcon(category)} {category}
                    </span>
                  </h2>
                  {LIBRARY_CATEGORY_INFO[category] && (
                    <p className="library-cat-info">{LIBRARY_CATEGORY_INFO[category]}</p>
                  )}
                  <div className="library-grid">{topics.map((t) => renderCard(t))}</div>
                </section>
              ))}
              {exerciseGroups.length > 0 && (
                <section aria-label="Exercise & Yoga">
                  <h2 className="library-section-title">
                    <span>
                      {categoryIcon("Exercise & Yoga")} Exercise & Yoga
                    </span>
                  </h2>
                  {LIBRARY_CATEGORY_INFO["Exercise & Yoga"] && (
                    <p className="library-cat-info">{LIBRARY_CATEGORY_INFO["Exercise & Yoga"]}</p>
                  )}
                  <div className="library-goal-row" aria-label="Filter by workout goal">
                    <button
                      type="button"
                      className={`library-cat-btn ${activeGoal === "All" ? "active" : ""}`}
                      onClick={() => setActiveGoal("All")}
                    >
                      All
                    </button>
                    {EXERCISE_GOAL_FILTERS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={`library-cat-btn ${activeGoal === g ? "active" : ""}`}
                        onClick={() => setActiveGoal(g)}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  <p className="library-safety-note">⚠️ {EXERCISE_SAFETY_NOTICE}</p>
                  {exerciseGroups.map(({ subsection, exercises }) => (
                    <div key={subsection}>
                      <h3 className="library-subsection-title">{subsection}</h3>
                      <div className="library-grid">
                        {exercises.map((ex) => renderExerciseCard(ex))}
                      </div>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        <p className="library-note">{LIBRARY_DISCLAIMER}</p>
        <p className="library-note" style={{ marginTop: "8px" }}>
          Urgent or severe symptoms — such as difficulty breathing, chest pain, confusion,
          or signs of a serious allergic reaction — should be evaluated by a medical
          professional promptly.
        </p>

        {selected && <HealthTopicModal topic={selected} onClose={closeModal} />}
        {selectedExercise && (
          <ExerciseDetailModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
        )}
      </div>
    </Layout>
  );
}

export default HealthLibrary;
