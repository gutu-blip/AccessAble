import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SubmissionForm from "./SubmissionForm";

/* ==================================================================
 * Shared production utilities, data, and constants
 * ================================================================== */

const STORAGE_KEYS = {
  bookmarks: "accessable.bookmarks.v1",
  contrast: "accessable.a11y.contrast.v1",
  dyslexia: "accessable.a11y.dyslexia.v1",
  fontScale: "accessable.a11y.fontScale.v1",
};

const SORT_OPTIONS = [
  "Deadline: Soonest",
  "Recently Added",
  "Highest Accommodation Rating",
];

const PAGE_SIZE_DESKTOP = 6;
const MOBILE_INITIAL_COUNT = 4;
const MOBILE_PAGE_STEP = 4;

const CATEGORY_DEFS = [
  { id: "all", label: "All Opportunities" },
  { id: "jobs", label: "Jobs & Internships" },
  { id: "events", label: "Events & Webinars" },
  { id: "grants", label: "Grants & Funding" },
  { id: "training", label: "Training & Mentorship" },
];

const TYPE_OPTIONS = [
  { label: "Full-time Job" },
  { label: "Webinar / Event" },
  { label: "Grant & Funding" },
  { label: "Mentorship & Fellowship" },
];

const ACCOMMODATION_OPTIONS = [
  { label: "Screen Reader Verified" },
  { label: "Sign Language (ASL/ISL)" },
  { label: "Wheelchair Accessible" },
  { label: "Real-time Captions (CART)" },
  { label: "Alternative Formats (Audio)" },
  { label: "Assistive Tech Provided" },
];

const WORK_MODE_OPTIONS = [
  { value: "all", label: "All Work Modes" },
  { value: "remote", label: "100% Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "In-Person / On-site" },
];

const FOOTER_LINKS = [
  "Accessibility Statement",
  "Universal Design Standards",
  "Employer Inclusivity Guide",
  "Terms of Service",
  "Privacy Policy",
  "Contact Support",
];

const FOOTER_CONTENT = {
  "Accessibility Statement":
    "AccessAble is built to WCAG 2.2 AA/AAA targets: keyboard-first navigation, visible focus, live regions for dynamic updates, adjustable text size (90–140%), high-contrast mode, and a dyslexia-friendly type option. If you encounter a barrier, contact support and we will remediate within 2 business days.",
  "Universal Design Standards":
    "Every listing must declare verified accommodations (screen-reader docs, captions, sign language, step-free access, alternative formats) plus a named accessibility coordinator and notice period before it can be published.",
  "Employer Inclusivity Guide":
    "Use plain language, publish salary or stipend ranges, offer flexible interview formats (video, phone, text, in-person), allow assistive technology, and confirm physical access details. Listings are screened before publishing.",
  "Terms of Service":
    "Opportunities are screened for accessibility clarity. Fraudulent, discriminatory, or inaccessible postings are removed. Applicant data is used only for matching and accommodation planning.",
  "Privacy Policy":
    "Bookmarks and accessibility preferences are stored locally on your device. Form submissions are stored in Firebase for review. We never sell personal data.",
  "Contact Support":
    "Email support@accessable.example · Phone/WhatsApp +254 700 000 000 (Mon–Fri, 9:00–17:00 EAT). For accommodation requests, include the opportunity title and the assistance you need.",
};

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return initialValue;
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initialValue;
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch {
      // storage may be blocked — app still works in-memory
    }
  }, [key, value]);
  return [value, setValue];
}

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function normalizeText(v) {
  return String(v == null ? "" : v).toLowerCase();
}

