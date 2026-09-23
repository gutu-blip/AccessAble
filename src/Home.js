/* eslint-disable jsx-a11y/anchor-is-valid -- href="#" anchors kept verbatim from Home.html for 1:1 UI fidelity */
/* eslint-disable jsx-a11y/anchor-is-valid -- href="#" anchors kept verbatim from Home.html for 1:1 UI fidelity */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Details from './Details';
import SubmissionForm from './SubmissionForm';
import {
  ACCESSIBILITY_FEATURE_KEYS,
  INITIAL_OPPORTUNITY_FORM,
  deleteOpportunity,
  opportunityToFormValues,
  submitOpportunity,
  subscribeOpportunities,
  updateOpportunity,
  validateOpportunityForm,
} from './services/opportunities';
import { onValue, ref as dbRef, remove as dbRemove, set as dbSet } from 'firebase/database';
import { db } from './firebase';

/* ------------------------------------------------------------------
 * Home — React port of src/Home.html.
 * Every Tailwind className below is verbatim from the HTML version, and
 * tailwind.config.js tokens were aligned with the HTML <script
 * id="tailwind-config"> so the rendered UI matches pixel-for-pixel.
 * State only drives behaviour (search / filters / sort / bookmarks /
 * pagination / a11y toggles); default state reproduces the HTML exactly.
 * ------------------------------------------------------------------ */

// Exact <style> block from Home.html <head> (base reset + hidden scrollbar).
const FIDELITY_STYLES = `@layer base{html,body{margin:0;padding:0;}body{overscroll-behavior:none;}main>:first-child{margin-top:0!important;}main>:last-child{margin-bottom:0!important;}}::-webkit-scrollbar{display:none;}`;

const A11Y_BTN =
  'p-1.5 rounded-full hover:bg-surface-container hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container transition-all';
const ACTIVE_A11Y_BTN = `${A11Y_BTN} bg-secondary-container text-on-secondary-fixed`;

const QUICK_FILTER =
  'px-space-md py-2 rounded-full font-label-md text-label-md text-on-surface bg-surface-container-low hover:bg-surface-container transition-colors whitespace-nowrap flex items-center gap-1.5';
const ACTIVE_QUICK_FILTER =
  'px-space-md py-2 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary shadow-sm whitespace-nowrap';

const QUICK_FILTERS = [
  { label: 'All Opportunities', icon: null, iconClass: null },
  { label: 'Screen Reader Verified', icon: 'visibility', iconClass: 'text-primary' },
  { label: 'ASL Fluent / Provided', icon: 'sign_language', iconClass: 'text-secondary' },
  { label: 'Wheelchair Accessible', icon: 'accessible', iconClass: 'text-primary' },
  { label: '100% Remote', icon: 'home_work', iconClass: 'text-secondary' },
  { label: 'Neurodiversity Friendly', icon: 'psychology', iconClass: 'text-primary' },
  { label: 'Assistive Tech Provided', icon: 'devices', iconClass: 'text-secondary' },
];

const SORT_OPTIONS = ['Most Relevant', 'Newest', 'Highest Accommodation Match', 'Salary (High to Low)'];

// Mobile-only constants — converted verbatim from HomeMobile.html
const MOBILE_SORT_OPTIONS = ['Most Relevant', 'Newest', 'Highest Accommodation'];

const MOBILE_QUICK_PILLS = [
  { label: 'All Opportunities', icon: 'all_inclusive', iconClass: null },
  { label: 'Screen Reader Verified', icon: 'visibility', iconClass: 'text-secondary' },
  { label: 'ASL Interpreters', icon: 'sign_language', iconClass: 'text-primary' },
  { label: 'Wheelchair Accessible', icon: 'accessible', iconClass: 'text-secondary' },
  { label: '100% Remote', icon: 'home_work', iconClass: 'text-primary' },
  { label: 'Neurodivergent Friendly', icon: 'psychology', iconClass: 'text-secondary' },
  { label: 'Flexible Hours', icon: 'hourglass_top', iconClass: 'text-primary' },
];

const MOBILE_FILTER_PILLS = [
  { key: 'all', label: 'All Opportunities', icon: 'all_inclusive' },
  { key: 'screen-reader', label: 'Screen Reader Verified', icon: 'visibility', iconClass: 'text-primary', quickKey: 'Screen Reader Verified' },
  { key: 'asl', label: 'ASL Fluent / Provided', icon: 'sign_language', iconClass: 'text-secondary', quickKey: 'ASL Fluent / Provided' },
  { key: 'wheelchair', label: 'Wheelchair Accessible', icon: 'accessible', iconClass: 'text-primary', quickKey: 'Wheelchair Accessible' },
  { key: 'remote', label: '100% Remote', icon: 'home_work', iconClass: 'text-secondary', quickKey: '100% Remote' },
  { key: 'neurodiversity', label: 'Neurodiversity Friendly', icon: 'psychology', iconClass: 'text-primary', quickKey: 'Neurodiversity Friendly' },
  { key: 'assistive-tech', label: 'Assistive Tech Provided', icon: 'devices', iconClass: 'text-secondary', quickKey: 'Assistive Tech Provided' },
];

const PAGE_SIZE = 6;

// Category metadata for the RTDB `basic.category` enum:
// job | event | grant | training | public (aid alias)
const CATEGORY_META = {
  job: { label: 'Job', icon: 'work' },
  event: { label: 'Event', icon: 'event' },
  grant: { label: 'Grant', icon: 'payments' },
  training: { label: 'Training', icon: 'school' },
  public: { label: 'Public Program', icon: 'campaign' },
  aid: { label: 'Aid', icon: 'volunteer_activism' },
};

// Human labels for the RTDB `accessibility.features` boolean map.
const FEATURE_META = {
  mobility_restrooms: { label: 'Step-free Restrooms', icon: 'accessible' },
  mobility_stepfree: { label: 'Step-free Access', icon: 'accessible' },
  mobility_parking: { label: 'Accessible Parking', icon: 'local_parking' },
  sli_support: { label: 'KSL / ASL Support', icon: 'sign_language' },
  cart_captions: { label: 'CART Captions', icon: 'subtitles' },
  hearing_loop: { label: 'Hearing Loop', icon: 'hearing' },
  screen_reader_docs: { label: 'Screen Reader Verified', icon: 'visibility' },
  braille_materials: { label: 'Braille Materials', icon: 'touch_app' },
  audio_descriptions: { label: 'Audio Descriptions', icon: 'audiotrack' },
  quiet_room: { label: 'Quiet Room', icon: 'volume_off' },
  pre_agenda: { label: 'Agenda in Advance', icon: 'event_note' },
  camera_optional: { label: 'Camera Optional', icon: 'videocam_off' },
};
const FEATURE_ORDER = Object.keys(FEATURE_META);

// Rotate avatar backgrounds so dynamic cards keep the variedDummy look.
const AVATAR_STYLES = [
  'bg-primary-fixed text-on-primary-fixed',
  'bg-secondary-container text-on-secondary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-secondary-container/70 text-on-secondary-fixed',
  'bg-primary-fixed/60 text-primary',
  'bg-secondary text-on-secondary',
];

function getInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'OP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function getCategoryMeta(category) {
  return CATEGORY_META[category] || { label: String(category || 'Opportunity'), icon: 'work' };
}

// "Apply by" vs "Register by" per category:
// job + grant -> Apply; event + training + aid/public -> Register.
function getDeadlineVerb(category) {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === 'event' || normalized === 'training' || normalized === 'public' || normalized === 'aid') {
    return 'Register by';
  }
  return 'Apply by';
}

function getAccommodationPills(opportunity) {
  const features = opportunity?.accessibility?.features || {};
  return FEATURE_ORDER.filter((key) => features[key] === true).map((key) => ({
    key,
    ...FEATURE_META[key],
  }));
}

function countAccommodations(opportunity) {
  const features = opportunity?.accessibility?.features || {};
  return FEATURE_ORDER.reduce((n, key) => n + (features[key] === true ? 1 : 0), 0);
}

function getTimestamp(opportunity) {
  const created = Number(opportunity?.meta?.createdAt);
  if (Number.isFinite(created) && created > 0) return created;
  const submitted = Date.parse(opportunity?.meta?.submittedAt || '');
  return Number.isFinite(submitted) ? submitted : 0;
}

