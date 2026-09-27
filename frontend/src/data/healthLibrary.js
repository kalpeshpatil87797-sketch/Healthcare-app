// Frontend-only health education library (no backend, no database).
// General awareness information only — not diagnosis, not treatment
// instructions, and not a substitute for professional medical advice.
//
// Data model: every topic is self-contained (flat) so the same shape can
// later move to MongoDB/API unchanged. Each topic stores:
//   id, title, category, description, keywords[],
//   about, goodToKnow[], whenToSeek
//
// Content rules followed here: short general descriptions, no invented
// statistics, no dosage or prescription details.

export const LIBRARY_CATEGORIES = [
  { name: "Common Conditions", icon: "🩺" },
  { name: "Healthy Habits", icon: "🌿" },
  { name: "Prevention & Hygiene", icon: "🧼" },
  { name: "Nutrition", icon: "🥗" },
  { name: "Mental Well-being", icon: "🧠" },
  { name: "First Aid", icon: "⛑️" },
  { name: "When to See a Doctor", icon: "👩‍⚕️" },
  { name: "Exercise & Yoga", icon: "🧘" },
];

// Short educational note shown above each category section.
export const LIBRARY_CATEGORY_INFO = {
  "Common Conditions":
    "Everyday health problems most people experience at some point. Learn what they generally involve, simple comfort measures, and which warning signs mean a doctor should take a look.",
  "Healthy Habits":
    "Small daily routines that support overall health over time — rest, water, movement, and balance between study, work, and leisure.",
  "Prevention & Hygiene":
    "Simple preventive steps that reduce the chance of infections and food-related illness for you and the people around you.",
  Nutrition:
    "General guidance on eating patterns and drinks that support everyday energy and long-term health.",
  "Mental Well-being":
    "Everyday ways to understand stress, protect sleep, and look after your mood. Mental health deserves the same attention as physical health.",
  "First Aid":
    "Basic awareness for handling common minor injuries safely at home. These notes do not replace proper first-aid training or emergency care.",
  "When to See a Doctor":
    "General signals that a symptom should be evaluated by a healthcare professional rather than managed at home.",
  "Exercise & Yoga":
    "Simple beginner-friendly exercises and yoga stretches for general fitness and everyday well-being. Not a personalized workout plan — start gently and listen to your body.",
};

