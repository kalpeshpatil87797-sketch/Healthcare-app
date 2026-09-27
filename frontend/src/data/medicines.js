// Frontend-only educational medicine directory (no backend).
// General information only — not personalized medical advice, no dosage instructions.
//
// Data model: every product document is self-contained (flat) so the same shape
// can later move to MongoDB/API unchanged. Each product stores:
//   category, activeIngredient, brandName, companyName, strength, dosageForm,
//   conditions[], use, shortDescription, detailedDescription,
//   commonUses[], precautions, warnings
//
// The same active ingredient can own multiple products (brands/strengths).
// Different strengths are always separate products.
// Real brand data is added category-by-category; ingredients whose brands
// have not been provided yet keep an empty products list.

export const CATEGORIES = [
  "Fever",
  "Headache & Migraine",
  "Cold & Flu",
  "Cough",
  "Allergy",
  "Acidity & Heartburn",
  "Nausea & Vomiting",
  "Diarrhea & Constipation",
  "Toothache",
  "General Pain",
  "Muscle & Joint Pain",
  "Skin Problems",
  "Eye-related Common Problems",
  "Common Infection Information",
  "Vitamins & Minerals",
];

// Short educational note shown with each category section.
export const CATEGORY_INFO = {
  Fever:
    "Fever is commonly a sign that the body is fighting an infection. Mild fever often settles with rest and fluids. A very high, prolonged fever, or fever with warning signs such as difficulty breathing, confusion, stiff neck, or rash should be evaluated by a medical professional promptly.",
  "Headache & Migraine":
    "Common headache types include tension headache, migraine, sinus-related headache, and cluster headache. Headache location alone (right side, left side, forehead, or back of the head) does not reliably determine which medicine is appropriate — the headache type, pattern, and severity matter more. Consult a healthcare professional for recurrent or severe headaches.",
  "Cold & Flu":
    "Colds and flu are viral illnesses, so antibiotics do not help them. Care usually focuses on relieving individual symptoms such as congestion, fever, or cough while the body recovers. Difficulty breathing, chest pain, or a fever that does not settle needs medical evaluation.",
  Cough:
    "Coughs may be dry or produce mucus, and the appropriate care depends on the type and cause. A cough lasting more than a few weeks, or one with blood, wheezing, or breathing difficulty, should be evaluated by a medical professional.",
  Allergy:
    "Allergies occur when the immune system reacts to harmless substances such as pollen, dust, or certain foods. Swelling of the lips, tongue, or throat, or difficulty breathing, are emergency signs — seek immediate medical care.",
  "Acidity & Heartburn":
    "Acidity and heartburn are commonly linked to eating habits, certain medicines, or stomach conditions. Frequent symptoms, difficulty swallowing, unexplained weight loss, or black stools should be evaluated by a medical professional.",
  "Nausea & Vomiting":
    "Nausea and vomiting have many causes, from stomach infections to motion sickness. Persistent vomiting, signs of dehydration, blood in vomit, or severe abdominal pain need prompt medical attention.",
  "Diarrhea & Constipation":
    "Digestive upsets are commonly managed with fluids, diet adjustments, and rest. Bloody stools, severe dehydration, high fever with diarrhea, or constipation lasting a long time should be evaluated by a medical professional.",
  Toothache:
    "Toothache commonly signals cavities, gum problems, or infection that need dental treatment — pain relief alone does not fix the cause. Swelling of the face, fever with tooth pain, or difficulty opening the mouth needs prompt dental or medical care.",
  "General Pain":
    "Mild, short-term general pain is commonly managed with rest and general pain relievers. Severe, sudden, or long-lasting pain, or pain after an injury, should be evaluated by a medical professional.",
  "Muscle & Joint Pain":
    "Muscle and joint pain commonly follows strain, overuse, or minor injury, and often improves with rest. Severe swelling, inability to move a joint, numbness, or pain after significant trauma needs medical evaluation.",
  "Skin Problems":
    "Common skin issues include rashes, itching, dryness, and minor fungal infections. Spreading redness, pus, severe swelling, or a rash with fever should be evaluated by a medical professional.",
  "Eye-related Common Problems":
    "Common eye complaints include dryness, itching, and mild redness. Eye pain, vision changes, sensitivity to light, or an eye injury need prompt evaluation by an eye care professional.",
  "Common Infection Information":
    "Antibiotics work only against bacterial infections, not viral illnesses such as colds or flu. They should be used only when prescribed, and the full course should be completed. Worsening infection signs need medical review. These entries are educational only and not self-medication recommendations.",
  "Vitamins & Minerals":
    "Vitamins and minerals support general health and are best obtained from a balanced diet. Supplements may be suggested by professionals for specific deficiencies. Excessive doses of some nutrients can be harmful — consult a healthcare professional before supplement use.",
};

