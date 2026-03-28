/**
 * Money Health Score dimensions
 */
export const HEALTH_DIMENSIONS = [
  { key: "emergency", label: "Emergency preparedness", icon: "🚨" },
  { key: "insurance", label: "Insurance coverage", icon: "🛡️" },
  { key: "investments", label: "Investment diversification", icon: "📈" },
  { key: "debt", label: "Debt health", icon: "🏦" },
  { key: "tax_efficiency", label: "Tax efficiency", icon: "📋" },
  { key: "savings", label: "Retirement readiness", icon: "🏖️" },
];

/**
 * FIRE Planner goal categories
 */
export const GOAL_CATEGORIES = [
  { value: "retirement", label: "🏖️ Retirement" },
  { value: "education", label: "🎓 Education" },
  { value: "home", label: "🏠 Home Purchase" },
  { value: "car", label: "🚗 Vehicle" },
  { value: "wedding", label: "💍 Wedding" },
  { value: "travel", label: "✈️ Travel" },
  { value: "emergency", label: "🚨 Emergency Fund" },
  { value: "custom", label: "⭐ Custom" },
];

/**
 * FIRE Planner risk profiles
 */
export const RISK_PROFILES = [
  { value: "conservative", label: "Conservative", description: "Low risk, stable returns" },
  { value: "moderate", label: "Moderate", description: "Balanced risk and returns" },
  { value: "aggressive", label: "Aggressive", description: "High risk, high potential returns" },
];

/**
 * Life Event types
 */
export const LIFE_EVENTS = [
  { value: "bonus", label: "Bonus / Windfall", icon: "Gift" },
  { value: "marriage", label: "Marriage", icon: "Heart" },
  { value: "child_birth", label: "Child Birth", icon: "Baby" },
  { value: "home_purchase", label: "Home Purchase", icon: "Home" },
  { value: "job_change", label: "Job Change", icon: "Briefcase" },
  { value: "retirement", label: "Retirement", icon: "Palmtree" },
  { value: "inheritance", label: "Inheritance", icon: "Package" },
  { value: "business_start", label: "Start Business", icon: "Rocket" },
  { value: "medical_emergency", label: "Medical Emergency", icon: "Hospital" },
];