function formatPostedAgo(opportunity) {
  const ts = getTimestamp(opportunity);
  if (!ts) return 'Recently posted';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `Posted ${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Posted ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Posted yesterday';
  if (days < 7) return `Posted ${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Posted ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  const date = new Date(ts);
  return `Posted ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatReadableDate(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function shorten(text, max = 48) {
  const value = String(text || '').trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

function formatLocation(opportunity) {
  const mode = opportunity?.logistics?.deliveryMode;
  const venue = String(opportunity?.logistics?.venueAddress || '').trim();
  if (mode === 'remote') return '100% Remote';
  if (mode === 'hybrid') return venue ? `Hybrid • ${shorten(venue, 42)}` : 'Hybrid';
  if (mode === 'onsite') return venue ? shorten(venue, 48) : 'On-site';
  return venue ? shorten(venue, 48) : 'Location TBD';
}

function formatDeliveryLabel(deliveryMode) {
  if (deliveryMode === 'remote') return 'Remote';
  if (deliveryMode === 'hybrid') return 'Hybrid';
  if (deliveryMode === 'onsite') return 'On-site';
  return deliveryMode ? String(deliveryMode) : '';
}

// Numeric value used for "Salary (High to Low)" sorting. "Free" -> 0,
// missing/unparseable -> -1 so it sorts last.
function parseCompensationValue(compensation) {
  const text = String(compensation || '').trim().toLowerCase();
  if (!text) return -1;
  if (text === 'free') return 0;
  const matches = text.replace(/,/g, '').match(/\d+(\.\d+)?/g);
  if (!matches) return -1;
  return Math.max(...matches.map(Number));
}

// Lowercase search corpus built from every user-facing schema field, plus
// synthetic keywords so the quick-filter pills keep working on live data.
function buildHaystack(opportunity) {
  const features = opportunity?.accessibility?.features || {};
  const notes = opportunity?.accessibility?.notes || {};
  const parts = [
    opportunity?.basic?.title,
    opportunity?.basic?.organization?.name,
    opportunity?.basic?.organization?.website,
    opportunity?.basic?.category,
    opportunity?.logistics?.deliveryMode,
    opportunity?.logistics?.venueAddress,
    opportunity?.logistics?.compensation,
    opportunity?.logistics?.applicationDeadline,
    opportunity?.logistics?.startDate,
    opportunity?.details?.descriptionMarkdown,
    opportunity?.details?.applicationUrl,
    Object.values(notes).filter(Boolean).join(' '),
    Object.entries(features)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => `${key.replace(/_/g, ' ')} ${FEATURE_META[key]?.label || ''}`)
      .join(' '),
  ];
  if (features.screen_reader_docs) parts.push('screen reader nvda jaws magnifier');
  if (features.sli_support) parts.push('asl sign language deaf ksl');
  if (features.mobility_stepfree || features.mobility_restrooms || features.mobility_parking) {
    parts.push('wheelchair step-free mobility accessible parking restrooms');
  }
  if (opportunity?.logistics?.deliveryMode === 'remote') parts.push('remote');
  if (features.quiet_room || features.camera_optional || features.pre_agenda) {
    parts.push('neurodivergent neurodiversity autistic sensory quiet asynchronous flexible');
  }
  if (features.audio_descriptions || features.cart_captions || features.braille_materials || features.hearing_loop) {
    parts.push('ergonomic speech-to-text captioning transcription relay contrast assistive tech captions');
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

const QUICK_FILTER_KEYWORDS = {
  'All Opportunities': null,
  'Screen Reader Verified': ['screen reader', 'nvda', 'jaws', 'magnifier'],
  'ASL Fluent / Provided': ['asl'],
  'ASL Interpreters': ['asl'],
  'Wheelchair Accessible': ['wheelchair', 'step-free'],
  '100% Remote': ['remote'],
  'Neurodiversity Friendly': ['neurodivergent', 'neurodiversity', 'autistic', 'sensory', 'quiet', 'asynchronous'],
  'Neurodivergent Friendly': ['neurodivergent', 'neurodiversity', 'autistic', 'sensory', 'quiet', 'asynchronous'],
  'Assistive Tech Provided': ['ergonomic', 'speech-to-text', 'captioning', 'transcription', 'relay', 'contrast'],
  'Flexible Hours': ['flexible', 'quiet', 'asynchronous'],
};

const SAVED_RTDB_PATH = 'saved';
const A11Y_STORAGE_KEY = 'accessable.a11y.v1';

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // Storage is best-effort (private mode, quota, non-browser env).
  }
}

// Sidebar faceted-filter predicates. Labels are verbatim from the HTML port;
// each predicate maps its label onto the RTDB schema (opportunities_schema.json).

function matchesTypeFilter(opportunity, label) {
  const haystack = buildHaystack(opportunity);
  if (label === 'Full-Time Jobs') return (opportunity?.basic?.category || '') === 'job';
  if (label === 'Internships & Co-ops') {
    return haystack.includes('intern') || haystack.includes('co-op') || haystack.includes('coop');
  }
  if (label === 'Apprenticeships') return haystack.includes('apprentice');
  if (label === 'Fellowships') return haystack.includes('fellow');
  return true;
}

function matchesAccommodationFilter(opportunity, label) {
  const features = opportunity?.accessibility?.features || {};
  if (label === 'Screen Reader Compatible') return features.screen_reader_docs === true;
  if (label === 'Wheelchair / Step-Free') {
    return (
      features.mobility_stepfree === true ||
      features.mobility_restrooms === true ||
      features.mobility_parking === true
    );
  }
  if (label === 'ASL / CART Interpreting') {
    return features.sli_support === true || features.cart_captions === true;
  }
  if (label === 'Flexible Hours / Rest Breaks') {
    return (
      features.camera_optional === true ||
      features.quiet_room === true ||
      features.pre_agenda === true
    );
  }
  if (label === 'Neurodivergent Friendly') {
    return (
      features.quiet_room === true ||
      features.camera_optional === true ||
      features.pre_agenda === true
    );
  }
  return true;
}

function matchesWorkModeFilter(opportunity, label) {
  const mode = opportunity?.logistics?.deliveryMode;
  if (label === 'Remote Only') return mode === 'remote';
  if (label === 'Hybrid') return mode === 'hybrid';
  if (label === 'On-site Verified') return mode === 'onsite';
  return true;
}

const INFO_CONTENT = {
  'employer-guide': {
    title: 'Employer Guide',
    paragraphs: [
      'Post roles, events, grants, trainings, and public programs with accommodations declared up front — screen-reader tested materials, KSL/ASL interpretation, CART captions, step-free venues, and quiet rooms where relevant.',
      'Every listing names an accessibility coordinator with a direct contact and a notice period, so candidates can request adjustments before they apply, not after.',
      'Use the Post an Opportunity button to submit a listing. New submissions enter review with the status pending_review and appear in the catalogue immediately.',
    ],
  },
  'universal-statement': {
    title: 'Universal Access Statement',
    paragraphs: [
      'AccessAble verifies that advertised opportunities meet WCAG 2.2 AA and ADA-aligned practices: full keyboard operability, meaningful alt text, captioned media, and flexible participation modes.',
      'Accommodation badges on each card are drawn live from the listing data — only features the organizer confirmed are shown.',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    paragraphs: [
      'Browsing, searching, filtering, and display preferences happen on your device. Display preferences are stored in your browser local storage. Saved bookmarks are stored in Firebase Realtime Database under the `saved` node so they stay in sync.',
      'Opportunity listings you submit (including organization logos) are stored in Firebase Realtime Database and Cloud Storage so they can be shared publicly in the catalogue.',
    ],
  },
  terms: {
    title: 'Terms of Use',
    paragraphs: [
      'Listings must be truthful about accommodations, contacts, deadlines, and compensation. Do not post discriminatory, misleading, or unlawful content.',
      'Applying happens on the organizer website via the Apply Now link. AccessAble does not guarantee selection outcomes.',
    ],
  },
};

const FORM_CATEGORY_OPTIONS = [
  { value: 'job', icon: 'work', label: 'Job / Internship' },
  { value: 'event', icon: 'event', label: 'Event / Webinar' },
  { value: 'grant', icon: 'payments', label: 'Grant / Funding' },
  { value: 'training', icon: 'school', label: 'Training / Fellowship' },
  { value: 'public', icon: 'campaign', label: 'Public Program / Aid' },
];

const FORM_DELIVERY_OPTIONS = [
  { value: 'remote', icon: 'language', label: '100% Remote' },
  { value: 'onsite', icon: 'location_city', label: 'On-Site' },
  { value: 'hybrid', icon: 'sync_alt', label: 'Hybrid' },
];

// Minimal markdown renderer for the details dialog: headings, bullets,
// numbered items, and paragraphs.
function renderDescriptionBlocks(markdown) {
  const lines = String(markdown || '').split('\n');
  const blocks = [];
  let list = [];
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'list', items: list });
      list = [];
    }
  };
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (/^#{1,6}\s+/.test(trimmed)) {
      flushList();
      blocks.push({ type: 'heading', text: trimmed.replace(/^#{1,6}\s+/, '') });
    } else if (/^[-*+]\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^[-*+]\s+/, ''));
    } else if (/^\d+\.\s+/.test(trimmed)) {
      list.push(trimmed.replace(/^\d+\.\s+/, ''));
    } else if (trimmed === '') {
      flushList();
    } else {
      flushList();
      blocks.push({ type: 'para', text: trimmed });
    }
  });
  flushList();
  return blocks.length ? blocks : [{ type: 'para', text: 'No description provided.' }];
}

const BOOKMARK_IDLE =
  'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full bg-surface-container-low hover:bg-secondary-container text-on-surface hover:text-on-secondary-fixed transition-colors';
const BOOKMARK_ACTIVE =
  'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-full bg-secondary-container text-on-secondary-fixed transition-colors';

const PAGINATION_ACTIVE =
  'w-10 h-10 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary flex items-center justify-center shadow-sm';
const PAGINATION_IDLE =
  'w-10 h-10 rounded-full font-label-md text-label-md text-on-surface hover:bg-surface-container-low flex items-center justify-center transition-colors';

function toggleInList(setter, value) {
  setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
}

function ToastStack({ toasts, onDismiss }) {
  const toneStyles = {
    success: 'bg-secondary-container text-on-secondary-fixed',
    error: 'bg-error-container text-on-error-container',
    info: 'bg-primary-fixed text-on-primary-fixed',
  };
  const toneIcons = { success: 'check_circle', error: 'error', info: 'info' };
  return (
    <div aria-live="polite" className="fixed bottom-4 right-4 z-[110] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 shadow-xl ${toneStyles[toast.tone] || toneStyles.info}`}
        >
          <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">
            {toneIcons[toast.tone] || toneIcons.info}
          </span>
          <p className="flex-1 font-body-sm text-body-sm font-medium">{toast.message}</p>
          <button
            aria-label="Dismiss notification"
            className="rounded-full p-1 hover:bg-black/10 transition-colors shrink-0"
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">close</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function DialogShell({ label, onClose, maxWidth = 'max-w-2xl', children }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => {
      const target = panelRef.current?.querySelector('[data-autofocus]') || panelRef.current;
      target?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(timer);
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`relative max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl bg-surface-container-lowest shadow-2xl focus:outline-none sm:rounded-3xl`}
      >
        {children}
      </div>
    </div>
  );
}

const FORM_INPUT =
  'w-full rounded-xl border bg-surface px-4 py-2.5 font-body-md text-body-md text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed';
const FORM_INPUT_ERROR = 'border-error';
const FORM_INPUT_OK = 'border-outline-variant';
const FORM_LABEL = 'font-label-md text-label-md font-bold text-on-surface';
const FORM_ERROR_TEXT = 'text-xs text-error font-medium';
const FORM_HELP_TEXT = 'text-xs text-on-surface-variant';

