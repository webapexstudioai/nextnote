// Shared types for the Lead Qualifier audit pipeline.
// The pipeline runs in three stages:
//   1. fetch  — pull external signals (reviews, page-speed audit)
//   2. synth  — feed the signals into Claude with a calibrated prompt
//   3. cache  — persist to lead_audits with a 30-day TTL

export interface Review {
  rating: number | null;
  text: string;
  author: string | null;
  date: string | null;
  owner_response: string | null;
}

export interface ReviewsBundle {
  ok: boolean;
  total_reviews: number | null;
  average_rating: number | null;
  reviews: Review[];
  business_categories: string[];
  business_hours: string | null;
  is_permanently_closed: boolean | null;
  fetched_at: string;
  error: string | null;
}

export interface PageSpeedBundle {
  ok: boolean;
  // 0-1 floats from Lighthouse, or null if unavailable.
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  // Core Web Vitals (LCP, CLS, etc) where available.
  metrics: Record<string, { value: number | string; displayValue?: string }>;
  // Audited URL after redirect resolution.
  final_url: string | null;
  // Top opportunities surfaced by Lighthouse (titles only, ranked).
  top_opportunities: string[];
  fetched_at: string;
  error: string | null;
}

export interface AuditSignals {
  reviews: ReviewsBundle;
  pagespeed: PageSpeedBundle;
  prospect: {
    name: string;
    phone: string | null;
    website: string | null;
    address: string | null;
    industry: string | null;
  };
}

export interface PitchHook {
  // Short, action-ready line the agency can use to pitch.
  hook: string;
  // Which fit it supports: 'ai_receptionist' | 'website' | 'both'.
  category: "ai_receptionist" | "website" | "both";
  // 1-2 sentences of evidence pulled directly from the signals.
  evidence: string;
}

export interface SignalEvidence {
  // Short label, e.g. "Reviews mention unanswered calls (3 of 12)"
  label: string;
  // Which fit this signal informs.
  category: "ai_receptionist" | "website" | "neutral";
  // Direction: does this push the score up or down?
  weight: "positive" | "negative" | "neutral";
  // Optional verbatim snippet from a review or audit finding.
  detail: string | null;
}

export interface AuditSynthesis {
  ai_receptionist_score: number; // 0-100
  website_score: number; // 0-100
  overall_score: number; // 0-100 — weighted by which fit is stronger
  confidence: "low" | "medium" | "high";
  signals: SignalEvidence[];
  pitch_hooks: PitchHook[];
  // 1-2 sentence summary readable in the prospect detail panel.
  summary: string;
}

export interface AuditRecord extends AuditSynthesis {
  id: string;
  user_id: string;
  prospect_id: string;
  status: "pending" | "complete" | "failed";
  error_message: string | null;
  credits_charged: number;
  created_at: string;
  completed_at: string | null;
  expires_at: string | null;
  raw_reviews: ReviewsBundle | null;
  raw_pagespeed: PageSpeedBundle | null;
}