// Ingredient-level info shared by all products of that ingredient.
// To add new data later, append a product object to the ingredient's
// products list, or append a whole new ingredient block below.
const INGREDIENTS = [
  {
    activeIngredient: "Paracetamol",
    category: "Analgesic & Antipyretic",
    conditions: ["Fever", "Toothache", "General Pain"],
    use: "Commonly used for fever and mild to moderate pain",
    shortDescription: "Widely used for fever and mild to moderate pain relief.",
    detailedDescription:
      "Paracetamol is one of the most commonly used medicines worldwide for reducing fever and relieving mild to moderate pain such as tension-type headaches, body aches, toothache, and cold-related discomfort. It may be used for migraine pain as part of general symptom relief, as advised by a professional.",
    commonUses: ["Fever", "Tension-type headache", "Body aches", "Toothache", "Cold-related discomfort"],
    precautions:
      "Do not exceed the recommended amount. Avoid combining with other products containing paracetamol. People with liver problems should consult a doctor first.",
    warnings:
      "Overdose can cause serious liver damage. Seek immediate medical care in case of accidental overdose. Consult a healthcare professional before use.",
    products: [
      { brandName: "Dolo", companyName: "Micro Labs Ltd", strength: "500mg", dosageForm: "Tablet" },
      { brandName: "Dolo", companyName: "Micro Labs Ltd", strength: "650mg", dosageForm: "Tablet" },
      { brandName: "Dolo", companyName: "Micro Labs Ltd", strength: "1000mg", dosageForm: "Tablet" },
      { brandName: "Crocin Advance", companyName: "GlaxoSmithKline India Pvt. Ltd.", strength: "500mg", dosageForm: "Tablet" },
      { brandName: "Crocin", companyName: "GlaxoSmithKline/Haleon", strength: "650mg", dosageForm: "Tablet" },
      { brandName: "Calpol 500+", companyName: "GlaxoSmithKline Pharmaceuticals Ltd", strength: "500mg", dosageForm: "Tablet" },
      { brandName: "Calpol 650+", companyName: "GlaxoSmithKline Pharmaceuticals Ltd", strength: "650mg", dosageForm: "Tablet" },
      { brandName: "ParaCIP", companyName: "Cipla Ltd", strength: "500mg", dosageForm: "Tablet" },
      { brandName: "ParaCIP", companyName: "Cipla Ltd", strength: "650mg", dosageForm: "Tablet" },
      { brandName: "Pyrigesic", companyName: "East West Pharma", strength: "650mg", dosageForm: "Tablet" },
      { brandName: "Pyrigesic", companyName: "East West Pharma", strength: "1000mg", dosageForm: "Tablet" },
      { brandName: "Pacimol", companyName: "Ipca Laboratories Ltd", strength: "500mg", dosageForm: "Tablet" },
      { brandName: "Pactiv", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Kabimol", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "T-98", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Ibuprofen",
    category: "NSAID Pain Reliever",
    conditions: ["Fever", "Toothache", "Muscle & Joint Pain", "General Pain"],
    use: "Commonly used for pain, inflammation, and fever",
    shortDescription: "Pain reliever with additional anti-inflammatory effects.",
    detailedDescription:
      "Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID) that may be used for headaches including migraine episodes, muscle and joint pain, dental pain, menstrual cramps, and fever, with additional anti-inflammatory effects.",
    commonUses: ["Headache and migraine episodes", "Muscle and joint pain", "Dental pain", "Menstrual cramps", "Fever"],
    precautions:
      "Best taken with food or milk to protect the stomach. Avoid long-term use without medical advice. People with ulcers, kidney problems, or asthma should consult a doctor first.",
    warnings:
      "Stop use and seek care for stomach pain, black stools, vomiting blood, or signs of allergy. Consult a healthcare professional before use.",
    products: [
      { brandName: "Brufen", companyName: "Abbott India Ltd", strength: "200mg", dosageForm: "Tablet" },
      { brandName: "Brufen", companyName: "Abbott India Ltd", strength: "400mg", dosageForm: "Tablet" },
      { brandName: "Brufen", companyName: "Abbott India Ltd", strength: "600mg", dosageForm: "Tablet" },
      { brandName: "Ibugesic", companyName: "Cipla Ltd", strength: "200mg", dosageForm: "Tablet" },
      { brandName: "Ibugesic", companyName: "Cipla Ltd", strength: "400mg", dosageForm: "Tablet" },
      { brandName: "Ibucon", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Advil", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Aspirin",
    category: "NSAID / Antiplatelet",
    conditions: ["Fever"],
    use: "Commonly used for mild pain, fever, and doctor-directed heart protection",
    shortDescription: "Mild pain and fever relief; low doses used for heart care.",
    detailedDescription:
      "Aspirin may be used for mild pain, headache, and fever. In low doses prescribed by doctors, it helps prevent blood clots that can cause heart attacks and strokes. Migraine management with aspirin should be guided by a professional.",
    commonUses: ["Mild headache", "Fever", "General aches", "Doctor-directed heart protection"],
    precautions:
      "Low-dose heart use must be doctor-directed. Avoid in children with viral illness. People with bleeding disorders, ulcers, or asthma should seek medical advice first.",
    warnings:
      "Do not give to children or teenagers with viral infections due to the risk of Reye's syndrome. Low-dose aspirin products meant for doctor-directed heart care should not be treated as general fever medicines. Consult a healthcare professional before use.",
    products: [
      { brandName: "Ecosprin", companyName: "USV", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Loprin", companyName: "Torrent Pharmaceuticals", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Delisprin", companyName: "Aristo Pharmaceuticals", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ascard", companyName: "Micro Labs", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Mefenamic Acid",
    category: "NSAID",
    conditions: ["Fever"],
    use: "May be used for pain and fever only with medical guidance",
    shortDescription: "Prescription NSAID for pain; not a first-choice fever medicine.",
    detailedDescription:
      "Mefenamic Acid is a non-steroidal anti-inflammatory drug that may be used for certain pain conditions and fever only when a healthcare professional considers it appropriate. It should not be treated as a first-choice or general fever medicine equivalent to Paracetamol.",
    commonUses: ["Pain relief under medical guidance", "Fever only when advised by a professional"],
    precautions:
      "Medical guidance may be required before use. People with stomach ulcers, kidney problems, asthma, or heart conditions should consult a doctor first. Avoid combining with other NSAIDs.",
    warnings:
      "Medical guidance may be required before use. Not for children without medical advice. Stop use and seek care for stomach pain, allergy signs, or unusual bleeding. Consult a healthcare professional before use.",
    products: [
      { brandName: "Mefast", companyName: "Zuventus Healthcare", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Mefanorm", companyName: "Serum Institute of India", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Mefalgin", companyName: "Anthus Pharmaceuticals", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ponstan", companyName: "Pfizer", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Naproxen",
    category: "NSAID Pain Reliever",
    conditions: ["Headache & Migraine", "Toothache", "Muscle & Joint Pain", "General Pain"],
    use: "Commonly used for longer-lasting pain and inflammation",
    shortDescription: "Longer-acting NSAID for pain and inflammation.",
    detailedDescription:
      "Naproxen is an NSAID that may be used for migraine and tension-type headaches, dental pain, and muscle and joint pain. Its effects generally last longer than some other pain relievers.",
    commonUses: ["Migraine and tension headache", "Dental pain", "Muscle and joint pain", "Menstrual cramps"],
    precautions:
      "Take with food or milk. Avoid combining with other NSAIDs. People with stomach, kidney, heart, or blood pressure problems should consult a doctor first.",
    warnings:
      "Seek care for signs of stomach bleeding or allergy. Consult a healthcare professional before use, especially for long-term needs.",
    products: [
      { brandName: "Naprosyn", companyName: "RPG Life Sciences", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Napra D", companyName: "Intas Pharmaceuticals", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Arthopan", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Xenobid", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Cuproxen", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Napix", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Movibon", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Napryn", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Naprolet", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Sumatriptan",
    category: "Triptan (Migraine-specific)",
    conditions: ["Headache & Migraine"],
    use: "May be used for migraine attacks as prescribed",
    shortDescription: "Prescription medicine made specifically for migraine.",
    detailedDescription:
      "Sumatriptan belongs to the triptan group, made specifically for migraine attacks rather than general pain. It is commonly used for moderate to severe migraine episodes, with or without aura, when recommended by a doctor. It is not meant for tension, sinus, or cluster headache self-treatment.",
    commonUses: ["Migraine attacks", "Migraine with aura"],
    precautions:
      "Prescription only. Use at the first sign of migraine as directed. Not for daily prevention. People with heart disease, high blood pressure, or circulation problems need medical evaluation first.",
    warnings:
      "Seek immediate care for chest tightness, severe dizziness, or allergy signs. Professional medical advice is required before use.",
    products: [
      { brandName: "Suminat", companyName: "Sun Pharmaceutical Industries", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Sumitrex", companyName: "Sun Pharmaceutical Industries", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Sumitop", companyName: "Healing Pharma", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Imijet", companyName: "Hetero Drugs", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Rizatriptan",
    category: "Triptan (Migraine-specific)",
    conditions: ["Headache & Migraine"],
    use: "May be used for migraine attacks as prescribed",
    shortDescription: "Prescription triptan made specifically for migraine.",
    detailedDescription:
      "Rizatriptan belongs to the triptan group, made specifically for migraine attacks rather than general pain. It is commonly used for migraine episodes, with or without aura, when recommended by a doctor. It is not a general over-the-counter headache medicine.",
    commonUses: ["Migraine attacks", "Migraine with aura"],
    precautions:
      "Prescription only. Use as directed at the start of migraine symptoms. People with heart disease, high blood pressure, or circulation problems need medical evaluation first.",
    warnings:
      "Seek immediate care for chest tightness, severe dizziness, or allergy signs. Professional medical advice is required before use.",
    products: [
      { brandName: "RIZact", companyName: "Cipla", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Rizaset", companyName: "Jagsam Pharma", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Rzt", companyName: "ANT Pharmaceuticals", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Flunarizine",
    category: "Calcium Channel Blocker (Migraine Prevention)",
    conditions: ["Headache & Migraine"],
    use: "May be used for migraine prevention as prescribed",
    shortDescription: "Prescription medicine for reducing migraine frequency.",
    detailedDescription:
      "Flunarizine is a calcium channel blocker that may be used for the prevention of migraine attacks, reducing how often they occur, when recommended by a doctor. It is not for relieving an ongoing headache and is not a general over-the-counter headache medicine.",
    commonUses: ["Migraine prevention", "Reducing migraine frequency"],
    precautions:
      "Prescription only with regular medical review. May cause drowsiness, weight changes, or mood changes — report these to your doctor. People with depression or Parkinson-like symptoms need medical evaluation first.",
    warnings:
      "Do not stop long-term preventive treatment suddenly without medical guidance. Professional medical advice is required before use.",
    products: [
      { brandName: "Sibelium", companyName: "Janssen/Johnson & Johnson", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Flunarin", companyName: "Cipla", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Diclofenac",
    category: "NSAID (Oral & Topical)",
    conditions: ["Muscle & Joint Pain", "Toothache", "General Pain"],
    use: "Commonly used for muscle, joint, and dental pain",
    shortDescription: "NSAID for joint, muscle, and dental pain.",
    detailedDescription:
      "Diclofenac is an NSAID that may be used for joint pain, back pain, sprains, and dental pain. Topical gel forms are commonly used for localized muscle and joint pain with lower whole-body exposure.",
    commonUses: ["Joint and back pain", "Sprains and strains", "Dental pain", "Localized muscle pain (gel)"],
    precautions:
      "Oral use needs medical guidance for longer periods. Gel is for external use only on unbroken skin. People with ulcers, kidney, or heart conditions should consult a doctor first.",
    warnings:
      "Stop use and seek care for stomach symptoms, skin reactions, or allergy signs. Consult a healthcare professional before use.",
    products: [
      { brandName: "Voveran", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Dynapar", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Diclogesic", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Dicloran", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Voltaren", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Diclomol", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Cetirizine",
    category: "Antihistamine",
    conditions: ["Allergy"],
    use: "Commonly used for allergy symptoms",
    shortDescription: "Relief for sneezing, itching, and rashes.",
    detailedDescription:
      "Cetirizine is an antihistamine that may be used for allergy symptoms such as sneezing, runny nose, itchy or watery eyes, and skin rashes or hives caused by seasonal or year-round allergies.",
    commonUses: ["Hay fever", "Itchy eyes", "Hives and skin itching", "Runny nose from allergies"],
    precautions:
      "May cause drowsiness in some people — avoid driving if affected. Avoid alcohol while using it. Consult a doctor for children, pregnancy, or kidney problems.",
    warnings:
      "Swelling of the lips, tongue, or throat with breathing difficulty is an emergency. Consult a healthcare professional before use.",
    products: [
      { brandName: "Cetzine", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Cetcip", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Alerid", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Loratadine",
    category: "Antihistamine",
    conditions: ["Allergy"],
    use: "Commonly used for allergy symptoms with less drowsiness",
    shortDescription: "Allergy relief, generally less sedating.",
    detailedDescription:
      "Loratadine is an antihistamine that may be used for sneezing, runny nose, itchy eyes, and skin allergy symptoms. It is generally less likely to cause drowsiness than some older antihistamines.",
    commonUses: ["Seasonal allergies", "Itchy eyes", "Skin allergy symptoms"],
    precautions:
      "Follow pack guidance on daily use. People with liver problems, and women who are pregnant or breastfeeding, should consult a doctor first.",
    warnings:
      "Severe allergy signs such as throat swelling or breathing difficulty need emergency care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Lorfast", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Loridin", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Levocetirizine",
    category: "Antihistamine",
    conditions: ["Allergy"],
    use: "Commonly used for allergy symptoms",
    shortDescription: "Allergy relief for sneezing, itching, and hives.",
    detailedDescription:
      "Levocetirizine is an antihistamine that may be used for sneezing, runny nose, itchy eyes, and hives caused by allergies. It may cause drowsiness in some people.",
    commonUses: ["Seasonal allergies", "Itchy eyes", "Hives and skin itching"],
    precautions:
      "May cause drowsiness in some people — avoid driving if affected. Avoid alcohol while using it. People with kidney problems should consult a doctor first.",
    warnings:
      "Swelling of the lips, tongue, or throat with breathing difficulty is an emergency. Consult a healthcare professional before use.",
    products: [
      { brandName: "Levocet", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Levocip", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Levocetriz", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Fexofenadine",
    category: "Antihistamine",
    conditions: ["Allergy"],
    use: "Commonly used for hay fever and hives",
    shortDescription: "Allergy and hives relief.",
    detailedDescription:
      "Fexofenadine is an antihistamine that may be used for hay fever symptoms and chronic hives (urticaria), generally with a low likelihood of drowsiness at usual amounts.",
    commonUses: ["Hay fever", "Chronic hives"],
    precautions:
      "Fruit juices may reduce its effect — check pack guidance. People with kidney problems or heart rhythm conditions should consult a doctor first.",
    warnings:
      "Emergency signs such as breathing difficulty need immediate care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Allegra", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Fexova", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Fexy", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Chlorpheniramine",
    category: "Antihistamine",
    conditions: ["Cold & Flu"],
    use: "Commonly used for cold, allergy, and cough symptoms",
    shortDescription: "Classic relief for colds and allergies.",
    detailedDescription:
      "Chlorpheniramine is an older antihistamine that may be used for sneezing, runny nose, watery eyes, and cough associated with colds and allergies. It commonly causes drowsiness.",
    commonUses: ["Cold symptoms", "Allergy symptoms", "Night-time cough relief"],
    precautions:
      "Likely to cause drowsiness — avoid driving and alcohol. People with glaucoma, prostate problems, or breathing conditions should consult a doctor first.",
    warnings:
      "Overdose needs emergency care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Avil", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Piriton", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Chlor-Trimeton", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Dextromethorphan",
    category: "Cough Suppressant",
    conditions: ["Cough"],
    use: "Commonly used for dry, irritating cough",
    shortDescription: "Calms dry cough.",
    detailedDescription:
      "Dextromethorphan acts on the cough center in the brain and may be used for dry, non-productive coughs associated with colds, helping rest and recovery. It is not suitable for coughs producing a lot of mucus.",
    commonUses: ["Dry cough", "Cold-related cough"],
    precautions:
      "Not for productive (mucus) coughs or asthma-related cough without advice. Avoid combining with certain antidepressants. Consult a doctor for children or persistent cough.",
    warnings:
      "Cough with blood, wheezing, or breathing difficulty needs medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Benadryl DR", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Corex DX", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ascoril D", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Guaifenesin",
    category: "Expectorant",
    conditions: ["Cough"],
    use: "Commonly used for chesty, mucus-producing cough",
    shortDescription: "Loosens mucus in chesty coughs.",
    detailedDescription:
      "Guaifenesin is an expectorant that loosens mucus in the airways, making chesty coughs more productive and easier to clear during colds and respiratory infections.",
    commonUses: ["Chesty cough", "Mucus congestion with colds"],
    precautions:
      "Drink plenty of fluids while using it. Not for persistent cough from smoking or long-term lung conditions without medical advice.",
    warnings:
      "Cough lasting weeks, or with fever and breathing difficulty, needs medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Glycodin", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ascoril LS", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Mucinex", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Ambroxol",
    category: "Mucolytic",
    conditions: ["Cough"],
    use: "Commonly used to thin mucus in respiratory congestion",
    shortDescription: "Thins mucus to ease clearance.",
    detailedDescription:
      "Ambroxol thins thick mucus in the airways and may be used for productive coughs with congestion during colds and respiratory tract infections.",
    commonUses: ["Productive cough", "Chest congestion"],
    precautions:
      "Stop and consult a doctor if skin rash appears. People with stomach ulcers should seek advice before use.",
    warnings:
      "Breathing difficulty or coughing blood needs prompt care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Mucosolvan", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ambrodil", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Mucolite", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Bromhexine",
    category: "Mucolytic",
    conditions: ["Cough"],
    use: "Commonly used to loosen mucus in chesty cough",
    shortDescription: "Loosens mucus to ease chest congestion.",
    detailedDescription:
      "Bromhexine thins mucus in the airways and may be used for productive coughs with congestion during colds and respiratory tract infections.",
    commonUses: ["Productive cough", "Chest congestion"],
    precautions:
      "Stop and consult a doctor if skin rash appears. People with stomach ulcers should seek advice before use. Consult a doctor for children or persistent cough.",
    warnings:
      "Breathing difficulty or coughing blood needs prompt care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Bisolvon", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Bro-Zedex", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Bromhex", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Phenylephrine",
    category: "Decongestant",
    conditions: ["Cold & Flu"],
    use: "Commonly used for nasal congestion",
    shortDescription: "Clears blocked nose from colds.",
    detailedDescription:
      "Phenylephrine narrows blood vessels in nasal passages and may be used for temporary relief of a blocked nose due to colds and allergies.",
    commonUses: ["Blocked nose", "Cold-related congestion"],
    precautions:
      "Short-term use only as directed. People with high blood pressure, heart disease, thyroid problems, or glaucoma should consult a doctor first.",
    warnings:
      "Prolonged use may worsen congestion. Consult a healthcare professional before use.",
    products: [
      { brandName: "Sinarest", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "D-Cold Total", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Nasivion", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Oxymetazoline",
    category: "Decongestant (Topical)",
    conditions: ["Cold & Flu"],
    use: "Commonly used for nasal congestion relief",
    shortDescription: "Topical relief for blocked nose.",
    detailedDescription:
      "Oxymetazoline is a topical decongestant that narrows blood vessels in nasal passages and may be used for temporary relief of a blocked nose due to colds.",
    commonUses: ["Blocked nose", "Cold-related congestion"],
    precautions:
      "Short-term use only as directed. People with high blood pressure, heart disease, thyroid problems, or glaucoma should consult a doctor first.",
    warnings:
      "Prolonged use may worsen congestion. Consult a healthcare professional before use.",
    products: [
      { brandName: "Nasivion", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Otrivin", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Nasomist", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Omeprazole",
    category: "Proton Pump Inhibitor",
    conditions: ["Acidity & Heartburn"],
    use: "Commonly used for acidity and acid reflux",
    shortDescription: "Reduces stomach acid production.",
    detailedDescription:
      "Omeprazole reduces the amount of acid produced in the stomach and may be used for acidity, heartburn, acid reflux, and stomach ulcers, usually taken before meals.",
    commonUses: ["Acid reflux", "Heartburn", "Stomach ulcers"],
    precautions:
      "Not for immediate relief of occasional heartburn. Long-term use needs medical supervision. Inform your doctor about persistent stomach pain, weight loss, or difficulty swallowing.",
    warnings:
      "Black stools, vomiting blood, or persistent vomiting need prompt medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Omez", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ocid", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Omecip", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Pantoprazole",
    category: "Proton Pump Inhibitor",
    conditions: ["Acidity & Heartburn"],
    use: "Commonly used for acidity, reflux, and ulcers",
    shortDescription: "Lowers stomach acid for reflux and ulcers.",
    detailedDescription:
      "Pantoprazole lowers stomach acid production and may be used for acid reflux, heartburn, and stomach or intestinal ulcers, usually as part of a doctor-guided treatment plan.",
    commonUses: ["Acid reflux", "Heartburn", "Stomach ulcers"],
    precautions:
      "Usually taken before meals as directed. Long-term use needs medical supervision with appropriate vitamin and mineral monitoring.",
    warnings:
      "Warning signs such as difficulty swallowing or ongoing vomiting need medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Pantocid", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Pantop", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Rabeprazole",
    category: "Proton Pump Inhibitor",
    conditions: ["Acidity & Heartburn"],
    use: "Commonly used for acidity, reflux, and ulcers",
    shortDescription: "Lowers stomach acid for reflux and ulcers.",
    detailedDescription:
      "Rabeprazole lowers stomach acid production and may be used for acid reflux, heartburn, and stomach or intestinal ulcers, usually as part of a doctor-guided treatment plan.",
    commonUses: ["Acid reflux", "Heartburn", "Stomach ulcers"],
    precautions:
      "Usually taken before meals as directed. Long-term use needs medical supervision with appropriate vitamin and mineral monitoring.",
    warnings:
      "Warning signs such as difficulty swallowing or ongoing vomiting need medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Razo", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Rablet", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Rabicip", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Famotidine",
    category: "H2 Blocker",
    conditions: ["Acidity & Heartburn"],
    use: "Commonly used for acidity, heartburn, and ulcers",
    shortDescription: "Reduces stomach acid via histamine blocking.",
    detailedDescription:
      "Famotidine is an H2 blocker that reduces stomach acid production and may be used for heartburn, acidity, and stomach or intestinal ulcers, as advised by a professional.",
    commonUses: ["Heartburn", "Acidity", "Stomach ulcers"],
    precautions:
      "Use as directed. People with kidney problems should consult a doctor first. Long-term or frequent use needs medical supervision.",
    warnings:
      "Black stools, vomiting blood, or persistent vomiting need prompt medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Famocid", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Famocip", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Famocare", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Antacid (Aluminium + Magnesium Hydroxide)",
    category: "Antacid",
    conditions: [],
    use: "Commonly used for quick relief of acidity and heartburn",
    shortDescription: "Fast, short-term acidity relief.",
    detailedDescription:
      "Aluminium hydroxide with magnesium hydroxide neutralizes excess stomach acid and may be used for quick, short-term relief of acidity, heartburn, and indigestion after meals.",
    commonUses: ["Heartburn", "Acidity after meals", "Indigestion"],
    precautions:
      "For short-term symptom relief, not for frequent daily use without advice. May affect absorption of other medicines — separate them as directed. People with kidney problems should consult a doctor first.",
    warnings:
      "Frequent need for antacids may signal an underlying condition needing evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Ondansetron",
    category: "Antiemetic",
    conditions: ["Nausea & Vomiting"],
    use: "Commonly used to control nausea and vomiting",
    shortDescription: "Controls nausea and vomiting.",
    detailedDescription:
      "Ondansetron blocks serotonin signals that trigger nausea and vomiting. It may be used for vomiting from stomach infections, motion sickness care plans, or treatment-related nausea as advised by a professional.",
    commonUses: ["Vomiting from stomach infections", "Motion-related nausea care", "Treatment-related nausea"],
    precautions:
      "Use as directed by a professional. Inform your doctor about heart rhythm problems or liver disease. Not a substitute for fluid replacement in dehydration.",
    warnings:
      "Blood in vomit, severe abdominal pain, or signs of dehydration need prompt care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Ondem", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Emeset", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ondero", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Ondanset", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Domperidone",
    category: "Antiemetic / Prokinetic",
    conditions: ["Nausea & Vomiting"],
    use: "Commonly used for nausea and slow digestion discomfort",
    shortDescription: "Eases nausea and digestive sluggishness.",
    detailedDescription:
      "Domperidone helps food move through the stomach and may be used for nausea, vomiting, bloating, and upper digestive discomfort as advised by a professional.",
    commonUses: ["Nausea and vomiting", "Bloating", "Indigestion discomfort"],
    precautions:
      "Use at the lowest effective amount for the shortest needed time, as directed. People with heart rhythm conditions or stomach blockage must consult a doctor first.",
    warnings:
      "Irregular heartbeat, fainting, or severe abdominal pain need immediate care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Domstal", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Vomistop", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Domperon", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Domsafe", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Metoclopramide",
    category: "Antiemetic / Prokinetic",
    conditions: ["Nausea & Vomiting"],
    use: "May be used for nausea, vomiting, and digestive sluggishness as prescribed",
    shortDescription: "Prescription medicine for nausea and stomach motility.",
    detailedDescription:
      "Metoclopramide helps stomach emptying and blocks nausea signals. It may be used for nausea, vomiting, and gastroparesis-type symptoms only when a healthcare professional considers it appropriate. It is not a general over-the-counter remedy.",
    commonUses: ["Nausea and vomiting", "Slow stomach emptying", "Treatment-related nausea"],
    precautions:
      "Prescription only. Use for the shortest needed duration as directed. People with Parkinson-like symptoms, depression, or bowel blockage need medical evaluation first.",
    warnings:
      "Muscle stiffness, tremors, or unusual movements need immediate medical care. Professional medical advice is required before use.",
    products: [
      { brandName: "Perinorm", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Reglan", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Metoclop", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Prochlorperazine",
    category: "Antipsychotic / Antiemetic",
    conditions: ["Nausea & Vomiting"],
    use: "May be used for severe nausea and vertigo as prescribed",
    shortDescription: "Prescription medicine for severe nausea and vertigo.",
    detailedDescription:
      "Prochlorperazine is primarily an antipsychotic medicine that, in specific doses, may be used for severe nausea, vomiting, and vertigo only when a healthcare professional considers it appropriate. It is not a general nausea remedy.",
    commonUses: ["Severe nausea and vomiting", "Vertigo"],
    precautions:
      "Prescription only. May cause significant drowsiness — avoid driving. Elderly people and children need careful medical supervision.",
    warnings:
      "Muscle stiffness, fever with rigidity, or unusual movements need immediate medical care. Professional medical advice is required before use.",
    products: [
      { brandName: "Stemetil", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Vertigon", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Prochlor", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Oral Rehydration Salts (ORS)",
    category: "Rehydration Support",
    conditions: ["Diarrhea & Constipation"],
    use: "Commonly used to replace fluids lost in diarrhea or vomiting",
    shortDescription: "Replaces fluids and salts safely.",
    detailedDescription:
      "ORS is a balanced mixture of salts and glucose that helps the body absorb water during diarrhea, vomiting, or fever-related fluid loss. It prevents and treats dehydration but does not stop the underlying illness.",
    commonUses: ["Diarrhea-related fluid loss", "Vomiting-related fluid loss", "Fever with dehydration risk"],
    precautions:
      "Prepare with clean drinking water exactly as directed. Continue usual feeding and fluids. Babies, elderly people, and those with kidney or heart conditions need medical guidance.",
    warnings:
      "Bloody stools, no urination, extreme thirst, confusion, or sunken eyes in children need urgent care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Loperamide",
    category: "Antidiarrheal",
    conditions: ["Diarrhea & Constipation"],
    use: "Commonly used for short-term diarrhea control",
    shortDescription: "Slows frequent loose motions.",
    detailedDescription:
      "Loperamide slows bowel movement and may be used for short-term control of sudden diarrhea, for example during travel, alongside fluid replacement.",
    commonUses: ["Sudden short-term diarrhea", "Travel-related loose motions"],
    precautions:
      "Not for diarrhea with high fever or blood in stools without medical advice. Do not exceed directed use. Consult a doctor for children or prolonged symptoms.",
    warnings:
      "Severe abdominal swelling, bloody stools, or no improvement needs medical evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Eldoper", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Imodium", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Lopamide", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Lactulose",
    category: "Laxative (Osmotic)",
    conditions: ["Diarrhea & Constipation"],
    use: "Commonly used for constipation relief",
    shortDescription: "Gentle relief for constipation.",
    detailedDescription:
      "Lactulose draws water into the bowel to soften stools and may be used for constipation relief, including in elderly people and during pregnancy when advised by a professional. It usually takes a day or two to work.",
    commonUses: ["Constipation", "Hard stools"],
    precautions:
      "Drink enough fluids. People with diabetes should consult a doctor first due to sugar content. Do not use for sudden severe abdominal pain without advice.",
    warnings:
      "Long-standing constipation, bleeding, or unexplained weight loss needs evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Duphalac", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Looz", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Lactuhep", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Livoluk", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Racecadotril",
    category: "Antidiarrheal (Antisecretory)",
    conditions: ["Diarrhea & Constipation"],
    use: "May be used for acute diarrhea as advised by a professional",
    shortDescription: "Reduces excess intestinal fluid loss in diarrhea.",
    detailedDescription:
      "Racecadotril reduces excess secretion of water into the bowel and may be used for acute diarrhea alongside fluid replacement, as advised by a healthcare professional. It does not treat the underlying infection.",
    commonUses: ["Acute diarrhea with fluid replacement"],
    precautions:
      "Always combine with fluid replacement. Not for bloody stools or high fever without medical advice. Consult a doctor for children, elderly people, or prolonged symptoms.",
    warnings:
      "Bloody stools, high fever, or signs of dehydration need prompt care. Consult a healthcare professional before use.",
    products: [
      { brandName: "Redotril", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Racedot", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Zedott", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Bisacodyl",
    category: "Laxative (Stimulant)",
    conditions: ["Diarrhea & Constipation"],
    use: "Commonly used for short-term constipation relief",
    shortDescription: "Stimulant relief for constipation.",
    detailedDescription:
      "Bisacodyl stimulates bowel movement and may be used for short-term relief of constipation, including bowel preparation before medical procedures as directed.",
    commonUses: ["Short-term constipation", "Bowel preparation as directed"],
    precautions:
      "Short-term use only without medical advice. Do not use for sudden severe abdominal pain, nausea with constipation, or bowel blockage symptoms.",
    warnings:
      "Long-standing constipation, bleeding, or unexplained weight loss needs evaluation. Consult a healthcare professional before use.",
    products: [
      { brandName: "Dulcolax", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
      { brandName: "Laxoclear", companyName: "Not specified", strength: "Not specified", dosageForm: "Not specified" },
    ],
  },
  {
    activeIngredient: "Clove Oil",
    category: "Dental Analgesic (Topical)",
    conditions: [],
    use: "Commonly used for temporary toothache soothing",
    shortDescription: "Temporary soothing for tooth pain.",
    detailedDescription:
      "Clove oil contains eugenol, which has mild numbing properties, and may be used for temporary soothing of toothache until dental treatment is received. It does not treat cavities or infection.",
    commonUses: ["Temporary toothache relief", "Gum discomfort before dental care"],
    precautions:
      "Use only a small amount on the affected area; avoid swallowing. Keep away from children. Dental treatment is still needed for the underlying cause.",
    warnings:
      "Facial swelling, fever with tooth pain, or difficulty opening the mouth needs prompt dental care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Hydrocortisone",
    category: "Topical Corticosteroid",
    conditions: [],
    use: "Commonly used for itchy, inflamed skin",
    shortDescription: "Calms itching and skin inflammation.",
    detailedDescription:
      "Low-strength hydrocortisone cream may be used for itching, redness, and mild inflammation from eczema flare-ups, insect bites, or contact rashes, for short periods.",
    commonUses: ["Itchy rashes", "Eczema flare-ups", "Insect bite reactions"],
    precautions:
      "For external use only; avoid eyes, face (unless advised), and broken skin. Short-term use only without medical advice. Not for fungal infections unless directed.",
    warnings:
      "Spreading redness, pus, or no improvement needs medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Clotrimazole",
    category: "Antifungal (Topical)",
    conditions: ["Skin Problems"],
    use: "Commonly used for fungal skin infections",
    shortDescription: "Treats athlete's foot, ringworm, and yeast rashes.",
    detailedDescription:
      "Clotrimazole is an antifungal that may be used for athlete's foot, ringworm, jock itch, and yeast-related skin rashes. Treatment usually continues for some time after symptoms improve, as directed.",
    commonUses: ["Athlete's foot", "Ringworm", "Yeast skin rashes"],
    precautions:
      "For external use only. Keep the area clean and dry. Complete the suggested duration even if the rash fades early.",
    warnings:
      "Widespread infection, diabetes with foot sores, or no improvement needs medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Artificial Tears",
    category: "Lubricant Eye Drops",
    conditions: [],
    use: "Commonly used for dry, irritated eyes",
    shortDescription: "Moisture relief for dry eyes.",
    detailedDescription:
      "Artificial tears lubricate the eyes and may be used for dryness, grittiness, or mild irritation from screens, air conditioning, dust, or contact lens wear.",
    commonUses: ["Dry eyes", "Screen-related eye strain", "Mild eye irritation"],
    precautions:
      "Do not touch the dropper tip to the eye. Remove contact lenses unless the product is lens-compatible. Discard single-use vials as directed.",
    warnings:
      "Eye pain, vision changes, discharge, or injury need prompt eye care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Olopatadine",
    category: "Antihistamine Eye Drops",
    conditions: ["Eye-related Common Problems"],
    use: "Commonly used for itchy eyes from allergies",
    shortDescription: "Relief for allergic eye itching.",
    detailedDescription:
      "Olopatadine eye drops may be used for itching, redness, and watering of the eyes caused by allergic conjunctivitis such as hay fever–related eye symptoms.",
    commonUses: ["Allergic eye itching", "Red watery eyes from allergies"],
    precautions:
      "Do not wear contact lenses during red-eye episodes unless advised. Do not share eye drops. Remove lenses before use unless the product allows them.",
    warnings:
      "Eye pain, light sensitivity, or vision changes need prompt eye care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Vitamin C",
    category: "Vitamin Supplement",
    conditions: ["Cold & Flu"],
    use: "Commonly used to support general immunity and recovery",
    shortDescription: "Supports everyday immune health.",
    detailedDescription:
      "Vitamin C supports immune function, skin health, and iron absorption. It may be used to support general health during colds, alongside rest and fluids, though it does not cure infections.",
    commonUses: ["General immune support", "Recovery support during colds", "Dietary shortfalls"],
    precautions:
      "High amounts may cause stomach upset or diarrhea. People with kidney stones or iron overload conditions should consult a doctor first.",
    warnings:
      "Supplements do not replace medical treatment for infections. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Vitamin D3",
    category: "Vitamin Supplement",
    conditions: ["Vitamins & Minerals"],
    use: "Commonly used for bone health and deficiency support",
    shortDescription: "Supports bones and everyday wellness.",
    detailedDescription:
      "Vitamin D3 supports calcium absorption, bone strength, and general wellness. It may be suggested for deficiency, limited sun exposure, or bone and muscle health as part of professional guidance.",
    commonUses: ["Vitamin D deficiency", "Bone health", "General wellness in low-sunlight routines"],
    precautions:
      "Excessive intake can be harmful — use as directed. A blood test may be needed to confirm deficiency. Inform your doctor about kidney problems.",
    warnings:
      "Persistent bone pain, fractures, or muscle weakness need medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Iron + Folic Acid",
    category: "Mineral & Vitamin Supplement",
    conditions: ["Vitamins & Minerals"],
    use: "Commonly used for iron deficiency and pregnancy support",
    shortDescription: "Supports healthy blood and pregnancy care.",
    detailedDescription:
      "Iron with folic acid may be used for iron-deficiency anemia and is commonly recommended during pregnancy to support maternal and fetal health, as advised by a professional.",
    commonUses: ["Iron deficiency", "Pregnancy nutritional support", "Anemia care plans"],
    precautions:
      "Take as directed; iron can cause dark stools or constipation. Keep away from children — iron overdose is dangerous. Inform your doctor about other medicines.",
    warnings:
      "Fatigue with paleness, breathlessness, or dizziness needs medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Aceclofenac",
    category: "NSAID Pain Reliever",
    conditions: ["Muscle & Joint Pain"],
    use: "Commonly used for joint, back, and muscle pain",
    shortDescription: "NSAID for joint and muscle pain.",
    detailedDescription:
      "Aceclofenac is a non-steroidal anti-inflammatory drug that may be used for joint pain, back pain, and muscle pain, as advised by a professional.",
    commonUses: ["Joint pain", "Back pain", "Muscle pain"],
    precautions:
      "Take with food or milk. Avoid combining with other NSAIDs. People with stomach, kidney, heart, or blood pressure problems should consult a doctor first.",
    warnings:
      "Seek care for signs of stomach bleeding or allergy. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Miconazole",
    category: "Antifungal (Topical)",
    conditions: ["Skin Problems"],
    use: "Commonly used for fungal skin infections",
    shortDescription: "Treats fungal skin infections.",
    detailedDescription:
      "Miconazole is an antifungal that may be used for athlete's foot, ringworm, jock itch, and yeast-related skin rashes, as directed.",
    commonUses: ["Athlete's foot", "Ringworm", "Yeast skin rashes"],
    precautions:
      "For external use only. Keep the area clean and dry. Complete the suggested duration even if the rash fades early.",
    warnings:
      "Widespread infection, diabetes with foot sores, or no improvement needs medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Benzoyl Peroxide",
    category: "Anti-acne (Topical)",
    conditions: ["Skin Problems"],
    use: "Commonly used for acne",
    shortDescription: "Treats mild to moderate acne.",
    detailedDescription:
      "Benzoyl Peroxide helps reduce acne-causing bacteria and unclog pores. It may be used for mild to moderate acne as directed.",
    commonUses: ["Mild acne", "Moderate acne"],
    precautions:
      "For external use only; avoid eyes and mouth. May bleach hair and fabrics. Start with lower strengths to check skin tolerance.",
    warnings:
      "Severe irritation, swelling, or allergy signs need medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Adapalene",
    category: "Retinoid (Topical)",
    conditions: ["Skin Problems"],
    use: "Commonly used for acne",
    shortDescription: "Topical retinoid for acne.",
    detailedDescription:
      "Adapalene is a topical retinoid that may be used for acne by helping skin cell turnover, as advised by a professional.",
    commonUses: ["Acne"],
    precautions:
      "For external use only at night unless directed otherwise. Avoid sun exposure without protection. Not for use during pregnancy unless directed.",
    warnings:
      "Severe irritation or allergy signs need medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Carboxymethylcellulose",
    category: "Lubricant Eye Drops",
    conditions: ["Eye-related Common Problems"],
    use: "Commonly used for dry, irritated eyes",
    shortDescription: "Moisture relief for dry eyes.",
    detailedDescription:
      "Carboxymethylcellulose eye drops lubricate the eyes and may be used for dryness, grittiness, or mild irritation from screens, air conditioning, or dust.",
    commonUses: ["Dry eyes", "Screen-related eye strain", "Mild eye irritation"],
    precautions:
      "Do not touch the dropper tip to the eye. Remove contact lenses unless the product is lens-compatible.",
    warnings:
      "Eye pain, vision changes, discharge, or injury need prompt eye care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Hypromellose",
    category: "Lubricant Eye Drops",
    conditions: ["Eye-related Common Problems"],
    use: "Commonly used for dry, irritated eyes",
    shortDescription: "Moisture relief for dry eyes.",
    detailedDescription:
      "Hypromellose eye drops lubricate the eyes and may be used for dryness and mild irritation, including discomfort from screens or dry environments.",
    commonUses: ["Dry eyes", "Mild eye irritation"],
    precautions:
      "Do not touch the dropper tip to the eye. Remove contact lenses unless the product is lens-compatible.",
    warnings:
      "Eye pain, vision changes, discharge, or injury need prompt eye care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Ketotifen",
    category: "Antihistamine Eye Drops",
    conditions: ["Eye-related Common Problems"],
    use: "Commonly used for itchy eyes from allergies",
    shortDescription: "Relief for allergic eye itching.",
    detailedDescription:
      "Ketotifen eye drops may be used for itching and redness of the eyes caused by allergic conjunctivitis, as advised by a professional.",
    commonUses: ["Allergic eye itching", "Red eyes from allergies"],
    precautions:
      "Do not wear contact lenses during red-eye episodes unless advised. Do not share eye drops.",
    warnings:
      "Eye pain, light sensitivity, or vision changes need prompt eye care. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Amoxicillin",
    category: "Antibiotic (Penicillin)",
    conditions: ["Common Infection Information"],
    use: "May be used for bacterial infections when prescribed",
    shortDescription: "Prescription antibiotic for bacterial infections.",
    detailedDescription:
      "Amoxicillin is a penicillin-type antibiotic that may be used against a range of bacterial infections such as ear, nose, throat, urinary tract, and skin infections. It does not work against viral illnesses like the common cold or flu. Educational entry only — not a self-medication recommendation.",
    commonUses: ["Bacterial ear infections", "Throat infections", "Urinary tract infections", "Skin infections"],
    precautions:
      "Use only when prescribed. Complete the full course even if you feel better. Inform your doctor about any penicillin allergy. Never share antibiotics with others.",
    warnings:
      "Seek immediate care for rash, swelling, or breathing difficulty (allergy signs). Professional medical advice is required before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Azithromycin",
    category: "Antibiotic (Macrolide)",
    conditions: ["Common Infection Information"],
    use: "May be used for certain bacterial infections when prescribed",
    shortDescription: "Prescription antibiotic for specific bacterial infections.",
    detailedDescription:
      "Azithromycin is a macrolide antibiotic that may be used for certain respiratory, skin, and ear bacterial infections when a doctor considers it appropriate. Educational entry only — not a self-medication recommendation.",
    commonUses: ["Bacterial respiratory infections", "Skin infections", "Ear infections"],
    precautions:
      "Use only when prescribed and complete the full course. Inform your doctor about heart rhythm problems, liver issues, or other medicines you take.",
    warnings:
      "Seek care for allergy signs, irregular heartbeat, or severe diarrhea. Professional medical advice is required before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Doxycycline",
    category: "Antibiotic (Tetracycline)",
    conditions: ["Common Infection Information"],
    use: "May be used for certain bacterial infections when prescribed",
    shortDescription: "Prescription antibiotic for specific bacterial infections.",
    detailedDescription:
      "Doxycycline is a tetracycline antibiotic that may be used for certain respiratory, skin, and other bacterial infections when a doctor considers it appropriate. Educational entry only — not a self-medication recommendation.",
    commonUses: ["Bacterial respiratory infections", "Skin infections", "Doctor-directed infection care"],
    precautions:
      "Use only when prescribed and complete the full course. Avoid sun exposure without protection. Not for use during pregnancy or in young children unless directed.",
    warnings:
      "Seek care for allergy signs or severe diarrhea. Professional medical advice is required before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Cefixime",
    category: "Antibiotic (Cephalosporin)",
    conditions: ["Common Infection Information"],
    use: "May be used for certain bacterial infections when prescribed",
    shortDescription: "Prescription antibiotic for specific bacterial infections.",
    detailedDescription:
      "Cefixime is a cephalosporin antibiotic that may be used for certain ear, throat, and urinary tract bacterial infections when a doctor considers it appropriate. Educational entry only — not a self-medication recommendation.",
    commonUses: ["Bacterial ear infections", "Throat infections", "Urinary tract infections"],
    precautions:
      "Use only when prescribed and complete the full course. Inform your doctor about penicillin or cephalosporin allergy.",
    warnings:
      "Seek care for allergy signs or severe diarrhea. Professional medical advice is required before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Vitamin B12 (Methylcobalamin)",
    category: "Vitamin Supplement",
    conditions: ["Vitamins & Minerals"],
    use: "Commonly used for vitamin B12 deficiency support",
    shortDescription: "Supports nerves, blood, and energy metabolism.",
    detailedDescription:
      "Methylcobalamin is a form of vitamin B12 that supports nerve health, red blood cell formation, and energy metabolism. It may be suggested for deficiency as part of professional guidance.",
    commonUses: ["Vitamin B12 deficiency", "Nerve health support", "Anemia care plans"],
    precautions:
      "A blood test may be needed to confirm deficiency. Inform your doctor about other medicines and existing conditions.",
    warnings:
      "Numbness, persistent fatigue, or paleness needs medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
  {
    activeIngredient: "Calcium + Vitamin D3",
    category: "Mineral & Vitamin Supplement",
    conditions: ["Vitamins & Minerals"],
    use: "Commonly used for bone health support",
    shortDescription: "Supports bones with calcium and vitamin D3.",
    detailedDescription:
      "Calcium with vitamin D3 supports bone strength and everyday wellness, as vitamin D3 helps the body absorb calcium. It may be suggested for bone health as part of professional guidance.",
    commonUses: ["Bone health", "Calcium shortfalls", "General wellness"],
    precautions:
      "Excessive intake can be harmful — use as directed. Inform your doctor about kidney problems or kidney stones.",
    warnings:
      "Persistent bone pain or fractures need medical evaluation. Consult a healthcare professional before use.",
    // Real brands to be added when provided.
    products: [],
  },
];

// Flattened product documents — each product carries every field, so this
// exact shape can be stored in MongoDB / served by an API later.
export const PRODUCTS = INGREDIENTS.flatMap((ing) =>
  ing.products.map((p) => ({
    id: `${ing.activeIngredient} | ${p.brandName} | ${p.strength} | ${p.dosageForm}`,
    activeIngredient: ing.activeIngredient,
    brandName: p.brandName,
    companyName: p.companyName,
    strength: p.strength,
    dosageForm: p.dosageForm,
    category: ing.category,
    conditions: ing.conditions,
    use: ing.use,
    shortDescription: ing.shortDescription,
    detailedDescription: ing.detailedDescription,
    commonUses: ing.commonUses,
    precautions: ing.precautions,
    warnings: ing.warnings,
  }))
);