function OpportunityFormModal({ mode, opportunity, onClose, onSaved }) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(() =>
    isEdit && opportunity ? opportunityToFormValues(opportunity) : { ...INITIAL_OPPORTUNITY_FORM }
  );
  const [errors, setErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef(null);
  const existingLogo = isEdit ? opportunity?.basic?.organization?.logo || null : null;

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleText = (name) => (event) => setField(name, event.target.value);
  const handleCheck = (name) => (event) => setField(name, event.target.checked);

  const handleLogoSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    setErrors((prev) => ({ ...prev, logo: undefined }));
    event.target.value = '';
  };

  const fieldError = (name) => (submitAttempted ? errors[name] : undefined);
  const inputClass = (name) => `${FORM_INPUT} ${fieldError(name) ? FORM_INPUT_ERROR : FORM_INPUT_OK}`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitAttempted(true);
    const validation = validateOpportunityForm(form);
    if (logoFile && logoFile.size > 5 * 1024 * 1024) {
      validation.logo = 'Logo must be 5MB or smaller.';
    }
    setErrors(validation);
    if (Object.keys(validation).length > 0) {
      setSubmitError('Please fix the highlighted fields before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateOpportunity(opportunity.id, form, { logoFile, removeLogo });
        onSaved(opportunity.id, 'edit');
      } else {
        const id = await submitOpportunity(form, logoFile);
        onSaved(id, 'create');
      }
    } catch (error) {
      console.error('Opportunity save failed:', error);
      setSubmitError(error?.message || 'Saving failed. Check your connection and database rules, then try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell label={isEdit ? 'Edit opportunity' : 'Post an opportunity'} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} noValidate>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-surface-container bg-surface-container-lowest/95 px-space-lg py-4 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">
              {isEdit ? 'edit' : 'post_add'}
            </span>
            <div>
              <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                {isEdit ? 'Edit opportunity' : 'Post an opportunity'}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {isEdit
                  ? 'Changes replace the live listing immediately.'
                  : 'New listings enter review and appear in the catalogue.'}
              </p>
            </div>
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-full p-2 hover:bg-surface-container transition-colors"
            onClick={onClose}
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-6 px-space-lg py-space-md">
          {submitError && (
            <div role="alert" className="flex items-start gap-2 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">error</span>
              <p className="font-body-sm text-body-sm font-medium">{submitError}</p>
            </div>
          )}

          <section className="flex flex-col gap-4">
            <h3 className="font-label-lg text-label-lg font-bold text-primary">1. Basics</h3>
            <div className="flex flex-col gap-1.5">
              <label className={FORM_LABEL} htmlFor="opp-form-title">Opportunity title *</label>
              <input
                id="opp-form-title"
                data-autofocus
                className={inputClass('opportunityTitle')}
                maxLength={120}
                onChange={handleText('opportunityTitle')}
                placeholder="e.g. Junior Frontend Developer (Remote)"
                value={form.opportunityTitle}
                aria-invalid={fieldError('opportunityTitle') ? true : undefined}
              />
              {fieldError('opportunityTitle') && <span className={FORM_ERROR_TEXT}>{fieldError('opportunityTitle')}</span>}
            </div>
            <fieldset>
              <legend className={FORM_LABEL}>Category *</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORM_CATEGORY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 font-label-md text-label-md transition-colors ${
                      form.category === option.value
                        ? 'border-primary bg-primary-fixed text-on-primary-fixed font-bold'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary'
                    }`}
                  >
                    <input
                      className="sr-only"
                      checked={form.category === option.value}
                      name="opp-category"
                      onChange={() => setField('category', option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{option.icon}</span>
                    {option.label}
                  </label>
                ))}
              </div>
              {fieldError('category') && <span className={FORM_ERROR_TEXT}>{fieldError('category')}</span>}
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-org">Organization *</label>
                <input
                  id="opp-form-org"
                  className={inputClass('orgName')}
                  onChange={handleText('orgName')}
                  placeholder="Kenya Inclusive Tech Trust"
                  value={form.orgName}
                  aria-invalid={fieldError('orgName') ? true : undefined}
                />
                {fieldError('orgName') && <span className={FORM_ERROR_TEXT}>{fieldError('orgName')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-org-url">Organization website</label>
                <input
                  id="opp-form-org-url"
                  className={inputClass('orgUrl')}
                  inputMode="url"
                  onChange={handleText('orgUrl')}
                  placeholder="https://example.org"
                  value={form.orgUrl}
                  aria-invalid={fieldError('orgUrl') ? true : undefined}
                />
                {fieldError('orgUrl') && <span className={FORM_ERROR_TEXT}>{fieldError('orgUrl')}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className={FORM_LABEL} id="opp-form-logo-label">Organization logo</span>
              <div className="flex flex-wrap items-center gap-3">
                {logoPreview ? (
                  <img src={logoPreview} alt="New logo preview" className="h-12 w-12 rounded-2xl border border-outline-variant object-cover" />
                ) : existingLogo && !removeLogo ? (
                  <img src={existingLogo.downloadURL} alt="Current logo" className="h-12 w-12 rounded-2xl border border-outline-variant object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-container font-bold text-on-surface-variant">
                    <span className="material-symbols-outlined" aria-hidden="true">image</span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="font-body-sm text-body-sm text-on-surface">
                    {logoFile ? logoFile.name : existingLogo && !removeLogo ? existingLogo.name || 'Current logo kept' : 'No logo'}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <button className="font-label-sm text-label-sm font-bold text-primary hover:underline" onClick={() => fileInputRef.current?.click()} type="button">
                      {logoFile || existingLogo ? 'Replace' : 'Upload'} (SVG/PNG/JPG, max 5MB)
                    </button>
                    {(logoFile || (existingLogo && !removeLogo)) && (
                      <button
                        className="font-label-sm text-label-sm font-bold text-error hover:underline"
                        onClick={() => {
                          if (logoPreview) URL.revokeObjectURL(logoPreview);
                          setLogoFile(null);
                          setLogoPreview(null);
                          if (existingLogo) setRemoveLogo(true);
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <input ref={fileInputRef} accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" className="sr-only" onChange={handleLogoSelect} type="file" aria-labelledby="opp-form-logo-label" />
              </div>
              {removeLogo && !logoFile && <span className={FORM_HELP_TEXT}>The current logo will be removed on save.</span>}
              {submitAttempted && errors.logo && <span className={FORM_ERROR_TEXT}>{errors.logo}</span>}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="font-label-lg text-label-lg font-bold text-primary">2. Logistics &amp; dates</h3>
            <fieldset>
              <legend className={FORM_LABEL}>Delivery mode *</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {FORM_DELIVERY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 font-label-md text-label-md transition-colors ${
                      form.deliveryMode === option.value
                        ? 'border-primary bg-primary-fixed text-on-primary-fixed font-bold'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary'
                    }`}
                  >
                    <input
                      className="sr-only"
                      checked={form.deliveryMode === option.value}
                      name="opp-delivery"
                      onChange={() => setField('deliveryMode', option.value)}
                      type="radio"
                      value={option.value}
                    />
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{option.icon}</span>
                    {option.label}
                  </label>
                ))}
              </div>
              {fieldError('deliveryMode') && <span className={FORM_ERROR_TEXT}>{fieldError('deliveryMode')}</span>}
            </fieldset>
            {form.deliveryMode !== 'remote' && (
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-venue">Venue address *</label>
                <input
                  id="opp-form-venue"
                  className={inputClass('venueAddress')}
                  onChange={handleText('venueAddress')}
                  placeholder="Building, street, city + step-free entry directions"
                  value={form.venueAddress}
                />
                {fieldError('venueAddress') && <span className={FORM_ERROR_TEXT}>{fieldError('venueAddress')}</span>}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <fieldset>
                <legend className={FORM_LABEL}>Application deadline *</legend>
                <div className="mt-1.5 flex gap-2">
                  {[
                    ['deadlineDay', 'DD', '2'],
                    ['deadlineMonth', 'MM', '2'],
                    ['deadlineYear', 'YYYY', '4'],
                  ].map(([name, placeholder, maxLength]) => (
                    <input
                      key={name}
                      aria-label={`Deadline ${placeholder}`}
                      className={inputClass('applicationDeadline')}
                      inputMode="numeric"
                      maxLength={Number(maxLength)}
                      onChange={handleText(name)}
                      placeholder={placeholder}
                      value={form[name]}
                    />
                  ))}
                </div>
                {fieldError('applicationDeadline') && <span className={FORM_ERROR_TEXT}>{fieldError('applicationDeadline')}</span>}
              </fieldset>
              <fieldset>
                <legend className={FORM_LABEL}>Start date (optional)</legend>
                <div className="mt-1.5 flex gap-2">
                  {[
                    ['startDay', 'DD', '2'],
                    ['startMonth', 'MM', '2'],
                    ['startYear', 'YYYY', '4'],
                  ].map(([name, placeholder, maxLength]) => (
                    <input
                      key={name}
                      aria-label={`Start ${placeholder}`}
                      className={inputClass('startDate')}
                      inputMode="numeric"
                      maxLength={Number(maxLength)}
                      onChange={handleText(name)}
                      placeholder={placeholder}
                      value={form[name]}
                    />
                  ))}
                </div>
                {fieldError('startDate') && <span className={FORM_ERROR_TEXT}>{fieldError('startDate')}</span>}
              </fieldset>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={FORM_LABEL} htmlFor="opp-form-comp">Compensation</label>
              <input
                id="opp-form-comp"
                className={inputClass('compensation')}
                onChange={handleText('compensation')}
                placeholder="e.g. Ksh 75,000 / month, Free, Ksh 500,000 grant"
                value={form.compensation}
              />
              <span className={FORM_HELP_TEXT}>Shown as the pay badge on the card. Leave empty if not applicable.</span>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="font-label-lg text-label-lg font-bold text-primary">3. Accessibility</h3>
            <fieldset>
              <legend className={FORM_LABEL}>Confirmed accommodations</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACCESSIBILITY_FEATURE_KEYS.map((key) => (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 font-label-sm text-label-sm transition-colors ${
                      form[key]
                        ? 'border-primary bg-secondary-container/40 text-on-secondary-fixed font-bold'
                        : 'border-outline-variant text-on-surface-variant hover:border-primary'
                    }`}
                  >
                    <input checked={!!form[key]} className="accent-primary" onChange={handleCheck(key)} type="checkbox" />
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{FEATURE_META[key]?.icon || 'check'}</span>
                    {FEATURE_META[key]?.label || key}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['mobilityNotes', 'Mobility notes'],
                ['hearingNotes', 'Hearing notes'],
                ['visionNotes', 'Vision notes'],
                ['sensoryNotes', 'Sensory notes'],
              ].map(([name, label]) => (
                <div key={name} className="flex flex-col gap-1.5">
                  <label className={FORM_LABEL} htmlFor={`opp-form-${name}`}>{label}</label>
                  <input
                    id={`opp-form-${name}`}
                    className={`${FORM_INPUT} ${FORM_INPUT_OK}`}
                    onChange={handleText(name)}
                    placeholder="Optional detail"
                    value={form[name]}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-coord-name">Coordinator name *</label>
                <input id="opp-form-coord-name" className={inputClass('coordinatorName')} onChange={handleText('coordinatorName')} value={form.coordinatorName} />
                {fieldError('coordinatorName') && <span className={FORM_ERROR_TEXT}>{fieldError('coordinatorName')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-coord-contact">Coordinator contact *</label>
                <input id="opp-form-coord-contact" className={inputClass('coordinatorContact')} onChange={handleText('coordinatorContact')} placeholder="email or +254…" value={form.coordinatorContact} />
                {fieldError('coordinatorContact') && <span className={FORM_ERROR_TEXT}>{fieldError('coordinatorContact')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={FORM_LABEL} htmlFor="opp-form-coord-notice">Notice period</label>
                <input id="opp-form-coord-notice" className={`${FORM_INPUT} ${FORM_INPUT_OK}`} onChange={handleText('coordinatorNotice')} value={form.coordinatorNotice} />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <h3 className="font-label-lg text-label-lg font-bold text-primary">4. Description &amp; application</h3>
            <div className="flex flex-col gap-1.5">
              <label className={FORM_LABEL} htmlFor="opp-form-desc">Full description *</label>
              <textarea
                id="opp-form-desc"
                className={`${inputClass('description')} min-h-32`}
                onChange={handleText('description')}
                placeholder="Markdown supported: ## headings, - bullets, 1. steps"
                rows={6}
                value={form.description}
                aria-invalid={fieldError('description') ? true : undefined}
              />
              {fieldError('description') && <span className={FORM_ERROR_TEXT}>{fieldError('description')}</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={FORM_LABEL} htmlFor="opp-form-url">Application / registration URL *</label>
              <input
                id="opp-form-url"
                className={inputClass('appUrl')}
                inputMode="url"
                onChange={handleText('appUrl')}
                placeholder="https://…"
                value={form.appUrl}
                aria-invalid={fieldError('appUrl') ? true : undefined}
              />
              {fieldError('appUrl') && <span className={FORM_ERROR_TEXT}>{fieldError('appUrl')}</span>}
            </div>
            <label className="flex cursor-pointer items-center gap-2.5 font-body-sm text-body-sm text-on-surface">
              <input checked={!!form.multimodalSupport} className="h-4 w-4 accent-primary" onChange={handleCheck('multimodalSupport')} type="checkbox" />
              Multimodal application supported (video, voice note, or assisted application)
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 font-body-sm text-body-sm text-on-surface">
              <input checked={!!form.pledgeAgree} className="mt-1 h-4 w-4 accent-primary" onChange={handleCheck('pledgeAgree')} type="checkbox" />
              <span>
                I accept the True-Inclusion pledge: every accommodation marked above is genuinely provided. *
              </span>
            </label>
            {fieldError('pledgeAgree') && <span className={FORM_ERROR_TEXT}>{fieldError('pledgeAgree')}</span>}
          </section>
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-surface-container bg-surface-container-lowest/95 px-space-lg py-4 backdrop-blur sm:flex-row sm:justify-end">
          <button
            className="rounded-full px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-primary px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Submit for review'}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

function DeleteConfirmDialog({ opportunity, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const title = opportunity?.basic?.title || 'this opportunity';
  const org = opportunity?.basic?.organization?.name || '';

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteOpportunity(opportunity.id);
      onDeleted(opportunity);
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err?.message || 'Delete failed. Check your connection and database rules.');
      setDeleting(false);
    }
  };

  return (
    <DialogShell label="Delete opportunity" onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col gap-4 px-space-lg py-space-md">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container" aria-hidden="true">
            <span className="material-symbols-outlined text-[24px]">delete</span>
          </span>
          <div>
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Delete opportunity?</h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              “{title}”{org ? ` by ${org}` : ''} will be permanently removed from the catalogue for everyone. This cannot be undone.
            </p>
          </div>
        </div>
        {error && (
          <div role="alert" className="rounded-xl bg-error-container px-4 py-3 font-body-sm text-body-sm font-medium text-on-error-container">
            {error}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            autoFocus
            data-autofocus
            className="rounded-full px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
            disabled={deleting}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-error px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-error shadow-sm transition-colors disabled:opacity-60"
            disabled={deleting}
            onClick={handleDelete}
            type="button"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

function DetailsDialog({ opportunity, bookmarked, onToggleBookmark, onEdit, onCopyLink, onClose }) {
  if (!opportunity) return null;
  const category = getCategoryMeta(opportunity?.basic?.category);
  const orgName = opportunity?.basic?.organization?.name || 'Inclusive Employer';
  const orgWebsite = opportunity?.basic?.organization?.website || null;
  const title = opportunity?.basic?.title || 'Untitled opportunity';
  const pills = getAccommodationPills(opportunity);
  const notes = opportunity?.accessibility?.notes || {};
  const coordinator = opportunity?.accessibility?.coordinator || {};
  const blocks = renderDescriptionBlocks(opportunity?.details?.descriptionMarkdown);
  const deadline = formatReadableDate(opportunity?.logistics?.applicationDeadline);
  const startDate = formatReadableDate(opportunity?.logistics?.startDate);
  const compensation = String(opportunity?.logistics?.compensation || '').trim();
  const venue = String(opportunity?.logistics?.venueAddress || '').trim();
  const applyUrl = opportunity?.details?.applicationUrl || '#';
  const noteEntries = [
    ['Mobility', notes.mobility],
    ['Hearing', notes.hearing],
    ['Vision', notes.vision],
    ['Sensory', notes.sensory],
  ].filter(([, value]) => String(value || '').trim() !== '');
  const contact = String(coordinator.contact || '').trim();
  const contactHref = contact.includes('@') ? `mailto:${contact}` : contact ? `tel:${contact.replace(/\s+/g, '')}` : null;

  return (
    <DialogShell label={`Details: ${title}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="flex items-start justify-between gap-3 border-b border-surface-container px-space-lg py-4">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-1 font-label-sm text-label-sm font-bold text-on-primary-fixed">
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{category.icon}</span>
            {category.label}
          </span>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">{title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {orgName}
            {orgWebsite && (
              <>
                {' · '}
                <a className="font-bold text-primary hover:underline" href={orgWebsite} target="_blank" rel="noreferrer">
                  Website
                </a>
              </>
            )}
          </p>
        </div>
        <button aria-label="Close details" className="rounded-full p-2 hover:bg-surface-container transition-colors" onClick={onClose} type="button" data-autofocus>
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
        </button>
      </div>

      <div className="flex flex-col gap-5 px-space-lg py-space-md">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-label-sm font-semibold text-on-surface">{formatLocation(opportunity)}</span>
          {compensation && <span className="rounded-full bg-primary-fixed px-3 py-1 font-label-sm text-label-sm font-bold text-on-primary-fixed">{compensation}</span>}
          {deadline && <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-label-sm font-semibold text-on-surface">{getDeadlineVerb(opportunity?.basic?.category)} {deadline}</span>}
          {startDate && <span className="rounded-full bg-surface-container-low px-3 py-1 font-label-sm text-label-sm font-semibold text-on-surface">Starts {startDate}</span>}
        </div>

        {venue && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-bold text-on-surface">Venue: </span>{venue}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {blocks.map((block, index) => {
            if (block.type === 'heading') {
              return <h3 key={index} className="font-headline-sm text-headline-sm font-bold text-on-surface">{block.text}</h3>;
            }
            if (block.type === 'list') {
              return (
                <ul key={index} className="flex list-disc flex-col gap-1 pl-5 font-body-md text-body-md text-on-surface">
                  {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                </ul>
              );
            }
            return <p key={index} className="font-body-md text-body-md text-on-surface">{block.text}</p>;
          })}
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="font-label-lg text-label-lg font-bold text-on-surface">Verified accommodations ({pills.length})</h3>
          {pills.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pills.map((pill) => (
                <span key={pill.key} className="inline-flex items-center gap-1 rounded-full bg-secondary-container/40 px-3 py-1 font-label-sm text-label-sm text-on-secondary-fixed">
                  <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">{pill.icon}</span>
                  {pill.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">Contact the coordinator for tailored accommodations.</p>
          )}
          {noteEntries.map(([area, value]) => (
            <p key={area} className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="font-bold text-on-surface">{area}: </span>{value}
            </p>
          ))}
        </div>

        {(coordinator.name || contact) && (
          <div className="rounded-2xl bg-surface-container-low p-4">
            <h3 className="font-label-lg text-label-lg font-bold text-on-surface">Accessibility coordinator</h3>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface">
              {coordinator.name}
              {coordinator.noticePeriod && <span className="text-on-surface-variant"> · {coordinator.noticePeriod}</span>}
            </p>
            {contactHref ? (
              <a className="font-body-sm text-body-sm font-bold text-primary hover:underline" href={contactHref}>{contact}</a>
            ) : contact ? (
              <p className="font-body-sm text-body-sm text-on-surface">{contact}</p>
            ) : null}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-surface-container bg-surface-container-lowest/95 px-space-lg py-4 backdrop-blur">
        <button className="rounded-full px-4 py-2.5 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => onToggleBookmark(opportunity.id)} type="button">
          {bookmarked ? 'Saved ✓' : 'Save'}
        </button>
        <button className="rounded-full px-4 py-2.5 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => onCopyLink(opportunity)} type="button">
          Copy link
        </button>
        <button className="rounded-full px-4 py-2.5 font-label-md text-label-md font-bold text-on-surface-variant hover:bg-surface-container transition-colors" onClick={() => onEdit(opportunity)} type="button">
          Edit
        </button>
        <a
          href={applyUrl}
          target={applyUrl === '#' ? undefined : '_blank'}
          rel={applyUrl === '#' ? undefined : 'noreferrer'}
          className="rounded-full bg-primary px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm hover:bg-primary-container transition-colors"
        >
          Apply Now
        </a>
      </div>
    </DialogShell>
  );
}

function InfoDialog({ topic, onClose }) {
  const content = INFO_CONTENT[topic] || { title: 'Information', paragraphs: [] };
  return (
    <DialogShell label={content.title} onClose={onClose} maxWidth="max-w-lg">
      <div className="flex items-start justify-between gap-3 border-b border-surface-container px-space-lg py-4">
        <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">{content.title}</h2>
        <button aria-label="Close dialog" className="rounded-full p-2 hover:bg-surface-container transition-colors" onClick={onClose} type="button" data-autofocus>
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
        </button>
      </div>
      <div className="flex flex-col gap-3 px-space-lg py-space-md">
        {content.paragraphs.map((paragraph, index) => (
          <p key={index} className="font-body-md text-body-md text-on-surface">{paragraph}</p>
        ))}
        <div className="flex justify-end pt-2">
          <button className="rounded-full bg-primary px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary hover:bg-primary-container transition-colors" onClick={onClose} type="button">
            Got it
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

function Home({ onViewDetails, onPostOpportunity }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailsPage, setShowDetailsPage] = useState(false);
  const [selectedForDetailsPage, setSelectedForDetailsPage] = useState(null);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = useState('All Opportunities');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS[0]);
  const [bookmarked, setBookmarked] = useState([]);
  const [opportunityType, setOpportunityType] = useState([]);
  const [accommodation, setAccommodation] = useState([]);
  const [workMode, setWorkMode] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState('browse');
  const [highContrast, setHighContrast] = useState(() => readStored(A11Y_STORAGE_KEY, {}).highContrast === true);
  const [largeText, setLargeText] = useState(() => readStored(A11Y_STORAGE_KEY, {}).largeText === true);
  const [dyslexiaFont, setDyslexiaFont] = useState(() => readStored(A11Y_STORAGE_KEY, {}).dyslexiaFont === true);
  // Production list from Firebase RTDB `/opportunities` (schema v1).
  const [opportunities, setOpportunities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  // UI chrome state: toasts, menus, dialogs (CRUD + details + info).
  const [toasts, setToasts] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [detailsOpp, setDetailsOpp] = useState(null);
  const [infoTopic, setInfoTopic] = useState(null);
  // Mobile-only chrome: sort dropdown + filter bottomsheet (ported from HomeMobile.html vanilla JS)
  const [mobileSortOpen, setMobileSortOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const toastIdRef = useRef(0);

  // Navigate to the Details.js page. The clicked card item is forwarded so
  // Details.js can display it inside the opportunity details card. When Home
  // is rendered inside App, delegate to App via onViewDetails(opportunity);
  // when rendered standalone, render Details directly so the button still
  // navigates.
  const handleViewDetails = useCallback((opportunity) => {
    if (typeof onViewDetails === 'function') {
      onViewDetails(opportunity || null);
    } else {
      setSelectedForDetailsPage(opportunity || null);
      setShowDetailsPage(true);
    }
  }, [onViewDetails]);

  // Navigate to the SubmissionForm.js page. When Home is rendered inside
  // App, delegate to App via onPostOpportunity; when rendered standalone,
  // render SubmissionForm directly so the button still navigates.
  const handlePostOpportunity = useCallback(() => {
    if (typeof onPostOpportunity === 'function') {
      onPostOpportunity();
    } else {
      setShowSubmissionForm(true);
    }
  }, [onPostOpportunity]);

  const pushToast = useCallback((message, tone = 'success') => {
    const id = `toast-${Date.now()}-${toastIdRef.current++}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Mirror the HTML <body> a11y behaviours onto the React document body.
  useEffect(() => {
    document.body.classList.toggle('high-contrast-mode', highContrast);
    return () => document.body.classList.remove('high-contrast-mode');
  }, [highContrast]);

  useEffect(() => {
    document.body.classList.toggle('dyslexia-font', dyslexiaFont);
    return () => document.body.classList.remove('dyslexia-font');
  }, [dyslexiaFont]);

  useEffect(() => {
    document.documentElement.style.fontSize = largeText ? '18px' : '';
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [largeText]);

  // Persist display preferences on this device.
  useEffect(() => {
    writeStored(A11Y_STORAGE_KEY, { highContrast, largeText, dyslexiaFont });
  }, [highContrast, largeText, dyslexiaFont]);

  // Saved bookmarks live in Firebase RTDB under the parent node `saved`.
  // Stored as `/saved/{opportunityId}: true`. The saved tab + card save
  // state both derive from this subscription.
  useEffect(() => {
    const savedRef = dbRef(db, SAVED_RTDB_PATH);
    const unsubscribe = onValue(
      savedRef,
      (snapshot) => {
        const value = snapshot.exists() ? snapshot.val() : null;
        if (!value || typeof value !== 'object') {
          setBookmarked([]);
          return;
        }
        const ids = Object.entries(value)
          .filter(([, v]) => v === true || typeof v === 'string' || (v && typeof v === 'object'))
          .map(([key, v]) => (typeof v === 'string' && v ? v : key))
          .filter((id) => typeof id === 'string' && id.length > 0);
        setBookmarked(ids);
      },
      (error) => {
        console.error('Failed to load saved bookmarks:', error);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Live subscription to the production `/opportunities` node. Records
  // follow opportunities_schema.json (basic/logistics/accessibility/
  // details/meta). Newest-first ordering comes from the service.
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    const unsubscribe = subscribeOpportunities(
      (items) => {
        setOpportunities(items);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load opportunities:', error);
        setLoadError(error);
        setIsLoading(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [retryTick]);

  // Close the profile dropdown and card menus on outside click / Escape.
  useEffect(() => {
    if (!profileOpen && !openMenuId) return undefined;
    const onPointerDown = (event) => {
      if (event.target.closest('[data-menu-root]')) return;
      setProfileOpen(false);
      setOpenMenuId(null);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setOpenMenuId(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen, openMenuId]);

  const toggleBookmark = useCallback(
    async (id) => {
      if (!id) return;
      const saved = bookmarked.includes(id);
      try {
        if (saved) {
          await dbRemove(dbRef(db, `${SAVED_RTDB_PATH}/${id}`));
          pushToast('Removed from saved bookmarks.', 'info');
        } else {
          await dbSet(dbRef(db, `${SAVED_RTDB_PATH}/${id}`), true);
          pushToast('Saved to bookmarks.');
        }
      } catch (error) {
        console.error('Failed to update saved bookmark:', error);
        pushToast('Could not update saved bookmarks. Check your connection and try again.', 'error');
      }
    },
    [bookmarked, pushToast]
  );
  const isBookmarked = (id) => bookmarked.includes(id);

  const resetFilters = () => {
    setSearchQuery('');
    setActiveQuickFilter('All Opportunities');
    setSortBy(SORT_OPTIONS[0]);
    setOpportunityType([]);
    setAccommodation([]);
    setWorkMode([]);
    setCurrentPage(1);
    setView('browse');
  };

  const copyOpportunityLink = useCallback(
    async (opp) => {
      const url = opp?.details?.applicationUrl || window.location.href;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          pushToast('Application link copied to clipboard.');
        } else {
          window.prompt('Copy the application link:', url);
        }
      } catch (error) {
        window.prompt('Copy the application link:', url);
      }
      setOpenMenuId(null);
    },
    [pushToast]
  );

  const openCreateModal = useCallback(() => {
    setProfileOpen(false);
    setOpenMenuId(null);
    handlePostOpportunity();
  }, [handlePostOpportunity]);

  const openEditModal = useCallback((opp) => {
    setFormModal({ mode: 'edit', opportunity: opp });
    setOpenMenuId(null);
    setDetailsOpp(null);
  }, []);

  const handleFormSaved = useCallback(
    (id, mode) => {
      setFormModal(null);
      pushToast(
        mode === 'edit'
          ? 'Opportunity updated.'
          : `Opportunity submitted for review (ID: ${id}).`
      );
      if (mode === 'create') setView('browse');
    },
    [pushToast]
  );

  const handleDeleted = useCallback(
    async (opp) => {
      setDeleteTarget(null);
      setDetailsOpp((current) => (current && current.id === opp.id ? null : current));
      // Best-effort cleanup of the saved entry in RTDB; the subscription
      // will reconcile local state.
      if (opp?.id) {
        try {
          await dbRemove(dbRef(db, `${SAVED_RTDB_PATH}/${opp.id}`));
        } catch (error) {
          console.warn('Could not remove deleted opportunity from saved:', error);
        }
      }
      pushToast('Opportunity deleted.');
    },
    [pushToast]
  );

  const visibleOpportunities = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const keywords = QUICK_FILTER_KEYWORDS[activeQuickFilter];
    const filtered = opportunities.filter((opp) => {
      if (view === 'saved' && !bookmarked.includes(opp.id)) return false;
      const haystack = buildHaystack(opp);
      if (query && !haystack.includes(query)) return false;
      if (keywords && !keywords.some((k) => haystack.includes(k))) return false;
      if (opportunityType.length > 0 && !opportunityType.some((label) => matchesTypeFilter(opp, label))) return false;
      if (accommodation.length > 0 && !accommodation.some((label) => matchesAccommodationFilter(opp, label))) return false;
      if (workMode.length > 0 && !workMode.some((label) => matchesWorkModeFilter(opp, label))) return false;
      return true;
    });
    const sorted = [...filtered];
    const normalizedSort = String(sortBy || '').trim();
    if (normalizedSort === 'Newest') {
      sorted.sort((a, b) => getTimestamp(b) - getTimestamp(a));
    } else if (normalizedSort === 'Highest Accommodation Match' || normalizedSort === 'Highest Accommodation') {
      sorted.sort((a, b) => countAccommodations(b) - countAccommodations(a) || getTimestamp(b) - getTimestamp(a));
    } else if (normalizedSort === 'Salary (High to Low)') {
      sorted.sort(
        (a, b) =>
          parseCompensationValue(b?.logistics?.compensation) -
            parseCompensationValue(a?.logistics?.compensation) || getTimestamp(b) - getTimestamp(a)
      );
    }
    return sorted;
  }, [opportunities, searchQuery, activeQuickFilter, sortBy, view, bookmarked, opportunityType, accommodation, workMode]);

  const visibleCount = visibleOpportunities.length;
  const totalPages = Math.max(1, Math.ceil(visibleCount / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedOpportunities = visibleOpportunities.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const paginationPages = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
    : [1, 2, 3, 'ellipsis', totalPages];

  // Reset to page 1 whenever the result set definition changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeQuickFilter, sortBy, view, opportunityType, accommodation, workMode]);

  // Clamp the page after deletes shrink the result set.
  useEffect(() => {
    setCurrentPage((page) => Math.min(Math.max(1, page), totalPages));
  }, [totalPages]);

  const activeFacetCount = opportunityType.length + accommodation.length + workMode.length;
  const employerCount = useMemo(
    () =>
      new Set(
        opportunities
          .map((opp) => String(opp?.basic?.organization?.name || '').trim().toLowerCase())
          .filter(Boolean)
      ).size,
    [opportunities]
  );
  const heroRolesLabel = isLoading ? 'Loading verified roles…' : `${opportunities.length} Verified ${opportunities.length === 1 ? 'Role' : 'Roles'}`;
  const heroEmployersLabel = isLoading ? 'Loading employers…' : `${employerCount} Inclusive ${employerCount === 1 ? 'Employer' : 'Employers'}`;

  // Mobile chrome effects: lock scroll when filters sheet open, close sort on outside click
  useEffect(() => {
    if (mobileFiltersOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
    return undefined;
  }, [mobileFiltersOpen]);

  useEffect(() => {
    if (!mobileSortOpen) return undefined;
    const onPointerDown = (e) => {
      if (e.target.closest('[data-mobile-sort-root]')) return;
      setMobileSortOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === 'Escape') setMobileSortOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSortOpen]);

  // Keep mobile filter sheet in sync with body overflow for closing via Esc
  useEffect(() => {
    if (!mobileFiltersOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') setMobileFiltersOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileFiltersOpen]);

  // Standalone fallback: if Home is used without App's onViewDetails,
  // navigate by rendering the Details.js page directly with the clicked item.
  if (showDetailsPage && typeof onViewDetails !== 'function') {
    return (
      <Details
        opportunity={selectedForDetailsPage}
        opportunityId={selectedForDetailsPage?.id || null}
        onBack={() => setShowDetailsPage(false)}
      />
    );
  }

  // Standalone fallback: if Home is used without App's onPostOpportunity,
  // navigate by rendering the SubmissionForm.js page directly.
  if (showSubmissionForm && typeof onPostOpportunity !== 'function') {
    return <SubmissionForm />;
  }

  return (
    // Root mirrors <body> from both Desktop + Mobile HTML shells.
    // Desktop UI (large devices) keeps every className verbatim from Home.html
    // Mobile UI (HomeMobile.html) is rendered exclusively on <lg via lg:hidden.
    <div className={`bg-surface font-body-md text-body-md text-on-surface antialiased${highContrast ? ' high-contrast-mode' : ''}${dyslexiaFont ? ' dyslexia-font' : ''}`}>
      <style>{FIDELITY_STYLES}</style>
      {/* Material symbols + scrollbar helpers — shared verbatim from HomeMobile.html <style> */}
      <style>{`.material-symbols-outlined{font-variation-settings:'FILL' 0,'wght' 500,'GRAD' 0,'opsz' 24;display:inline-block;vertical-align:middle;line-height:1}.material-symbols-fill{font-variation-settings:'FILL' 1,'wght' 600,'GRAD' 0,'opsz' 24}.scrollbar-none::-webkit-scrollbar{display:none}.scrollbar-none{-ms-overflow-style:none;scrollbar-width:none}`}</style>

      {/* ===================== DESKTOP SHELL (lg+) ===================== */}
      <div className="hidden lg:block">
        <header className="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]"><div className="h-20 w-full px-gutter-mobile lg:px-gutter flex items-center justify-between gap-space-md"><div className="flex items-center gap-space-md shrink-0"><a className="flex items-center gap-space-sm focus:outline-none focus:ring-4 focus:ring-primary-container rounded-full" data-path="browse-opportunities" href="#" onClick={() => { setView('browse'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCDjVcBc3SNANVDT_ft-chQPXJCLOQGldM-AKBAD84S97xfkIkmjOznYOtxgWiW5Dbv2hTdSkGJo8eDJF1uCwzv-W-Ghj0kM_grRYiD-0zFLledBnQ9udNAAE2K36tqe-gOPhRfYoS38KIQ3At2QtkO6UFAKvlJja-KOoArAyMH27rewac-QfhWctu8fNbtWxq40lHIyPqF-yjA0mQbO0CWxR1-sKK_GV4uKF8obS2ONVis9Nykdf-Oqp7fqxZegFIOvE" alt="AccessAble Logo" className="h-10 w-auto object-contain" /><div className="flex flex-col"><span className="font-headline-sm text-headline-sm text-primary tracking-tight font-extrabold">AccessAble</span></div></a></div><div className="hidden md:flex flex-1 max-w-xl mx-space-sm"><div className="w-full flex items-center bg-surface-container-low px-space-md py-space-xs rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-within:ring-2 focus-within:ring-primary-container"><span className="material-symbols-outlined text-outline mr-space-sm">search</span><input aria-label="Search inclusive jobs, internships, accommodations" className="w-full bg-transparent border-none outline-none font-body-sm text-body-sm text-on-surface placeholder:text-outline" placeholder="Search inclusive jobs, internships, accommodations..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div><nav className="hidden xl:flex items-center gap-space-xs bg-surface-container-low p-1.5 rounded-full" data-active-classes="bg-primary text-on-primary font-label-md rounded-full shadow-sm"><button aria-current={view === "browse" ? "page" : undefined} className={view === "browse" ? "px-space-md py-2 transition-all bg-primary text-on-primary font-label-md rounded-full shadow-sm" : "px-space-md py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all"} onClick={() => setView("browse")} type="button">Browse Opportunities</button><button aria-current={view === "saved" ? "page" : undefined} className={view === "saved" ? "px-space-md py-2 transition-all bg-primary text-on-primary font-label-md rounded-full shadow-sm flex items-center gap-1.5" : "px-space-md py-2 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-1.5"} onClick={() => setView("saved")} type="button">Saved Bookmarks{bookmarked.length > 0 ? (<span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary-container px-1 font-label-sm text-label-sm font-bold text-on-secondary-fixed">{bookmarked.length}</span>) : null}</button></nav><div className="flex items-center gap-space-sm shrink-0"><div className="hidden sm:flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-full text-on-surface-variant"><button aria-pressed={highContrast} className={highContrast ? ACTIVE_A11Y_BTN : A11Y_BTN} onClick={() => setHighContrast((v) => !v)} title="Toggle High Contrast" type="button"><span className="material-symbols-outlined text-[20px]">contrast</span></button><button aria-pressed={largeText} className={largeText ? ACTIVE_A11Y_BTN : A11Y_BTN} onClick={() => setLargeText((v) => !v)} title="Text Size Options" type="button"><span className="material-symbols-outlined text-[20px]">text_fields</span></button><button aria-pressed={dyslexiaFont} className={dyslexiaFont ? ACTIVE_A11Y_BTN : A11Y_BTN} onClick={() => setDyslexiaFont((v) => !v)} title="Universal Accessibility Options" type="button"><span className="material-symbols-outlined text-[20px]">accessibility</span></button></div><button className="hidden sm:inline-flex items-center justify-center bg-primary-container text-on-primary px-space-lg py-2.5 rounded-full font-label-md text-label-md shadow-sm hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-secondary-container transition-transform" onClick={openCreateModal} type="button">Post an Opportunity</button><div className="flex items-center ml-space-xs" data-menu-root><div className="relative"><button aria-expanded={profileOpen} aria-haspopup="menu" aria-label="Account menu" className="block rounded-full focus:outline-none focus:ring-4 focus:ring-primary-container" onClick={() => setProfileOpen((v) => !v)} type="button"><img alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-secondary-container" src="https://lh3.googleusercontent.com/aida/AEtjO1VNhLS90sGEsrGZ4QTntCwO2KXWJl3z598WV0kITWYBuSL7zQYm0n6q799qV9ZDVq6a-2qzH9MhYEWr_pGzq8mxMSVe8JefZOglP-0LPl0necCYsTlYSKP2el0-E5dq678kpSUDcrwBI35nO_VHGJQGtDpw75E6j9cjj0fR_y639Vb6qP_D7otM3hrleIb-3mYbOsBLr9zQN7FbbalfsIMCUizv6yUVCbmcc2MhiOggcFFPJbt-6BjxI16mCYl3kgtWB50d1OBlsew" /></button>{profileOpen ? (<div aria-label="Account" role="menu" className="fixed right-4 top-20 z-50 w-64 rounded-2xl bg-surface-container-lowest p-2 shadow-xl ring-1 ring-outline-variant"><div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-3 py-2.5"><img alt="" className="h-9 w-9 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1VNhLS90sGEsrGZ4QTntCwO2KXWJl3z598WV0kITWYBuSL7zQYm0n6q799qV9ZDVq6a-2qzH9MhYEWr_pGzq8mxMSVe8JefZOglP-0LPl0necCYsTlYSKP2el0-E5dq678kpSUDcrwBI35nO_VHGJQGtDpw75E6j9cjj0fR_y639Vb6qP_D7otM3hrleIb-3mYbOsBLr9zQN7FbbalfsIMCUizv6yUVCbmcc2MhiOggcFFPJbt-6BjxI16mCYl3kgtWB50d1OBlsew" /><div className="flex flex-col"><span className="font-label-md text-label-md font-bold text-on-surface">My AccessAble</span><span className="font-label-sm text-label-sm text-on-surface-variant">{bookmarked.length} saved {bookmarked.length === 1 ? "opportunity" : "opportunities"}</span></div></div><button role="menuitem" className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container" onClick={() => { setView("saved"); setProfileOpen(false); }} type="button"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">bookmark</span>Saved bookmarks</button><button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container" onClick={openCreateModal} type="button"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">post_add</span>Post an opportunity</button><button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container" onClick={() => { resetFilters(); setProfileOpen(false); }} type="button"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">restart_alt</span>Reset all filters</button><button role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-body-sm text-body-sm text-on-surface hover:bg-surface-container" onClick={() => setHighContrast((v) => !v)} type="button"><span className="material-symbols-outlined text-[20px]" aria-hidden="true">contrast</span>High contrast: {highContrast ? "on" : "off"}</button></div>) : null}</div></div></div></div></header><aside className="fixed left-0 top-20 bottom-0 w-72 bg-surface-container-lowest shadow-[1px_0_12px_rgba(0,0,0,0.03)] z-40 overflow-y-auto p-space-md flex flex-col gap-space-lg"><div className="flex items-center justify-between pb-space-xs"><div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[20px]">tune</span><span className="font-label-lg text-label-lg font-bold text-on-surface">Faceted Filters</span>{activeFacetCount > 0 ? (<span className="rounded-full bg-primary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-primary-fixed">{activeFacetCount} active</span>) : null}</div><button className="font-label-sm text-label-sm text-primary hover:underline" onClick={resetFilters} type="button">Reset</button></div><div className="space-y-space-sm"><span className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider">Opportunity Type</span><div className="space-y-1.5"><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={opportunityType.includes("Full-Time Jobs")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setOpportunityType, "Full-Time Jobs")} type="checkbox" value="Full-Time Jobs" />Full-Time Jobs</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={opportunityType.includes("Internships & Co-ops")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setOpportunityType, "Internships & Co-ops")} type="checkbox" value="Internships & Co-ops" />Internships &amp; Co-ops</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={opportunityType.includes("Apprenticeships")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setOpportunityType, "Apprenticeships")} type="checkbox" value="Apprenticeships" />Apprenticeships</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={opportunityType.includes("Fellowships")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setOpportunityType, "Fellowships")} type="checkbox" value="Fellowships" />Fellowships</label></div></div><div className="space-y-space-sm"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-secondary text-[18px]">verified</span><span className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider">Accommodations</span></div><div className="space-y-1.5"><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={accommodation.includes("Screen Reader Compatible")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setAccommodation, "Screen Reader Compatible")} type="checkbox" value="Screen Reader Compatible" />Screen Reader Compatible</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={accommodation.includes("Wheelchair / Step-Free")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setAccommodation, "Wheelchair / Step-Free")} type="checkbox" value="Wheelchair / Step-Free" />Wheelchair / Step-Free</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={accommodation.includes("ASL / CART Interpreting")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setAccommodation, "ASL / CART Interpreting")} type="checkbox" value="ASL / CART Interpreting" />ASL / CART Interpreting</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={accommodation.includes("Flexible Hours / Rest Breaks")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setAccommodation, "Flexible Hours / Rest Breaks")} type="checkbox" value="Flexible Hours / Rest Breaks" />Flexible Hours / Rest Breaks</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={accommodation.includes("Neurodivergent Friendly")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setAccommodation, "Neurodivergent Friendly")} type="checkbox" value="Neurodivergent Friendly" />Neurodivergent Friendly</label></div></div><div className="space-y-space-sm"><span className="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider">Work Mode</span><div className="space-y-1.5"><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={workMode.includes("Remote Only")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setWorkMode, "Remote Only")} type="checkbox" value="Remote Only" />Remote Only</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={workMode.includes("Hybrid")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setWorkMode, "Hybrid")} type="checkbox" value="Hybrid" />Hybrid</label><label className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer text-body-sm font-body-sm"><input checked={workMode.includes("On-site Verified")} className="w-4 h-4 rounded text-primary focus:ring-primary-container" onChange={() => toggleInList(setWorkMode, "On-site Verified")} type="checkbox" value="On-site Verified" />On-site Verified</label></div></div></aside><div className="pl-72"><main className="w-full pt-20 bg-surface min-h-[calc(100vh-14rem)]"><div className="flex flex-col w-full">
      <div className="w-full px-gutter-mobile lg:px-gutter py-space-md max-w-7xl mx-auto flex flex-col gap-space-lg">
      <div className="px-gutter-mobile pt-space-md md:hidden"><div className="flex w-full items-center rounded-full bg-surface-container-lowest px-space-md py-space-xs shadow-sm focus-within:ring-2 focus-within:ring-primary-container"><span className="material-symbols-outlined text-outline mr-space-sm">search</span><input aria-label="Search opportunities" className="w-full border-none bg-transparent outline-none font-body-sm text-body-sm text-on-surface placeholder:text-outline" placeholder="Search opportunities..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
      {/* Hero / Discovery Editorial Cluster Section */}
      <section className="relative overflow-hidden bg-surface-container-lowest rounded-xl p-space-lg lg:p-space-xl shadow-sm">
      <div className="absolute -right-20 -top-24 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none"></div>
      <div className="absolute -left-12 -bottom-16 w-80 h-80 rounded-full bg-primary-fixed/25 blur-2xl pointer-events-none"></div>
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-center">
      {/* Text & Headline Area */}
      <div className="lg:col-span-7 flex flex-col gap-space-md">
      <div className="inline-flex items-center gap-2 self-start bg-secondary-container/30 px-space-md py-1.5 rounded-full">
      <img alt="AccessAble Verified Icon" className="w-5 h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3AW1b2aGnNI0cfYPrGyvIJ1Zekk1YCjAWIll6LzziPDWs_dw2QRhxLVapfHPgPeZkSiZVPg7Z_NXmUcgVPHtPPAjdI6RZQJ0TAZOfdRPUTS3-sGVX9RgkI8QvjZ54vsbGIfoxOo4R2x7IVx2vRENMlXj3LkdJ70mWUDgq_SuHd88lXThalCnwVfQbo7vuSnsT9vPSaBjRFeQVJfUSrnm7Zd-nRFOvbVgKDqNODGuMl4gMHnahIwrxwolLaENOxMNcV0o" />
      <span className="font-label-sm text-label-sm text-on-secondary-fixed uppercase tracking-wider font-bold">100% Accommodation Guaranteed</span>
      </div>
      <h1 className="font-headline-xl text-headline-xl text-on-surface tracking-tight font-extrabold">
                  Connecting Disability Talent to Inclusive Spaces
                </h1>
      <p className="font-body-xl text-body-xl text-on-surface-variant max-w-xl">
                  The central hub for persons with disabilities to discover accessible careers, events, and beneficiary programs with guaranteed support.
                </p>
      {/* Verified Key Stats Pills */}
      <div className="flex flex-wrap items-center gap-space-sm pt-space-xs">
      <div className="flex items-center gap-2.5 bg-surface-container-low px-4 py-2 rounded-full">
      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
      <span className="font-label-md text-label-md font-bold text-on-surface">{heroRolesLabel}</span>
      </div>
      <div className="flex items-center gap-2.5 bg-surface-container-low px-4 py-2 rounded-full">
      <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
      <span className="font-label-md text-label-md font-bold text-on-surface">{heroEmployersLabel}</span>
      </div>
      <div className="flex items-center gap-2.5 bg-secondary-container px-4 py-2 rounded-full">
      <span className="material-symbols-outlined text-[18px] text-on-secondary-fixed">verified</span>
      <span className="font-label-md text-label-md font-bold text-on-secondary-fixed">WCAG &amp; ADA Verified</span>
      </div>
      </div>
      </div>
      {/* Visual Pinterest-Style Editorial Organic Cluster */}
      <div className="lg:col-span-5 relative flex items-center justify-center">
      <div className="relative w-full max-w-sm h-72 sm:h-80 flex items-center justify-center">
      {/* Organic Visual 1: Main dynamic card */}
      <div className="absolute w-44 h-56 rounded-3xl overflow-hidden shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300 z-20 left-4 top-2 bg-primary">
      <img alt="A smiling disabled professional woman in a modern bright creative studio working with assistive screen reading monitors and ergonomic workspace tools." className="w-full h-full object-cover" data-alt="A smiling disabled professional woman in a modern bright creative studio working with assistive screen reading monitors and ergonomic workspace tools." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCKoz9IVr6ByJX88ukbzr6tNn2BBU82sPXGtveRE0NhZDqh6Rrrz6nb4Wkpy-SVPaIIdov0Z1J9bvXCqPehAtTgVTREAuwfxmvO4bsfEyBb1XPYLsa6Qu1G4a0amdQ8Ks9CPiFoqU7JjvH-F057wRA4x2twm7Tt0EyJYGO4AJdNac7dziY68kSNXAIXfMspXyT8bEEEFN311qbxcVjm9XDMts4_3cS9RXYoJLutad6aNtuohlHywfwzjg" />
      <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-3">
      <span className="font-label-sm text-label-sm text-on-primary bg-primary-container px-2 py-0.5 rounded-full">Inclusive Tech</span>
      </div>
      </div>
      {/* Organic Visual 2: Secondary overlapping card */}
      <div className="absolute w-40 h-52 rounded-3xl overflow-hidden shadow-md transform rotate-6 hover:rotate-0 transition-transform duration-300 z-10 right-2 top-8 bg-surface-container">
      <img alt="An agile creative designer communicating with colleagues using expressive American Sign Language in an airy, brightly illuminated inclusive workplace." className="w-full h-full object-cover" data-alt="An agile creative designer communicating with colleagues using expressive American Sign Language in an airy, brightly illuminated inclusive workplace." src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDw7XwUBg2ZVu1BrOxRAchx3Qzu1OFSVc3k6J5PX4OCP4DcIuDVkK2MZQj9F3wh1fnGitTF2Ciqo6pnBOUW1vUgVvnm7lPrWm2Fh4A8nSh36Hlgn_4wiEn8wTn0Ign2vfgQp5jfAc49me1KmH60fBq0TTfrS2-jEjVn_PaaK4q4CSRhVsSwpFuajwMrID5bpZgAQrqMbBfelHucsJNz6KDVO6uxHJwgdZzFtmkJ3Fcx9qSNAV3rme5Hw" />
      <div className="absolute top-2 right-2 bg-surface-container-lowest/90 backdrop-blur rounded-full p-1.5 shadow">
      <img alt="AccessAble Emblem" className="w-5 h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtXasFbINsZyg42aA7_TxHxLjvfFB5Nn-QLPrO3VGTMw014NuhsbxOmMcz6vow1jzQo0yCJbfyZMtPuO6_uSpEKnXuZZ6pLK3uLplHCKD4heNJRFzZ55Tc_LBXgMo3P1CCKiYJUcLpqConELHkrj-gDgZWNrdObkws7GRv1heSd_bDhTlTasMkAImN_1ENKwn9ajXpc1sSwfiOkEYQT9eeomNHC3KLlljR_ZAWM2Xo8n3Lmdxvmo1K9coPoVT-Y1IwCOg" />
      </div>
      </div>
      {/* Organic Visual 3: Floating bottom pill badge */}
      <div className="absolute bottom-2 z-30 bg-surface-container-lowest px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-secondary-container flex items-center justify-center">
      <img alt="Verified" className="w-6 h-6 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDUH2fqYRA124R5mS3R4s_zG91oYV8Jqe38jseAYz8_7tjL6rpgJ094QkrUnCuzb4Ais6_HWxLzuCqVO8dmgeli1DMlTl-isxqY6NTFg4ub9AAZ9g5FMDxfMoXtmq5cOfF9IsagIydlUdO7ptfDpCkujh6QGghmL0y2jCnJKF-KWKIEQeVPRzWn13nBvtaJJKU1LxNfmDpQqHiC2UIoRzIoY3S6dQGAuZVwu4Fucer3p7lAAuHifogZN0VedYksax93U88" />
      </div>
      <div className="flex flex-col">
      <span className="font-label-sm text-label-sm font-bold text-on-surface">Universal Standard</span>
      <span className="font-label-sm text-label-sm text-secondary font-semibold">Zero-Barrier Workplace</span>
      </div>
      </div>
      </div>
      </div>
      </div>
      {/* Quick Filter Scroll Pills */}
      <div className="mt-space-lg pt-space-md border-t-0 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">{QUICK_FILTERS.map((filter) => { const isActive = activeQuickFilter === filter.label; return (<button key={filter.label} aria-pressed={isActive} className={isActive ? ACTIVE_QUICK_FILTER : QUICK_FILTER} onClick={() => setActiveQuickFilter(filter.label)} type="button">{filter.icon ? (<span className={`material-symbols-outlined text-[18px] ${filter.iconClass}`}>{filter.icon}</span>) : null}{filter.label}</button>); })}</div>
      </section>
      {/* Controls Bar: Result Count & Sorting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm bg-surface-container-lowest px-space-md py-3 rounded-full shadow-sm">
      <div className="flex items-center gap-2">
      <span className="font-headline-sm text-headline-sm text-on-surface font-bold">Showing {visibleCount} {view === "saved" ? (visibleCount === 1 ? "Saved Opportunity" : "Saved Opportunities") : "Opportunities"}</span>
      <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
      <span className="font-body-sm text-body-sm text-secondary font-bold flex items-center gap-1">
      <img alt="Verified" className="w-4 h-4 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAWGd-81drL7Nt56hJnMiN0lFRB9nqwpr6Ya4LW_1cengopaR8z084uG7Jl-5rArWAWs2Byu2yXjV05NjEHswOy5ZR26s6FODEC5ktiKGVeQjcLdHpcxSNOS4PE1YGvI0G7IeoNWZ2eQsWGKo7JC0g37wYlzCaKH34c0DW15Uxaoi-AEIJrcOf9Bl0j4ViMMsdFoifx1WwPjKi1Qa7BhpapgpYD1CmJHWwPd3tGjJjbeCmmwGN2KPxCa_hyOxOfWpBhpiU" /> Active verified
              </span>
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
      <label className="font-label-sm text-label-sm text-on-surface-variant font-bold" htmlFor="sort-select">Sort by:</label>
      <div className="relative">
      <select className="appearance-none bg-surface-container-low text-on-surface font-label-md text-label-md rounded-full py-2 pl-4 pr-9 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer" id="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
      <option value="Most Relevant">Most Relevant</option>
      <option value="Newest">Newest</option>
      <option value="Highest Accommodation Match">Highest Accommodation Match</option>
      <option value="Salary (High to Low)">Salary (High to Low)</option>
      </select>
      <span className="material-symbols-outlined text-[18px] absolute right-3 top-2.5 text-on-surface pointer-events-none">expand_more</span>
      </div>
      </div>
      </div>
      {/* Opportunity Cards Grid — live production list from RTDB `/opportunities` (schema v1) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-space-md">
      {isLoading ? (
        [0, 1, 2, 3].map((skeleton) => (
          <article key={`skeleton-${skeleton}`} aria-busy="true" className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md animate-pulse">
            <div className="h-5 w-32 rounded-full bg-surface-container"></div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-surface-container"></div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="h-3 w-28 rounded bg-surface-container"></div>
                <div className="h-5 w-3/4 rounded bg-surface-container"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-24 rounded-full bg-surface-container"></div>
              <div className="h-6 w-28 rounded-full bg-surface-container"></div>
            </div>
            <div className="h-16 rounded-xl bg-surface-container-low"></div>
          </article>
        ))
      ) : loadError ? (
        <div className="col-span-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-[32px] text-error">cloud_off</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Couldn&apos;t load opportunities</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            Check your connection and Firebase database rules for the <code>opportunities</code> node, then try again.
          </p>
          <button
            className="px-space-lg py-2.5 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-transform"
            onClick={() => setRetryTick((tick) => tick + 1)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : pagedOpportunities.length === 0 ? (
        <div className="col-span-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm flex flex-col items-center gap-3 text-center">
          <span className="material-symbols-outlined text-[32px] text-outline">search_off</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">No opportunities match your filters</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
            {view === 'saved' && bookmarked.length === 0
              ? 'You have not saved any opportunities yet. Tap the bookmark icon on any card to keep it here.'
              : opportunities.length === 0
                ? 'No opportunities have been published yet. Be the first to post an inclusive listing.'
                : 'Try a different search term or clear the filters to see more results.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {view === 'saved' && bookmarked.length === 0 ? (
              <button
                className="px-space-lg py-2.5 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-transform"
                onClick={() => setView('browse')}
                type="button"
              >
                Browse opportunities
              </button>
            ) : (
              <>
                {opportunities.length === 0 && (
                  <button
                    className="px-space-lg py-2.5 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary hover:bg-primary-container shadow-sm transition-transform"
                    onClick={openCreateModal}
                    type="button"
                  >
                    Post an opportunity
                  </button>
                )}
                <button
                  className="px-space-lg py-2.5 rounded-full font-label-md text-label-md font-bold bg-surface-container-low text-on-surface hover:bg-surface-container shadow-sm transition-transform"
                  onClick={resetFilters}
                  type="button"
                >
                  Clear search &amp; filters
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        pagedOpportunities.map((opp, index) => {
          const category = getCategoryMeta(opp?.basic?.category);
          const orgName = opp?.basic?.organization?.name || 'Inclusive Employer';
          const title = opp?.basic?.title || 'Untitled opportunity';
          const logoUrl = opp?.basic?.organization?.logo?.downloadURL || null;
          const deliveryLabel = formatDeliveryLabel(opp?.logistics?.deliveryMode);
          const locationLabel = formatLocation(opp);
          const compensation = String(opp?.logistics?.compensation || '').trim();
          const pills = getAccommodationPills(opp);
          const deadline = formatReadableDate(opp?.logistics?.applicationDeadline);
          const startDate = formatReadableDate(opp?.logistics?.startDate);
          const posted = formatPostedAgo(opp);
          const bookmarkedActive = isBookmarked(opp.id);
          const avatarStyle = AVATAR_STYLES[index % AVATAR_STYLES.length];
          const venueFull = String(opp?.logistics?.venueAddress || '').trim();
          return (
            <article key={opp.id} className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-space-md relative overflow-hidden group">
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm px-2.5 py-1 rounded-full font-bold bg-primary-fixed text-on-primary-fixed">
                    <span className="material-symbols-outlined text-[14px]">{category.icon}</span>
                    {category.label}{deliveryLabel ? ` • ${deliveryLabel}` : ''}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {logoUrl ? (
                      <img src={logoUrl} alt={`${orgName} logo`} className="h-12 w-12 shrink-0 aspect-square rounded-2xl border border-surface-container bg-surface-container-low object-cover object-center" loading="lazy" />
                    ) : (
                      <div className={`h-12 w-12 shrink-0 aspect-square rounded-2xl flex items-center justify-center overflow-hidden font-headline-sm font-bold ${avatarStyle}`}>
                        {getInitials(orgName)}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface-variant">{orgName}</span>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface group-hover:text-primary transition-colors">
                        <button className="text-left hover:underline" onClick={() => setDetailsOpp(opp)} type="button">{title}</button>
                      </h2>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center" data-menu-root>
                    <button aria-label={`Bookmark ${title}`} aria-pressed={bookmarkedActive} className={bookmarkedActive ? BOOKMARK_ACTIVE : BOOKMARK_IDLE} onClick={() => toggleBookmark(opp.id)} type="button"><span className="material-symbols-outlined text-[20px]">{bookmarkedActive ? 'bookmark' : 'bookmark_border'}</span></button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span title={venueFull || locationLabel} className="px-3 py-1 rounded-full bg-surface-container-low text-on-surface font-label-sm text-label-sm font-semibold">{locationLabel}</span>
                  {compensation ? (
                    <span className="px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-bold">{compensation}</span>
                  ) : null}
                </div>
                <div className="pt-space-xs flex flex-col gap-1.5">
                  <span className="font-label-sm text-label-sm text-secondary font-bold flex items-center gap-1.5">
                    <img alt="Verified" className="w-4 h-4 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRZqu5ilMT97zfPV82wMPqykrz0UiB4VZf7w3U3CFuaeVcw5PnwKs_4G3uJCfeT8y2xHsciE8DG7PcRACaKs741hTnfyGOOMpGHBC6utn8u1hawxEI8sRSdNtRrVICqrXz6kmo2oCPTXZ2TZmBrna1h4xtFLXav4WIYxpYoFcnzOHEl5_DNu4h4D7CTTKWSESwLnDcZ_TybF8mKfsWHVzLIPkyQ7zzI5LPdV9Ydroq0suoUA3TWW12Z5Hbdy5nGSX2T2U" />
                    Verified Accommodations Included
                  </span>
                  {pills.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {pills.map((pill, pillIndex) => (
                        <span
                          key={pill.key}
                          className={
                            pillIndex === 0
                              ? 'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary-container/40 text-on-secondary-fixed font-label-sm text-label-sm'
                              : 'inline-flex items-center gap-1 px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm'
                          }
                        >
                          <span className={`material-symbols-outlined text-[16px]${pillIndex === 0 ? ' text-secondary' : ''}`}>{pill.icon}</span>
                          {pill.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Contact the access coordinator for tailored accommodations.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-space-sm border-t-0 bg-surface-container-low/50 -mx-space-lg -mb-space-lg p-space-md px-space-lg rounded-b-2xl">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface-variant font-label-sm text-label-sm">
                  <span>{posted}</span>
                  <span className="w-1 h-1 rounded-full bg-outline"></span>
                  {deadline ? (
                    <span className="font-semibold text-primary">{getDeadlineVerb(opp?.basic?.category)} {deadline}</span>
                  ) : startDate ? (
                    <span className="font-semibold text-primary">Starts {startDate}</span>
                  ) : (
                    <span className="font-semibold text-primary">{countAccommodations(opp)} accommodations</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={`View details for ${title}`}
                    onClick={() => handleViewDetails(opp)}
                    type="button"
                    className="inline-block px-space-lg py-2.5 rounded-full font-label-md text-label-md font-bold bg-primary text-on-primary hover:bg-primary-container shadow-sm hover:scale-[1.02] transition-transform"
                  >
                    View details
                  </button>
                </div>
              </div>
            </article>
          );
        })
      )}
      </div>
      {/* Pagination Controls */}
      <nav aria-label="Pagination Navigation" className="flex items-center justify-center gap-2 pt-space-md pb-space-lg"><button className="px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1" disabled={safePage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} type="button"><span className="material-symbols-outlined text-[18px]">chevron_left</span>Previous</button><div className="flex items-center gap-1.5">{paginationPages.map((page) => (page === "ellipsis" ? (<span key="ellipsis" className="px-2 text-outline">...</span>) : (<button key={page} aria-current={safePage === page ? "page" : undefined} className={safePage === page ? PAGINATION_ACTIVE : PAGINATION_IDLE} onClick={() => setCurrentPage(page)} type="button">{page}</button>)))}</div><button className="px-4 py-2 rounded-full font-label-md text-label-md bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors flex items-center gap-1" disabled={safePage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} type="button">Next<span className="material-symbols-outlined text-[18px]">chevron_right</span></button></nav>
      </div>
      </div></main><footer className="w-full bg-surface-container-lowest shadow-[0_-1px_12px_rgba(0,0,0,0.03)]"><div className="w-full px-gutter-mobile lg:px-gutter py-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md"><div className="flex items-center gap-space-sm"><img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCWku6ZpPWVXtQt8w0ZpnuVTJ3ERcAUjTsNDCMtXeJoM_KVv2GV-jdxKNW3Q0317oU-QiSsAU5-Hvi-GGS5CG1JQLYor_cZn6TEIabQ179mcPhmD5sa009E6aLgQAVrv9cvBgq9J8RydE-yT9pxn-6N7VY8dDB0qMwlNFiIFinqKFSvCcD6TydKg0JseRyear8GpWElbW9zrbhZsNctm-Dnu5DQjENKBiUSkd19yl1VkxbAuStiBLZnmm06z7zjRsjy60" alt="AccessAble Logo" className="h-6 w-auto object-contain" /><span className="font-body-sm text-body-sm text-on-surface-variant">© 2025 AccessAble. Universal accessibility verified.</span></div><div className="flex items-center gap-space-md font-label-sm text-label-sm text-on-surface-variant"><button className="hover:text-primary transition-colors" onClick={() => setInfoTopic("employer-guide")} type="button">Employer Guide</button><button className="hover:text-primary transition-colors" onClick={() => setInfoTopic("universal-statement")} type="button">Universal Statement</button><button className="hover:text-primary transition-colors" onClick={() => setInfoTopic("privacy")} type="button">Privacy Policy</button><button className="hover:text-primary transition-colors" onClick={() => setInfoTopic("terms")} type="button">Terms</button></div></div></footer></div>
      </div>

      {/* ===================== MOBILE SHELL (<lg) — verbatim from HomeMobile.html ===================== */}
      <div className="lg:hidden bg-background text-on-surface min-h-screen pb-24">
        <div className="max-w-md mx-auto min-h-screen bg-background relative shadow-2xl flex flex-col">
          {/* Top App Bar — HomeMobile.html header 1:1 */}
          <header className="bg-surface-container-lowest sticky top-0 z-40 px-3.5 h-14 w-full flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <img alt="AccessAble Brand Emblem" className="w-7 h-7 rounded-full object-contain bg-primary-fixed p-1" src="https://lh3.googleusercontent.com/aida/AEtjO1WLbGjCfL8UicmlrkOSPAlssnO2OKaHqD5ZXNt6Y6AnemO3fCsMGqNqSPVA7A6I75AZzg_skLwDxS_Ngo_fHorj7FqRayG9Kme_o1gdhINxcyYDAaX7VKZfR5VjCvoNemrwJEutzuzSgBqrmVq33om0-QkmmQWB-Ok-TjAqe3K6He4LMj2BhdIl3j8FgN7oBdCbMlUT0UxK2nGKlZJPZgAHQg8pDGsOulOofmVt7o2ojH3I30RS1hWZfscJDhxZwJcRDr59vnvcDcc" />
                <div className="flex flex-col leading-tight">
                  <span className="text-[17px] leading-[20px] font-bold text-primary tracking-tight">AccessAble</span>
                  <span className="text-[11px] leading-[14px] text-secondary font-bold tracking-wide">Inclusive Opportunities</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <img className="w-8 h-8 rounded-full object-cover border-2 border-secondary-container shadow-sm" alt="User profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBIJCwJksaH0vkO6FJC1uu5jQp6Pcn0k_nj9XU0HpEl1D-b-7ACBcJRB1JyIgEEnAtKtZ-LSLFPy6VU9uhecje7xZYErXHb6u_7uBr7QoeB2ztGwoQgxVoxuVXnOSIYhRKP9hNqj6c8o4fxsUWDAYMruxmQ9M4hKmjw69wtY3Wi3WfnieG1PEicihUKnDlTdpbT-UTt-GJjSCe-JDEZTX7hoLStly9L_5nRnKDU1eCWrTUurOS-fn67YA" />
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-secondary-container border-2 border-surface-container-lowest rounded-full"></span>
              </div>
            </div>
          </header>

          {/* Sub-header & Quick Accessibility Controls Toolstrip — HomeMobile.html 1:1 with shared a11y state */}
          <section className="bg-surface-container-lowest px-3.5 py-1.5 shadow-sm border-b border-surface-container">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] leading-[14px] font-bold text-on-surface break-words whitespace-normal flex-1 min-w-0">Accessibility toggles</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button aria-label="Accessibility Settings" aria-pressed={highContrast} onClick={() => setHighContrast((v) => !v)} className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${highContrast ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-surface-container-low text-primary hover:bg-surface-container'}`}>
                  <span className="material-symbols-outlined text-[18px]">accessibility_new</span>
                </button>
                <div className="flex items-center gap-0.5 bg-surface-container-low px-1.5 py-0.5 rounded-full border border-outline-variant/30">
                <button onClick={() => setLargeText(false)} className={`px-1 text-xs font-bold transition-colors ${!largeText ? 'text-on-surface' : 'text-on-surface-variant hover:text-primary'}`} title="Decrease font size">A-</button>
                <span className="w-[1px] h-3 bg-outline-variant"></span>
                <button onClick={() => setLargeText(true)} className={`px-1 text-xs font-bold transition-colors ${largeText ? 'text-on-surface bg-secondary-container/40 rounded px-1' : 'text-on-surface hover:text-primary'}`} title="Increase font size">A+</button>
                <span className="w-[1px] h-3 bg-outline-variant"></span>
                <button onClick={() => setHighContrast((v) => !v)} className={`p-0.5 rounded transition-colors flex items-center ${highContrast ? 'text-primary bg-primary-fixed/50' : 'text-on-surface-variant hover:text-primary'}`} title="High Contrast Mode">
                  <span className="material-symbols-outlined text-sm">contrast</span>
                </button>
                <span className="w-[1px] h-3 bg-outline-variant"></span>
                <button aria-label="Dyslexia Font" aria-pressed={dyslexiaFont} onClick={() => setDyslexiaFont((v) => !v)} className={`p-0.5 rounded flex items-center ${dyslexiaFont ? 'text-secondary bg-secondary-container/40' : 'text-secondary font-bold text-xs hover:text-primary'}`} title="Dyslexia Friendly Font">
                  <span className="material-symbols-outlined text-sm">format_letter_spacing</span>
                </button>
                </div>
              </div>
            </div>
          </section>

          {/* Main Content Stream — HomeMobile.html <main> 1:1 but dynamic & logic-bound */}
          <main className="flex-1 px-3.5 pt-3 space-y-3">
            {/* Dynamic Search & Voice Command Bar (Pill Form) — shared searchQuery */}
            <div className="relative bg-surface-container-lowest rounded-full shadow-sm flex items-center p-1 border border-outline-variant/40 focus-within:ring-2 focus-within:ring-primary-container transition-all">
              <div className="pl-2.5 pr-1.5 flex items-center text-primary">
                <span className="material-symbols-outlined text-[20px]">search</span>
              </div>
              <input
                className="w-full bg-transparent border-none outline-none text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:ring-0 focus:border-transparent focus:ring-offset-0 p-0"
                placeholder="Search verified roles, accommodations..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="flex items-center gap-1 pr-0.5">
                <button aria-label="Open filter preferences" onClick={() => setMobileFiltersOpen(true)} className="w-8 h-8 rounded-full bg-primary-container text-on-primary hover:bg-primary flex items-center justify-center active:scale-95 transition-all shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
            </div>

            {/* Category Filter Pills (Horizontal Scroll) — shared activeQuickFilter */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-[13px] leading-[18px] text-on-surface font-bold">Accommodations &amp; Categories</h2>
                <button onClick={resetFilters} className="text-[11px] leading-[14px] text-primary font-bold hover:underline">Clear All</button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-3.5 px-3.5">
                {MOBILE_QUICK_PILLS.map((pill) => {
                  const isActive = activeQuickFilter === pill.label || (pill.label === 'ASL Interpreters' && activeQuickFilter === 'ASL Fluent / Provided') || (pill.label === 'Neurodivergent Friendly' && activeQuickFilter === 'Neurodivergent Friendly');
                  // Normalize: activeQuickFilter may be Neurodiversity variant; treat both as active for Neurodivergent pill
                  const normalizedActive = activeQuickFilter === 'Neurodiversity Friendly' && pill.label === 'Neurodivergent Friendly' ? true : isActive;
                  const reallyActive = normalizedActive || activeQuickFilter === pill.label;
                  return (
                    <button
                      key={pill.label}
                      aria-pressed={reallyActive}
                      onClick={() => setActiveQuickFilter(pill.label === 'ASL Interpreters' ? 'ASL Fluent / Provided' : pill.label === 'Neurodivergent Friendly' ? 'Neurodiversity Friendly' : pill.label)}
                      className={reallyActive ? 'flex-shrink-0 bg-primary-container text-on-primary px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-bold shadow-sm flex items-center gap-1 active:scale-95 transition-all' : 'flex-shrink-0 bg-surface-container-lowest text-on-surface border border-outline-variant/60 hover:bg-surface-container px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold shadow-sm flex items-center gap-1 active:scale-95 transition-all'}
                      type="button"
                    >
                      <span className={`material-symbols-outlined text-[13px] ${pill.iconClass || ''}`}>{pill.icon}</span>
                      <span>{pill.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feed Header — shared visibleCount + sortBy */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] leading-[22px] font-bold text-on-surface">{visibleCount} {visibleCount === 1 ? 'opportunity' : 'opportunities'} found</h2>
              </div>
              <div className="relative flex items-center gap-1 text-outline font-label-sm text-label-sm" data-mobile-sort-root>
                <span>Sort:</span>
                <button onClick={() => setMobileSortOpen((v) => !v)} className="font-bold text-primary flex items-center gap-0.5 hover:bg-surface-container px-2 py-1 rounded-full transition-colors" type="button">
                  <span>{MOBILE_SORT_OPTIONS.includes(sortBy) ? sortBy : sortBy === 'Highest Accommodation Match' ? 'Highest Accommodation' : sortBy}</span>
                  <span className="material-symbols-outlined text-base transition-transform" style={{ transform: mobileSortOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>arrow_drop_down</span>
                </button>
                <div className={`${mobileSortOpen ? '' : 'hidden'} absolute right-0 top-full mt-2 w-52 bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/40 overflow-hidden z-30`}>
                  <div className="py-1.5">
                    {MOBILE_SORT_OPTIONS.map((opt) => {
                      const mappedOpt = opt === 'Highest Accommodation' ? 'Highest Accommodation Match' : opt;
                      const normalizedSortBy = sortBy === 'Highest Accommodation Match' ? 'Highest Accommodation' : sortBy;
                      const isActive = normalizedSortBy === opt;
                      return (
                        <button
                          key={opt}
                          data-sort={opt}
                          onClick={() => { setSortBy(mappedOpt); setMobileSortOpen(false); }}
                          className={isActive ? 'w-full text-left px-3.5 py-2 text-[13px] leading-[18px] font-bold bg-primary-container text-on-primary flex items-center justify-between' : 'w-full text-left px-3.5 py-2 text-[13px] leading-[18px] font-semibold text-on-surface hover:bg-surface-container flex items-center justify-between'}
                          type="button"
                        >
                          <span>{opt}</span>
                          {isActive ? <span className="material-symbols-outlined text-base">check</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Opportunity Cards — uses pagedOpportunities shared with desktop */}
            {isLoading ? (
              <div className="space-y-2.5">
                {[0,1,2].map((s) => (
                  <div key={s} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/40 animate-pulse">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-surface-container"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-surface-container rounded"></div>
                        <div className="h-4 w-3/4 bg-surface-container rounded"></div>
                      </div>
                    </div>
                    <div className="mt-4 h-12 bg-surface-container-low rounded-2xl"></div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/40 flex flex-col items-center gap-2.5 text-center">
                <span className="material-symbols-outlined text-[26px] text-error">cloud_off</span>
                <p className="text-[14px] leading-[20px] font-bold text-on-surface">Couldn&apos;t load opportunities</p>
                <button onClick={() => setRetryTick((t) => t+1)} className="bg-primary text-on-primary px-4 py-1.5 rounded-full text-[13px] leading-[18px] font-bold" type="button">Retry</button>
              </div>
            ) : pagedOpportunities.length === 0 ? (
              <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/40 flex flex-col items-center gap-1.5 text-center">
                <span className="material-symbols-outlined text-[24px] text-outline">search_off</span>
                <h3 className="text-[16px] leading-[22px] font-bold text-on-surface">No opportunities match</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">{view === 'saved' && bookmarked.length===0 ? 'No saved bookmarks yet.' : 'Try clearing filters or another search.'}</p>
                <button onClick={resetFilters} className="mt-1.5 bg-surface-container-low px-4 py-1.5 rounded-full text-[13px] leading-[18px] font-bold text-on-surface" type="button">Clear filters</button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pagedOpportunities.map((opp, index) => {
                  const orgName = opp?.basic?.organization?.name || 'Inclusive Employer';
                  const title = opp?.basic?.title || 'Untitled opportunity';
                  const compensation = String(opp?.logistics?.compensation || '').trim();
                  const deliveryLabel = formatDeliveryLabel(opp?.logistics?.deliveryMode);
                  const categoryMeta = getCategoryMeta(opp?.basic?.category);
                  const pills = getAccommodationPills(opp);
                  const posted = formatPostedAgo(opp);
                  const deadline = formatReadableDate(opp?.logistics?.applicationDeadline);
                  const startDate = formatReadableDate(opp?.logistics?.startDate);
                  const bookmarkedActive = isBookmarked(opp.id);
                  const avatarStyle = AVATAR_STYLES[index % AVATAR_STYLES.length];
                  const logoUrl = opp?.basic?.organization?.logo?.downloadURL || null;
                  const initials = getInitials(orgName);
                  // icons mapping for accommodation pills on mobile: first pill gets primary/secondary tint
                  return (
                    <article key={opp.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-outline-variant/40 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {logoUrl ? (
                            <img src={logoUrl} alt={`${orgName} logo`} className="w-10 h-10 rounded-xl object-cover border border-outline-variant/30 bg-surface-container-low shrink-0" />
                          ) : (
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[15px] font-extrabold shrink-0 ${avatarStyle}`}>
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-[13px] leading-[18px] font-bold text-on-surface block truncate">{orgName}</span>
                            <div className="flex items-center gap-1 flex-wrap mt-0.5">
                              <span className="inline-flex items-center gap-0.5 bg-secondary-fixed/50 text-on-secondary-fixed text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-[12px]">{categoryMeta.icon}</span>
                                <span>{categoryMeta.label}</span>
                              </span>
                              <p className="text-[11px] leading-[14px] text-outline truncate">{deliveryLabel || formatLocation(opp)}</p>
                            </div>
                          </div>
                        </div>
                        <button aria-label={`Save ${title}`} aria-pressed={bookmarkedActive} onClick={() => toggleBookmark(opp.id)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${bookmarkedActive ? 'bg-secondary-container text-on-secondary-fixed' : 'bg-surface-container-low hover:bg-surface-container text-outline hover:text-primary'}`} type="button">
                          <span className="material-symbols-outlined text-[20px]">{bookmarkedActive ? 'bookmark' : 'bookmark_border'}</span>
                        </button>
                      </div>
                      <div className="mt-2.5">
                        <h3 className="text-[16px] leading-[22px] font-bold text-on-surface">
                          <button onClick={() => handleViewDetails(opp)} className="text-left hover:text-primary" type="button">{title}</button>
                        </h3>
                        {compensation && <p className="text-[13px] leading-[18px] text-primary font-bold mt-0.5">{compensation}</p>}
                      </div>
                      {pills.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {pills.slice(0,4).map((pill) => (
                            <span key={pill.key} className="inline-flex items-center gap-1 bg-surface-container text-on-surface-variant text-[11px] leading-[14px] font-semibold px-2 py-1 rounded-full">
                              <span className="material-symbols-outlined text-primary text-[13px]">{pill.icon}</span>
                              <span>{pill.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 pt-2.5 border-t border-surface-container flex items-center justify-between gap-2">
                        <span className="text-[11px] leading-[14px] text-outline flex items-center gap-1 min-w-0">
                          <span className="material-symbols-outlined text-[14px]">history</span>
                          <span className="truncate">{posted}</span>
                        </span>
                        <button onClick={() => handleViewDetails(opp)} className="bg-primary hover:bg-primary-container text-on-primary text-[13px] leading-[18px] font-bold px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1 active:scale-95 shadow-sm shrink-0" type="button">
                          <span>{deadline ? 'View Details' : startDate ? 'View Details' : 'View Details'}</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Mobile pagination — shares desktop pagination state */}
            {totalPages > 1 && !isLoading && !loadError && pagedOpportunities.length > 0 && (
              <nav aria-label="Mobile pagination" className="flex items-center justify-center gap-1 pt-1.5">
                <button disabled={safePage===1} onClick={() => setCurrentPage((p)=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-full text-on-surface bg-surface-container-low disabled:opacity-40 flex items-center gap-1 text-[12px] leading-[16px] font-semibold" type="button"><span className="material-symbols-outlined text-[14px]">chevron_left</span>Prev</button>
                <span className="text-[12px] leading-[16px] text-on-surface font-bold px-2">{safePage} / {totalPages}</span>
                <button disabled={safePage===totalPages} onClick={() => setCurrentPage((p)=>Math.min(totalPages,p+1))} className="px-3 py-1.5 rounded-full text-on-surface bg-surface-container-low disabled:opacity-40 flex items-center gap-1 text-[12px] leading-[16px] font-semibold" type="button">Next<span className="material-symbols-outlined text-[14px]">chevron_right</span></button>
              </nav>
            )}
          </main>

          {/* Bottom Navigation Bar — HomeMobile.html JSON schema verified */}
          <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 py-1.5 max-w-md mx-auto right-0 bg-surface-container-lowest shadow-lg border-t border-surface-container">
            <button onClick={() => { setView('browse'); setMobileFiltersOpen(false); window.scrollTo({top:0,behavior:'smooth'}); }} className={`flex flex-col items-center justify-center min-w-[60px] min-h-[44px] rounded-xl px-2.5 py-0.5 active:scale-95 transition-transform duration-150 ${view==='browse' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`} type="button">
              <span className={`material-symbols-outlined text-[22px] leading-none ${view==='browse' ? 'material-symbols-fill' : ''}`}>explore</span>
              <span className="text-[11px] leading-[14px] font-bold">Browse</span>
            </button>
            <button onClick={openCreateModal} className="flex flex-col items-center justify-center min-w-[60px] min-h-[44px] text-on-surface-variant hover:bg-surface-container rounded-xl px-2.5 py-0.5 active:scale-95 transition-transform duration-150" type="button">
              <span className="material-symbols-outlined text-[22px] leading-none">add_circle</span>
              <span className="text-[11px] leading-[14px] font-bold">Post</span>
            </button>
            <button onClick={() => setView('saved')} className={`flex flex-col items-center justify-center min-w-[60px] min-h-[44px] rounded-xl px-2.5 py-0.5 active:scale-95 transition-transform duration-150 relative ${view==='saved' ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`} type="button">
              <span className="material-symbols-outlined text-[22px] leading-none">bookmark</span>
              {bookmarked.length>0 && <span className="absolute top-0.5 right-2.5 w-4 h-4 bg-secondary-container text-on-secondary-container text-[10px] font-extrabold rounded-full flex items-center justify-center">{bookmarked.length}</span>}
              <span className="text-[11px] leading-[14px] font-bold">Saved</span>
            </button>
            <button onClick={() => setProfileOpen((v)=>!v)} className={`flex flex-col items-center justify-center min-w-[60px] min-h-[44px] rounded-xl px-2.5 py-0.5 active:scale-95 transition-transform duration-150 ${profileOpen ? 'bg-primary-container text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`} type="button">
              <span className="material-symbols-outlined text-[22px] leading-none">person</span>
              <span className="text-[11px] leading-[14px] font-bold">Profile</span>
            </button>
          </nav>

          {/* Filters BottomSheet Modal — React port of HomeMobile.html vanilla JS */}
          {mobileFiltersOpen && <div onClick={() => setMobileFiltersOpen(false)} className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-40 max-w-md mx-auto" aria-hidden="true"></div>}
          <div className={`${mobileFiltersOpen ? '' : 'hidden'} fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-surface-container-lowest rounded-t-3xl shadow-2xl z-50 max-h-[80vh] flex flex-col overflow-hidden`} style={{ transform: mobileFiltersOpen ? 'translateY(0)' : 'translateY(100%)', transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' }}>
            <div className="flex justify-center pt-2.5 pb-1.5">
              <span className="w-9 h-1 bg-outline-variant rounded-full"></span>
            </div>
            <div className="flex items-center justify-between px-4 pb-2.5 border-b border-surface-container">
              <h3 className="text-[17px] leading-[22px] font-bold text-on-surface">Filters</h3>
              <div className="flex items-center gap-1.5">
                <button onClick={() => { resetFilters(); }} className="text-[12px] leading-[16px] font-bold text-primary hover:underline px-2 py-1" type="button">Clear All</button>
                <button aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} className="w-8 h-8 rounded-full bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface active:scale-95 transition-all" type="button">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-none">
              <div>
                <h4 className="text-[13px] leading-[18px] font-bold text-on-surface mb-2">Opportunity Type</h4>
                <div className="flex flex-wrap gap-1.5">
                  {MOBILE_FILTER_PILLS.map((pill) => {
                    const normalizedQuick = activeQuickFilter === 'Neurodiversity Friendly' ? 'Neurodiversity Friendly' : activeQuickFilter;
                    const isActive = (pill.key === 'all' && activeQuickFilter === 'All Opportunities') || (pill.quickKey && normalizedQuick === pill.quickKey);
                    return (
                      <button
                        key={pill.key}
                        onClick={() => {
                          if (pill.key === 'all') setActiveQuickFilter('All Opportunities');
                          else setActiveQuickFilter(pill.quickKey);
                        }}
                        className={isActive ? 'bg-primary text-on-primary px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-bold shadow-sm flex items-center gap-1' : 'bg-surface-container-low border border-outline-variant/60 text-on-surface px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold flex items-center gap-1 hover:bg-surface-container'}
                        type="button"
                      >
                        <span className={`material-symbols-outlined text-[13px] ${pill.iconClass || ''}`}>{pill.icon}</span>
                        <span>{pill.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-[13px] leading-[18px] font-bold text-on-surface mb-2">Work Arrangement</h4>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <input type="checkbox" checked={workMode.includes('Remote Only')} onChange={() => toggleInList(setWorkMode, 'Remote Only')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Remote
                  </label>
                  <label className="inline-flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <input type="checkbox" checked={workMode.includes('Hybrid')} onChange={() => toggleInList(setWorkMode, 'Hybrid')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Hybrid
                  </label>
                  <label className="inline-flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <input type="checkbox" checked={workMode.includes('On-site Verified')} onChange={() => toggleInList(setWorkMode, 'On-site Verified')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> On-site
                  </label>
                  <label className="inline-flex items-center gap-1.5 bg-surface-container px-3 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <input type="checkbox" checked={accommodation.includes('Flexible Hours / Rest Breaks')} onChange={() => toggleInList(setAccommodation, 'Flexible Hours / Rest Breaks')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" /> Flexible Hours
                  </label>
                </div>
              </div>
              <div>
                <h4 className="text-[13px] leading-[18px] font-bold text-on-surface mb-2">Verified Accommodations</h4>
                <div className="flex flex-wrap gap-1.5">
                  <label className="inline-flex items-center gap-1 bg-surface-container px-2.5 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-primary text-[13px]">visibility</span> Screen Reader Verified
                    <input type="checkbox" checked={accommodation.includes('Screen Reader Compatible')} onChange={() => toggleInList(setAccommodation, 'Screen Reader Compatible')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  </label>
                  <label className="inline-flex items-center gap-1 bg-surface-container px-2.5 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-secondary text-[13px]">sign_language</span> ASL Interpreters
                    <input type="checkbox" checked={accommodation.includes('ASL / CART Interpreting')} onChange={() => toggleInList(setAccommodation, 'ASL / CART Interpreting')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  </label>
                  <label className="inline-flex items-center gap-1 bg-surface-container px-2.5 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-primary text-[13px]">accessible</span> Wheelchair Accessible
                    <input type="checkbox" checked={accommodation.includes('Wheelchair / Step-Free')} onChange={() => toggleInList(setAccommodation, 'Wheelchair / Step-Free')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  </label>
                  <label className="inline-flex items-center gap-1 bg-surface-container px-2.5 py-1.5 rounded-full text-[12px] leading-[16px] font-semibold text-on-surface cursor-pointer hover:bg-surface-container-high">
                    <span className="material-symbols-outlined text-secondary text-[13px]">devices</span> Assistive Tech Provided
                    <input type="checkbox" checked={accommodation.includes('Neurodivergent Friendly')} onChange={() => toggleInList(setAccommodation, 'Neurodivergent Friendly')} className="rounded text-primary focus:ring-primary w-3.5 h-3.5" />
                  </label>
                </div>
              </div>
            </div>
            <div className="p-3.5 border-t border-surface-container bg-surface-container-lowest flex items-center gap-2.5">
              <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface text-[13px] leading-[18px] font-bold py-2.5 rounded-full" type="button">Cancel</button>
              <button onClick={() => setMobileFiltersOpen(false)} className="flex-1 bg-primary hover:bg-primary-container text-on-primary text-[13px] leading-[18px] font-bold py-2.5 rounded-full shadow-md" type="button">Show {visibleCount} Results</button>
            </div>
          </div>
        </div>
      </div>

      {/* Shared overlays (toasts, dialogs) — remain outside lg split so they overlay both shells */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {formModal ? (
        <OpportunityFormModal
          key={formModal.mode === 'edit' ? formModal.opportunity.id : 'create'}
          mode={formModal.mode}
          opportunity={formModal.opportunity}
          onClose={() => setFormModal(null)}
          onSaved={handleFormSaved}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteConfirmDialog opportunity={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleDeleted} />
      ) : null}
      {detailsOpp ? (
        <DetailsDialog
          opportunity={opportunities.find((item) => item.id === detailsOpp.id) || detailsOpp}
          bookmarked={isBookmarked(detailsOpp.id)}
          onToggleBookmark={toggleBookmark}
          onEdit={openEditModal}
          onCopyLink={copyOpportunityLink}
          onClose={() => setDetailsOpp(null)}
        />
      ) : null}
      {infoTopic ? <InfoDialog topic={infoTopic} onClose={() => setInfoTopic(null)} /> : null}
    </div>
  );
}

export default Home;