function matchesSearch(card, query) {
  const q = normalizeText(query).trim();
  if (!q) return true;
  const haystack = normalizeText(
    [
      card.title,
      card.org,
      card.location,
      card.meta,
      card.badge,
      card.description,
      card.categoryKey,
      card.type,
      card.workMode,
      ...(card.pills || []).map((p) => p.label),
      ...(card.accommodations || []),
    ]
      .filter(Boolean)
      .join(" | ")
  );
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function filterOpportunities(items, { query, category, types, accommodations, workMode, savedOnly, bookmarked }) {
  return items.filter((item) => {
    if (savedOnly && !(bookmarked && bookmarked[item.id])) return false;
    if (category && category !== "all" && item.categoryKey !== category) return false;
    if (types && types.length > 0 && !types.includes(item.type)) return false;
    if (
      accommodations &&
      accommodations.length > 0 &&
      !accommodations.every((a) => (item.accommodations || []).includes(a))
    )
      return false;
    if (workMode && workMode !== "all" && item.workMode !== workMode) return false;
    if (!matchesSearch(item, query)) return false;
    return true;
  });
}

function sortOpportunities(items, sortBy) {
  const next = [...items];
  if (sortBy === "Recently Added") {
    next.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } else if (sortBy === "Highest Accommodation Rating") {
    next.sort((a, b) => b.rating - a.rating || a.deadlineDays - b.deadlineDays);
  } else {
    next.sort((a, b) => a.deadlineDays - b.deadlineDays);
  }
  return next;
}

function getCategoryCount(items, id) {
  if (id === "all") return items.length;
  return items.filter((i) => i.categoryKey === id).length;
}

function getTypeCount(items, label) {
  return items.filter((i) => i.type === label).length;
}

function clampFontScale(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(90, Math.min(140, Math.round(n)));
}

function useA11yPrefs() {
  const [highContrast, setHighContrast] = useLocalStorage(STORAGE_KEYS.contrast, false);
  const [dyslexiaActive, setDyslexiaActive] = useLocalStorage(STORAGE_KEYS.dyslexia, false);
  const [fontScaleRaw, setFontScaleRaw] = useLocalStorage(STORAGE_KEYS.fontScale, 100);
  const fontScale = clampFontScale(fontScaleRaw);
  const setFontScale = useCallback((v) => setFontScaleRaw(clampFontScale(typeof v === "function" ? v(fontScaleRaw) : v)), [fontScaleRaw, setFontScaleRaw]);

  useEffect(() => {
    try {
      document.documentElement.style.fontSize = `${(fontScale / 100) * 16}px`;
    } catch {
      // ignore (non-DOM environment)
    }
  }, [fontScale]);

  useEffect(() => {
    try {
      document.body.classList.toggle("high-contrast-mode", !!highContrast);
      document.body.classList.toggle("dyslexia-font", !!dyslexiaActive);
    } catch {
      // ignore
    }
    return () => {
      try {
        document.body.classList.remove("high-contrast-mode");
        document.body.classList.remove("dyslexia-font");
      } catch {
        // ignore
      }
    };
  }, [highContrast, dyslexiaActive]);

  const updateScale = useCallback((next) => setFontScale(clampFontScale(next)), [setFontScale]);

  return { highContrast, setHighContrast, dyslexiaActive, setDyslexiaActive, fontScale, setFontScale, updateScale };
}

function useBookmarks() {
  const [bookmarked, setBookmarked] = useLocalStorage(STORAGE_KEYS.bookmarks, {});
  const toggleBookmark = useCallback(
    (id) => {
      let nextVal = false;
      setBookmarked((prev) => {
        const safe = prev && typeof prev === "object" ? prev : {};
        nextVal = !safe[id];
        return { ...safe, [id]: nextVal };
      });
      return nextVal;
    },
    [setBookmarked]
  );
  const savedCount = useMemo(
    () => Object.values(bookmarked || {}).filter(Boolean).length,
    [bookmarked]
  );
  return { bookmarked: bookmarked || {}, setBookmarked, toggleBookmark, savedCount };
}

const UNIFORM_PILL_CLASS =
  "bg-surface-container-high text-on-surface-variant border border-outline-variant/60";
const UNIFORM_BADGE_CLASS = "bg-primary-container text-on-primary";
const UNIFORM_DEADLINE_CLASS = "text-on-surface-variant";

function getOrgInitials(org) {
  if (!org) return "";
  const words = org.split(" ").filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function AccPill({ label }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-label-sm font-label-sm font-medium ${UNIFORM_PILL_CLASS}`}
    >
      {label}
    </span>
  );
}

function OpportunityCard({ card, bookmarked, onToggleBookmark, onViewDetails }) {
  return (
    <article className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 card-elevation-1 transition-all duration-150 flex flex-col justify-between group">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-label-sm font-label-sm font-bold ${UNIFORM_BADGE_CLASS}`}
          >
            {card.badge}
          </span>
          <span
            className={`inline-flex items-center text-label-sm font-label-sm font-semibold ${UNIFORM_DEADLINE_CLASS}`}
          >
            {card.deadline}
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 border border-outline-variant/60 text-primary font-headline-sm font-bold">
            {card.logo || getOrgInitials(card.org)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface group-hover:text-primary transition-colors">
              {card.title}
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-on-surface">{card.org}</span>
              <span>•</span>
              {card.locationIcon ? (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    {card.locationIcon}
                  </span>
                  {card.location}
                </span>
              ) : (
                <span className={card.locationEmphasis || ""}>
                  {card.location}
                </span>
              )}
              {card.meta ? (
                <>
                  <span>•</span>
                  <span className={card.metaEmphasis || ""}>{card.meta}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {card.pills.map((pill) => (
            <AccPill key={pill.label} label={pill.label} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between pt-6 mt-6 border-t border-outline-variant/60">
        <button
          aria-label={`Bookmark ${card.title}`}
          aria-pressed={!!bookmarked}
          onClick={onToggleBookmark}
          type="button"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors border border-outline-variant/60 active:scale-[0.98] ${
            bookmarked
              ? "text-primary bg-secondary-container border-transparent"
              : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {bookmarked ? "bookmark" : "bookmark_border"}
          </span>
        </button>
        <button
          type="button"
          onClick={onViewDetails}
          aria-label={`View details for ${card.title}`}
          className="inline-flex items-center gap-1.5 font-label-lg text-label-lg font-bold text-primary hover:translate-x-1 transition-transform"
        >
          View Details
          <span className="material-symbols-outlined text-[18px]">
            arrow_forward
          </span>
        </button>
      </div>
    </article>
  );
}

/* ------------------------- Shared overlays ------------------------- */

function ModalShell({ title, onClose, children, labelledById }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl"
      >
        <div className="sticky top-0 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/60 px-6 py-4 flex items-center justify-between gap-4">
          <h2 id={labelledById} className="font-headline-sm text-headline-sm font-bold text-on-surface">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function OpportunityDetailModal({ card, bookmarked, onToggleBookmark, onClose }) {
  if (!card) return null;
  return (
    <ModalShell title={card.title} onClose={onClose} labelledById="opp-detail-title">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-label-sm font-bold ${UNIFORM_BADGE_CLASS}`}>
            {card.badge}
          </span>
          <span className="inline-flex items-center text-label-sm font-semibold text-on-surface-variant">
            {card.deadline}
          </span>
          <span className="inline-flex items-center gap-1 text-label-sm font-semibold text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">star</span>
            {card.rating.toFixed(1)} accommodation rating
          </span>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 border border-outline-variant/60 text-primary font-headline-sm font-bold text-lg">
            {card.logo || getOrgInitials(card.org)}
          </div>
          <div>
            <p className="font-body-md text-body-md text-on-surface">
              <span className="font-bold">{card.org}</span> • {card.location}
            </p>
            {card.meta ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{card.meta}</p>
            ) : null}
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              Work mode: <span className="font-semibold text-on-surface capitalize">{card.workMode}</span>
              {" • "}Listed {new Date(card.createdAt).toLocaleDateString([], { dateStyle: "medium" })}
            </p>
          </div>
        </div>
        <p className="font-body-md text-body-md text-on-surface leading-relaxed">{card.description}</p>
        <div>
          <h3 className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Verified accommodations</h3>
          <div className="flex flex-wrap gap-2">
            {(card.accommodations || []).map((a) => (
              <AccPill key={a} label={a} />
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Highlights</h3>
          <div className="flex flex-wrap gap-2">
            {(card.pills || []).map((p) => (
              <AccPill key={p.label} label={p.label} />
            ))}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onToggleBookmark}
            aria-pressed={!!bookmarked}
            className={`inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border font-label-lg text-label-lg font-bold transition-colors active:scale-[0.98] ${
              bookmarked
                ? "bg-secondary-container text-on-secondary-container border-transparent"
                : "bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {bookmarked ? "bookmark" : "bookmark_border"}
            </span>
            {bookmarked ? "Saved" : "Save for later"}
          </button>
          {card.applyUrl && card.applyUrl !== "#" ? (
            <a
              href={card.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold hover:opacity-95 transition-opacity active:scale-[0.98]"
            >
              Apply / Register
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          ) : (
            <button
              type="button"
              disabled
              title="Application link available after accessibility screening"
              className="inline-flex flex-1 items-center justify-center gap-2 h-11 px-5 rounded-xl bg-surface-container-low text-on-surface-variant font-label-lg text-label-lg font-bold cursor-not-allowed border border-outline-variant"
            >
              Apply / Register
              <span className="material-symbols-outlined text-[18px]">lock</span>
            </button>
          )}
        </div>
        {(!card.applyUrl || card.applyUrl === "#") && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Application link is provided after accessibility screening. Save this opportunity and check back soon.
          </p>
        )}
      </div>
    </ModalShell>
  );
}

function PostOpportunityModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-opp-title"
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#f8f9fb] rounded-2xl shadow-2xl border border-outline-variant"
      >
        <div className="sticky top-0 z-10 bg-[#f8f9fb]/95 backdrop-blur border-b border-outline-variant/60 px-6 py-4 flex items-center justify-between gap-4">
          <h2 id="post-opp-title" className="font-headline-sm text-headline-sm font-bold text-on-surface">
            Post an Inclusive Opportunity
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close post opportunity form"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <SubmissionForm />
      </div>
    </div>
  );
}

function FooterDialog({ link, onClose }) {
  if (!link) return null;
  return (
    <ModalShell title={link} onClose={onClose} labelledById="footer-dialog-title">
      <p className="font-body-md text-body-md text-on-surface leading-relaxed">
        {FOOTER_CONTENT[link] || "Details coming soon."}
      </p>
      <div className="pt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold"
        >
          Got it
        </button>
      </div>
    </ModalShell>
  );
}

function EmptyState({ title, body, onReset }) {
  return (
    <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-xl p-10 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
        <span className="material-symbols-outlined text-[28px]">search_off</span>
      </div>
      <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">{title}</h3>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">{body}</p>
      <div className="pt-2">
        <button
          type="button"
          onClick={onReset}
          className="h-10 px-5 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-bold hover:opacity-95 active:scale-[0.98]"
        >
          Clear search &amp; filters
        </button>
      </div>
    </div>
  );
}

/* ==================================================================
 * Opportunity dataset (18 items — powers counts, filters, sort)
 * ================================================================== */

const OPPORTUNITIES = [
  {
    id: 1,
    badge: "Job • Full-time",
    deadline: "Closes in 4 days",
    title: "Senior Accessible Frontend Engineer",
    org: "InclusiveTech Labs",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "$135k – $160k",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Alternative Formats (Audio)", "Assistive Tech Provided"],
    deadlineDays: 4,
    createdAt: "2025-10-10T09:00:00.000Z",
    rating: 4.8,
    description:
      "Lead accessible React development with WCAG 2.2 AA targets, semantic HTML, keyboard-first flows, and assistive-technology testing. Fully remote with flexible hours and a home-office stipend.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "100% Remote" },
      { label: "Flexible Hours" },
      { label: "Mental Health Days" },
    ],
  },
  {
    id: 2,
    badge: "Event • Free Webinar",
    deadline: "Tomorrow • 2:00 PM EST",
    title: "Global Disability Inclusion Summit 2025",
    org: "World PWD Alliance",
    locationIcon: "videocam",
    location: "Live Stream / Virtual",
    meta: "Free Attendance",
    categoryKey: "events",
    type: "Webinar / Event",
    workMode: "remote",
    accommodations: ["Sign Language (ASL/ISL)", "Real-time Captions (CART)", "Alternative Formats (Audio)"],
    deadlineDays: 1,
    createdAt: "2025-10-20T14:00:00.000Z",
    rating: 4.9,
    description:
      "A full-day virtual summit on inclusive hiring, accessible procurement, and disability-led innovation. Live sign language, CART captions, and accessible slides shared 48 hours ahead.",
    applyUrl: "#",
    pills: [
      { label: "Live Sign Language (ASL/ISL)" },
      { label: "Real-time Captions (CART)" },
      { label: "Accessible Slides Ahead" },
    ],
  },
  {
    id: 3,
    badge: "Grant & Funding",
    deadline: "Deadline: Nov 15, 2025",
    title: "Neurodivergent Entrepreneurs Innovation Grant",
    org: "Horizon Impact Trust",
    location: "Grant of $25,000 USD",
    locationEmphasis: "font-bold text-tertiary",
    locationIcon: null,
    meta: null,
    categoryKey: "grants",
    type: "Grant & Funding",
    workMode: "remote",
    accommodations: ["Alternative Formats (Audio)", "Assistive Tech Provided", "Screen Reader Verified"],
    deadlineDays: 24,
    createdAt: "2025-09-15T09:00:00.000Z",
    rating: 4.7,
    description:
      "$25,000 seed funding for neurodivergent founders. Apply by video, audio, or text. 1-on-1 application assistance and an extended review window are included.",
    applyUrl: "#",
    pills: [
      { label: "Alternative Formats (Audio/Video)" },
      { label: "1-on-1 Application Assistance" },
      { label: "Extended Review Window" },
    ],
  },
  {
    id: 4,
    badge: "Training & Mentorship",
    deadline: "Starts Nov 10",
    title: "Digital Accessibility QA Mentorship Cohort",
    org: "A11y Guild",
    locationIcon: null,
    location: "Hybrid (New York & Online)",
    meta: "Sponsored Stipend",
    categoryKey: "training",
    type: "Mentorship & Fellowship",
    workMode: "hybrid",
    accommodations: ["Wheelchair Accessible", "Assistive Tech Provided", "Real-time Captions (CART)"],
    deadlineDays: 19,
    createdAt: "2025-09-20T09:00:00.000Z",
    rating: 4.6,
    description:
      "A 10-week mentored cohort covering manual QA with screen readers, keyboard testing, and defect reporting. Wheelchair-accessible lab, loaner assistive tech, and live captioning.",
    applyUrl: "#",
    pills: [
      { label: "Wheelchair Accessible Lab" },
      { label: "Assistive Tech Provided" },
      { label: "Live Captioning" },
    ],
  },
  {
    id: 5,
    badge: "Job • Part-time",
    deadline: "Closes in 8 days",
    title: "Accessibility UX Researcher & Tester",
    org: "Universal Design Lab",
    locationIcon: null,
    location: "Remote (US)",
    meta: "$60 - $80 / hr",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Alternative Formats (Audio)"],
    deadlineDays: 8,
    createdAt: "2025-10-12T09:00:00.000Z",
    rating: 4.5,
    description:
      "Part-time UX research with disabled testers: plan studies, run moderated sessions asynchronously, and synthesize plain-language findings. Ergonomic stipend included.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "Asynchronous Communication" },
      { label: "Ergonomic Equipment Stipend" },
    ],
  },
  {
    id: 6,
    badge: "Fellowship & Residency",
    deadline: "Deadline: Dec 1, 2025",
    title: "Inclusive Arts & Media Fellowship 2026",
    org: "Creative Access Initiative",
    locationIcon: null,
    location: "Los Angeles, CA",
    meta: "$40,000 Stipend",
    categoryKey: "training",
    type: "Mentorship & Fellowship",
    workMode: "onsite",
    accommodations: ["Sign Language (ASL/ISL)", "Wheelchair Accessible"],
    deadlineDays: 40,
    createdAt: "2025-09-01T09:00:00.000Z",
    rating: 4.8,
    description:
      "A 6-month paid fellowship for disabled artists and media makers. Sensory-friendly studio, on-site ASL interpreters, and personal-care-assistant accompaniment allowed.",
    applyUrl: "#",
    pills: [
      { label: "Sensory-friendly Studio" },
      { label: "ASL Interpreters on Site" },
      { label: "PCA Accompaniment Allowed" },
    ],
  },
  {
    id: 7,
    badge: "Job • Contract",
    deadline: "Closes in 6 days",
    title: "Junior Accessibility Tester (Contract)",
    org: "A11yWorks Studio",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "$35 - $45 / hr",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Real-time Captions (CART)"],
    deadlineDays: 6,
    createdAt: "2025-10-18T09:00:00.000Z",
    rating: 4.4,
    description:
      "Three-month contract testing web flows with NVDA, JAWS, and VoiceOver. Async standups, captioned demos, and mentored bug-bash sessions.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "100% Remote" },
      { label: "Mentored Onboarding" },
    ],
  },
  {
    id: 8,
    badge: "Job • Full-time",
    deadline: "Closes in 12 days",
    title: "Inclusive Customer Support Specialist",
    org: "Brightline Services",
    locationIcon: null,
    location: "Hybrid (Nairobi & Remote)",
    meta: "KES 120k – 150k / mo",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "hybrid",
    accommodations: ["Wheelchair Accessible", "Assistive Tech Provided"],
    deadlineDays: 12,
    createdAt: "2025-10-05T09:00:00.000Z",
    rating: 4.3,
    description:
      "Support customers over chat, email, and relay-friendly phone. Step-free office, height-adjustable desks, and provided headsets with hearing-aid compatibility.",
    applyUrl: "#",
    pills: [
      { label: "Wheelchair Accessible" },
      { label: "Assistive Tech Provided" },
      { label: "Flexible Shifts" },
    ],
  },
  {
    id: 9,
    badge: "Job • Part-time",
    deadline: "Closes in 10 days",
    title: "Remote Data Annotator (Evenings)",
    org: "Open Data Collective",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "$22 / hr",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Alternative Formats (Audio)"],
    deadlineDays: 10,
    createdAt: "2025-10-08T09:00:00.000Z",
    rating: 4.2,
    description:
      "Label image descriptions and audio transcripts in evening shifts. Keyboard-only workflow verified, audio alternatives for every visual task.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "100% Remote" },
      { label: "Evening Shifts" },
    ],
  },
  {
    id: 10,
    badge: "Job • Internship",
    deadline: "Closes in 15 days",
    title: "Accessibility Design Intern",
    org: "Northwind Inclusive",
    locationIcon: null,
    location: "Hybrid (Lagos & Online)",
    meta: "Paid Internship",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "hybrid",
    accommodations: ["Screen Reader Verified", "Sign Language (ASL/ISL)"],
    deadlineDays: 15,
    createdAt: "2025-10-15T09:00:00.000Z",
    rating: 4.7,
    description:
      "Paid 12-week internship in inclusive product design. Portfolio reviews over video with interpreters, captioned critiques, and a dedicated mentor.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "Sign Language (ASL/ISL)" },
      { label: "Paid Stipend" },
    ],
  },
  {
    id: 11,
    badge: "Job • Full-time",
    deadline: "Closes in 7 days",
    title: "Backend Engineer (Accessible APIs)",
    org: "InclusiveTech Labs",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "$120k – $145k",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Assistive Tech Provided"],
    deadlineDays: 7,
    createdAt: "2025-10-14T09:00:00.000Z",
    rating: 4.6,
    description:
      "Build accessible REST/GraphQL APIs with clear error contracts and docs tested with screen readers. Remote-first with async RFC culture.",
    applyUrl: "#",
    pills: [
      { label: "Screen Reader Verified" },
      { label: "100% Remote" },
      { label: "Async Culture" },
    ],
  },
  {
    id: 12,
    badge: "Job • Contract",
    deadline: "Closes in 9 days",
    title: "Technical Writer, Plain Language",
    org: "ClearDocs Foundation",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "$70 - $90 / hr",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "remote",
    accommodations: ["Alternative Formats (Audio)", "Screen Reader Verified"],
    deadlineDays: 9,
    createdAt: "2025-10-11T09:00:00.000Z",
    rating: 4.5,
    description:
      "Write plain-language help centers and audio-described tutorials. Every deliverable ships with tagged PDF, HTML, and audio versions.",
    applyUrl: "#",
    pills: [
      { label: "Alternative Formats (Audio)" },
      { label: "Screen Reader Verified" },
      { label: "Flexible Hours" },
    ],
  },
  {
    id: 13,
    badge: "Job • Full-time",
    deadline: "Closes in 14 days",
    title: "QA Analyst, Assistive Technology",
    org: "Universal Design Lab",
    locationIcon: null,
    location: "On-site (Nairobi)",
    meta: "KES 180k – 220k / mo",
    categoryKey: "jobs",
    type: "Full-time Job",
    workMode: "onsite",
    accommodations: ["Wheelchair Accessible", "Assistive Tech Provided"],
    deadlineDays: 14,
    createdAt: "2025-10-02T09:00:00.000Z",
    rating: 4.4,
    description:
      "On-site QA across switch devices, magnifiers, and hearing loops. Step-free lab, accessible restrooms, reserved parking, and quiet room.",
    applyUrl: "#",
    pills: [
      { label: "Wheelchair Accessible" },
      { label: "Assistive Tech Provided" },
      { label: "Quiet Room" },
    ],
  },
  {
    id: 14,
    badge: "Event • Workshop",
    deadline: "In 2 days • 11:00 AM EAT",
    title: "Disability Rights Webinar Series",
    org: "Equal Access Network",
    locationIcon: "videocam",
    location: "Live Stream / Virtual",
    meta: "Free Attendance",
    categoryKey: "events",
    type: "Webinar / Event",
    workMode: "remote",
    accommodations: ["Sign Language (ASL/ISL)", "Real-time Captions (CART)"],
    deadlineDays: 2,
    createdAt: "2025-10-21T09:00:00.000Z",
    rating: 4.9,
    description:
      "Three evening workshops on disclosure, reasonable accommodation letters, and interview self-advocacy. Interpreted and captioned with transcripts next day.",
    applyUrl: "#",
    pills: [
      { label: "Live Sign Language (ASL/ISL)" },
      { label: "Real-time Captions (CART)" },
      { label: "Transcripts Next Day" },
    ],
  },
  {
    id: 15,
    badge: "Event • Expo",
    deadline: "Starts Nov 12",
    title: "Assistive Tech Expo 2025",
    org: "Innovate Access",
    locationIcon: null,
    location: "Hybrid (Kigali & Online)",
    meta: "Free + Paid Workshops",
    categoryKey: "events",
    type: "Webinar / Event",
    workMode: "hybrid",
    accommodations: ["Wheelchair Accessible", "Sign Language (ASL/ISL)", "Real-time Captions (CART)"],
    deadlineDays: 20,
    createdAt: "2025-09-25T09:00:00.000Z",
    rating: 4.6,
    description:
      "Try 60+ devices with occupational therapists. Step-free halls, hearing loops, captioned stages, and remote streaming for all keynotes.",
    applyUrl: "#",
    pills: [
      { label: "Wheelchair Accessible" },
      { label: "Live Captioning" },
      { label: "Hearing Loop" },
    ],
  },
  {
    id: 16,
    badge: "Event • Job Fair",
    deadline: "Starts Nov 9",
    title: "Inclusive Hiring Fair",
    org: "Access Employers Forum",
    locationIcon: null,
    location: "On-site (Accra)",
    meta: "Free Entry",
    categoryKey: "events",
    type: "Webinar / Event",
    workMode: "onsite",
    accommodations: ["Wheelchair Accessible", "Sign Language (ASL/ISL)", "Assistive Tech Provided"],
    deadlineDays: 18,
    createdAt: "2025-09-28T09:00:00.000Z",
    rating: 4.5,
    description:
      "Meet 40 certified inclusive employers. Quiet interview rooms, on-demand interpreters, step-free booths, and resume support in Braille, large print, and audio.",
    applyUrl: "#",
    pills: [
      { label: "Wheelchair Accessible" },
      { label: "ASL Interpreters on Site" },
      { label: "Quiet Interview Rooms" },
    ],
  },
  {
    id: 17,
    badge: "Grant & Funding",
    deadline: "Deadline: Nov 30, 2025",
    title: "Community Access Micro-Grant",
    org: "Horizon Impact Trust",
    location: "Grant up to $5,000 USD",
    locationEmphasis: "font-bold text-tertiary",
    locationIcon: null,
    meta: null,
    categoryKey: "grants",
    type: "Grant & Funding",
    workMode: "remote",
    accommodations: ["Alternative Formats (Audio)", "Screen Reader Verified"],
    deadlineDays: 30,
    createdAt: "2025-09-10T09:00:00.000Z",
    rating: 4.7,
    description:
      "Micro-grants for community access projects: ramps, captions, transport, or assistive devices. Two-page application accepted as text, audio, or video.",
    applyUrl: "#",
    pills: [
      { label: "Alternative Formats (Audio/Video)" },
      { label: "Plain-Language Form" },
      { label: "Rolling Support Calls" },
    ],
  },
  {
    id: 18,
    badge: "Training & Mentorship",
    deadline: "Closes in 5 days",
    title: "Peer Mentorship Circle (Cohort 8)",
    org: "A11y Guild",
    locationIcon: "public",
    location: "Remote (Global)",
    meta: "Free · 6 Weeks",
    categoryKey: "training",
    type: "Mentorship & Fellowship",
    workMode: "remote",
    accommodations: ["Screen Reader Verified", "Real-time Captions (CART)", "Sign Language (ASL/ISL)"],
    deadlineDays: 5,
    createdAt: "2025-10-19T09:00:00.000Z",
    rating: 4.8,
    description:
      "Small-group peer mentoring on career navigation, disclosure, and requesting accommodations. Captioned calls, interpreted sessions on request, camera-optional.",
    applyUrl: "#",
    pills: [
      { label: "Real-time Captions (CART)" },
      { label: "Camera Optional" },
      { label: "Screen Reader Verified" },
    ],
  },
];

/* ------------------------------------------------------------------
 * HomeDesktop — desktop implementation with full production logic.
 * Visual structure preserved; all controls are now functional.
 * ------------------------------------------------------------------ */
function HomeDesktop() {
  const { highContrast, setHighContrast, dyslexiaActive, setDyslexiaActive, fontScale, updateScale } =
    useA11yPrefs();
  const { bookmarked, toggleBookmark, savedCount } = useBookmarks();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedAccommodations, setSelectedAccommodations] = useState([]);
  const [workMode, setWorkMode] = useState("all");
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedOnly, setSavedOnly] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [detailBookmarkedTick, setDetailBookmarkedTick] = useState(0);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [footerLink, setFooterLink] = useState(null);
  const [toast, setToast] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  const searchRef = useRef(null);
  const feedTopRef = useRef(null);
  const profileRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setAnnouncement(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (searchRef.current) searchRef.current.focus();
      }
      if (e.key === "Escape") {
        setShowProfileMenu(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggleType = useCallback((label) => {
    setSelectedTypes((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]));
    setCurrentPage(1);
  }, []);

  const toggleAccommodation = useCallback((label) => {
    setSelectedAccommodations((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
    setCurrentPage(1);
  }, []);

  const handleWorkMode = useCallback((value) => {
    setWorkMode(value);
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery("");
    setActiveCategory("all");
    setSelectedTypes([]);
    setSelectedAccommodations([]);
    setWorkMode("all");
    setSavedOnly(false);
    setSortBy(SORT_OPTIONS[0]);
    setCurrentPage(1);
    setAnnouncement("All filters cleared. Showing all opportunities.");
  }, []);

  const filtered = useMemo(
    () =>
      filterOpportunities(OPPORTUNITIES, {
        query: debouncedQuery,
        category: activeCategory,
        types: selectedTypes,
        accommodations: selectedAccommodations,
        workMode,
        savedOnly,
        bookmarked,
      }),
    [debouncedQuery, activeCategory, selectedTypes, selectedAccommodations, workMode, savedOnly, bookmarked]
  );

  const sorted = useMemo(() => sortOpportunities(filtered, sortBy), [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE_DESKTOP));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE_DESKTOP, safePage * PAGE_SIZE_DESKTOP),
    [sorted, safePage]
  );

  useEffect(() => {
    if (currentPage !== safePage) setCurrentPage(safePage);
  }, [safePage, currentPage]);

  const activeBadges = useMemo(() => {
    const badges = [];
    if (activeCategory !== "all") {
      const def = CATEGORY_DEFS.find((c) => c.id === activeCategory);
      badges.push({ key: `cat:${activeCategory}`, label: def ? def.label : activeCategory, kind: "category" });
    }
    selectedTypes.forEach((t) => badges.push({ key: `type:${t}`, label: t, kind: "type" }));
    selectedAccommodations.forEach((a) => badges.push({ key: `acc:${a}`, label: a, kind: "accommodation" }));
    if (workMode !== "all") {
      const wm = WORK_MODE_OPTIONS.find((w) => w.value === workMode);
      badges.push({ key: `wm:${workMode}`, label: wm ? wm.label : workMode, kind: "workMode" });
    }
    if (debouncedQuery.trim()) {
      badges.push({ key: "q", label: `Search: “${debouncedQuery.trim()}”`, kind: "query" });
    }
    if (savedOnly) badges.push({ key: "saved", label: "Saved only", kind: "saved" });
    return badges;
  }, [activeCategory, selectedTypes, selectedAccommodations, workMode, debouncedQuery, savedOnly]);

  const removeBadge = useCallback(
    (badge) => {
      if (badge.kind === "category") setActiveCategory("all");
      else if (badge.kind === "type")
        setSelectedTypes((prev) => prev.filter((t) => t !== badge.label));
      else if (badge.kind === "accommodation")
        setSelectedAccommodations((prev) => prev.filter((a) => a !== badge.label));
      else if (badge.kind === "workMode") setWorkMode("all");
      else if (badge.kind === "query") setSearchQuery("");
      else if (badge.kind === "saved") setSavedOnly(false);
      setCurrentPage(1);
    },
    []
  );

  const handleToggleBookmark = useCallback(
    (id, title) => {
      const willSave = !bookmarked[id];
      toggleBookmark(id);
      setDetailBookmarkedTick((t) => t + 1);
      showToast(willSave ? `Saved “${title}”.` : `Removed “${title}” from saved.`);
    },
    [bookmarked, toggleBookmark, showToast]
  );

  const goToPage = useCallback(
    (page) => {
      const next = Math.max(1, Math.min(totalPages, page));
      setCurrentPage(next);
      setAnnouncement(`Page ${next} of ${totalPages}. Showing ${paginated.length} of ${sorted.length} opportunities.`);
      if (feedTopRef.current) {
        feedTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [totalPages, paginated.length, sorted.length]
  );

  const applyFilters = useCallback(() => {
    setCurrentPage(1);
    const msg = `Filters applied. ${filtered.length} ${filtered.length === 1 ? "opportunity" : "opportunities"} found.`;
    setAnnouncement(msg);
    showToast(msg);
    if (feedTopRef.current) feedTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [filtered.length, showToast]);

  const openDetails = useCallback((card) => setSelectedCard(card), []);
  const closeDetails = useCallback(() => setSelectedCard(null), []);

  const rootClasses = [
    "bg-background text-on-background min-h-screen flex flex-col antialiased selection:bg-secondary-container selection:text-primary",
    highContrast ? "high-contrast-mode" : "",
    dyslexiaActive ? "dyslexia-font" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    if (pages.length <= 5) return pages;
    const windowed = [1];
    for (let i = safePage - 1; i <= safePage + 1; i++) {
      if (i > 1 && i < totalPages) windowed.push(i);
    }
    windowed.push(totalPages);
    return [...new Set(windowed)].sort((a, b) => a - b);
  }, [totalPages, safePage]);

  const resultsHeading = savedOnly
    ? `${sorted.length} Saved ${sorted.length === 1 ? "Opportunity" : "Opportunities"}`
    : `${sorted.length} ${sorted.length === 1 ? "Opportunity" : "Opportunities"} Available Now`;

  return (
    <div id="app-root" className={rootClasses}>
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>
      {/* 1. PERSISTENT ACCESSIBILITY QUICK-TOOLBAR */}
      <aside
        aria-label="Accessibility quick controls"
        className="w-full bg-surface-container-lowest border-b border-outline-variant/60 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-on-surface">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-secondary-container text-primary">
              <span className="material-symbols-outlined text-[16px]">
                accessibility_new
              </span>
            </span>
            <span className="font-label-sm text-label-sm text-on-surface font-semibold tracking-wide">
              Universal Access Toolbar
            </span>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
            <span className="hidden sm:inline font-body-sm text-body-sm text-on-surface-variant">
              WCAG 2.2 AAA Compliant Mode
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors duration-150 active:scale-[0.98] font-label-sm text-label-sm text-on-surface"
              id="toggle-contrast"
              type="button"
              aria-pressed={highContrast}
              onClick={() => {
                setHighContrast((v) => !v);
                setAnnouncement(!highContrast ? "High contrast enabled." : "High contrast disabled.");
              }}
            >
              <span className="material-symbols-outlined text-[18px]">
                contrast
              </span>
              <span>Contrast</span>
            </button>
            <div
              aria-label="Text Size Zoom"
              className="inline-flex items-center rounded-lg border border-outline-variant bg-surface-container-low p-0.5"
              role="group"
            >
              <button
                aria-label="Decrease text size"
                className="px-2.5 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container rounded transition-colors duration-150 active:scale-[0.98]"
                id="btn-font-dec"
                type="button"
                onClick={() => updateScale(fontScale - 10)}
              >
                A-
              </button>
              <span
                className="px-2 font-label-sm text-label-sm text-on-surface-variant font-bold border-x border-outline-variant/60"
                id="font-scale-display"
              >
                {fontScale}%
              </span>
              <button
                aria-label="Increase text size"
                className="px-2.5 py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container rounded transition-colors duration-150 active:scale-[0.98]"
                id="btn-font-inc"
                type="button"
                onClick={() => updateScale(fontScale + 10)}
              >
                A+
              </button>
            </div>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors duration-150 active:scale-[0.98] font-label-sm text-label-sm text-on-surface"
              id="toggle-dyslexia"
              type="button"
              aria-pressed={dyslexiaActive}
              onClick={() => {
                setDyslexiaActive((v) => !v);
                setAnnouncement(!dyslexiaActive ? "Dyslexia-friendly font enabled." : "Default font restored.");
              }}
            >
              <span className="material-symbols-outlined text-[18px]">
                format_size
              </span>
              <span>Dyslexia Font</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. TOPNAVBAR */}
      <header className="w-full bg-surface-container-lowest dark:bg-inverse-surface border-b border-outline-variant dark:border-outline shadow-sm dark:shadow-none sticky top-10 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <a
              className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary flex items-center gap-2 group"
              href="#app-root"
              onClick={(e) => {
                e.preventDefault();
                resetFilters();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              aria-label="AccessAble home"
            >
              <span className="tracking-tight flex items-center gap-2">
                AccessAble
              </span>
            </a>
            <div className="hidden lg:flex items-center relative w-80">
              <label className="sr-only" htmlFor="global-search">
                Search accessible jobs, events, grants
              </label>
              <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                search
              </span>
              <input
                ref={searchRef}
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-150"
                id="global-search"
                placeholder="Search roles, accommodations, hubs... (Ctrl+K)"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && searchQuery) {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                    if (searchRef.current) searchRef.current.focus();
                  }}
                  className="absolute right-2 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
            <button
              type="button"
              onClick={() => {
                setSavedOnly(false);
                setCurrentPage(1);
                setAnnouncement("Browsing all opportunities.");
                if (feedTopRef.current) feedTopRef.current.scrollIntoView({ behavior: "smooth" });
              }}
              aria-current={savedOnly ? undefined : "page"}
              className={`border-b-2 pb-1 font-label-lg text-label-lg inline-flex items-center gap-1.5 ${
                !savedOnly
                  ? "border-primary dark:border-inverse-primary text-primary dark:text-inverse-primary font-bold"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                explore
              </span>
              Browse Opportunities
            </button>
            <button
              type="button"
              onClick={() => {
                setSavedOnly(true);
                setCurrentPage(1);
                setAnnouncement(`Showing ${savedCount} saved opportunities.`);
                if (feedTopRef.current) feedTopRef.current.scrollIntoView({ behavior: "smooth" });
              }}
              aria-current={savedOnly ? "page" : undefined}
              className={`pb-1 font-label-lg text-label-lg inline-flex items-center gap-1.5 border-b-2 ${
                savedOnly
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-on-surface-variant dark:text-inverse-on-surface hover:text-on-surface dark:hover:text-surface-bright transition-colors"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                bookmark
              </span>
              Saved ({savedCount})
            </button>
          </nav>
          <div className="flex items-center gap-3">
            <button
              className="hidden sm:inline-flex items-center gap-2 bg-primary-container text-on-primary font-label-lg text-label-lg px-5 h-11 rounded-xl shadow-sm hover:bg-primary transition-colors duration-150 active:scale-[0.98] font-bold"
              type="button"
              onClick={() => setShowPostModal(true)}
            >
              <span className="material-symbols-outlined text-[20px]">
                add_circle
              </span>
              Post an Opportunity
            </button>
            <div className="relative" ref={profileRef}>
              <button
                aria-label="User Account and Profile"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                className="flex items-center gap-2 p-1.5 rounded-xl border border-outline-variant/80 hover:bg-surface-container-low transition-colors duration-150 active:scale-[0.98]"
                type="button"
                onClick={() => setShowProfileMenu((v) => !v)}
              >
                <img
                  className="w-8 h-8 rounded-lg object-cover border border-outline-variant"
                  alt="User profile"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCs2a8me0OjRU8oc96oLBQYgh_fdvrr3aHWqrrXsu8yrvGNIDJ4-2BpvwLisUIL-__jwV63w_J7xKODs0PWD7sAfcuFczyZ5cCQS2g8yZktGQPUy9FP1xzYFZFToCtMt18flHvDWUDiwc9DxRtlc61a3gc0caUtAIUGCupXjn4MaXRQvWpoCoVBBLZkbBcic76gtEZiJamSwZEc8yURzGJvq56laEiv3Y8OSV3-V6IDmv2Hz549uMJz"
                />
                <span className="material-symbols-outlined text-outline text-[18px] pr-1">
                  keyboard_arrow_down
                </span>
              </button>
              {showProfileMenu && (
                <div
                  role="menu"
                  aria-label="Account menu"
                  className="absolute right-0 mt-2 w-60 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl py-2 z-50"
                >
                  {[
                    { icon: "person", label: "View profile", action: () => showToast("Profile page coming soon in this demo.") },
                    { icon: "bookmark", label: `Saved opportunities (${savedCount})`, action: () => { setSavedOnly(true); setCurrentPage(1); } },
                    { icon: "add_circle", label: "Post an opportunity", action: () => setShowPostModal(true) },
                    { icon: "contrast", label: `${highContrast ? "Disable" : "Enable"} high contrast`, action: () => setHighContrast((v) => !v) },
                    { icon: "format_size", label: `${dyslexiaActive ? "Disable" : "Enable"} dyslexia font`, action: () => setDyslexiaActive((v) => !v) },
                    { icon: "restart_alt", label: "Reset all filters", action: () => resetFilters() },
                  ].map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        item.action();
                        setShowProfileMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{item.icon}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="lg:hidden px-6 pb-3">
          <div className="flex items-center relative">
            <label className="sr-only" htmlFor="global-search-mobile">
              Search accessible jobs, events, grants
            </label>
            <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
              search
            </span>
            <input
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-low border border-outline-variant text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              id="global-search-mobile"
              placeholder="Search roles, accommodations, hubs..."
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 3. HERO & QUICK FILTER PILLS SECTION */}
      <section className="bg-surface-container-lowest border-b border-outline-variant/60 pt-10 pb-8 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="max-w-4xl space-y-3">
            <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-extrabold">
              Discover inclusive jobs, events, and programs.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl">
              Empowering Persons with Disabilities (PWDs) through dignified
              careers, verified accessible spaces, transparent hiring processes,
              and dedicated growth funding.
            </p>
          </div>
          <div
            aria-label="Opportunity categories"
            className="flex items-center gap-2.5 overflow-x-auto pt-2 pb-1 no-scrollbar"
            role="tablist"
          >
            {CATEGORY_DEFS.map((cat) => {
              const count = getCategoryCount(OPPORTUNITIES, cat.id);
              const label = `${cat.label} (${count})`;
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  aria-selected={isActive}
                  role="tab"
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setCurrentPage(1);
                    setAnnouncement(
                      cat.id === "all"
                        ? "Showing all opportunities."
                        : `Filtered to ${cat.label}, ${count} results.`
                    );
                  }}
                  className={`shrink-0 px-4 py-2 rounded-full font-label-md text-label-md transition-all active:scale-[0.98] ${
                    isActive
                      ? "bg-primary text-on-primary font-bold shadow-xs"
                      : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. TWO-COLUMN MAIN CONTENT WORKSPACE */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* LEFT SIDEBAR: FACETED FILTERS */}
          <aside
            aria-label="Filter opportunities"
            className="w-full lg:w-72 flex-shrink-0 bg-surface-container-lowest border border-outline-variant rounded-xl p-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto space-y-6 shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-4">
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">
                    tune
                  </span>
                  Filters
                </h2>
              </div>
              <button
                className="text-primary hover:underline font-label-sm text-label-sm font-semibold"
                type="button"
                onClick={resetFilters}
              >
                Reset
              </button>
            </div>

            <fieldset className="space-y-3">
              <legend className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  work
                </span>
                Opportunity Type
              </legend>
              <div className="space-y-2.5 pt-1">
                {TYPE_OPTIONS.map((t) => {
                  const checked = selectedTypes.includes(t.label);
                  return (
                    <label
                      key={t.label}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        checked={checked}
                        onChange={() => toggleType(t.label)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/30"
                        type="checkbox"
                      />
                      <span className="font-body-sm text-body-sm text-on-surface group-hover:text-primary transition-colors">
                        {t.label}
                      </span>
                      <span className="ml-auto font-label-sm text-label-sm text-outline">
                        {getTypeCount(OPPORTUNITIES, t.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-t border-outline-variant/60 pt-5">
              <legend className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  accessible
                </span>
                Verified Accommodations
              </legend>
              <div className="space-y-2.5 pt-1">
                {ACCOMMODATION_OPTIONS.map((a) => {
                  const checked = selectedAccommodations.includes(a.label);
                  return (
                    <label
                      key={a.label}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <input
                        checked={checked}
                        onChange={() => toggleAccommodation(a.label)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary/30"
                        type="checkbox"
                      />
                      <span className="font-body-sm text-body-sm text-on-surface group-hover:text-primary transition-colors">
                        {a.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3 border-t border-outline-variant/60 pt-5">
              <legend className="font-label-lg text-label-lg text-on-surface font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  home_work
                </span>
                Work Mode
              </legend>
              <div className="space-y-2 pt-1" role="radiogroup" aria-label="Work Mode">
                {WORK_MODE_OPTIONS.map((w) => (
                  <label
                    key={w.value}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <input
                      checked={workMode === w.value}
                      onChange={() => handleWorkMode(w.value)}
                      className="w-4 h-4 text-primary border-outline-variant focus:ring-primary/30"
                      name="work_mode"
                      type="radio"
                    />
                    <span className="font-body-sm text-body-sm text-on-surface group-hover:text-primary">
                      {w.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="pt-4 border-t border-outline-variant/60 space-y-2">
              <button
                className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg font-bold hover:bg-primary-container transition-colors shadow-sm active:scale-[0.98]"
                type="button"
                onClick={applyFilters}
              >
                Apply Filters ({filtered.length})
              </button>
              {savedOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setSavedOnly(false);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-outline-variant font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  Show all (exit Saved view)
                </button>
              )}
            </div>
          </aside>

          {/* RIGHT MAIN FEED */}
          <section
            aria-label="Available opportunities feed"
            className="flex-1 w-full space-y-6"
          >
            <div
              ref={feedTopRef}
              className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 scroll-mt-32"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-headline-sm text-headline-sm font-bold text-on-surface" aria-live="polite">
                  {resultsHeading}
                </span>
                {activeBadges.map((b) => (
                  <span
                    key={b.key}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold"
                  >
                    {b.label}
                    <button
                      aria-label={`Remove filter ${b.label}`}
                      className="hover:text-error transition-colors"
                      type="button"
                      onClick={() => removeBadge(b)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label
                  className="font-label-sm text-label-sm text-on-surface-variant shrink-0"
                  htmlFor="sort-select"
                >
                  Sort By:
                </label>
                <div className="relative">
                  <select
                    className="h-10 pl-3 pr-8 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface font-label-sm text-label-sm font-semibold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                      setAnnouncement(`Sorted by ${e.target.value}.`);
                    }}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {paginated.length === 0 ? (
              <EmptyState
                title={savedOnly ? "No saved opportunities yet" : "No opportunities match your filters"}
                body={
                  savedOnly
                    ? "Tap the bookmark icon on any opportunity to save it here for quick access."
                    : "Try broadening your search, removing an accommodation filter, or choosing a different category."
                }
                onReset={resetFilters}
              />
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {paginated.map((card) => (
                  <OpportunityCard
                    key={card.id}
                    card={card}
                    bookmarked={!!bookmarked[card.id]}
                    onToggleBookmark={() => handleToggleBookmark(card.id, card.title)}
                    onViewDetails={() => openDetails(card)}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex items-center gap-2" role="navigation" aria-label="Pagination">
                <button
                  className={`px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md ${
                    safePage <= 1
                      ? "bg-surface-container-low text-outline cursor-not-allowed"
                      : "bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-semibold"
                  }`}
                  disabled={safePage <= 1}
                  type="button"
                  onClick={() => goToPage(safePage - 1)}
                >
                  Previous
                </button>
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    aria-current={p === safePage ? "page" : undefined}
                    aria-label={`Go to page ${p}`}
                    className={`px-3.5 py-2 rounded-lg font-label-md text-label-md ${
                      p === safePage
                        ? "bg-primary text-on-primary font-bold shadow-xs"
                        : "border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface"
                    }`}
                    type="button"
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className={`px-4 py-2 rounded-lg border border-outline-variant font-label-md text-label-md font-semibold ${
                    safePage >= totalPages
                      ? "bg-surface-container-low text-outline cursor-not-allowed"
                      : "bg-surface-container-lowest hover:bg-surface-container-low text-on-surface"
                  }`}
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => goToPage(safePage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
            <p className="text-center font-body-sm text-body-sm text-on-surface-variant" aria-live="polite">
              Page {safePage} of {totalPages} · {sorted.length} {sorted.length === 1 ? "result" : "results"}
              {debouncedQuery ? ` for “${debouncedQuery}”` : ""}
            </p>
          </section>
        </div>
      </main>

      {/* 5. FOOTER */}
      <footer className="w-full bg-surface-container-low dark:bg-inverse-surface border-t border-outline-variant dark:border-outline mt-auto">
        <div className="max-w-7xl mx-auto py-12 px-6 space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="font-headline-sm text-headline-sm font-bold text-primary dark:text-inverse-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">
                  accessible_forward
                </span>
                AccessAble
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 max-w-md">
                The national career &amp; development bridge uniting ambitious
                persons with disabilities with certified inclusive
                organizations.
              </p>
            </div>
            <nav
              aria-label="Footer navigation links"
              className="flex flex-wrap gap-x-6 gap-y-2 font-label-md text-label-md"
            >
              {FOOTER_LINKS.map((l) => (
                <a
                  key={l}
                  className="text-on-surface-variant dark:text-inverse-on-surface hover:text-primary dark:hover:text-inverse-primary underline transition-colors duration-150"
                  href={`#footer-${l.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setFooterLink(l);
                  }}
                >
                  {l}
                </a>
              ))}
            </nav>
          </div>
          <div className="pt-6 border-t border-outline-variant/60 flex flex-col sm:flex-row items-center justify-between gap-4 font-body-sm text-body-sm text-on-surface-variant">
            <p>© 2025 AccessAble. Designed for radical accessibility and empowerment.</p>
            <p className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-tertiary"></span>
              WCAG 2.2 Level AAA Certified Architecture
            </p>
          </div>
        </div>
      </footer>

      {selectedCard && (
        <OpportunityDetailModal
          card={selectedCard}
          bookmarked={!!bookmarked[selectedCard.id]}
          onToggleBookmark={() => handleToggleBookmark(selectedCard.id, selectedCard.title)}
          onClose={closeDetails}
        />
      )}
      {showPostModal && <PostOpportunityModal onClose={() => setShowPostModal(false)} />}
      {footerLink && <FooterDialog link={footerLink} onClose={() => setFooterLink(null)} />}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] bg-on-surface text-surface-container-lowest px-5 py-3 rounded-xl shadow-xl font-body-sm text-body-sm flex items-center gap-2 max-w-[90vw]"
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span className="truncate">{toast}</span>
        </div>
      )}
      <span className="hidden">{detailBookmarkedTick}</span>
    </div>
  );
}