export const LIBRARY_TOPICS = [
  // ---------------- Common Conditions ----------------
  {
    id: "fever",
    title: "Fever",
    category: "Common Conditions",
    description:
      "Learn about common causes of fever, basic precautions, and when medical attention may be needed.",
    keywords: ["temperature", "infection", "flu", "thermometer"],
    about:
      "Fever is a rise in body temperature and is commonly a sign that the body is responding to an infection. Mild, short fevers often settle with rest and fluids.",
    goodToKnow: [
      "Rest and drinking enough fluids are the usual first steps during a mild fever.",
      "Temperature can be tracked with a thermometer to notice whether it is rising or settling.",
      "Light clothing and a comfortable room temperature help most people feel better.",
    ],
    whenToSeek:
      "See a doctor for a very high fever, a fever lasting more than a couple of days, or fever with warning signs such as difficulty breathing, confusion, stiff neck, rash, or persistent vomiting.",
  },
  {
    id: "common-cold",
    title: "Common Cold",
    category: "Common Conditions",
    description:
      "Understand what the common cold is, how it spreads, and simple ways to feel more comfortable.",
    keywords: ["cold", "runny nose", "sneezing", "viral", "flu"],
    about:
      "The common cold is a mild viral illness affecting the nose and throat. It usually involves a runny nose, sneezing, sore throat, or mild cough, and most people recover within a week or so.",
    goodToKnow: [
      "Colds spread through coughs, sneezes, and touching contaminated surfaces.",
      "Rest, warm fluids, and good hand hygiene support recovery.",
      "Covering coughs and sneezes helps protect others.",
    ],
    whenToSeek:
      "See a doctor if symptoms last much longer than expected, breathing becomes difficult, or there is a high persistent fever, chest pain, or wheezing.",
  },
  {
    id: "headache",
    title: "Headache",
    category: "Common Conditions",
    description:
      "Learn about common headache triggers, everyday relief habits, and signs that need medical review.",
    keywords: ["head pain", "migraine", "tension", "stress"],
    about:
      "Headaches are very common and can be linked to factors such as stress, lack of sleep, dehydration, long screen time, or skipped meals. Most occasional headaches settle with rest and routine care.",
    goodToKnow: [
      "Regular sleep, meals, and water intake help reduce headache frequency for many people.",
      "Short breaks from screens and a quiet, dim resting place can ease an ongoing headache.",
      "Noting when headaches happen may help a doctor understand the pattern.",
    ],
    whenToSeek:
      "See a doctor for sudden severe headaches, headaches after a head injury, or headaches with vision changes, confusion, weakness, fever with stiff neck, or a pattern that keeps getting worse.",
  },
  {
    id: "cough",
    title: "Cough",
    category: "Common Conditions",
    description:
      "Understand why coughs happen, simple comfort steps, and when a cough should be checked by a doctor.",
    keywords: ["dry cough", "throat", "cold", "breathing"],
    about:
      "A cough is the body's way of clearing the airways of mucus, dust, or irritants. Many coughs follow colds and settle as the illness passes.",
    goodToKnow: [
      "Warm fluids and avoiding smoke or strong dust can make a cough more bearable.",
      "Honey in warm water is a traditional home comfort for throat irritation in older children and adults.",
      "Keeping track of how long the cough lasts helps when talking to a doctor.",
    ],
    whenToSeek:
      "See a doctor for a cough lasting several weeks, cough with blood, wheezing, chest pain, or difficulty breathing.",
  },
  // ---------------- Healthy Habits ----------------
  {
    id: "sleep-rest",
    title: "Sleep & Rest",
    category: "Healthy Habits",
    description:
      "Learn why regular sleep matters and simple habits that support good rest every night.",
    keywords: ["sleep", "rest", "bedtime", "routine", "tired"],
    about:
      "Regular, sufficient sleep supports concentration, mood, immunity, and everyday energy. Both young people and adults benefit from a consistent sleep routine.",
    goodToKnow: [
      "Going to bed and waking up at similar times supports a steady sleep rhythm.",
      "Reducing screen time before bed helps many people fall asleep faster.",
      "A calm, dark, and comfortable bedroom supports better rest.",
    ],
    whenToSeek:
      "Talk to a doctor if poor sleep continues for weeks, loud snoring with breathing pauses occurs, or daytime tiredness regularly affects daily life.",
  },
  {
    id: "hydration-habit",
    title: "Hydration",
    category: "Healthy Habits",
    description:
      "Understand the role of water in daily life and easy ways to drink enough through the day.",
    keywords: ["water", "drinks", "fluids", "thirst"],
    about:
      "Water supports almost every body function, including temperature control, digestion, and concentration. Many people feel better simply by drinking water regularly through the day.",
    goodToKnow: [
      "Sipping water through the day works better than drinking a lot only once.",
      "Carrying a water bottle makes regular drinking easier at school or work.",
      "Pale-yellow urine is a rough everyday sign of adequate fluid intake.",
    ],
    whenToSeek:
      "See a doctor for signs of dehydration that do not improve with fluids, such as dizziness, very dark urine, confusion, or inability to keep fluids down.",
  },
  // ---------------- Prevention & Hygiene ----------------
  {
    id: "hand-hygiene",
    title: "Hand Hygiene",
    category: "Prevention & Hygiene",
    description:
      "Learn when and how to wash hands to reduce the spread of everyday infections.",
    keywords: ["handwash", "soap", "germs", "infection", "hygiene"],
    about:
      "Hands pick up germs from surfaces, food, and other people. Washing hands with soap at key moments is one of the simplest ways to prevent many infections.",
    goodToKnow: [
      "Wash hands before eating and after using the toilet, coughing, or sneezing.",
      "Soap and water for about 20 seconds covers most everyday situations.",
      "Alcohol-based sanitizer is a backup option when soap and water are unavailable.",
    ],
    whenToSeek:
      "Hand hygiene prevents illness but does not treat it — see a doctor if symptoms such as fever, vomiting, or diarrhea appear and persist.",
  },
  {
    id: "food-safety",
    title: "Food Safety",
    category: "Prevention & Hygiene",
    description:
      "Understand basic food safety habits that lower the risk of stomach illness at home.",
    keywords: ["food", "cooking", "storage", "stomach", "fresh"],
    about:
      "Many stomach upsets are linked to how food is stored, cooked, or handled. A few consistent kitchen habits greatly lower the risk for the whole family.",
    goodToKnow: [
      "Wash fruits, vegetables, and hands before preparing food.",
      "Cook food thoroughly and store leftovers in the refrigerator promptly.",
      "Avoid food with unusual smell, taste, or expired packaging.",
    ],
    whenToSeek:
      "See a doctor for food-related illness with high fever, blood in stools, signs of dehydration, or symptoms that do not settle within a couple of days.",
  },
  // ---------------- Nutrition ----------------
  {
    id: "balanced-diet",
    title: "Balanced Diet",
    category: "Nutrition",
    description:
      "Learn what a balanced everyday diet generally includes, in simple terms.",
    keywords: ["food", "diet", "vegetables", "fruits", "meals"],
    about:
      "A balanced diet generally includes a mix of grains, vegetables, fruits, protein foods, and dairy or alternatives, in suitable portions. Variety matters more than any single food.",
    goodToKnow: [
      "Including vegetables or fruit in most meals adds fiber and everyday nutrients.",
      "Regular meal times help maintain steady energy through the day.",
      "Whole grains and home-cooked meals are good everyday defaults.",
    ],
    whenToSeek:
      "Talk to a doctor or dietitian for ongoing digestive problems, unexplained weight changes, or specific dietary needs related to a health condition.",
  },
  {
    id: "healthy-hydration",
    title: "Healthy Hydration",
    category: "Nutrition",
    description:
      "Learn which everyday drinks support health and which are best kept occasional.",
    keywords: ["water", "juice", "soda", "sugary drinks", "milk"],
    about:
      "Water is the healthiest everyday drink. Milk, buttermilk, and fresh homemade options can also fit a balanced routine, while very sugary drinks are best kept occasional.",
    goodToKnow: [
      "Choosing water as the default drink is a simple healthy habit.",
      "Whole fruits generally offer more fiber than packaged fruit juices.",
      "Reading labels helps notice high sugar content in packaged drinks.",
    ],
    whenToSeek:
      "Talk to a doctor or dietitian if a health condition requires fluid or sugar restrictions, or for personalized nutrition guidance.",
  },
  // ---------------- Mental Well-being ----------------
  {
    id: "stress-management",
    title: "Stress Management",
    category: "Mental Well-being",
    description:
      "Understand common signs of stress and everyday strategies that help you cope.",
    keywords: ["stress", "anxiety", "relaxation", "mood", "pressure"],
    about:
      "Stress is a normal response to pressure from studies, work, or personal life. Short-term stress passes, but ongoing stress deserves attention and healthy coping habits.",
    goodToKnow: [
      "Regular physical activity, hobbies, and time outdoors help many people unwind.",
      "Breaking big tasks into smaller steps makes pressure feel more manageable.",
      "Talking with trusted family or friends can lighten emotional load.",
    ],
    whenToSeek:
      "Reach out to a counselor, doctor, or helpline if stress feels overwhelming, lasts for weeks, or affects sleep, appetite, studies, or relationships.",
  },
  {
    id: "healthy-sleep-mind",
    title: "Healthy Sleep",
    category: "Mental Well-being",
    description:
      "Explore the connection between sleep and mood, and habits that protect both.",
    keywords: ["sleep", "mood", "rest", "mental health", "bedtime"],
    about:
      "Sleep and mood influence each other: poor sleep can lower mood and concentration, while worry can make sleep harder. Protecting sleep is also protecting mental well-being.",
    goodToKnow: [
      "A regular wind-down routine signals the mind that rest time is near.",
      "Daylight activity and limited late caffeine support night-time sleep.",
      "Writing down worries earlier in the evening can reduce bedtime overthinking.",
    ],
    whenToSeek:
      "Talk to a doctor or counselor if sleep problems or low mood continue for weeks or interfere with everyday functioning.",
  },
  // ---------------- First Aid ----------------
  {
    id: "minor-cuts",
    title: "Minor Cuts",
    category: "First Aid",
    description:
      "Learn the basic steps for handling small everyday cuts safely at home.",
    keywords: ["cut", "wound", "bleeding", "bandage", "injury"],
    about:
      "Small cuts from kitchen work or play are common. Most minor cuts can be managed with cleaning, gentle pressure, and a clean covering.",
    goodToKnow: [
      "Wash hands first, then rinse the cut gently with clean water.",
      "Light pressure with a clean cloth usually slows minor bleeding.",
      "Keep the cut clean and covered, and change the covering if it gets dirty.",
    ],
    whenToSeek:
      "Seek medical care for deep or gaping cuts, bleeding that does not stop, dirt that cannot be cleaned out, or signs of infection such as spreading redness, swelling, warmth, or pus.",
  },
  {
    id: "minor-burns",
    title: "Minor Burns",
    category: "First Aid",
    description:
      "Understand the first response to small heat burns and what to avoid.",
    keywords: ["burn", "heat", "scald", "skin", "injury"],
    about:
      "Minor burns from hot vessels, steam, or brief contact with heat are common at home. Quick cooling and gentle care support healing of small burns.",
    goodToKnow: [
      "Cool the area under clean running water for several minutes.",
      "Avoid applying toothpaste, oils, or ice directly on burns.",
      "Loose, clean coverings protect the area while it heals.",
    ],
    whenToSeek:
      "Seek medical care for large burns, burns on the face, hands, feet, or joints, blistering over wide areas, or burns caused by chemicals or electricity.",
  },
  // ---------------- When to See a Doctor ----------------
  {
    id: "persistent-fever",
    title: "Persistent Fever",
    category: "When to See a Doctor",
    description:
      "Learn which fever patterns generally call for a medical evaluation.",
    keywords: ["fever", "temperature", "doctor", "warning signs"],
    about:
      "While many fevers settle in a day or two, some patterns suggest the body needs medical help. Knowing these patterns helps in deciding when to visit a doctor.",
    goodToKnow: [
      "Fever lasting more than a couple of days deserves medical review.",
      "Fever that keeps returning after settling should also be evaluated.",
      "Note accompanying symptoms — they help the doctor assess the cause.",
    ],
    whenToSeek:
      "See a doctor promptly for persistent fever, very high fever, or fever with breathing difficulty, severe headache with stiff neck, confusion, rash, or dehydration.",
  },
  {
    id: "difficulty-breathing",
    title: "Difficulty Breathing",
    category: "When to See a Doctor",
    description:
      "Understand why breathing difficulty always deserves prompt medical attention.",
    keywords: ["breathing", "breathlessness", "emergency", "chest", "asthma"],
    about:
      "Difficulty breathing can have many causes, from respiratory infections to allergic reactions. Because breathing is vital, new or worsening breathing difficulty should be treated as urgent.",
    goodToKnow: [
      "Stay calm, sit upright, and move to fresh air if possible.",
      "Note when it started and what may have triggered it.",
      "People with known asthma or allergies should follow their doctor's action plan.",
    ],
    whenToSeek:
      "Seek prompt medical care for any significant difficulty breathing, noisy or very fast breathing, bluish lips, chest pain, or wheezing that does not settle.",
  },
];

