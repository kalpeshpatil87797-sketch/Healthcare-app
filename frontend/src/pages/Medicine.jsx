import { useState, useRef } from "react";
import Layout from "../components/Layout";
import MedicineDetailModal, { DISCLAIMER } from "../components/MedicineDetailModal";
import { PRODUCTS, CATEGORIES, CATEGORY_INFO } from "../data/medicines";
import "./Medicine.css";

function matchesSearch(p, query) {
  if (query === "") return true;
  const q = query.toLowerCase();
  return [p.activeIngredient, p.brandName, p.companyName, p.category, p.strength].some((f) =>
    String(f).toLowerCase().includes(q)
  );
}

function Medicine() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState(null);
  const sectionsRef = useRef(null);

  const query = search.trim();

  function scrollToSections() {
    requestAnimationFrame(() => {
      sectionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleCategoryClick(c) {
    setActiveCategory(c);
    scrollToSections();
  }

  const visibleCategories = activeCategory === "All" ? CATEGORIES : [activeCategory];

  // Group matching products of a category by active ingredient, then by
  // brand family (activeIngredient + brandName). Different strengths of the
  // same brand belong to one family and never occupy multiple top slots.
  function ingredientsIn(category) {
    const inCategory = PRODUCTS.filter(
      (p) => p.conditions.includes(category) && matchesSearch(p, query)
    );
    const byIngredient = new Map();
    for (const p of inCategory) {
      if (!byIngredient.has(p.activeIngredient)) byIngredient.set(p.activeIngredient, []);
      byIngredient.get(p.activeIngredient).push(p);
    }
    return [...byIngredient.entries()].map(([ingredient, products]) => {
      const families = new Map();
      for (const p of products) {
        const key = `${p.activeIngredient}|||${p.brandName}`;
        if (!families.has(key)) {
          families.set(key, {
            key,
            brandName: p.brandName,
            companyName: p.companyName,
            strengths: [],
            dosageForms: [],
            info: p,
          });
        }
        const f = families.get(key);
        if (!f.strengths.includes(p.strength)) f.strengths.push(p.strength);
        if (!f.dosageForms.includes(p.dosageForm)) f.dosageForms.push(p.dosageForm);
      }
      const all = [...families.values()];
      return {
        ingredient,
        top: all.slice(0, 3),
        rest: all.slice(3),
      };
    });
  }

  const sections = visibleCategories
    .map((c) => ({ category: c, groups: ingredientsIn(c) }))
    .filter((s) => s.groups.length > 0);

  function closeModal() {
    setSelected(null);
  }

  function renderCard(f) {
    function openDetails() {
      setSelected(f);
    }
    function openOnKey(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    }
    return (
      <div
        key={f.key}
        className="medicine-card medicine-clickable"
        onClick={openDetails}
        onKeyDown={openOnKey}
        role="button"
        tabIndex={0}
        aria-label={`View details for ${f.brandName}`}
      >
        <div className="medicine-card-top">
          <span className="medicine-icon" aria-hidden="true">💊</span>
          <div className="medicine-card-info">
            <h3>{f.brandName}</h3>
            <p className="medicine-ingredient-line">{f.info.activeIngredient}</p>
            <p className="medicine-strength-line">{f.strengths.join(" · ")}</p>
            <p>{f.companyName}</p>
          </div>
        </div>
        <button
          type="button"
          className="medicine-readmore"
          onClick={(e) => {
            e.stopPropagation();
            openDetails();
          }}
        >
          View Details
        </button>
      </div>
    );
  }

  function clearSearch() {
    setSearch("");
  }

  return (
    <Layout>
      <div className="medicine-page">
        <span className="medicine-badge">💊 Information Directory</span>
        <h1 className="medicine-heading">Medicine Information</h1>
        <p className="medicine-sub">
          Explore commonly used medicines organized by health category.
        </p>

        <div className="medicine-search-wrap">
          <span className="medicine-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            className="medicine-search"
            placeholder="Search medicines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search by ingredient, brand, company, category, or strength"
          />
          {query !== "" && (
            <button
              type="button"
              className="medicine-search-clear"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="medicine-categories" aria-label="Medicine categories">
          <button
            type="button"
            className={`medicine-cat-btn ${activeCategory === "All" ? "active" : ""}`}
            onClick={() => handleCategoryClick("All")}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`medicine-cat-btn ${activeCategory === c ? "active" : ""}`}
              onClick={() => handleCategoryClick(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div ref={sectionsRef} className="medicine-sections">
          {sections.length === 0 ? (
            <div className="medicine-empty">
              <span className="medicine-empty-icon" aria-hidden="true">💊</span>
              <p className="medicine-empty-title">No medicines found.</p>
              <p className="medicine-empty-sub">Try another medicine name or category.</p>
            </div>
          ) : (
            sections.map(({ category, groups }) => (
              <section key={category} aria-label={category}>
                <h2 className="medicine-section-title"><span>{category}</span></h2>
                {CATEGORY_INFO[category] && (
                  <p className="medicine-cat-info">{CATEGORY_INFO[category]}</p>
                )}
                {groups.map(({ ingredient, top, rest }) => (
                  <div key={ingredient} className="medicine-ingredient">
                    <h3 className="medicine-ingredient-name">{ingredient}</h3>
                    <div className="medicine-grid">
                      {top.map((p) => renderCard(p))}
                    </div>
                    {rest.length > 0 && (
                      <>
                        <p className="medicine-more-label">More available brands/products</p>
                        <div className="medicine-grid">
                          {rest.map((p) => renderCard(p))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <p className="medicine-note">{DISCLAIMER}</p>
        <p className="medicine-note" style={{ marginTop: "8px" }}>
          Urgent or severe symptoms — such as difficulty breathing, chest pain, confusion,
          or signs of a serious allergic reaction — should be evaluated by a medical
          professional promptly.
        </p>

        {selected && (
          <MedicineDetailModal family={selected} onClose={closeModal} />
        )}
      </div>
    </Layout>
  );
}

export default Medicine;