/* ==================================================================
 * SMALL-DEVICE VARIANT — same visual system, fully functional.
 * ================================================================== */

const MOBILE_CATEGORIES = [
  { id: "all", label: "All Opportunities", icon: "apps", iconClass: "" },
  { id: "jobs", label: "Jobs & Internships", icon: "work", iconClass: "text-primary" },
  { id: "events", label: "Events & Webinars", icon: "event", iconClass: "text-tertiary-container" },
  { id: "grants", label: "Grants & Funding", icon: "payments", iconClass: "text-on-secondary-fixed-variant" },
  { id: "training", label: "Training & Scholarships", icon: "school", iconClass: "text-primary" },
];

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpoint
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    if (typeof window.matchMedia !== "function") {
      window.addEventListener("resize", onResize);
      onResize();
      return () => window.removeEventListener("resize", onResize);
    }
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [breakpoint]);

  return isMobile;
}

function MobileCard({ card, bookmarked, onToggleBookmark, onViewDetails, bookmarkBtnClass }) {
  return (
    <article className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant shadow-sm hover:shadow-md transition-shadow relative space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-bold bg-primary-container text-on-primary">
          {card.badge}
        </span>
        <span className="inline-flex items-center text-[11px] font-semibold text-on-surface-variant text-right">
          {card.deadline}
        </span>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center shrink-0 border border-outline-variant/50 text-primary text-[14px] font-bold">
          {getOrgInitials(card.org)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">
            {card.title}
          </h3>
          <p className="font-label-sm text-label-sm mt-0.5 text-on-surface-variant">
            <span className="font-bold text-on-surface">{card.org}</span>
            <span> • {card.location}</span>
          </p>
        </div>
      </div>
      <div className="pt-1">
        <p className="sr-only">Accessibility features:</p>
        <div className="flex flex-wrap gap-1" role="list">
          {(card.pills || []).slice(0, 4).map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant border border-outline-variant/60"
              role="listitem"
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-surface-container">
        <button
          aria-label={`Save ${card.title} to bookmarks`}
          aria-pressed={!!bookmarked}
          className={bookmarkBtnClass(!!bookmarked)}
          type="button"
          onClick={onToggleBookmark}
        >
          <span
            className="material-symbols-outlined text-[20px]"
            style={bookmarked ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            bookmark
          </span>
        </button>
        <button
          onClick={onViewDetails}
          aria-label={`View details for ${card.title}`}
          className="flex-1 h-10 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center justify-center gap-1.5 hover:bg-primary active:scale-[0.98] transition-all shadow-sm"
          type="button"
        >
          <span>View Details</span>
          <span className="material-symbols-outlined text-[16px]">
            arrow_forward
          </span>
        </button>
      </div>
    </article>
  );
}

function Sheet({ title, onClose, children, labelledById }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface-container-lowest rounded-t-3xl border-t border-x border-outline-variant shadow-2xl"
      >
        <div className="sticky top-0 bg-surface-container-lowest/95 backdrop-blur px-5 pt-3 pb-4 border-b border-outline-variant/60">
          <div className="mx-auto w-10 h-1 rounded-full bg-outline-variant mb-3" aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <h2 id={labelledById} className="font-headline-sm text-headline-sm font-bold text-on-surface">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="w-10 h-10 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function HomeMobile() {
  const { highContrast, setHighContrast, dyslexiaActive, setDyslexiaActive, fontScale, setFontScale } =
    useA11yPrefs();
  const isHighContrast = highContrast;
  const isDyslexia = dyslexiaActive;
  const { bookmarked, toggleBookmark: toggleBookmarkStored, savedCount } = useBookmarks();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 200);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [appliedTypes, setAppliedTypes] = useState([]);
  const [appliedAccommodations, setAppliedAccommodations] = useState([]);
  const [appliedWorkMode, setAppliedWorkMode] = useState("all");
  const [draftTypes, setDraftTypes] = useState([]);
  const [draftAccommodations, setDraftAccommodations] = useState([]);
  const [draftWorkMode, setDraftWorkMode] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("browse");
  const [visibleCount, setVisibleCount] = useState(MOBILE_INITIAL_COUNT);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [announcement, setAnnouncement] = useState(
    "AccessAble home page loaded. High contrast and font scaling tools available at top."
  );

  const announce = useCallback((msg) => setAnnouncement(msg), []);

  const increaseFont = () => {
    setFontScale((prev) => {
      const next = Math.min(140, clampFontScale(prev) + 10);
      if (next !== clampFontScale(prev)) setAnnouncement(`Text size set to ${next} percent.`);
      return next;
    });
  };

  const decreaseFont = () => {
    setFontScale((prev) => {
      const next = Math.max(90, clampFontScale(prev) - 10);
      if (next !== clampFontScale(prev)) setAnnouncement(`Text size set to ${next} percent.`);
      return next;
    });
  };

  const handleContrast = () => {
    setHighContrast((prev) => {
      setAnnouncement(prev ? "High contrast mode disabled." : "High contrast mode enabled.");
      return !prev;
    });
  };

  const handleDyslexia = () => {
    setDyslexia((prev) => {
      setAnnouncement(prev ? "Default system font restored." : "Dyslexia friendly font activated.");
      return !prev;
    });
  };

  const setDyslexia = setDyslexiaActive;

  const handleToggleBookmark = (id, label) => {
    const willSave = !bookmarked[id];
    toggleBookmarkStored(id);
    announce(willSave ? `${label} saved to bookmarks.` : `${label} removed from bookmarks.`);
  };

  const bookmarkBtnClass = (active) =>
    `w-10 h-10 flex items-center justify-center rounded-lg border border-outline-variant transition-all active:scale-95 ${
      active
        ? "bg-primary-container text-on-primary border-transparent"
        : "text-on-surface hover:bg-surface-container"
    }`;

  const filtered = useMemo(
    () =>
      filterOpportunities(OPPORTUNITIES, {
        query: debouncedQuery,
        category: activeCategory,
        types: appliedTypes,
        accommodations: appliedAccommodations,
        workMode: appliedWorkMode,
        savedOnly,
        bookmarked,
      }),
    [debouncedQuery, activeCategory, appliedTypes, appliedAccommodations, appliedWorkMode, savedOnly, bookmarked]
  );
  const sorted = useMemo(() => sortOpportunities(filtered, sortBy), [filtered, sortBy]);
  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);

  useEffect(() => {
    setVisibleCount(MOBILE_INITIAL_COUNT);
  }, [debouncedQuery, activeCategory, appliedTypes, appliedAccommodations, appliedWorkMode, sortBy, savedOnly]);

  const openFilterSheet = () => {
    setDraftTypes(appliedTypes);
    setDraftAccommodations(appliedAccommodations);
    setDraftWorkMode(appliedWorkMode);
    setShowFilterSheet(true);
  };

  const applySheetFilters = () => {
    setAppliedTypes(draftTypes);
    setAppliedAccommodations(draftAccommodations);
    setAppliedWorkMode(draftWorkMode);
    setShowFilterSheet(false);
    announce(`Filters applied. ${filterOpportunities(OPPORTUNITIES, {
      query: debouncedQuery,
      category: activeCategory,
      types: draftTypes,
      accommodations: draftAccommodations,
      workMode: draftWorkMode,
      savedOnly,
      bookmarked,
    }).length} opportunities found.`);
  };

  const resetSheetFilters = () => {
    setDraftTypes([]);
    setDraftAccommodations([]);
    setDraftWorkMode("all");
    setAppliedTypes([]);
    setAppliedAccommodations([]);
    setAppliedWorkMode("all");
    setSearchQuery("");
    setActiveCategory("all");
    setSavedOnly(false);
    setActiveTab("browse");
    announce("All mobile filters cleared.");
  };

  const goBrowse = () => {
    setActiveTab("browse");
    setSavedOnly(false);
    announce("Browsing all opportunities.");
    try {
      document.getElementById("main-content")?.scrollIntoView({ behavior: "smooth" });
    } catch {
      // ignore
    }
  };

  const goSaved = () => {
    setActiveTab("saved");
    setSavedOnly(true);
    announce(`Showing ${savedCount} saved opportunities.`);
    try {
      document.getElementById("main-content")?.scrollIntoView({ behavior: "smooth" });
    } catch {
      // ignore
    }
  };

  const goPost = () => {
    setActiveTab("post");
    setShowPostModal(true);
  };

  const resultsHeading = savedOnly
    ? `${sorted.length} Saved ${sorted.length === 1 ? "Opportunity" : "Opportunities"}`
    : `${sorted.length} ${sorted.length === 1 ? "Opportunity" : "Opportunities"} Available Now`;

  return (
    <div className="bg-background text-on-surface font-body-md text-body-md antialiased min-h-screen pb-24 transition-colors duration-200 home-mobile-canvas w-full max-w-[100vw] overflow-x-clip">
      {/* Accessibility Announcement Region for Screen Readers */}
      <div aria-live="polite" className="sr-only" id="a11y-status-announcer">
        {announcement}
      </div>

      <div className="w-full max-w-md mx-auto min-h-screen bg-background relative flex flex-col min-w-0 overflow-x-clip">
        {/* 1. PERSISTENT TOP ACCESSIBILITY TOOLBAR */}
        <header className="sticky top-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-sm">
          <div className="px-3 py-1.5 flex items-center justify-between gap-1 text-on-surface">
            {/* High Contrast Quick Toggle */}
            <button
              aria-pressed={isHighContrast}
              className={`flex items-center gap-1.5 px-2.5 h-10 rounded-lg hover:bg-surface-container transition-colors active:scale-95 text-on-surface ${
                isHighContrast ? "bg-primary-container text-on-primary" : ""
              }`}
              title="Toggle High Contrast Mode"
              type="button"
              onClick={handleContrast}
            >
              <span className="material-symbols-outlined text-[20px]">contrast</span>
              <span className="font-label-sm text-label-sm font-semibold">Contrast</span>
            </button>

            {/* Font Size Scaler [ A- | A+ ] */}
            <div
              aria-label="Text size controls"
              className="flex items-center bg-surface-container-low rounded-lg p-0.5"
              role="group"
            >
              <button
                aria-label="Decrease text size"
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm font-bold active:scale-95"
                title="Decrease font size"
                type="button"
                onClick={decreaseFont}
              >
                A-
              </button>
              <span
                aria-label="Current text size"
                className="px-1.5 font-label-sm text-label-sm font-bold text-primary select-none"
              >
                {fontScale}%
              </span>
              <button
                aria-label="Increase text size"
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface font-headline-sm text-headline-sm font-bold active:scale-95"
                title="Increase font size"
                type="button"
                onClick={increaseFont}
              >
                A+
              </button>
            </div>

            {/* Dyslexia Font Toggle */}
            <button
              aria-pressed={isDyslexia}
              className={`flex items-center gap-1 px-2.5 h-10 rounded-lg hover:bg-surface-container transition-colors active:scale-95 text-on-surface ${
                isDyslexia ? "bg-primary-container text-on-primary" : ""
              }`}
              title="Toggle Dyslexia Friendly Font"
              type="button"
              onClick={handleDyslexia}
            >
              <span className="material-symbols-outlined text-[20px]">spellcheck</span>
              <span className="font-label-sm text-label-sm font-semibold">Dyslexia</span>
            </button>
          </div>

          {/* MAIN APP TOP APP BAR */}
          <div className="flex justify-between items-center w-full px-4 h-16 max-w-md mx-auto bg-surface-container-lowest dark:bg-inverse-surface shadow-sm dark:shadow-none">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={goBrowse}
                aria-label="AccessAble home — browse opportunities"
                className="text-headline-md font-headline-md font-bold text-primary dark:text-inverse-primary tracking-tight"
              >
                AccessAble
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                aria-label="Inclusive settings and profile"
                aria-haspopup="dialog"
                className="w-12 h-12 flex items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed hover:bg-surface-container dark:hover:bg-surface-container-highest transition-colors active:scale-95"
                type="button"
                onClick={() => setShowProfileSheet(true)}
              >
                <span className="material-symbols-outlined text-[24px]">
                  accessibility_new
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* MAIN SCROLLABLE CONTENT CANVAS */}
        <main className="flex-1 px-4 pt-4 pb-8 space-y-5 min-w-0 w-full max-w-full overflow-x-clip" id="main-content">
          {/* 2. HERO & VALUE PROPOSITION */}
          <section className="space-y-3 min-w-0 w-full max-w-full overflow-x-clip">
            <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/60">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h1 className="font-headline-xl-mobile text-headline-xl-mobile font-bold text-on-surface leading-tight">
                    Discover inclusive jobs, events, and programs.
                  </h1>
                </div>
              </div>
              <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                Empowering Persons with Disabilities (PWDs) through dignified careers,
                verified accessible spaces, and dedicated funding.
              </p>
            </div>

            {/* ACCESSIBLE SEARCH INPUT BAR */}
            <form className="relative" role="search" onSubmit={(e) => e.preventDefault()}>
              <label className="sr-only" htmlFor="accessible-search">
                Search by title, skill, or organization
              </label>
              <div className="relative flex items-center">
                <span
                  aria-hidden="true"
                  className="absolute left-3.5 flex items-center pointer-events-none text-on-surface-variant"
                >
                  <span className="material-symbols-outlined text-[24px]">search</span>
                </span>
                <input
                  className="w-full h-[52px] pl-11 pr-24 rounded-2xl bg-surface-container-lowest border border-outline-variant font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/80 focus:border-primary-container focus:ring-0 transition-all shadow-sm"
                  id="accessible-search"
                  placeholder="Search by title, skill, or organization..."
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute right-1.5 flex items-center gap-1">
                  <button
                    aria-label="Clear search input"
                    className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-xl active:scale-95"
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      announce("Search cleared.");
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                  </button>
                  <button
                    aria-label="Open accessibility accommodations filter"
                    aria-haspopup="dialog"
                    className="w-10 h-10 flex items-center justify-center bg-primary-fixed text-on-primary-fixed rounded-xl hover:bg-primary-fixed-dim active:scale-95 transition-transform"
                    type="button"
                    onClick={openFilterSheet}
                  >
                    <span className="material-symbols-outlined text-[20px]">tune</span>
                  </button>
                </div>
              </div>
            </form>

            {/* HORIZONTAL SCROLLABLE CATEGORY PILLS */}
            <nav
              aria-label="Opportunity Categories"
              className="relative -mx-4 px-4 overflow-x-auto no-scrollbar flex items-center gap-2 py-1 w-full max-w-full"
            >
              {MOBILE_CATEGORIES.map((cat) => {
                const isActive = cat.id === activeCategory;
                const count = getCategoryCount(OPPORTUNITIES, cat.id);
                return (
                  <button
                    key={cat.id}
                    aria-pressed={isActive}
                    aria-label={`${cat.label}, ${count} opportunities`}
                    className={
                      isActive
                        ? "h-10 px-4 rounded-full bg-primary-container text-on-primary font-label-md text-label-md font-bold flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
                        : "h-10 px-4 rounded-full bg-surface-container-lowest text-on-surface font-label-md text-label-md font-semibold border border-outline-variant flex items-center gap-1.5 shrink-0 hover:bg-surface-container active:scale-95 transition-all"
                    }
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.id);
                      announce(
                        cat.id === "all"
                          ? "Showing all opportunities."
                          : `Filtered to ${cat.label}, ${count} results.`
                      );
                    }}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${cat.iconClass}`}>
                      {cat.icon}
                    </span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </nav>
            {(appliedTypes.length > 0 || appliedAccommodations.length > 0 || appliedWorkMode !== "all" || savedOnly) && (
              <div className="flex flex-wrap gap-1.5" aria-label="Active mobile filters">
                {appliedTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setAppliedTypes((prev) => prev.filter((x) => x !== t));
                      announce(`Removed filter ${t}.`);
                    }}
                    aria-label={`Remove filter ${t}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container"
                  >
                    {t} ×
                  </button>
                ))}
                {appliedAccommodations.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setAppliedAccommodations((prev) => prev.filter((x) => x !== a));
                      announce(`Removed filter ${a}.`);
                    }}
                    aria-label={`Remove filter ${a}`}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container"
                  >
                    {a} ×
                  </button>
                ))}
                {appliedWorkMode !== "all" && (
                  <button
                    type="button"
                    onClick={() => setAppliedWorkMode("all")}
                    aria-label="Remove work mode filter"
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container"
                  >
                    {WORK_MODE_OPTIONS.find((w) => w.value === appliedWorkMode)?.label} ×
                  </button>
                )}
                {savedOnly && (
                  <button
                    type="button"
                    onClick={goBrowse}
                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary text-on-primary"
                  >
                    Saved only ×
                  </button>
                )}
                <button
                  type="button"
                  onClick={resetSheetFilters}
                  className="inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border border-outline-variant text-on-surface"
                >
                  Reset all
                </button>
              </div>
            )}
          </section>

          {/* 3. OPPORTUNITIES FEED */}
          <section aria-labelledby="feed-heading" className="space-y-4 pt-1 min-w-0 w-full max-w-full overflow-x-clip">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center min-w-0 flex-1">
                <h2
                  className="font-headline-sm text-headline-sm font-bold text-on-surface"
                  id="feed-heading"
                >
                  {resultsHeading}
                </h2>
              </div>
              <button
                aria-haspopup="listbox"
                aria-label={`Sort opportunities, currently sorted by ${sortBy}`}
                className="h-9 px-3 rounded-full bg-surface-container text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm font-bold flex items-center gap-1 active:scale-95 transition-all shrink-0"
                type="button"
                onClick={() => setShowSortSheet(true)}
              >
                <span>{sortBy}</span>
                <span className="material-symbols-outlined text-[16px]">
                  arrow_drop_down
                </span>
              </button>
            </div>

            <div className="space-y-4 min-w-0 w-full max-w-full">
              {visible.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-xl p-6 border border-dashed border-outline-variant text-center space-y-2">
                  <p className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {savedOnly ? "No saved opportunities yet" : "No matches found"}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {savedOnly
                      ? "Tap the bookmark icon on any card to save it here."
                      : "Try a different keyword, category, or clear your filters."}
                  </p>
                  <button
                    type="button"
                    onClick={resetSheetFilters}
                    className="mt-2 h-10 px-5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-bold"
                  >
                    Clear search &amp; filters
                  </button>
                </div>
              ) : (
                visible.map((card) => (
                  <MobileCard
                    key={card.id}
                    card={card}
                    bookmarked={!!bookmarked[card.id]}
                    onToggleBookmark={() => handleToggleBookmark(card.id, card.title)}
                    onViewDetails={() => setSelectedCard(card)}
                    bookmarkBtnClass={bookmarkBtnClass}
                  />
                ))
              )}
            </div>

            {visibleCount < sorted.length && (
              <button
                type="button"
                onClick={() => {
                  setVisibleCount((c) => c + MOBILE_PAGE_STEP);
                  announce(`Showing ${Math.min(visibleCount + MOBILE_PAGE_STEP, sorted.length)} of ${sorted.length} opportunities.`);
                }}
                className="w-full h-11 rounded-xl border border-outline-variant bg-surface-container-lowest font-label-md text-label-md font-bold text-primary hover:bg-surface-container-low active:scale-[0.99]"
              >
                Load more ({sorted.length - visibleCount} remaining)
              </button>
            )}
            <p className="text-center font-label-sm text-label-sm text-on-surface-variant" aria-live="polite">
              Showing {visible.length} of {sorted.length}
              {debouncedQuery ? ` for “${debouncedQuery}”` : ""}
            </p>
          </section>
        </main>

        {/* 4. BOTTOM NAVIGATION BAR */}
        <nav
          aria-label="Mobile Bottom Navigation"
          className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-2 max-w-md mx-auto right-0 bg-surface-container-lowest dark:bg-inverse-surface shadow-lg dark:shadow-none"
        >
          <button
            aria-current={activeTab === "browse" && !savedOnly ? "page" : undefined}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] rounded-xl px-3 py-1 active:scale-95 transition-transform duration-150 ${
              activeTab === "browse" && !savedOnly
                ? "bg-primary-container text-on-primary"
                : "text-on-surface-variant px-3 py-1 hover:bg-surface-container"
            }`}
            type="button"
            onClick={goBrowse}
          >
            <span
              className="material-symbols-outlined text-[22px]"
              style={activeTab === "browse" && !savedOnly ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              explore
            </span>
            <span className="text-label-sm font-label-sm mt-0.5">Browse</span>
          </button>
          <button
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-1 transition-colors active:scale-95 duration-150 rounded-xl ${
              showPostModal
                ? "bg-primary-container text-on-primary"
                : "text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-highest"
            }`}
            type="button"
            onClick={goPost}
          >
            <span className="material-symbols-outlined text-[22px]">add_circle</span>
            <span className="text-label-sm font-label-sm mt-0.5">Post</span>
          </button>
          <button
            aria-current={savedOnly ? "page" : undefined}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-3 py-1 transition-colors active:scale-95 duration-150 rounded-xl relative ${
              savedOnly
                ? "bg-primary-container text-on-primary"
                : "text-on-surface-variant dark:text-outline-variant hover:bg-surface-container dark:hover:bg-surface-container-highest"
            }`}
            type="button"
            onClick={goSaved}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">bookmark</span>
              <span className="absolute -top-1 -right-2 bg-primary text-on-primary text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {savedCount}
              </span>
            </div>
            <span className="text-label-sm font-label-sm mt-0.5">Saved</span>
          </button>
        </nav>
      </div>

      {showFilterSheet && (
        <Sheet title={`Filters (${filtered.length} results)`} onClose={() => setShowFilterSheet(false)} labelledById="mobile-filter-title">
          <div className="space-y-5">
            <fieldset>
              <legend className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Opportunity type</legend>
              <div className="space-y-2">
                {TYPE_OPTIONS.map((t) => {
                  const checked = draftTypes.includes(t.label);
                  return (
                    <label key={t.label} className="flex items-center gap-3 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraftTypes((prev) =>
                            prev.includes(t.label) ? prev.filter((x) => x !== t.label) : [...prev, t.label]
                          )
                        }
                        className="w-5 h-5 rounded text-primary"
                      />
                      <span className="font-body-md text-body-md text-on-surface flex-1">{t.label}</span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">
                        {getTypeCount(OPPORTUNITIES, t.label)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Verified accommodations</legend>
              <div className="space-y-2">
                {ACCOMMODATION_OPTIONS.map((a) => {
                  const checked = draftAccommodations.includes(a.label);
                  return (
                    <label key={a.label} className="flex items-center gap-3 py-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraftAccommodations((prev) =>
                            prev.includes(a.label) ? prev.filter((x) => x !== a.label) : [...prev, a.label]
                          )
                        }
                        className="w-5 h-5 rounded text-primary"
                      />
                      <span className="font-body-md text-body-md text-on-surface">{a.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Work mode</legend>
              <div className="space-y-2" role="radiogroup" aria-label="Work mode">
                {WORK_MODE_OPTIONS.map((w) => (
                  <label key={w.value} className="flex items-center gap-3 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mobile-work-mode"
                      checked={draftWorkMode === w.value}
                      onChange={() => setDraftWorkMode(w.value)}
                      className="w-5 h-5 text-primary"
                    />
                    <span className="font-body-md text-body-md text-on-surface">{w.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="font-label-lg text-label-lg font-bold text-on-surface mb-2">Sort by</legend>
              <div className="space-y-2" role="radiogroup" aria-label="Sort by">
                {SORT_OPTIONS.map((o) => (
                  <label key={o} className="flex items-center gap-3 py-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mobile-sort-inline"
                      checked={sortBy === o}
                      onChange={() => {
                        setSortBy(o);
                        announce(`Sorted by ${o}.`);
                      }}
                      className="w-5 h-5 text-primary"
                    />
                    <span className="font-body-md text-body-md text-on-surface">{o}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={resetSheetFilters}
                className="flex-1 h-11 rounded-xl border border-outline-variant font-label-md text-label-md font-bold text-on-surface"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={applySheetFilters}
                className="flex-[2] h-11 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold"
              >
                Show results
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {showSortSheet && (
        <Sheet title="Sort opportunities" onClose={() => setShowSortSheet(false)} labelledById="mobile-sort-title">
          <div role="listbox" aria-label="Sort options" className="space-y-1">
            {SORT_OPTIONS.map((o) => {
              const selected = sortBy === o;
              return (
                <button
                  key={o}
                  role="option"
                  aria-selected={selected}
                  type="button"
                  onClick={() => {
                    setSortBy(o);
                    setShowSortSheet(false);
                    announce(`Sorted by ${o}.`);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left font-body-md text-body-md ${
                    selected ? "bg-primary-container text-on-primary font-bold" : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  {o}
                  {selected && <span className="material-symbols-outlined text-[20px]">check</span>}
                </button>
              );
            })}
          </div>
        </Sheet>
      )}

      {showProfileSheet && (
        <Sheet title="Profile & accessibility" onClose={() => setShowProfileSheet(false)} labelledById="mobile-profile-title">
          <div className="space-y-2">
            {[
              { icon: "bookmark", label: `Saved opportunities (${savedCount})`, fn: () => { goSaved(); setShowProfileSheet(false); } },
              { icon: "add_circle", label: "Post an opportunity", fn: () => { goPost(); setShowProfileSheet(false); } },
              { icon: "contrast", label: `${isHighContrast ? "Disable" : "Enable"} high contrast`, fn: handleContrast },
              { icon: "spellcheck", label: `${isDyslexia ? "Disable" : "Enable"} dyslexia font`, fn: handleDyslexia },
              { icon: "text_increase", label: `Text size ${fontScale}% — increase`, fn: increaseFont },
              { icon: "text_decrease", label: "Decrease text size", fn: decreaseFont },
              { icon: "restart_alt", label: "Reset all filters", fn: () => { resetSheetFilters(); setShowProfileSheet(false); } },
            ].map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={row.fn}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-body-md text-body-md text-on-surface hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[22px] text-on-surface-variant">{row.icon}</span>
                {row.label}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {selectedCard && (
        <OpportunityDetailModal
          card={selectedCard}
          bookmarked={!!bookmarked[selectedCard.id]}
          onToggleBookmark={() => handleToggleBookmark(selectedCard.id, selectedCard.title)}
          onClose={() => setSelectedCard(null)}
        />
      )}
      {showPostModal && <PostOpportunityModal onClose={() => { setShowPostModal(false); setActiveTab(savedOnly ? "saved" : "browse"); }} />}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Responsive dispatcher — preserves the desktop HomeDesktop above and
 * renders HomeMobile ONLY for small devices.
 * Double-guard: JS (matchMedia + width check) + CSS (md:hidden /
 * hidden md:block) so the wrong variant can never be visible.
 * Breakpoint: < 768px (Tailwind `md`) => mobile.
 * ------------------------------------------------------------------ */
function Home() {
  const isMobile = useIsMobile(768);

  if (isMobile) {
    return (
      <div className="md:hidden">
        <HomeMobile />
      </div>
    );
  }

  return (
    <div className="hidden md:block">
      <HomeDesktop />
    </div>
  );
}

export default Home;
