import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as Indian currency (₹)
 */
export function formatCurrency(amount: number): string {
  if (amount === undefined || amount === null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number as a percentage
 */
export function formatPercent(value: number): string {
  if (value === undefined || value === null) return "0%";
  return `${value.toFixed(1)}%`;
}

/**
 * Get color based on a health/score value (0-100)
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return "#10b981"; // emerald
  if (score >= 60) return "#f59e0b"; // amber
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

/**
 * Get a label for a health score
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs Work";
  return "Critical";
}

/**
 * Get a time-of-day greeting
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}
