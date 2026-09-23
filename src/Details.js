/* eslint-disable jsx-a11y/anchor-is-valid -- href="#" anchors kept verbatim from Details.html for 1:1 UI fidelity */
import React, { useEffect, useMemo, useState } from 'react';
import SubmissionForm from './SubmissionForm';
import { subscribeOpportunities } from './services/opportunities';

/* ------------------------------------------------------------------
 * Details — React port of src/Details.html, now data-driven.
 *
 * - Left feed lists live opportunities from RTDB `/opportunities`.
 * - Right "opportunity details card" adapts to all 5 categories:
 *     Job (job) | Event (event) | Funding (grant) |
 *     Training (training) | Beneficiary Program (public + legacy aid)
 *   Field labels, icons, CTA text and info grids switch per category
 *   using CATEGORY_CONFIG below. Field mapping was derived from
 *   `accessablebyhex-default-rtdb-opportunities-export.json`:
 *     basic.title / basic.organization.{name,website,logo} /
 *     basic.category / logistics.{deliveryMode,venueAddress,
 *     applicationDeadline,startDate,compensation} /
 *     accessibility.{features,notes,coordinator} /
 *     details.{descriptionMarkdown,applicationUrl,multimodalSupport}.
 * - Clicking "View details" on any Home card navigates here via
 *   App.js (selected opportunity passed as `opportunity` /
 *   `opportunityId` props) and is rendered in the details card.
 * ------------------------------------------------------------------ */

const FIDELITY_STYLES = `
  @layer base {
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    body {
      overscroll-behavior: none;
    }
  }
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 9999px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  .scrollbar-none {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-none::-webkit-scrollbar {
    display: none;
  }
  .shadow-soft { box-shadow: 0 8px 30px rgba(15, 23, 42, 0.05); }
  .shadow-float { box-shadow: 0 14px 40px rgba(29, 78, 216, 0.12); }
  .shadow-subtle { box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03); }
  .shadow-xs { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06); }
  .shadow-2xs { box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); }
  .py-0\\.2 { padding-top: 0.05rem; padding-bottom: 0.05rem; }
`;

// Category catalogue. `grant` is displayed as "Funding" and both
// `public` (current rules) and `aid` (legacy export) are displayed as
// "Beneficiary Program".
const CATEGORY_CONFIG = {
  job: {
    label: 'Job',
    icon: 'work',
    cta: 'Apply Now',
    ctaNote: '⚡ Accommodations auto-attached to your encrypted application',
    compensationLabel: 'Salary',
    compensationIcon: 'payments',
    deadlineLabel: 'Apply by',
    startLabel: 'Start date',
    typeLabel: 'Opportunity',
    typeIcon: 'business_center',
    venueLabel: 'Work location',
    detailsHeading: 'Job Details',
    emptyCta: 'Browse jobs',
  },
  event: {
    label: 'Event',
    icon: 'event',
    cta: 'Register Now',
    ctaNote: '⚡ Access needs shared with the event organizers on registration',
    compensationLabel: 'Entry fee',
    compensationIcon: 'confirmation_number',
    deadlineLabel: 'Registration closes',
    startLabel: 'Event date',
    typeLabel: 'Format',
    typeIcon: 'event',
    venueLabel: 'Venue',
    detailsHeading: 'Event Details',
    emptyCta: 'Browse events',
  },
  grant: {
    label: 'Funding',
    icon: 'payments',
    cta: 'Apply for Funding',
    ctaNote: '⚡ Accessibility support included with your funding application',
    compensationLabel: 'Award amount',
    compensationIcon: 'payments',
    deadlineLabel: 'Applications close',
    startLabel: 'Disbursement from',
    typeLabel: 'Funding type',
    typeIcon: 'volunteer_activism',
    venueLabel: 'Location',
    detailsHeading: 'Funding Details',
    emptyCta: 'Browse funding',
  },
  training: {
    label: 'Training',
    icon: 'school',
    cta: 'Enroll Now',
    ctaNote: '⚡ Learning accommodations confirmed before the cohort starts',
    compensationLabel: 'Cost',
    compensationIcon: 'school',
    deadlineLabel: 'Applications close',
    startLabel: 'Cohort starts',
    typeLabel: 'Training format',
    typeIcon: 'school',
    venueLabel: 'Training venue',
    detailsHeading: 'Training Details',
    emptyCta: 'Browse trainings',
  },
  public: {
    label: 'Beneficiary Program',
    icon: 'campaign',
    cta: 'Request Support',
    ctaNote: '⚡ Support needs shared confidentially with the program team',
    compensationLabel: 'Benefit',
    compensationIcon: 'volunteer_activism',
    deadlineLabel: 'Apply by',
    startLabel: 'Distribution from',
    typeLabel: 'Program type',
    typeIcon: 'campaign',
    venueLabel: 'Collection point',
    detailsHeading: 'Program Details',
    emptyCta: 'Browse programs',
  },
};

CATEGORY_CONFIG.aid = { ...CATEGORY_CONFIG.public };