export const LIBRARY_DISCLAIMER =
  "The Health Library is for general education only. It is not a diagnosis, not a prescription, and not a substitute for professional medical advice. Always consult a qualified healthcare professional about symptoms or health concerns.";

// ---------------- Exercise & Yoga ----------------
// Beginner-friendly general fitness education only — not a personalized
// workout plan. Same flat self-contained shape as topics; each exercise
// stores: id, title, subsection, icon, description, benefit, difficulty,
// goals[], keywords[], about, steps[], safety.
//
// Content rules: simple language, no extreme routines, no bodybuilding
// focus, and no claims that yoga or exercise cures diseases.

export const EXERCISE_SUBSECTIONS = ["Basic Workouts", "Yoga & Stretching"];

export const EXERCISE_GOAL_FILTERS = [
  "General Fitness",
  "Strength",
  "Flexibility",
  "Mobility",
  "Relaxation",
];

export const EXERCISE_SAFETY_NOTICE =
  "Start gradually and use proper form. Stop if you feel pain, dizziness, or unusual discomfort. If you have a medical condition, injury, or concerns about exercise, consult a qualified healthcare professional before starting a new routine.";

export const LIBRARY_EXERCISES = [
  // ---------------- Basic Workouts ----------------
  {
    id: "walking",
    title: "Walking",
    subsection: "Basic Workouts",
    icon: "🚶",
    description:
      "A simple low-impact activity suitable for almost all beginners.",
    benefit: "General fitness and stamina",
    difficulty: "Beginner",
    goals: ["General Fitness", "Mobility"],
    keywords: ["walk", "cardio", "exercise", "workout", "fitness", "steps"],
    about:
      "Walking is one of the easiest ways to stay active. It needs no equipment, can be done almost anywhere, and is gentle on the joints.",
    steps: [
      "Wear comfortable footwear and choose a safe, even path.",
      "Start with a slow pace for the first few minutes to warm up.",
      "Walk at a steady, comfortable pace for 10–20 minutes.",
      "Finish slowly and drink some water afterwards.",
    ],
    safety:
      "Choose well-lit, even paths and stop if you feel chest discomfort, dizziness, or unusual breathlessness.",
  },
  {
    id: "jogging",
    title: "Jogging",
    subsection: "Basic Workouts",
    icon: "🏃",
    description:
      "A gentle running pace that builds stamina once walking feels easy.",
    benefit: "Stamina and heart health",
    difficulty: "Beginner",
    goals: ["General Fitness"],
    keywords: ["jog", "run", "running", "cardio", "exercise", "workout", "fitness"],
    about:
      "Jogging is a slow, relaxed run. Beginners usually start by alternating short jogs with walking until stamina improves gradually.",
    steps: [
      "Warm up with 5 minutes of easy walking.",
      "Alternate 1 minute of slow jogging with 2 minutes of walking.",
      "Repeat a few times, keeping breathing comfortable.",
      "Cool down with slow walking and gentle leg stretches.",
    ],
    safety:
      "Increase jogging time gradually over weeks, not days. Stop if joints hurt sharply or breathing feels distressed.",
  },
  {
    id: "push-ups",
    title: "Push-ups",
    subsection: "Basic Workouts",
    icon: "💪",
    description:
      "A basic bodyweight exercise that works the chest, shoulders and arms.",
    benefit: "Upper-body strength",
    difficulty: "Beginner",
    goals: ["Strength", "General Fitness"],
    keywords: ["pushup", "push up", "arms", "chest", "strength", "exercise", "workout", "bodyweight"],
    about:
      "Push-ups use your own body weight to strengthen the chest, shoulders, arms, and core. Wall or knee push-ups are easier starting versions.",
    steps: [
      "Place hands shoulder-width apart on the floor, body in a straight line.",
      "Beginners may rest knees on the floor instead of toes.",
      "Slowly lower your chest toward the floor, then push back up.",
      "Start with a few slow repetitions with good form.",
    ],
    safety:
      "Keep the back straight and avoid sagging hips. Stop if shoulders or wrists hurt.",
  },
  {
    id: "squats",
    title: "Squats",
    subsection: "Basic Workouts",
    icon: "🦵",
    description:
      "A fundamental lower-body move that strengthens the legs and hips.",
    benefit: "Leg strength and mobility",
    difficulty: "Beginner",
    goals: ["Strength", "Mobility", "General Fitness"],
    keywords: ["squat", "legs", "thighs", "strength", "exercise", "workout", "bodyweight"],
    about:
      "Squats mimic the everyday motion of sitting and standing. They strengthen the thighs, hips, and glutes while supporting everyday mobility.",
    steps: [
      "Stand with feet about shoulder-width apart.",
      "Bend the knees and push hips back, as if sitting on a chair.",
      "Keep heels on the floor and chest gently lifted.",
      "Rise back up slowly and repeat a few times.",
    ],
    safety:
      "Do not let knees collapse inward. Keep movements slow and stop if knees hurt.",
  },
  {
    id: "lunges",
    title: "Lunges",
    subsection: "Basic Workouts",
    icon: "🧍",
    description:
      "A stepping exercise that builds leg strength and balance.",
    benefit: "Leg strength and balance",
    difficulty: "Beginner",
    goals: ["Strength", "Mobility"],
    keywords: ["lunge", "legs", "balance", "strength", "exercise", "workout", "bodyweight"],
    about:
      "Lunges work one leg at a time, which builds strength and balance together. Small steps are best for beginners.",
    steps: [
      "Stand tall and step one foot forward.",
      "Lower your body until both knees are softly bent.",
      "Keep the upper body upright and front knee over the ankle.",
      "Push back to standing and repeat on the other side.",
    ],
    safety:
      "Use a wall or chair for balance if needed. Stop if knees or hips hurt.",
  },
  {
    id: "plank",
    title: "Plank",
    subsection: "Basic Workouts",
    icon: "🧱",
    description:
      "A still hold that strengthens the core muscles of the belly and back.",
    benefit: "Core stability",
    difficulty: "Beginner",
    goals: ["Strength", "General Fitness"],
    keywords: ["plank", "core", "abs", "strength", "exercise", "workout", "bodyweight"],
    about:
      "The plank builds the muscles that support the spine and posture. Beginners start with short holds and build up gradually.",
    steps: [
      "Rest on forearms and toes (or knees for an easier version).",
      "Keep the body in one straight line from head to heels.",
      "Breathe normally and hold for 10–20 seconds.",
      "Rest, then repeat once or twice.",
    ],
    safety:
      "Stop if the lower back sags painfully. Short holds with good form beat long holds with poor form.",
  },
  {
    id: "glute-bridge",
    title: "Glute Bridge",
    subsection: "Basic Workouts",
    icon: "🌉",
    description:
      "A lying-down exercise that wakes up the hips and lower back muscles.",
    benefit: "Hip and back support",
    difficulty: "Beginner",
    goals: ["Strength", "Mobility"],
    keywords: ["bridge", "glutes", "hips", "back", "strength", "exercise", "workout", "bodyweight"],
    about:
      "The glute bridge strengthens the buttocks and supports the lower back. It is done lying down, so it suits beginners well.",
    steps: [
      "Lie on your back with knees bent and feet flat on the floor.",
      "Press through the heels and lift hips toward the ceiling.",
      "Hold briefly at the top, then lower down slowly.",
      "Repeat a few times with steady breathing.",
    ],
    safety:
      "Move slowly and avoid arching the lower back sharply. Stop if back pain appears.",
  },
  {
    id: "jumping-jacks",
    title: "Jumping Jacks",
    subsection: "Basic Workouts",
    icon: "⭐",
    description:
      "A simple full-body warm-up move that raises the heart rate gently.",
    benefit: "Warm-up and coordination",
    difficulty: "Beginner",
    goals: ["General Fitness"],
    keywords: ["jumping jack", "warmup", "warm up", "cardio", "exercise", "workout", "fitness"],
    about:
      "Jumping jacks move the arms and legs together and are often used to warm up before other activity. A low step-touch version removes the jumping.",
    steps: [
      "Stand with feet together and arms at your sides.",
      "Jump (or step) feet out while raising arms overhead.",
      "Return to the starting position.",
      "Continue at a comfortable rhythm for 30 seconds.",
    ],
    safety:
      "Land softly with slightly bent knees. Choose the step-touch version if jumping feels uncomfortable.",
  },
  {
    id: "bodyweight-exercises",
    title: "Bodyweight Exercises",
    subsection: "Basic Workouts",
    icon: "🤸",
    description:
      "An introduction to training that uses your own body as resistance.",
    benefit: "Everyday functional strength",
    difficulty: "Beginner",
    goals: ["General Fitness", "Strength"],
    keywords: ["bodyweight", "no equipment", "home workout", "strength", "exercise", "workout", "fitness"],
    about:
      "Bodyweight exercises need no gym or equipment, so they are ideal for beginners at home. Squats, push-ups, and planks are common examples.",
    steps: [
      "Pick 2–3 simple moves you already know.",
      "Do a few slow repetitions of each with rest in between.",
      "Repeat the small circuit once or twice.",
      "Add repetitions gradually over weeks.",
    ],
    safety:
      "Learn correct form first and progress slowly. Soreness for a day is common; sharp pain is a stop signal.",
  },
  {
    id: "basic-full-body-workout",
    title: "Basic Full-Body Workout",
    subsection: "Basic Workouts",
    icon: "🔄",
    description:
      "A gentle example sequence covering the major muscle groups.",
    benefit: "Balanced general fitness",
    difficulty: "Intermediate",
    goals: ["General Fitness", "Strength"],
    keywords: ["full body", "routine", "circuit", "exercise", "workout", "fitness", "beginner routine"],
    about:
      "A basic full-body session combines a warm-up, a few simple strength moves, and a cool-down. The example below takes about 15–20 minutes.",
    steps: [
      "Warm up: march in place and do jumping jacks for 3–5 minutes.",
      "Main set: squats, wall push-ups, glute bridges — a few slow repetitions each.",
      "Repeat the main set once more with rest between moves.",
      "Cool down: slow walking plus gentle stretches for 3–5 minutes.",
    ],
    safety:
      "Rest between moves and skip anything that causes pain. Two or three sessions a week is plenty for beginners.",
  },
  // ---------------- Yoga & Stretching ----------------
  {
    id: "tadasana",
    title: "Tadasana (Mountain Pose)",
    subsection: "Yoga & Stretching",
    icon: "🧘",
    description:
      "A foundational standing pose that teaches steady posture and balance.",
    benefit: "Posture and balance",
    difficulty: "Beginner",
    goals: ["Mobility", "Relaxation", "General Fitness"],
    keywords: ["tadasana", "mountain pose", "yoga", "standing", "posture", "stretching", "balance"],
    about:
      "Tadasana is the starting point of many standing yoga sequences. It looks simple but builds awareness of posture, breathing, and balance.",
    steps: [
      "Stand with feet together and weight spread evenly.",
      "Lengthen the spine and relax the shoulders down.",
      "Breathe slowly and hold the pose for 30 seconds.",
      "Release gently and notice how your posture feels.",
    ],
    safety:
      "Stand near a wall for support if balance feels unsteady.",
  },
  {
    id: "balasana",
    title: "Balasana (Child's Pose)",
    subsection: "Yoga & Stretching",
    icon: "🧘",
    description:
      "A gentle resting pose that stretches the back and calms the body.",
    benefit: "Back stretch and relaxation",
    difficulty: "Beginner",
    goals: ["Flexibility", "Relaxation"],
    keywords: ["balasana", "child's pose", "childs pose", "yoga", "resting", "stretching", "back", "relaxation"],
    about:
      "Balasana, known in English as Child's Pose, is a resting posture often used between yoga sequences to relax the back, shoulders, and mind.",
    steps: [
      "Kneel and sit back toward your heels.",
      "Fold forward, resting your forehead on the floor or a cushion.",
      "Stretch arms forward or rest them alongside the body.",
      "Breathe slowly and hold for 30–60 seconds.",
    ],
    safety:
      "Use a cushion under the forehead or knees for comfort. Come out slowly if you feel dizzy.",
  },
  {
    id: "bhujangasana",
    title: "Bhujangasana (Cobra Pose)",
    subsection: "Yoga & Stretching",
    icon: "🐍",
    description:
      "A gentle backbend that opens the chest and stretches the belly.",
    benefit: "Spine flexibility and posture",
    difficulty: "Beginner",
    goals: ["Flexibility", "Mobility"],
    keywords: ["bhujangasana", "cobra pose", "cobra", "yoga", "backbend", "stretching", "spine", "back"],
    about:
      "Bhujangasana, known in English as Cobra Pose, gently arches the back while lying face down. It stretches the front of the body and supports upright posture.",
    steps: [
      "Lie face down with palms under the shoulders.",
      "Press gently through the hands and lift the chest a little.",
      "Keep elbows slightly bent and shoulders away from the ears.",
      "Hold for a few slow breaths, then lower down.",
    ],
    safety:
      "Lift only to a comfortable height — never force the backbend. Stop if the lower back hurts.",
  },
  {
    id: "cat-cow-stretch",
    title: "Cat-Cow Stretch",
    subsection: "Yoga & Stretching",
    icon: "🐈",
    description:
      "A flowing movement that warms up the spine and eases stiffness.",
    benefit: "Spinal mobility",
    difficulty: "Beginner",
    goals: ["Flexibility", "Mobility", "Relaxation"],
    keywords: ["cat cow", "cat-cow", "spine", "yoga", "stretching", "back", "warmup", "mobility"],
    about:
      "Cat-Cow alternates between rounding and arching the back with the breath. It is a popular warm-up that loosens the whole spine.",
    steps: [
      "Come to hands and knees with a flat back.",
      "Breathe in: gently arch the back and lift the head (Cow).",
      "Breathe out: round the back and tuck the chin (Cat).",
      "Flow slowly between the two for 5–8 breaths.",
    ],
    safety:
      "Move slowly and keep motions small if the neck or back is sensitive.",
  },
  {
    id: "seated-forward-fold",
    title: "Seated Forward Fold",
    subsection: "Yoga & Stretching",
    icon: "🧘",
    description:
      "A seated stretch for the back of the legs and the lower back.",
    benefit: "Hamstring and back flexibility",
    difficulty: "Beginner",
    goals: ["Flexibility", "Relaxation"],
    keywords: ["forward fold", "seated", "hamstring", "yoga", "stretching", "legs", "flexibility"],
    about:
      "This seated pose stretches the hamstrings and lower back while encouraging slow breathing. Bending the knees slightly makes it easier.",
    steps: [
      "Sit with legs extended straight ahead.",
      "Breathe in to lengthen the spine, then fold forward gently.",
      "Rest hands on the legs wherever they reach comfortably.",
      "Hold for 20–30 seconds while breathing slowly.",
    ],
    safety:
      "Never bounce or force the fold. Slight knee bend is fine and safer for tight legs.",
  },
  {
    id: "neck-stretch",
    title: "Neck Stretch",
    subsection: "Yoga & Stretching",
    icon: "🧍",
    description:
      "A gentle stretch that eases tension from desk work and phone use.",
    benefit: "Neck mobility and tension relief",
    difficulty: "Beginner",
    goals: ["Mobility", "Relaxation"],
    keywords: ["neck", "stretch", "tension", "desk", "yoga", "stretching", "mobility", "stiffness"],
    about:
      "Long hours at a desk or phone can stiffen the neck. Slow side stretches help release everyday tension in the neck and shoulders.",
    steps: [
      "Sit or stand tall with shoulders relaxed.",
      "Slowly tilt the right ear toward the right shoulder.",
      "Hold for 15–20 seconds, breathing normally.",
      "Return to center and repeat on the other side.",
    ],
    safety:
      "Move gently and never roll the neck forcefully. Stop if dizziness occurs.",
  },
  {
    id: "shoulder-stretch",
    title: "Shoulder Stretch",
    subsection: "Yoga & Stretching",
    icon: "🤸",
    description:
      "A simple cross-body stretch for tight shoulders and upper arms.",
    benefit: "Shoulder mobility",
    difficulty: "Beginner",
    goals: ["Mobility", "Flexibility"],
    keywords: ["shoulder", "stretch", "arms", "yoga", "stretching", "mobility", "upper body"],
    about:
      "This stretch targets the shoulders and the back of the upper arms. It is useful after study sessions, desk work, or upper-body activity.",
    steps: [
      "Bring one arm across the chest at shoulder height.",
      "Gently support it with the other hand near the elbow.",
      "Hold for 15–20 seconds without pulling hard.",
      "Repeat on the other side.",
    ],
    safety:
      "Stretch only to mild tension, never pain. Keep shoulders down away from the ears.",
  },
  {
    id: "standing-side-stretch",
    title: "Standing Side Stretch",
    subsection: "Yoga & Stretching",
    icon: "🌴",
    description:
      "An easy standing stretch for the sides of the body and waist.",
    benefit: "Side-body flexibility",
    difficulty: "Beginner",
    goals: ["Flexibility", "Mobility"],
    keywords: ["side stretch", "side bend", "waist", "yoga", "stretching", "standing", "flexibility", "obliques"],
    about:
      "Side stretches open the muscles along the ribs and waist, which supports comfortable bending and twisting in daily life.",
    steps: [
      "Stand tall with feet hip-width apart.",
      "Raise one arm overhead and lean gently to the opposite side.",
      "Hold for 15–20 seconds while breathing slowly.",
      "Return to center and repeat on the other side.",
    ],
    safety:
      "Lean only as far as comfortable and keep balance steady — stand near a wall if needed.",
  },
  {
    id: "seated-spinal-twist",
    title: "Seated Spinal Twist",
    subsection: "Yoga & Stretching",
    icon: "🪑",
    description:
      "A seated twist that mobilizes the spine and eases mid-back stiffness.",
    benefit: "Spinal mobility",
    difficulty: "Intermediate",
    goals: ["Flexibility", "Mobility"],
    keywords: ["twist", "spine", "seated", "yoga", "stretching", "back", "mobility", "flexibility"],
    about:
      "Gentle seated twists rotate the spine within a comfortable range. They are commonly used to relieve stiffness from long sitting.",
    steps: [
      "Sit tall in a chair or on the floor with legs comfortable.",
      "Place one hand on the opposite knee and the other behind you.",
      "Turn gently to one side while breathing out.",
      "Hold a few breaths, then repeat on the other side.",
    ],
    safety:
      "Twist gently without forcing. Avoid deep twists during pregnancy or with spinal conditions unless a doctor advises.",
  },
  {
    id: "basic-full-body-stretch",
    title: "Basic Full-Body Stretch",
    subsection: "Yoga & Stretching",
    icon: "🌅",
    description:
      "A short calming sequence covering the neck, shoulders, back, and legs.",
    benefit: "Overall flexibility and relaxation",
    difficulty: "Beginner",
    goals: ["Flexibility", "Relaxation", "General Fitness"],
    keywords: ["full body stretch", "stretching routine", "yoga", "cool down", "cooldown", "flexibility", "relaxation"],
    about:
      "A short full-body stretch routine links a few gentle poses together. It works well as a morning routine or a cool-down after walking or workouts.",
    steps: [
      "Neck and shoulder stretches: one round on each side.",
      "Cat-Cow: 5 slow rounds to warm the spine.",
      "Child's Pose: rest and breathe for 30 seconds.",
      "Seated forward fold and a standing side stretch to finish.",
    ],
    safety:
      "Hold each stretch at mild tension and breathe normally. Skip anything that causes pain.",
  },
];
