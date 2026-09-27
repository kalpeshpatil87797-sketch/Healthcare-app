import { PRODUCTS } from "../data/medicines";
import "../pages/Medicine.css";

export const DISCLAIMER =
  "This medicine directory is for educational information only and is not a substitute for professional medical advice. Consult a qualified healthcare professional before taking any medicine.";

// Build the same brand-family object the Medicine page grouping creates,
// for a single known product — so the existing detail modal can be opened
// directly (e.g. from a doctor-chat card) with all sibling strengths/forms.
export function familyForProduct(p) {
  const sibs = PRODUCTS.filter(
    (x) => x.activeIngredient === p.activeIngredient && x.brandName === p.brandName
  );
  return {
    key: `${p.activeIngredient}|||${p.brandName}`,
    brandName: p.brandName,
    companyName: p.companyName,
    strengths: [...new Set(sibs.map((s) => s.strength))],
    dosageForms: [...new Set(sibs.map((s) => s.dosageForm))],
    info: p,
  };
}

// Shared medicine full-details modal — same presentation and information
// structure as the Medicine page. Renders nothing when no family is given.
export default function MedicineDetailModal({ family, onClose }) {
  if (!family) return null;
  return (
    <div className="medicine-modal-overlay" onClick={onClose}>
      <div className="medicine-modal" onClick={(e) => e.stopPropagation()}>
        <div className="medicine-modal-header">
          <h2>{family.brandName}</h2>
          <button type="button" className="medicine-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p><strong>Active ingredient:</strong> {family.info.activeIngredient}</p>
        <p><strong>Company:</strong> {family.companyName}</p>
        <p><strong>Available strengths:</strong> {family.strengths.join(", ")}</p>
        <p><strong>Dosage forms:</strong> {family.dosageForms.join(", ")}</p>
        <p><strong>Drug category:</strong> {family.info.category}</p>
        <p><strong>Related conditions:</strong> {family.info.conditions.join(", ")}</p>
        <p><strong>Common use:</strong> {family.info.use}</p>
        <p><strong>Description:</strong> {family.info.detailedDescription}</p>
        <p><strong>Common uses:</strong></p>
        <ul className="medicine-list">
          {family.info.commonUses.map((u) => (
            <li key={u}>{u}</li>
          ))}
        </ul>
        <p><strong>Precautions:</strong> {family.info.precautions}</p>
        <p><strong>Warnings:</strong> {family.info.warnings}</p>
        <p className="medicine-note" style={{ marginTop: "12px" }}>{DISCLAIMER}</p>
      </div>
    </div>
  );
}