const CATEGORY_PILLS = [
  { value: 'all', label: 'See All', icon: 'stars' },
  { value: 'job', label: 'Job', icon: 'work' },
  { value: 'event', label: 'Event', icon: 'event' },
  { value: 'grant', label: 'Funding', icon: 'payments' },
  { value: 'training', label: 'Training', icon: 'school' },
  { value: 'public', label: 'Beneficiary Program', icon: 'campaign' },
];

const FILTER_CHIPS = [
  'Accessibility Lead',
  'Customer Success',
  'Frontend & QA',
  'Hybrid',
  'Remote',
];

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

const AVATAR_STYLES = [
  'bg-blue-50 text-blue-700 border border-blue-100',
  'bg-lime-100 text-lime-900',
  'bg-indigo-50 text-indigo-700',
  'bg-amber-50 text-amber-800',
  'bg-teal-50 text-teal-800',
  'bg-lime-200 text-lime-900',
];

const BOOKMARKS_STORAGE_KEY = 'accessable.bookmarks.v1';

function readBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const parsed = raw == null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch (error) {
    return [];
  }
}

function getCategoryConfig(category) {
  if (category && CATEGORY_CONFIG[category]) return CATEGORY_CONFIG[category];
  return CATEGORY_CONFIG.job;
}

function getInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'OP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
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
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Posted ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const date = new Date(ts);
  return `Posted ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function formatReadableDate(isoDate) {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDeliveryLabel(deliveryMode) {
  if (deliveryMode === 'remote') return '100% Remote';
  if (deliveryMode === 'hybrid') return 'Hybrid';
  if (deliveryMode === 'onsite') return 'On-site';
  return deliveryMode ? String(deliveryMode) : 'Location TBD';
}

function formatLocation(opportunity) {
  const mode = opportunity?.logistics?.deliveryMode;
  const venue = String(opportunity?.logistics?.venueAddress || '').trim();
  if (mode === 'remote') return '100% Remote';
  if (mode === 'hybrid') return venue ? `Hybrid • ${venue.length > 42 ? `${venue.slice(0, 41).trimEnd()}…` : venue}` : 'Hybrid';
  if (mode === 'onsite') return venue ? (venue.length > 48 ? `${venue.slice(0, 47).trimEnd()}…` : venue) : 'On-site';
  return venue ? (venue.length > 48 ? `${venue.slice(0, 47).trimEnd()}…` : venue) : 'Location TBD';
}

function getAccommodationPills(opportunity) {
  const features = opportunity?.accessibility?.features || {};
  return FEATURE_ORDER.filter((key) => features[key] === true).map((key) => ({
    key,
    ...FEATURE_META[key],
  }));
}

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

function matchesCategoryPill(opportunity, pillValue) {
  if (pillValue === 'all') return true;
  if (pillValue === 'public') {
    return opportunity?.basic?.category === 'public' || opportunity?.basic?.category === 'aid';
  }
  return opportunity?.basic?.category === pillValue;
}

function Details({
  opportunity: initialOpportunity,
  opportunityId: initialOpportunityId,
  onBack,
  onPostOpportunity,
  onSelectOpportunity,
}) {
  const [activeChip, setActiveChip] = useState('Accessibility Lead');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSubmissionForm, setShowSubmissionForm] = useState(false);
  const [opportunities, setOpportunities] = useState(
    initialOpportunity ? [initialOpportunity] : []
  );
  const [isLoading, setIsLoading] = useState(!initialOpportunity);
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const [selectedId, setSelectedId] = useState(
    initialOpportunityId || initialOpportunity?.id || null
  );
  const [bookmarked, setBookmarked] = useState(() => readBookmarks());

  // Keep selection in sync when App navigates with a newly clicked card.
  useEffect(() => {
    const nextId = initialOpportunityId || initialOpportunity?.id || null;
    if (nextId) setSelectedId(nextId);
    if (initialOpportunity && initialOpportunity.id) {
      setOpportunities((prev) => {
        if (prev.some((item) => item.id === initialOpportunity.id)) {
          return prev.map((item) => (item.id === initialOpportunity.id ? initialOpportunity : item));
        }
        return [initialOpportunity, ...prev];
      });
      setIsLoading(false);
    }
  }, [initialOpportunity, initialOpportunityId]);

  // Live list powers the left feed + resolves the selected id.
  useEffect(() => {
    setIsLoading((prev) => (opportunities.length > 0 ? prev : true));
    setLoadError(null);
    const unsubscribe = subscribeOpportunities(
      (items) => {
        setOpportunities((prev) => {
          // Preserve a navigated-in opportunity even if RTDB read is empty.
          if (items.length === 0 && initialOpportunity) return prev.length ? prev : [initialOpportunity];
          return items;
        });
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load opportunities in Details:', error);
        if (!initialOpportunity) {
          setLoadError(error);
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryTick]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarked));
    } catch (error) {
      // best-effort
    }
  }, [bookmarked]);

  // Reset tab + read-more whenever a different card is selected.
  useEffect(() => {
    setActiveTab('overview');
    setExpanded(false);
  }, [selectedId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory, opportunities.length]);

  const selected =
    opportunities.find((item) => item.id === selectedId) ||
    (initialOpportunity && (initialOpportunity.id === selectedId || !selectedId) ? initialOpportunity : null) ||
    opportunities[0] ||
    null;

  const selectedConfig = getCategoryConfig(selected?.basic?.category);

  const filteredFeed = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return opportunities.filter((opp) => {
      if (!matchesCategoryPill(opp, activeCategory)) return false;
      if (!query) return true;
      const haystack = [
        opp?.basic?.title,
        opp?.basic?.organization?.name,
        opp?.basic?.category,
        opp?.logistics?.deliveryMode,
        opp?.logistics?.venueAddress,
        opp?.logistics?.compensation,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [opportunities, searchQuery, activeCategory]);

  const PAGE_SIZE = 5;
  const totalPages = Math.max(1, Math.ceil(filteredFeed.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedFeed = filteredFeed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handlePostOpportunity = (event) => {
    if (event) event.preventDefault();
    if (typeof onPostOpportunity === 'function') {
      onPostOpportunity();
    } else {
      setShowSubmissionForm(true);
    }
  };

  const handleBack = (event) => {
    if (event) event.preventDefault();
    if (typeof onBack === 'function') {
      onBack();
    } else if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    }
  };

  const handleSelect = (opp) => {
    if (!opp) return;
    setSelectedId(opp.id);
    if (typeof onSelectOpportunity === 'function') onSelectOpportunity(opp);
    if (typeof document !== 'undefined') {
      document.getElementById('opportunity-detail-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const toggleBookmark = (id) => {
    if (!id) return;
    setBookmarked((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  if (showSubmissionForm && typeof onPostOpportunity !== 'function') {
    return <SubmissionForm />;
  }

  const selectedPills = selected ? getAccommodationPills(selected) : [];
  const selectedNotes = selected?.accessibility?.notes || {};
  const selectedCoordinator = selected?.accessibility?.coordinator || {};
  const selectedOrg = selected?.basic?.organization || {};
  const selectedTitle = selected?.basic?.title || 'Untitled opportunity';
  const selectedOrgName = selectedOrg?.name || 'Inclusive Employer';
  const selectedLogo = selectedOrg?.logo?.downloadURL || null;
  const selectedCompensation = String(selected?.logistics?.compensation || '').trim();
  const selectedVenue = String(selected?.logistics?.venueAddress || '').trim();
  const selectedDeadline = formatReadableDate(selected?.logistics?.applicationDeadline);
  const selectedStart = formatReadableDate(selected?.logistics?.startDate);
  const selectedDelivery = formatDeliveryLabel(selected?.logistics?.deliveryMode);
  const selectedApplyUrl = selected?.details?.applicationUrl || '#';
  const selectedBlocks = renderDescriptionBlocks(selected?.details?.descriptionMarkdown);
  const selectedContact = String(selectedCoordinator.contact || '').trim();
  const selectedContactHref = selectedContact.includes('@')
    ? `mailto:${selectedContact}`
    : selectedContact
      ? `tel:${selectedContact.replace(/\\s+/g, '')}`
      : null;
  const noteEntries = [
    ['Mobility', selectedNotes.mobility],
    ['Hearing', selectedNotes.hearing],
    ['Vision', selectedNotes.vision],
    ['Sensory', selectedNotes.sensory],
  ].filter(([, value]) => String(value || '').trim() !== '');
  const isBookmarked = selected ? bookmarked.includes(selected.id) : false;
  const collapsedText = String(selected?.details?.descriptionMarkdown || '').slice(0, 220);

  const tabButton = (value, icon, label) => {
    const isActive = activeTab === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setActiveTab(value)}
        aria-pressed={isActive}
        className={
          isActive
            ? 'py-2 rounded-xl text-xs font-bold text-slate-900 bg-white shadow-xs flex items-center justify-center gap-1'
            : 'py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 transition-colors'
        }
      >
        <span className="material-symbols-outlined text-[15px]">{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <div
      className="bg-[#f8fafc] text-slate-800 antialiased min-h-screen flex flex-col selection:bg-blue-100 selection:text-blue-900"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <style>{FIDELITY_STYLES}</style>
      {/* Floating Modern Header Bar matching Reference Structure */}
      <header className="sticky top-0 z-50 px-4 sm:px-6 lg:px-8 pt-4 pb-2 backdrop-blur-md bg-[#f8fafc]/80 transition-all">
      <div className="max-w-[1580px] mx-auto bg-white/95 rounded-3xl lg:rounded-full px-5 py-3 shadow-soft border border-slate-200/70 flex flex-wrap items-center justify-between gap-4">
      {/* Brand Logo (matching Home.js) */}
      <div className="flex items-center gap-4 shrink-0">
      <button type="button" onClick={handleBack} className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl p-1" aria-label="Back to opportunities">
      <img alt="AccessAble Logo" className="h-10 w-auto object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCDjVcBc3SNANVDT_ft-chQPXJCLOQGldM-AKBAD84S97xfkIkmjOznYOtxgWiW5Dbv2hTdSkGJo8eDJF1uCwzv-W-Ghj0kM_grRYiD-0zFLledBnQ9udNAAE2K36tqe-gOPhRfYoS38KIQ3At2QtkO6UFAKvlJja-KOoArAyMH27rewac-QfhWctu8fNbtWxq40lHIyPqF-yjA0mQbO0CWxR1-sKK_GV4uKF8obS2ONVis9Nykdf-Oqp7fqxZegFIOvE" />
      <div className="flex flex-col">
      <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-extrabold">AccessAble</span>
      </div>
      </button>
      </div>
      {/* Search navigates the related feed */}
      <div className="flex-1 max-w-xl mx-auto order-3 lg:order-2 w-full lg:w-auto">
      <div className="relative flex items-center bg-slate-100/80 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600 rounded-full border border-slate-200 transition-all px-4 py-2">
      <span className="material-symbols-outlined text-slate-400 text-[20px] mr-2">search</span>
      <input
        className="w-full bg-transparent border-none outline-none text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:ring-0 p-0"
        placeholder="Search related opportunities..."
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        aria-label="Search related opportunities"
      />
      </div>
      </div>
      {/* Action Nav & Profile Elements */}
      <div className="flex items-center gap-2.5 sm:gap-3 order-2 lg:order-3 shrink-0">
      {/* Accessibility Suite Quick Controls */}
      <div className="hidden sm:flex items-center bg-slate-100/90 rounded-full p-1 gap-1">
      <button className="p-1.5 rounded-full hover:bg-white hover:shadow-xs text-slate-600 hover:text-blue-700 transition-all" title="High Contrast Mode">
      <span className="material-symbols-outlined text-[18px]">contrast</span>
      </button>
      <button className="p-1.5 rounded-full hover:bg-white hover:shadow-xs text-slate-600 hover:text-blue-700 transition-all" title="Adjust Text Scaling">
      <span className="material-symbols-outlined text-[18px]">text_fields</span>
      </button>
      <button className="p-1.5 rounded-full hover:bg-white hover:shadow-xs text-slate-600 hover:text-blue-700 transition-all" title="Universal Accessibility Guide">
      <span className="material-symbols-outlined text-[18px]">accessibility_new</span>
      </button>
      </div>
      {/* Post an Opportunity Button */}
      <a className="hidden md:inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-sm hover:shadow transition-all" href="#" onClick={handlePostOpportunity}>
      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                Post Opportunity
              </a>
      {/* User Profile Pill / Avatar with Verified Emblem */}
      <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
      <div className="relative cursor-pointer">
      <img alt="User Profile" className="w-10 h-10 rounded-full object-cover ring-2 ring-lime-400 p-0.5 bg-white" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD0E56Ep7QQ2RWEOr7wwZZFbbCebGpKXC7Ch0UasYNbRkQYe3LuQFvyB2FFrLinDcsrvpS-zRTTguJ44PBRsX3BAZNWMqHdNx6Ke9sTQmZzkxVVS7MGU5VoDmjSJIEY8_-wp9GpnAJKPYN_xji0CJ5S_Ed5iCnIckMYrUzWvkVXW6AWAdeH1hhiMx-VEi21Ygb1j-yrDJ55taKxFTTLDdoHtw01DCC7xA31A-jeFAH8d4WAtcF9boi41e7SnW7pNvxKJ2I" />
      <span className="absolute -bottom-0.5 -right-0.5 bg-lime-500 w-3.5 h-3.5 rounded-full border-2 border-white"></span>
      </div>
      </div>
      </div>
      </div>
      {/* Category pills: filter the related feed + show all 5 types */}
      <div className="max-w-[1580px] mx-auto pt-3 px-2 flex items-center gap-2 overflow-x-auto py-1 scrollbar-none w-full">
      {CATEGORY_PILLS.map((pill) => {
        const isActive = activeCategory === pill.value;
        return (
          <button
            key={pill.value}
            type="button"
            onClick={() => setActiveCategory(pill.value)}
            aria-pressed={isActive}
            className={
              isActive
                ? 'px-5 py-2 rounded-full font-semibold text-xs sm:text-sm bg-[#1d4ed8] text-white shadow-sm shrink-0 flex items-center gap-1.5'
                : 'px-4 py-2 rounded-full font-medium text-xs sm:text-sm bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-all shrink-0 flex items-center gap-1.5'
            }
          >
          <span className="material-symbols-outlined text-[16px]">{pill.icon}</span>
          {pill.label}
          </button>
        );
      })}
      </div>
      </header>
      {/* MAIN SPLIT WORKSPACE: Left/Center Listing Feed + Right Detail Preview (Unified 2-Screen Reference Model) */}
      <main className="flex-1 max-w-[1580px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* LEFT & CENTER REGION (Cols 1-7 on desktop): Features, Reminders, and Feed Cards */}
      <div className="lg:col-span-7 xl:col-span-7 flex flex-col gap-6">
      {/* 3. Main Feed Section Header & Filter Quick Tags (from Reference Screen 3) */}
      <div className="pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
      <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Related opportunities
                    </h2>
      <span className="bg-lime-100 text-lime-900 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-lime-600"></span> Active WCAG Verified
                    </span>
      </div>
      {/* Sort By Selector Pill */}
      <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500 font-medium">Sort:</span>
      <button className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-2xs hover:bg-slate-50" type="button" title="Newest first">
                      Recently Added
                      <span className="material-symbols-outlined text-[14px] text-slate-400">expand_more</span>
      </button>
      </div>
      </div>
      {/* Secondary Filter Chips Bar matching Reference 3 ("UI/UX Designer", "Graphic Designer", "Hybrid", etc.) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {FILTER_CHIPS.map((chip) => {
                    const isActive = activeChip === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setActiveChip(chip)}
                        aria-pressed={isActive}
                        className={
                          isActive
                            ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 flex items-center gap-1'
                            : 'px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }
                      >
                        {chip}
                        {isActive && <span className="material-symbols-outlined text-[14px]">close</span>}
                      </button>
                    );
                  })}
                </div>
      </div>
      {/* 4. Opportunity Feed: live cards — View details loads the right preview */}
      <div className="space-y-4">
      {isLoading ? (
        [0, 1, 2].map((skeleton) => (
          <article key={`skeleton-${skeleton}`} aria-busy="true" className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-subtle animate-pulse">
            <div className="h-4 w-32 rounded-full bg-slate-100" />
            <div className="mt-3 h-6 w-3/4 rounded bg-slate-100" />
            <div className="mt-3 flex gap-2">
              <div className="h-6 w-24 rounded-full bg-slate-100" />
              <div className="h-6 w-28 rounded-full bg-slate-100" />
            </div>
          </article>
        ))
      ) : loadError ? (
        <div className="bg-white border border-red-200 rounded-3xl p-6 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-red-500">cloud_off</span>
          <h3 className="text-base font-bold text-slate-900">Couldn&apos;t load opportunities</h3>
          <p className="text-xs text-slate-500">Check your connection and Firebase rules, then try again.</p>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="bg-[#1d4ed8] text-white font-semibold text-xs px-4 py-2 rounded-full"
          >
            Retry
          </button>
        </div>
      ) : pagedFeed.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 text-center flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-[32px] text-slate-300">search_off</span>
          <h3 className="text-base font-bold text-slate-900">No related opportunities</h3>
          <p className="text-xs text-slate-500">
            {opportunities.length === 0
              ? 'No opportunities have been published yet.'
              : 'Try a different search term or category.'}
          </p>
        </div>
      ) : (
        pagedFeed.map((opp, index) => {
          const config = getCategoryConfig(opp?.basic?.category);
          const orgName = opp?.basic?.organization?.name || 'Inclusive Employer';
          const title = opp?.basic?.title || 'Untitled opportunity';
          const logoUrl = opp?.basic?.organization?.logo?.downloadURL || null;
          const compensation = String(opp?.logistics?.compensation || '').trim();
          const pills = getAccommodationPills(opp);
          const isActive = selected && opp.id === selected.id;
          const avatarStyle = AVATAR_STYLES[index % AVATAR_STYLES.length];
          return (
            <article
              key={opp.id}
              className={
                isActive
                  ? 'bg-white border-2 border-blue-500/80 rounded-3xl p-5 shadow-soft transition-all relative cursor-pointer ring-4 ring-blue-50'
                  : 'bg-white border border-slate-200/80 hover:border-blue-300 rounded-3xl p-5 shadow-subtle hover:shadow-soft transition-all cursor-pointer'
              }
              onClick={() => handleSelect(opp)}
            >
            <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3.5">
            {logoUrl ? (
              <img src={logoUrl} alt={`${orgName} logo`} className="w-12 h-12 rounded-2xl object-cover bg-slate-50 border border-slate-200/80 shrink-0" loading="lazy" />
            ) : (
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${avatarStyle}`}>
                {getInitials(orgName)}
              </div>
            )}
            <div>
            <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{orgName}</span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[12px]">verified</span> Trusted
            </span>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-[12px]">{config.icon}</span> {config.label}
            </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 hover:text-blue-600 transition-colors mt-0.5">
              {title}
            </h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
            {compensation && (
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">{compensation}</span>
            )}
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{formatLocation(opp)}</span>
            </div>
            </div>
            </div>
            <button
              type="button"
              aria-label={`Save ${title}`}
              aria-pressed={bookmarked.includes(opp.id)}
              onClick={(e) => { e.stopPropagation(); toggleBookmark(opp.id); }}
              className={
                bookmarked.includes(opp.id)
                  ? 'p-2 rounded-full text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors'
                  : 'p-2 rounded-full text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors'
              }
            >
            <span className="material-symbols-outlined text-[20px]">{bookmarked.includes(opp.id) ? 'bookmark' : 'bookmark_border'}</span>
            </button>
            </div>
            {/* Accommodations Pill Row */}
            {pills.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              {pills.slice(0, 3).map((pill, pillIndex) => (
                <span
                  key={pill.key}
                  className={
                    pillIndex === 0
                      ? 'text-[11px] font-bold text-lime-700 bg-lime-50 border border-lime-200/80 px-2.5 py-1 rounded-full flex items-center gap-1'
                      : 'text-[11px] font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full flex items-center gap-1'
                  }
                >
                <span className="material-symbols-outlined text-[14px]">{pill.icon}</span> {pill.label}
                </span>
              ))}
              {pills.length > 3 && (
                <span className="text-[11px] font-semibold text-slate-500">+{pills.length - 3} more</span>
              )}
              </div>
            )}
            {/* Card Bottom Bar: Applicants + Timestamp + Action */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">{formatPostedAgo(opp)}{formatReadableDate(opp?.logistics?.applicationDeadline) ? ` • ${config.deadlineLabel} ${formatReadableDate(opp.logistics.applicationDeadline)}` : ''}</span>
            <div className="flex items-center gap-2">
            {isActive && <span className="hidden sm:inline text-xs font-bold text-blue-600">Selected Preview</span>}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleSelect(opp); }}
              className={
                isActive
                  ? 'bg-[#1d4ed8] hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-full shadow-xs transition-transform hover:scale-105'
                  : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 font-semibold text-xs px-4 py-2 rounded-full transition-colors'
              }
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
      <nav aria-label="Pagination" className="flex items-center justify-center gap-2 pt-4 pb-4">
      <button
        type="button"
        disabled={safePage === 1}
        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
        className="px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-colors disabled:opacity-50"
      >
      <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  Previous
                </button>
      <div className="flex items-center gap-1">
      {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((page) => (
        <button
          key={page}
          type="button"
          aria-current={safePage === page ? 'page' : undefined}
          onClick={() => setCurrentPage(page)}
          className={
            safePage === page
              ? 'w-8 h-8 rounded-full text-xs font-bold bg-[#1d4ed8] text-white'
              : 'w-8 h-8 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-200'
          }
        >
          {page}
        </button>
      ))}
      {totalPages > 5 && <span className="px-1 text-slate-400 text-xs">...</span>}
      </div>
      <button
        type="button"
        disabled={safePage === totalPages}
        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
        className="px-4 py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-colors disabled:opacity-50"
      >
                  Next
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
      </button>
      </nav>

      </div>
      {/* RIGHT REGION: adaptive opportunity details card */}
      <div className="lg:col-span-5 xl:col-span-5">
      <aside id="opportunity-detail-card" className="sticky top-28 bg-white border border-slate-200/90 rounded-3xl shadow-soft p-6 flex flex-col gap-5 overflow-hidden">
      {!selected ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="material-symbols-outlined text-[40px] text-slate-300">search_off</span>
          <h2 className="text-lg font-bold text-slate-900">No opportunity selected</h2>
          <p className="text-xs text-slate-500 max-w-xs">
            {isLoading ? 'Loading opportunities…' : 'Select a card on the left to preview it here.'}
          </p>
        </div>
      ) : (
        <>
        {/* Top Back / Share / Bookmark Bar */}
        <div className="flex items-center justify-between">
        <button onClick={handleBack} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors" title="Back to opportunities" type="button">
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
        <span className="">{selectedOrgName}</span>
        <span className="material-symbols-outlined text-blue-600 text-[18px]">verified</span>
        </div>
        <button
          onClick={() => toggleBookmark(selected.id)}
          className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
          title={isBookmarked ? 'Saved' : 'Bookmark'}
          type="button"
          aria-pressed={isBookmarked}
        >
        <span className={`material-symbols-outlined text-[20px] ${isBookmarked ? 'text-red-500' : ''}`}>{isBookmarked ? 'bookmark' : 'bookmark_border'}</span>
        </button>
        </div>
        {/* Hero Company Avatar & Role Summary */}
        <div className="flex flex-col items-center text-center pt-2">
        {selectedLogo ? (
          <img src={selectedLogo} alt={`${selectedOrgName} logo`} className="w-20 h-20 rounded-full object-cover shadow-md ring-4 ring-blue-50 bg-white" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 text-white flex items-center justify-center text-2xl font-extrabold shadow-md ring-4 ring-blue-50">
            {getInitials(selectedOrgName)}
          </div>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-full">
        <span className="material-symbols-outlined text-[14px]">{selectedConfig.icon}</span>
        {selectedConfig.label}
        {selected?.details?.multimodalSupport ? ' • Video / Voice OK' : ''}
        </span>
        <h2 className="text-xl font-bold text-slate-900 mt-2 tracking-tight">
          {selectedTitle}
        </h2>
        {selectedCompensation && (
          <p className="text-sm font-bold text-blue-700 mt-0.5">
            {selectedCompensation}
          </p>
        )}
        {/* Role Chips: category + delivery + accommodation count */}
        <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
        <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{selectedConfig.label}</span>
        <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{selectedDelivery}</span>
        <span className="px-3.5 py-1 rounded-full text-xs font-semibold bg-lime-100 text-lime-800 font-bold">{selectedPills.length} Accommodations</span>
        </div>
        </div>
        {/* Segmented Tab Switcher (Overview | Company | Barrier-Free) */}
        <div className="grid grid-cols-3 bg-slate-100 p-1.5 rounded-2xl gap-1">
        {tabButton('overview', 'description', 'Overview')}
        {tabButton('company', 'domain', 'Company')}
        {tabButton('barrier', 'verified', 'Barrier-Free')}
        </div>

        {activeTab === 'overview' && (
          <>
          {/* Key Quick Info Grid — labels adapt per category */}
          <div className="grid grid-cols-3 gap-2.5 bg-slate-50/80 rounded-2xl p-3 border border-slate-100">
          <div className="flex flex-col text-left">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase">
          <span className="material-symbols-outlined text-[14px] text-amber-700">{selectedConfig.typeIcon}</span>
            {selectedConfig.typeLabel}
          </div>
          <span className="text-xs font-bold text-slate-800 mt-1">{selectedConfig.label}</span>
          </div>
          <div className="flex flex-col text-left">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase">
          <span className="material-symbols-outlined text-[14px] text-blue-600">alarm</span>
            {selectedConfig.deadlineLabel}
          </div>
          <span className="text-xs font-bold text-slate-800 mt-1">{selectedDeadline || 'Rolling'}</span>
          </div>
          <div className="flex flex-col text-left">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 uppercase">
          <span className="material-symbols-outlined text-[14px] text-teal-600">home</span>
            {selectedConfig.startLabel}
          </div>
          <span className="text-xs font-bold text-slate-800 mt-1">{selectedStart || 'TBD'}</span>
          </div>
          </div>
          {/* Compensation + Location Secondary Info Grid */}
          <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">{selectedConfig.compensationIcon}</span>
          </div>
          <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedConfig.compensationLabel}</span>
          <span className="text-xs font-bold text-slate-800">{selectedCompensation || 'Not specified'}</span>
          </div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-lime-50 text-lime-700 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[18px]">public</span>
          </div>
          <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
          <span className="text-xs font-bold text-slate-800">{formatLocation(selected)}</span>
          </div>
          </div>
          </div>
          {selectedVenue && (
            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-3 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-slate-500 shrink-0">location_on</span>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedConfig.venueLabel}</span>
                <span className="text-xs text-slate-700 mt-0.5">{selectedVenue}</span>
              </div>
            </div>
          )}
          {/* Details Copy with Read More */}
          <div>
          <div className="flex items-center justify-between mb-1.5">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">{selectedConfig.detailsHeading}</h3>
          <button className="text-slate-400 hover:text-slate-600" type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          <span className="material-symbols-outlined text-[16px]">more_horiz</span>
          </button>
          </div>
          {!expanded ? (
            <p className="text-xs leading-relaxed text-slate-600">
              {collapsedText.length > 219 ? `${collapsedText}…` : collapsedText || 'No description provided.'}{' '}
              <button type="button" onClick={() => setExpanded(true)} className="text-blue-600 font-bold hover:underline">Read More</button>
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedBlocks.map((block, index) => {
                if (block.type === 'heading') {
                  return <h4 key={index} className="text-xs font-bold text-slate-900">{block.text}</h4>;
                }
                if (block.type === 'list') {
                  return (
                    <ul key={index} className="list-disc pl-4 space-y-1 text-xs text-slate-600">
                      {block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                    </ul>
                  );
                }
                return <p key={index} className="text-xs leading-relaxed text-slate-600">{block.text}</p>;
              })}
              <button type="button" onClick={() => setExpanded(false)} className="self-start text-blue-600 font-bold hover:underline text-xs">Show less</button>
            </div>
          )}
          </div>
          </>
        )}

        {activeTab === 'company' && (
          <div className="flex flex-col gap-2.5">
            <div className="bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex items-start gap-3">
              {selectedLogo ? (
                <img src={selectedLogo} alt={`${selectedOrgName} logo`} className="w-11 h-11 rounded-2xl object-cover border border-slate-200 bg-white shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0">
                  {getInitials(selectedOrgName)}
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-slate-900">{selectedOrgName}</span>
                {selectedOrg?.website ? (
                  <a href={selectedOrg.website} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline break-all">
                    {selectedOrg.website}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Website not provided</span>
                )}
                <span className="inline-flex w-fit items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <span className="material-symbols-outlined text-[12px]">verified</span> Trusted organizer
                </span>
              </div>
            </div>
            {(selectedCoordinator.name || selectedContact) && (
              <div className="border border-slate-200/80 rounded-2xl p-4">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-blue-600">support_agent</span>
                  Accessibility coordinator
                </h3>
                {selectedCoordinator.name && <p className="text-xs font-bold text-slate-800 mt-2">{selectedCoordinator.name}</p>}
                {selectedContactHref ? (
                  <a href={selectedContactHref} className="text-xs font-bold text-blue-600 hover:underline break-all">{selectedContact}</a>
                ) : selectedContact ? (
                  <p className="text-xs text-slate-700">{selectedContact}</p>
                ) : null}
                {selectedCoordinator.noticePeriod && (
                  <p className="text-[11px] text-slate-500 mt-1">Notice: {selectedCoordinator.noticePeriod}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedConfig.deadlineLabel}</span>
                <p className="text-xs font-bold text-slate-800 mt-1">{selectedDeadline || 'Rolling'}</p>
              </div>
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedConfig.startLabel}</span>
                <p className="text-xs font-bold text-slate-800 mt-1">{selectedStart || 'TBD'}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'barrier' && (
          <div className="flex flex-col gap-3">
          {/* Verified Accommodations Deep-Dive Section */}
          <div className="border border-lime-200/70 bg-lime-50/40 rounded-2xl p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-lime-200/60">
          <span className="text-xs font-bold text-lime-900 uppercase tracking-wider flex items-center gap-1.5">
          <span className="material-symbols-outlined text-lime-600 text-[18px]">verified_user</span>
            Pre-Audited Accommodations
          </span>
          <span className="text-[10px] font-extrabold bg-lime-200 text-lime-900 px-2 py-0.5 rounded-full">{selectedPills.length} Verified</span>
          </div>
          {selectedPills.length > 0 ? (
            <ul className="space-y-2 text-xs text-slate-700">
            {selectedPills.map((pill) => (
              <li key={pill.key} className="flex items-start gap-2">
              <span className="material-symbols-outlined text-lime-600 text-[16px] shrink-0 mt-0.5">check_circle</span>
              <span className=""><strong>{pill.label}</strong></span>
              </li>
            ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">Contact the coordinator for tailored accommodations.</p>
          )}
          </div>
          {noteEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              {noteEntries.map(([area, value]) => (
                <p key={area} className="text-xs leading-relaxed text-slate-600">
                  <strong className="text-slate-800">{area}: </strong>{value}
                </p>
              ))}
            </div>
          )}
          {selected?.details?.multimodalSupport && (
            <p className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">videocam</span>
              Multimodal application supported (video, voice note, or assisted application)
            </p>
          )}
          {(selectedCoordinator.name || selectedContact) && (
            <div className="border border-slate-200/80 rounded-2xl p-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Coordinator</span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {selectedCoordinator.name || 'Access coordinator'}
                {selectedCoordinator.noticePeriod ? <span className="font-medium text-slate-500"> • {selectedCoordinator.noticePeriod}</span> : ''}
              </p>
              {selectedContactHref ? (
                <a href={selectedContactHref} className="text-xs font-bold text-blue-600 hover:underline break-all">{selectedContact}</a>
              ) : null}
            </div>
          )}
          </div>
        )}

        {/* Sticky CTA — label adapts per category */}
        <div className="pt-2">
        <a
          href={selectedApplyUrl}
          target={selectedApplyUrl === '#' ? undefined : '_blank'}
          rel={selectedApplyUrl === '#' ? undefined : 'noreferrer'}
          className="w-full bg-[#1d4ed8] hover:bg-blue-700 text-white rounded-full py-3.5 px-6 font-bold text-sm shadow-float flex items-center justify-between group transition-all"
        >
        <span className="pl-2">{selectedConfig.cta}</span>
        <div className="flex items-center gap-0.5 text-blue-200 group-hover:translate-x-1 transition-transform">
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        <span className="material-symbols-outlined text-[18px] -ml-2">chevron_right</span>
        <span className="material-symbols-outlined text-[18px] -ml-2">chevron_right</span>
        <span className="material-symbols-outlined text-[18px] -ml-2 text-white">chevron_right</span>
        </div>
        </a>
        <p className="text-center text-[11px] text-slate-400 mt-2 font-medium">
          {selectedConfig.ctaNote}
        </p>
        </div>
        </>
      )}
      </aside>
      </div>
      </div>
      </main>
      {/* Clean Minimal Footer matching Brand Spec */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white">
      <div className="max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
      <img alt="AccessAble Logo" className="h-6 w-auto object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDr5881s4MY59MfVF4TM8OXqJ8RABAUG7jHO6uGql_63-aO3pE_UAwsGXnbYKvZj-uE4bnniuPNPTQafrlwKBJco7x3d4jjiEEl33NIBulca-xw7LDWZHrrl91isRVVRwKo-GNPeV2rkLzDqXRbsyvAHvVCrlbWwYYiKMDaapesVmJJmpm0zREBQKqUCK584JTat7QnFAEqqFCJ2AczHG-qpHbPmnGDpie-wkQQYvB976m2E0RsF0FLIMZkv38B5n6-uUQ" />
      <span className="text-xs text-slate-500">© 2025 AccessAble. Universal accessibility &amp; zero-barrier employment standard.</span>
      </div>
      <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-600">
      <a className="hover:text-blue-600 transition-colors" href="#">Employer Accommodation Guide</a>
      <a className="hover:text-blue-600 transition-colors" href="#">Universal Statement</a>
      <a className="hover:text-blue-600 transition-colors" href="#">WCAG 2.2 AAA Audit</a>
      <a className="hover:text-blue-600 transition-colors" href="#">Privacy &amp; Security</a>
      </div>
      </div>
      </footer>
    </div>
  );
}

export default Details;
