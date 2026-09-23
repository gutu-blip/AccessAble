import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { submitOpportunity } from './services/opportunities';

const DRAFT_STORAGE_KEY = 'accessable.opportunity.draft.v1';
const MAX_TITLE_LENGTH = 120;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg'];
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = CURRENT_YEAR;
const MAX_YEAR = CURRENT_YEAR + 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s()-]+$/;
const DOMAIN_LIKE_REGEX = /^[^\s/?#]+\.[^\s/?#]{2,}(\/.*)?$/i;

const INITIAL_VALUES = {
  opportunityTitle: '',
  category: 'job',
  orgName: '',
  orgUrl: '',
  deliveryMode: 'remote',
  venueAddress: '',
  deadlineDay: '',
  deadlineMonth: '',
  deadlineYear: '',
  startDay: '',
  startMonth: '',
  startYear: '',
  compensation: '',
  mobility_restrooms: true,
  mobility_stepfree: true,
  mobility_parking: false,
  sli_support: true,
  cart_captions: true,
  hearing_loop: false,
  screen_reader_docs: true,
  braille_materials: false,
  audio_descriptions: true,
  quiet_room: false,
  pre_agenda: false,
  camera_optional: false,
  mobilityNotes: '',
  hearingNotes: '',
  visionNotes: '',
  sensoryNotes: '',
  coordinatorName: '',
  coordinatorContact: '',
  coordinatorNotice: 'At least 3 business days',
  description: '',
  appUrl: '',
  multimodalSupport: true,
  pledgeAgree: false,
};

const CATEGORY_OPTIONS = [
  {
    value: 'job',
    icon: 'work',
    title: 'Job / Internship',
    description: 'Full-time, contract, or paid internships',
    spanClass: '',
  },
  {
    value: 'event',
    icon: 'event',
    title: 'Event / Webinar',
    description: 'Workshops, summits, and symposiums',
    spanClass: '',
  },
  {
    value: 'grant',
    icon: 'payments',
    title: 'Grant / Funding',
    description: 'Direct assistance, bursaries, and seed funds',
    spanClass: '',
  },
  {
    value: 'training',
    icon: 'school',
    title: 'Training / Fellowship',
    description: 'Vocational courses, upskilling cohorts',
    spanClass: '',
  },
  {
    value: 'public',
    icon: 'campaign',
    title: 'Public Program / Beneficiary Aid',
    description:
      'Assistive device distribution, community support, or government affirmative action',
    spanClass: 'sm:col-span-2 md:col-span-2',
  },
];

const DELIVERY_OPTIONS = [
  {
    value: 'remote',
    icon: 'language',
    title: '100% Remote',
    description:
      'Digital participation via accessible platforms worldwide or within territory.',
  },
  {
    value: 'onsite',
    icon: 'location_city',
    title: 'On-Site Physical',
    description: 'Held at a verified barrier-free physical venue or workplace.',
  },
  {
    value: 'hybrid',
    icon: 'sync_alt',
    title: 'Hybrid Model',
    description:
      'Choice of in-person attendance or full remote digital streaming.',
  },
];

const STEP_TABS = [
  {
    id: 'section-basic',
    label: '1. Basic Details',
    icon: 'assignment',
    iconName: 'Assignment',
    iconWeight: 'regular',
  },
  {
    id: 'section-logistics',
    label: '2. Logistics & Dates',
    icon: 'event',
    iconName: 'Event',
    iconWeight: 'regular',
  },
  {
    id: 'section-accessibility',
    label: '3. Accommodations',
    icon: 'accessible',
    iconName: 'Accessible',
    iconWeight: 'fill',
  },
  {
    id: 'section-description',
    label: '4. Description',
    icon: 'article',
    iconName: 'Article',
    iconWeight: 'regular',
  },
];

const SECTION_ERROR_KEYS = {
  'section-basic': ['opportunityTitle', 'category', 'orgName', 'orgUrl'],
  'section-logistics': [
    'deliveryMode',
    'venueAddress',
    'applicationDeadline',
    'startDate',
  ],
  'section-accessibility': ['coordinatorName', 'coordinatorContact'],
  'section-description': ['description', 'appUrl'],
  'section-review': ['pledgeAgree'],
};

const FOCUS_SELECTORS = {
  opportunityTitle: '#opp-title',
  category: 'input[name="category"]',
  orgName: '#org-name',
  orgUrl: '#org-url',
  logo: '#logo-dropzone',
  deliveryMode: 'input[name="delivery_mode"]',
  venueAddress: '#venue-address',
  applicationDeadline: '#deadline-day',
  startDate: '#start-day',
  coordinatorName: '#coord-name',
  coordinatorContact: '#coord-contact',
  description: '#opportunity-desc',
  appUrl: '#app-url',
  pledgeAgree: '#pledge-agree',
};

const FOCUS_ORDER = Object.keys(FOCUS_SELECTORS);

const DATE_MAX_LENGTH = { day: 2, month: 2, year: 4 };

function isFilled(value) {
  return String(value == null ? '' : value).trim() !== '';
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function parseDateParts(dayValue, monthValue, yearValue) {
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year = Number(yearValue);
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }
  if (year < MIN_YEAR || year > MAX_YEAR) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(year, month - 1, day);
}

function isValidYearValue(yearValue) {
  const year = Number(yearValue);
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function isValidContact(value) {
  if (EMAIL_REGEX.test(value)) return true;
  if (!PHONE_REGEX.test(value)) return false;
  return value.replace(/\D/g, '').length >= 7;
}

function normalizeUrlValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (DOMAIN_LIKE_REGEX.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function validateLogoFile(file) {
  const extensionOk = /\.(svg|png|jpe?g)$/i.test(file.name || '');
  const accepted = file.type
    ? ACCEPTED_LOGO_TYPES.includes(file.type)
    : extensionOk;
  if (!accepted) {
    return 'Logo must be an SVG, PNG, or JPG file.';
  }
  if (file.size > MAX_LOGO_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `Logo must be 5MB or smaller (selected file is ${sizeMb}MB).`;
  }
  return '';
}

function validateForm(values) {
  const errors = {};

  if (!values.opportunityTitle.trim()) {
    errors.opportunityTitle = 'Enter an opportunity title.';
  } else if (values.opportunityTitle.trim().length > MAX_TITLE_LENGTH) {
    errors.opportunityTitle = `Opportunity title cannot exceed ${MAX_TITLE_LENGTH} characters.`;
  }

  if (!values.category) {
    errors.category = 'Select a category classification.';
  }

  if (!values.orgName.trim()) {
    errors.orgName = 'Enter your organization or company name.';
  }

  if (values.orgUrl.trim() && !isValidHttpUrl(values.orgUrl.trim())) {
    errors.orgUrl = 'Enter a valid website URL (for example, https://example.org).';
  }

  if (!values.deliveryMode) {
    errors.deliveryMode = 'Select a delivery mode.';
  }

  if (values.deliveryMode !== 'remote' && !values.venueAddress.trim()) {
    errors.venueAddress =
      'Add the venue address and accessibility access directions for on-site or hybrid opportunities.';
  }

  const deadlineFields = [
    values.deadlineDay,
    values.deadlineMonth,
    values.deadlineYear,
  ];
  const deadlineFilledCount = deadlineFields.filter(isFilled).length;
  if (deadlineFilledCount === 0) {
    errors.applicationDeadline = 'Enter the application deadline (DD / MM / YYYY).';
  } else if (deadlineFilledCount < 3) {
    errors.applicationDeadline =
      'Complete all application deadline fields (DD / MM / YYYY).';
  } else if (!isValidYearValue(values.deadlineYear)) {
    errors.applicationDeadline = `Enter a year between ${MIN_YEAR} and ${MAX_YEAR}.`;
  } else {
    const deadline = parseDateParts(
      values.deadlineDay,
      values.deadlineMonth,
      values.deadlineYear
    );
    if (!deadline) {
      errors.applicationDeadline =
        'Enter a valid calendar date for the application deadline.';
    } else if (deadline < startOfToday()) {
      errors.applicationDeadline = 'The application deadline cannot be in the past.';
    }
  }

  const startFields = [values.startDay, values.startMonth, values.startYear];
  const startFilledCount = startFields.filter(isFilled).length;
  if (startFilledCount > 0 && startFilledCount < 3) {
    errors.startDate =
      'Complete all start date fields (DD / MM / YYYY), or leave them empty.';
  } else if (startFilledCount === 3) {
    if (!isValidYearValue(values.startYear)) {
      errors.startDate = `Enter a year between ${MIN_YEAR} and ${MAX_YEAR}.`;
    } else {
      const startDate = parseDateParts(
        values.startDay,
        values.startMonth,
        values.startYear
      );
      if (!startDate) {
        errors.startDate = 'Enter a valid calendar date for the start date.';
      } else if (startDate < startOfToday()) {
        errors.startDate = 'The start date cannot be in the past.';
      }
    }
  }

  if (!values.coordinatorName.trim()) {
    errors.coordinatorName = "Enter the accessibility coordinator's full name.";
  }

  const contact = values.coordinatorContact.trim();
  if (!contact) {
    errors.coordinatorContact = 'Enter a direct email address or WhatsApp number.';
  } else if (!isValidContact(contact)) {
    errors.coordinatorContact =
      'Enter a valid email address or phone number (for example, accommodations@org.or.ke or +254 712 345 678).';
  }

  if (!values.description.trim()) {
    errors.description = 'Provide the full opportunity description.';
  }

  const appUrl = values.appUrl.trim();
  if (!appUrl) {
    errors.appUrl = 'Enter the primary application or registration URL.';
  } else if (!isValidHttpUrl(appUrl)) {
    errors.appUrl =
      'Enter a valid URL (for example, https://company.applytojob.com/apply/xyz123).';
  }

  if (!values.pledgeAgree) {
    errors.pledgeAgree = 'Accept the True-Inclusion Certification Guarantee to continue.';
  }

  return errors;
}

function SubmissionForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [activeSection, setActiveSection] = useState('section-basic');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [draftStatus, setDraftStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const descriptionRef = useRef(null);
  const fileInputRef = useRef(null);
  const autoSaveReadyRef = useRef(false);

  const errors = useMemo(() => validateForm(values), [values]);

  const errorCount =
    Object.keys(errors).length + (logoError ? 1 : 0);

  const fieldError = useCallback(
    (name) => {
      if (!submitAttempted && !touched[name]) return undefined;
      return errors[name];
    },
    [errors, submitAttempted, touched]
  );

  const touch = useCallback((name) => {
    setTouched((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  const handleChange = useCallback((name) => (event) => {
    const { checked, type, value } = event.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  const handleBlur = useCallback((name) => () => touch(name), [touch]);

  const handleTextBlur = useCallback(
    (name, transform) => () => {
      touch(name);
      if (transform) {
        setValues((prev) => {
          const next = transform(prev[name]);
          return next === prev[name] ? prev : { ...prev, [name]: next };
        });
      }
    },
    [touch]
  );

  /* ------------------------- Scroll-spy step indicator ------------------- */

  useEffect(() => {
    let rafId = null;
    const tabIds = STEP_TABS.map((tab) => tab.id);

    const computeActiveSection = () => {
      rafId = null;
      const sections = Array.from(
        document.querySelectorAll('section[id^="section-"]')
      );
      if (!sections.length) return;

      let current = '';
      sections.forEach((section) => {
        if (window.pageYOffset >= section.offsetTop - 120) {
          current = section.getAttribute('id');
        }
      });
      if (!current) current = sections[0].getAttribute('id');

      let active = current;
      if (active === 'section-review') active = 'section-description';
      if (!tabIds.includes(active)) active = tabIds[0];

      setActiveSection((prev) => (prev === active ? prev : active));
    };

    const onScroll = () => {
      if (rafId == null) rafId = requestAnimationFrame(computeActiveSection);
    };

    computeActiveSection();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  /* ------------------------------- Draft logic -------------------------- */

  const persistDraft = useCallback(
    (announce) => {
      try {
        const payload = {
          version: 1,
          savedAt: new Date().toISOString(),
          values,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        if (announce) {
          const time = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setDraftStatus({ tone: 'success', text: `Draft saved at ${time}.` });
        }
        return true;
      } catch (error) {
        setDraftStatus({
          tone: 'error',
          text: 'Draft could not be saved. This browser may be blocking local storage.',
        });
        return false;
      }
    },
    [values]
  );

  // Restore a previously saved draft (if any) on mount.
  useEffect(() => {
    let raw = null;
    try {
      raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !parsed.values ||
        typeof parsed.values !== 'object'
      ) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return;
      }
      setValues((prev) => ({ ...prev, ...parsed.values }));
      const savedAt = parsed.savedAt ? new Date(parsed.savedAt) : null;
      setDraftStatus(
        savedAt && !Number.isNaN(savedAt.getTime())
          ? {
              tone: 'success',
              text: `Draft restored from ${savedAt.toLocaleString([], {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}.`,
            }
          : { tone: 'success', text: 'Saved draft restored.' }
      );
    } catch (error) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch (removeError) {
        // Ignore storage removal failures.
      }
    }
  }, []);

  // Quiet auto-save so an accidental refresh never loses work.
  useEffect(() => {
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return undefined;
    }
    const timer = setTimeout(() => persistDraft(false), 800);
    return () => clearTimeout(timer);
  }, [persistDraft]);

  /* ------------------------------ Logo upload --------------------------- */

  const assignLogo = useCallback((file) => {
    const validationError = validateLogoFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }
    const preview = URL.createObjectURL(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return preview;
    });
    setLogoFile(file);
    setLogoError('');
  }, []);

  const clearLogo = useCallback(() => {
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLogoFile(null);
    setLogoError('');
  }, []);

  const handleLogoInputChange = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) assignLogo(file);
      event.target.value = '';
    },
    [assignLogo]
  );

  const handleZoneKeyDown = useCallback(
    (event) => {
      if (event.target !== event.currentTarget) return;
      if (logoFile) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
    },
    [logoFile]
  );

  /* ------------------------------ Date fields --------------------------- */

  const handleDateChange = useCallback(
    (group, part) => (event) => {
      const digits = event.target.value
        .replace(/[^0-9]/g, '')
        .slice(0, DATE_MAX_LENGTH[part]);
      const key = `${group}${part.charAt(0).toUpperCase()}${part.slice(1)}`;
      setValues((prev) => ({ ...prev, [key]: digits }));

      if (digits.length === DATE_MAX_LENGTH[part] && part !== 'year') {
        const nextId =
          part === 'day' ? `${group}-month` : `${group}-year`;
        document.getElementById(nextId)?.focus();
      }
    },
    []
  );

  const handleDateKeyDown = useCallback((group, part) => (event) => {
    if (event.key !== 'Backspace') return;
    if (event.target.value !== '') return;
    if (part === 'day') return;
    const prevId = part === 'month' ? `${group}-day` : `${group}-month`;
    document.getElementById(prevId)?.focus();
  }, []);

  const handleDateBlur = useCallback(
    (errorKey) => () => touch(errorKey),
    [touch]
  );

  /* --------------------------- Markdown toolbar ------------------------- */

  const applyFormat = useCallback(
    (type) => {
      const textarea = descriptionRef.current;
      if (!textarea) return;

      const value = textarea.value;
      const selectionStart = textarea.selectionStart;
      const selectionEnd = textarea.selectionEnd;
      const selected = value.slice(selectionStart, selectionEnd);

      let nextValue = value;
      let start = selectionStart;
      let end = selectionEnd;

      const commit = (inserted, from, to) => {
        nextValue =
          value.slice(0, selectionStart) + inserted + value.slice(selectionEnd);
        start = from;
        end = to;
      };

      const wrapSelection = (marker) => {
        if (
          selected &&
          selected.length >= marker.length * 2 &&
          selected.startsWith(marker) &&
          selected.endsWith(marker)
        ) {
          const inner = selected.slice(marker.length, -marker.length);
          commit(inner, selectionStart, selectionStart + inner.length);
          return;
        }
        if (selected) {
          const inserted = marker + selected + marker;
          commit(
            inserted,
            selectionStart + marker.length,
            selectionStart + marker.length + selected.length
          );
        } else {
          const inserted = marker + marker;
          commit(
            inserted,
            selectionStart + marker.length,
            selectionStart + marker.length
          );
        }
      };

      const toggleLinePrefix = (addPrefix, stripPattern) => {
        const processLine = (line) =>
          stripPattern.test(line)
            ? line.replace(stripPattern, '')
            : addPrefix + line;

        if (selected) {
          const replaced = selected.split('\n').map(processLine).join('\n');
          commit(replaced, selectionStart, selectionStart + replaced.length);
          return;
        }

        const lineStart =
          selectionStart === 0
            ? 0
            : value.lastIndexOf('\n', selectionStart - 1) + 1;
        const newlineIndex = value.indexOf('\n', selectionEnd);
        const lineEnd =
          newlineIndex === -1 ? value.length : newlineIndex;
        const line = value.slice(lineStart, lineEnd);
        const processed = processLine(line);
        nextValue =
          value.slice(0, lineStart) + processed + value.slice(lineEnd);
        start = lineStart;
        end = lineStart + processed.length;
      };

      const toggleNumberedList = () => {
        const numberStrip = /^\d+\.\s+/;
        if (selected) {
          const lines = selected.split('\n');
          const allNumbered = lines.every(
            (line) => line.trim() === '' || numberStrip.test(line)
          );
          const replaced = allNumbered
            ? lines.map((line) => line.replace(numberStrip, '')).join('\n')
            : lines
                .map((line, index) => `${index + 1}. ${line}`)
                .join('\n');
          commit(replaced, selectionStart, selectionStart + replaced.length);
          return;
        }

        const lineStart =
          selectionStart === 0
            ? 0
            : value.lastIndexOf('\n', selectionStart - 1) + 1;
        const newlineIndex = value.indexOf('\n', selectionEnd);
        const lineEnd =
          newlineIndex === -1 ? value.length : newlineIndex;
        const line = value.slice(lineStart, lineEnd);
        const processed = numberStrip.test(line)
          ? line.replace(numberStrip, '')
          : `1. ${line}`;
        nextValue =
          value.slice(0, lineStart) + processed + value.slice(lineEnd);
        start = lineStart;
        end = lineStart + processed.length;
      };

      switch (type) {
        case 'bold':
          wrapSelection('**');
          break;
        case 'italic':
          wrapSelection('*');
          break;
        case 'h2':
          toggleLinePrefix('## ', /^#{1,6}\s+/);
          break;
        case 'h3':
          toggleLinePrefix('### ', /^#{1,6}\s+/);
          break;
        case 'bullet':
          toggleLinePrefix('- ', /^[-*+]\s+/);
          break;
        case 'numbered':
          toggleNumberedList();
          break;
        case 'link': {
          const text = selected || 'link text';
          const inserted = `[${text}](https://)`;
          commit(
            inserted,
            selectionStart + text.length + 3,
            selectionStart + inserted.length - 1
          );
          break;
        }
        case 'code': {
          if (selected.includes('\n')) {
            const inserted = '```\n' + selected + '\n```';
            commit(inserted, selectionStart + 4, selectionStart + 4 + selected.length);
          } else {
            wrapSelection('`');
          }
          break;
        }
        default:
          return;
      }

      if (nextValue === value) return;

      setValues((prev) => ({ ...prev, description: nextValue }));
      requestAnimationFrame(() => {
        const el = descriptionRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(start, end);
      });
    },
    []
  );

  /* --------------------------- Section completion ----------------------- */

  const isSectionComplete = useCallback(
    (sectionId) => {
      const keys = SECTION_ERROR_KEYS[sectionId] || [];
      return keys.every((key) => !errors[key]);
    },
    [errors]
  );

  /* -------------------------------- Submit ------------------------------ */

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSubmitAttempted(true);
      setSubmitStatus(null);

      const firstInvalidField = FOCUS_ORDER.find((field) =>
        field === 'logo'
          ? Boolean(logoError)
          : Boolean(errors[field])
      );

      if (firstInvalidField) {
        requestAnimationFrame(() => {
          const element = document.querySelector(
            FOCUS_SELECTORS[firstInvalidField]
          );
          if (!element) return;
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus({ preventScroll: true });
        });
        return;
      }

      if (isSubmitting) return;
      setIsSubmitting(true);

      try {
        const opportunityId = await submitOpportunity(values, logoFile);
        try {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        } catch (storageError) {
          // Draft cleanup is best-effort; the submission already succeeded.
        }
        setValues(INITIAL_VALUES);
        setTouched({});
        setSubmitAttempted(false);
        setDraftStatus(null);
        clearLogo();
        setSubmitStatus({
          tone: 'success',
          text: `Opportunity submitted for review (ID: ${opportunityId}).`,
        });
      } catch (error) {
        console.error('Opportunity submission failed:', error);
        setSubmitStatus({
          tone: 'error',
          text: 'Submission failed. Check your connection and try again — your draft is still saved.',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [errors, logoError, isSubmitting, values, logoFile, clearLogo]
  );

  return (
    <div
      className="relative flex h-auto min-h-screen w-full flex-col bg-[#f8f9fb] group/design-root overflow-x-hidden"
      style={{ fontFamily: '"Plus Jakarta Sans", "Noto Sans", sans-serif' }}
    >
      <div className="layout-container flex h-full grow flex-col">
        <div className="px-40 flex flex-1 justify-center py-5">
          <div className="layout-content-container flex flex-col max-w-[960px] flex-1">
            <div className="flex flex-wrap justify-between gap-3 p-4">
              <div className="flex min-w-72 flex-col gap-3">
                <p className="text-[#0e111b] text-4xl font-black leading-tight tracking-[-0.033em]">
                  Post an Inclusive Opportunity
                </p>
                <p className="text-[#4f6296] text-base font-normal leading-normal">
                  Takes ~3 minutes. All listings are screened for accessibility
                  clarity and verified accommodation commitments before
                  publishing.
                </p>
              </div>
            </div>
            <div className="pb-3">
              <div className="flex border-b border-[#d0d6e6] px-4 justify-between">
                {STEP_TABS.map((tab) => {
                  const isActive = activeSection === tab.id;
                  const isComplete =
                    !isActive && isSectionComplete(tab.id);
                  const textColorClass = isActive
                    ? 'text-[#0e111b]'
                    : isComplete
                      ? 'text-tertiary'
                      : 'text-[#4f6296]';
                  const borderClass = isActive
                    ? 'border-b-[#1d4fd8]'
                    : 'border-b-transparent';
                  return (
                    <a
                      key={tab.id}
                      className={`flex flex-col items-center justify-center border-b-[3px] gap-1 pb-[7px] pt-2.5 flex-1 ${borderClass} ${textColorClass}`}
                      href={`#${tab.id}`}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        const section = document.getElementById(tab.id);
                        if (section) {
                          section.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          });
                          window.history.replaceState(
                            null,
                            '',
                            `#${tab.id}`
                          );
                        }
                      }}
                    >
                      <div
                        className={textColorClass}
                        data-icon={tab.iconName}
                        data-size="24px"
                        data-weight={tab.iconWeight}
                      >
                        <span
                          className="material-symbols-outlined text-2xl"
                          aria-hidden="true"
                        >
                          {tab.icon}
                        </span>
                      </div>
                      <p
                        className={`text-sm font-bold leading-normal tracking-[0.015em] ${textColorClass}`}
                      >
                        {tab.label}
                      </p>
                    </a>
                  );
                })}
              </div>
            </div>
            {/* Main Application Form Body */}
            <form
              className="flex flex-col gap-8 px-4 pb-12"
              id="opportunityForm"
              noValidate
              onSubmit={handleSubmit}
            >
              {submitAttempted && errorCount > 0 && (
                <div
                  className="bg-error-container text-on-error-container border border-error rounded-xl p-4 flex items-start gap-3"
                  role="alert"
                >
                  <span
                    className="material-symbols-outlined text-xl"
                    aria-hidden="true"
                  >
                    error
                  </span>
                  <p className="text-sm font-medium">
                    Please correct the {errorCount}{' '}
                    {errorCount === 1 ? 'highlighted field' : 'highlighted fields'}{' '}
                    before submitting. The first field needing attention has
                    been focused for you.
                  </p>
                </div>
              )}
              {/* SECTION 1: BASIC INFORMATION */}
              <section
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-sm"
                id="section-basic"
              >
                <div className="flex items-center justify-between border-b border-surface-container pb-4">
                  <div>
                    <h3 className="font-headline-md text-primary font-bold">
                      1. Basic Opportunity Details
                    </h3>
                    <p className="font-body-sm text-secondary">
                      Clear descriptive titles ensure high discoverability
                      across screen-readers.
                    </p>
                  </div>
                </div>
                {/* Opportunity Title Input */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="opp-title"
                    >
                      Opportunity Title{' '}
                      <span aria-hidden="true" className="text-error">
                        *
                      </span>
                    </label>
                    <span
                      className="text-xs text-secondary"
                      id="title-char-count"
                      aria-live="polite"
                    >
                      {values.opportunityTitle.length} / {MAX_TITLE_LENGTH}{' '}
                      characters
                    </span>
                  </div>
                  <input
                    aria-describedby={
                      fieldError('opportunityTitle')
                        ? 'title-help opp-title-error'
                        : 'title-help'
                    }
                    aria-invalid={
                      fieldError('opportunityTitle') ? true : undefined
                    }
                    aria-required="true"
                    autoComplete="off"
                    className={`w-full rounded-lg border bg-surface text-on-surface px-4 py-3 font-body-md focus:border-primary focus:ring-2 focus:ring-primary-fixed ${
                      fieldError('opportunityTitle')
                        ? 'border-error'
                        : 'border-outline-variant'
                    }`}
                    id="opp-title"
                    maxLength={MAX_TITLE_LENGTH}
                    name="opportunity_title"
                    onBlur={handleBlur('opportunityTitle')}
                    onChange={handleChange('opportunityTitle')}
                    placeholder="e.g., Senior Accessibility Engineer (Remote) or Youth Inclusive Tech Bootcamp 2025"
                    required
                    type="text"
                    value={values.opportunityTitle}
                  />
                  {fieldError('opportunityTitle') && (
                    <span className="text-xs text-error" id="opp-title-error">
                      {fieldError('opportunityTitle')}
                    </span>
                  )}
                  <span className="text-xs text-secondary" id="title-help">
                    Specify role, organization, and primary focus area.
                  </span>
                </div>
                {/* Category Selector */}
                <div className="flex flex-col gap-3">
                  <label className="font-label-lg text-on-surface">
                    Category Classification{' '}
                    <span className="text-error" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div
                    aria-label="Category Selection"
                    aria-describedby={
                      fieldError('category') ? 'category-error' : undefined
                    }
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                    role="radiogroup"
                  >
                    {CATEGORY_OPTIONS.map((option) => {
                      const isSelected = values.category === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`cursor-pointer relative flex items-start gap-3 p-3.5 rounded-lg transition-all ${option.spanClass} ${
                            isSelected
                              ? 'border border-primary bg-secondary-fixed/30'
                              : 'border border-outline-variant hover:border-primary hover:bg-surface-container-low'
                          }`}
                        >
                          <input
                            checked={isSelected}
                            className="mt-1 text-primary focus:ring-primary"
                            name="category"
                            onBlur={handleBlur('category')}
                            onChange={handleChange('category')}
                            type="radio"
                            value={option.value}
                          />
                          <div>
                            <div className="font-label-md text-on-surface font-bold flex items-center gap-1.5">
                              <span
                                className={`material-symbols-outlined text-[18px] ${
                                  isSelected ? 'text-primary' : 'text-secondary'
                                }`}
                              >
                                {option.icon}
                              </span>
                              {option.title}
                            </div>
                            <p className="text-xs text-secondary">
                              {option.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  {fieldError('category') && (
                    <span className="text-xs text-error" id="category-error">
                      {fieldError('category')}
                    </span>
                  )}
                </div>
                {/* Organization Profile Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="org-name"
                    >
                      Organization / Company Name{' '}
                      <span className="text-error" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      aria-describedby={
                        fieldError('orgName') ? 'org-name-error' : undefined
                      }
                      aria-invalid={fieldError('orgName') ? true : undefined}
                      aria-required="true"
                      autoComplete="organization"
                      className={`w-full rounded-lg border bg-surface text-on-surface px-4 py-2.5 font-body-md focus:border-primary focus:ring-primary ${
                        fieldError('orgName')
                          ? 'border-error'
                          : 'border-outline-variant'
                      }`}
                      id="org-name"
                      name="org_name"
                      onBlur={handleBlur('orgName')}
                      onChange={handleChange('orgName')}
                      placeholder="e.g. Kenya Inclusive Tech Trust"
                      required
                      type="text"
                      value={values.orgName}
                    />
                    {fieldError('orgName') && (
                      <span className="text-xs text-error" id="org-name-error">
                        {fieldError('orgName')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="org-url"
                    >
                      Organization Website URL
                    </label>
                    <input
                      aria-describedby={
                        fieldError('orgUrl')
                          ? 'org-url-help org-url-error'
                          : 'org-url-help'
                      }
                      aria-invalid={fieldError('orgUrl') ? true : undefined}
                      autoComplete="url"
                      className={`w-full rounded-lg border bg-surface text-on-surface px-4 py-2.5 font-body-md focus:border-primary focus:ring-primary ${
                        fieldError('orgUrl')
                          ? 'border-error'
                          : 'border-outline-variant'
                      }`}
                      id="org-url"
                      name="org_url"
                      onBlur={handleTextBlur('orgUrl', normalizeUrlValue)}
                      onChange={handleChange('orgUrl')}
                      placeholder="https://example.org"
                      type="url"
                      value={values.orgUrl}
                    />
                    <span className="text-xs text-secondary" id="org-url-help">
                      Optional. Include https:// for best results.
                    </span>
                    {fieldError('orgUrl') && (
                      <span className="text-xs text-error" id="org-url-error">
                        {fieldError('orgUrl')}
                      </span>
                    )}
                  </div>
                </div>
                {/* Logo Upload Dropzone */}
                <div className="flex flex-col gap-2">
                  <label
                    className="font-label-lg text-on-surface"
                    id="logo-upload-label"
                  >
                    Organization Brand Logo
                  </label>
                  <div
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center bg-surface-container-low transition-colors cursor-pointer group ${
                      dragActive
                        ? 'border-primary bg-secondary-fixed/30'
                        : logoError
                          ? 'border-error'
                          : 'border-outline-variant hover:bg-surface-container'
                    }`}
                    id="logo-dropzone"
                    role={logoFile ? undefined : 'button'}
                    tabIndex={logoFile ? undefined : 0}
                    aria-label={
                      logoFile ? undefined : 'Upload organization brand logo'
                    }
                    aria-labelledby={
                      logoFile ? undefined : 'logo-upload-label'
                    }
                    aria-describedby={
                      logoFile
                        ? logoError
                          ? 'logo-error'
                          : undefined
                        : logoError
                          ? 'logo-help logo-error'
                          : 'logo-help'
                    }
                    onClick={(event) => {
                      // Ignore the click that our own programmatic
                      // input.click() dispatches (it bubbles back up here).
                      if (event.target === fileInputRef.current) return;
                      fileInputRef.current?.click();
                    }}
                    onKeyDown={handleZoneKeyDown}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'copy';
                      setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.contains(event.relatedTarget)) {
                        return;
                      }
                      setDragActive(false);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragActive(false);
                      const file =
                        event.dataTransfer.files &&
                        event.dataTransfer.files[0];
                      if (file) assignLogo(file);
                    }}
                  >
                    <input
                      accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                      aria-hidden="true"
                      className="sr-only"
                      id="logo-input"
                      name="org_logo"
                      onChange={handleLogoInputChange}
                      ref={fileInputRef}
                      tabIndex={-1}
                      type="file"
                    />
                    {logoFile ? (
                      <>
                        <div className="mb-2 h-16 w-16 rounded-lg border border-outline-variant bg-surface overflow-hidden flex items-center justify-center">
                          {logoPreview && (
                            <img
                              alt={`Preview of ${logoFile.name}`}
                              className="max-h-full max-w-full object-contain"
                              src={logoPreview}
                            />
                          )}
                        </div>
                        <p className="font-label-md text-on-surface break-all">
                          {logoFile.name}
                        </p>
                        <p className="text-xs text-secondary mt-1">
                          {Math.max(1, Math.round(logoFile.size / 1024))} KB ·
                          Drop a new file or click to replace
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <button
                            className="text-xs font-bold text-primary hover:underline"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            Replace
                          </button>
                          <button
                            className="text-xs font-bold text-error hover:underline"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              clearLogo();
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="size-12 rounded-full bg-secondary-fixed flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                          <span className="material-symbols-outlined text-2xl">
                            cloud_upload
                          </span>
                        </div>
                        <p className="font-label-md text-on-surface">
                          <span className="text-primary font-bold hover:underline">
                            Click to upload
                          </span>{' '}
                          or drag and drop brand logo
                        </p>
                        <p
                          className="text-xs text-secondary mt-1"
                          id="logo-help"
                        >
                          SVG, PNG, or JPG (High contrast monochrome preferred,
                          max 5MB)
                        </p>
                      </>
                    )}
                    {logoError && (
                      <span
                        className="text-xs text-error mt-2"
                        id="logo-error"
                      >
                        {logoError}
                      </span>
                    )}
                  </div>
                </div>
              </section>
              {/* SECTION 2: FORMAT, LOCATION & TIMELINES */}
              <section
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-sm"
                id="section-logistics"
              >
                <div className="flex items-center justify-between border-b border-surface-container pb-4">
                  <div>
                    <h3 className="font-headline-md text-primary font-bold">
                      2. Format, Location &amp; Dates
                    </h3>
                    <p className="font-body-sm text-secondary">
                      Define where and when this opportunity takes place with
                      full accessibility clarity.
                    </p>
                  </div>
                </div>
                {/* Delivery Mode Radio Pills */}
                <div className="flex flex-col gap-3">
                  <label className="font-label-lg text-on-surface">
                    Delivery Mode{' '}
                    <span className="text-error" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div
                    className="grid grid-cols-1 md:grid-cols-3 gap-3"
                    aria-label="Delivery Mode"
                    aria-describedby={
                      fieldError('deliveryMode')
                        ? 'delivery-mode-error'
                        : undefined
                    }
                    role="radiogroup"
                  >
                    {DELIVERY_OPTIONS.map((option) => {
                      const isSelected = values.deliveryMode === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`cursor-pointer p-4 rounded-lg flex flex-col gap-1 text-left ${
                            isSelected
                              ? 'border-2 border-primary bg-secondary-container/40'
                              : 'border border-outline-variant hover:border-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`font-label-lg font-bold flex items-center gap-1.5 ${
                                isSelected
                                  ? 'text-primary-container'
                                  : 'text-on-surface'
                              }`}
                            >
                              <span className="material-symbols-outlined text-xl">
                                {option.icon}
                              </span>{' '}
                              {option.title}
                            </span>
                            <input
                              checked={isSelected}
                              className="text-primary focus:ring-primary"
                              name="delivery_mode"
                              onBlur={handleBlur('deliveryMode')}
                              onChange={handleChange('deliveryMode')}
                              type="radio"
                              value={option.value}
                            />
                          </div>
                          <p className="text-xs text-secondary mt-1">
                            {option.description}
                          </p>
                        </label>
                      );
                    })}
                  </div>
                  {fieldError('deliveryMode') && (
                    <span
                      className="text-xs text-error"
                      id="delivery-mode-error"
                    >
                      {fieldError('deliveryMode')}
                    </span>
                  )}
                </div>
                {/* Physical Location Address (hidden for 100% remote) */}
                {values.deliveryMode !== 'remote' && (
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="venue-address"
                    >
                      Physical Venue &amp; Accessibility Access Directions
                      <>{' '}</>
                      <span className="text-error" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      aria-describedby={
                        fieldError('venueAddress')
                          ? 'venue-help venue-address-error'
                          : 'venue-help'
                      }
                      aria-invalid={
                        fieldError('venueAddress') ? true : undefined
                      }
                      aria-required="true"
                      autoComplete="street-address"
                      className={`w-full rounded-lg border bg-surface text-on-surface px-4 py-2.5 font-body-md focus:border-primary focus:ring-primary ${
                        fieldError('venueAddress')
                          ? 'border-error'
                          : 'border-outline-variant'
                      }`}
                      id="venue-address"
                      name="venue_address"
                      onBlur={handleBlur('venueAddress')}
                      onChange={handleChange('venueAddress')}
                      placeholder="e.g., 4th Floor, All-Access Center, Westlands, Nairobi. (Ramp access on North Entrance)"
                      required
                      type="text"
                      value={values.venueAddress}
                    />
                    {fieldError('venueAddress') && (
                      <span
                        className="text-xs text-error"
                        id="venue-address-error"
                      >
                        {fieldError('venueAddress')}
                      </span>
                    )}
                    <span className="text-xs text-secondary" id="venue-help">
                      Include landmark nearest public transit station and
                      specific ramp entry instructions.
                    </span>
                  </div>
                )}
                {/* Structured Dates Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {/* Application Deadline Field */}
                  <fieldset className="border border-surface-container-high rounded-lg p-4 bg-surface-container-lowest">
                    <legend className="font-label-md text-on-surface font-bold px-1.5">
                      Application Deadline{' '}
                      <span className="text-error" aria-hidden="true">
                        *
                      </span>
                    </legend>
                    <p className="text-xs text-secondary mb-3">
                      Final date to accept accommodations requests and
                      candidacies.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="deadline-day"
                        >
                          Day (DD)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('applicationDeadline')
                              ? 'deadline-error'
                              : undefined
                          }
                          aria-invalid={
                            fieldError('applicationDeadline')
                              ? true
                              : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="deadline-day"
                          inputMode="numeric"
                          max="31"
                          min="1"
                          name="deadline_day"
                          onBlur={handleDateBlur('applicationDeadline')}
                          onChange={handleDateChange('deadline', 'day')}
                          onKeyDown={handleDateKeyDown('deadline', 'day')}
                          placeholder="28"
                          type="number"
                          value={values.deadlineDay}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="deadline-month"
                        >
                          Month (MM)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('applicationDeadline')
                              ? 'deadline-error'
                              : undefined
                          }
                          aria-invalid={
                            fieldError('applicationDeadline')
                              ? true
                              : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="deadline-month"
                          inputMode="numeric"
                          max="12"
                          min="1"
                          name="deadline_month"
                          onBlur={handleDateBlur('applicationDeadline')}
                          onChange={handleDateChange('deadline', 'month')}
                          onKeyDown={handleDateKeyDown('deadline', 'month')}
                          placeholder="11"
                          type="number"
                          value={values.deadlineMonth}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="deadline-year"
                        >
                          Year (YYYY)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('applicationDeadline')
                              ? 'deadline-error'
                              : undefined
                          }
                          aria-invalid={
                            fieldError('applicationDeadline')
                              ? true
                              : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="deadline-year"
                          inputMode="numeric"
                          max={MAX_YEAR}
                          min={MIN_YEAR}
                          name="deadline_year"
                          onBlur={handleDateBlur('applicationDeadline')}
                          onChange={handleDateChange('deadline', 'year')}
                          onKeyDown={handleDateKeyDown('deadline', 'year')}
                          placeholder={String(MIN_YEAR)}
                          type="number"
                          value={values.deadlineYear}
                        />
                      </div>
                    </div>
                    {fieldError('applicationDeadline') && (
                      <span
                        className="text-xs text-error mt-2 block"
                        id="deadline-error"
                      >
                        {fieldError('applicationDeadline')}
                      </span>
                    )}
                  </fieldset>
                  {/* Program Start / Work Commencement Date */}
                  <fieldset className="border border-surface-container-high rounded-lg p-4 bg-surface-container-lowest">
                    <legend className="font-label-md text-on-surface font-bold px-1.5">
                      Start Date / Commencement
                    </legend>
                    <p className="text-xs text-secondary mb-3">
                      Anticipated orientation or start of duties.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="start-day"
                        >
                          Day (DD)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('startDate') ? 'start-error' : undefined
                          }
                          aria-invalid={
                            fieldError('startDate') ? true : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="start-day"
                          inputMode="numeric"
                          max="31"
                          min="1"
                          name="start_day"
                          onBlur={handleDateBlur('startDate')}
                          onChange={handleDateChange('start', 'day')}
                          onKeyDown={handleDateKeyDown('start', 'day')}
                          placeholder="15"
                          type="number"
                          value={values.startDay}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="start-month"
                        >
                          Month (MM)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('startDate') ? 'start-error' : undefined
                          }
                          aria-invalid={
                            fieldError('startDate') ? true : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="start-month"
                          inputMode="numeric"
                          max="12"
                          min="1"
                          name="start_month"
                          onBlur={handleDateBlur('startDate')}
                          onChange={handleDateChange('start', 'month')}
                          onKeyDown={handleDateKeyDown('start', 'month')}
                          placeholder="12"
                          type="number"
                          value={values.startMonth}
                        />
                      </div>
                      <div>
                        <label
                          className="text-[11px] font-bold uppercase tracking-wider text-secondary"
                          htmlFor="start-year"
                        >
                          Year (YYYY)
                        </label>
                        <input
                          aria-describedby={
                            fieldError('startDate') ? 'start-error' : undefined
                          }
                          aria-invalid={
                            fieldError('startDate') ? true : undefined
                          }
                          className="w-full text-center rounded border bg-surface py-2 focus:ring-primary border-outline-variant"
                          id="start-year"
                          inputMode="numeric"
                          max={MAX_YEAR}
                          min={MIN_YEAR}
                          name="start_year"
                          onBlur={handleDateBlur('startDate')}
                          onChange={handleDateChange('start', 'year')}
                          onKeyDown={handleDateKeyDown('start', 'year')}
                          placeholder={String(MIN_YEAR)}
                          type="number"
                          value={values.startYear}
                        />
                      </div>
                    </div>
                    {fieldError('startDate') && (
                      <span
                        className="text-xs text-error mt-2 block"
                        id="start-error"
                      >
                        {fieldError('startDate')}
                      </span>
                    )}
                  </fieldset>
                </div>
                {/* Compensation & Fees with Transparency Badge */}
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="compensation-input"
                    >
                      Compensation, Stipend, or Admission Fee
                    </label>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed font-label-sm rounded-full w-fit">
                      <span className="material-symbols-outlined text-sm">
                        verified
                      </span>
                      Pay transparency builds trust with PWD communities
                    </span>
                  </div>
                  <div className="relative rounded-lg shadow-sm">
                    <input
                      className="w-full rounded-lg border-outline-variant bg-surface text-on-surface px-4 py-2.5 font-body-md focus:border-primary focus:ring-primary"
                      id="compensation-input"
                      name="compensation"
                      onChange={handleChange('compensation')}
                      placeholder="e.g. Ksh 75,000 / month, $1,500 Honorarium, or 100% Free Admission"
                      type="text"
                      value={values.compensation}
                    />
                  </div>
                </div>
              </section>
              {/* SECTION 3: COMPREHENSIVE ACCESSIBILITY & ACCOMMODATIONS */}
              <section
                className="bg-surface-container-lowest border-2 border-primary rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-md relative"
                id="section-accessibility"
              >
                <div className="absolute -top-3.5 left-6 bg-primary text-on-primary px-3 py-0.5 rounded-full font-label-sm uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <span className="material-symbols-outlined text-[15px]">
                    verified_user
                  </span>{' '}
                  Essential Inclusion Standard
                </div>
                <div className="flex items-center justify-between border-b border-surface-container pb-4 pt-1">
                  <div>
                    <h3 className="font-headline-md text-primary font-bold">
                      3. Comprehensive Accommodations Checklist
                    </h3>
                    <p className="font-body-sm text-secondary">
                      AccessAble requires verified physical and sensory
                      accommodations. Check all items that your organization
                      guarantees for candidates.
                    </p>
                  </div>
                </div>
                {/* 4 Grouped Checklist Sections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Group A: Mobility & Physical Access */}
                  <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-on-surface border-b border-outline-variant/30 pb-2">
                      <span className="material-symbols-outlined text-primary text-xl">
                        accessible
                      </span>
                      <h4 className="font-label-lg font-bold">
                        A. Mobility &amp; Physical Access
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.mobility_restrooms}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="mobility_restrooms"
                          onChange={handleChange('mobility_restrooms')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Wheelchair-accessible entrance and ADA restrooms
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.mobility_stepfree}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="mobility_stepfree"
                          onChange={handleChange('mobility_stepfree')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Step-free access &amp; operational wide elevators
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.mobility_parking}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="mobility_parking"
                          onChange={handleChange('mobility_parking')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Dedicated reserved accessible parking bay
                        </span>
                      </label>
                    </div>
                    <div className="mt-2">
                      <label
                        className="text-xs font-semibold text-secondary block mb-1"
                        htmlFor="mobility-notes"
                      >
                        Mobility notes &amp; dimensions:
                      </label>
                      <input
                        className="w-full text-xs rounded border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                        id="mobility-notes"
                        name="mobility_notes"
                        onChange={handleChange('mobilityNotes')}
                        placeholder="e.g. Ramp slope 1:12, entrance doors 36-inch width with auto-push button"
                        type="text"
                        value={values.mobilityNotes}
                      />
                    </div>
                  </div>
                  {/* Group B: Deaf & Hard of Hearing Support */}
                  <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-on-surface border-b border-outline-variant/30 pb-2">
                      <span className="material-symbols-outlined text-primary text-xl">
                        hearing
                      </span>
                      <h4 className="font-label-lg font-bold">
                        B. Deaf &amp; Hard of Hearing Support
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.sli_support}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="sli_support"
                          onChange={handleChange('sli_support')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Sign Language Interpreters (KSL / ASL / ISL)
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.cart_captions}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="cart_captions"
                          onChange={handleChange('cart_captions')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Live CART human captioning or verified real-time CC
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.hearing_loop}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="hearing_loop"
                          onChange={handleChange('hearing_loop')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Telecoil / Assistive listening loop installed
                        </span>
                      </label>
                    </div>
                    <div className="mt-2">
                      <label
                        className="text-xs font-semibold text-secondary block mb-1"
                        htmlFor="hearing-notes"
                      >
                        Hearing accommodations details:
                      </label>
                      <input
                        className="w-full text-xs rounded border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                        id="hearing-notes"
                        name="hearing_notes"
                        onChange={handleChange('hearingNotes')}
                        placeholder="e.g. Two certified KSL interpreters on stage; transcript shared within 2 hours"
                        type="text"
                        value={values.hearingNotes}
                      />
                    </div>
                  </div>
                  {/* Group C: Blind & Low Vision Support */}
                  <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-on-surface border-b border-outline-variant/30 pb-2">
                      <span className="material-symbols-outlined text-primary text-xl">
                        visibility
                      </span>
                      <h4 className="font-label-lg font-bold">
                        C. Blind &amp; Low Vision Support
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.screen_reader_docs}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="screen_reader_docs"
                          onChange={handleChange('screen_reader_docs')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Screen-reader tested digital PDFs &amp; semantic docs
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.braille_materials}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="braille_materials"
                          onChange={handleChange('braille_materials')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Large print (18pt+) &amp; Braille formats on request
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.audio_descriptions}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="audio_descriptions"
                          onChange={handleChange('audio_descriptions')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Live audio description for presentations and diagrams
                        </span>
                      </label>
                    </div>
                    <div className="mt-2">
                      <label
                        className="text-xs font-semibold text-secondary block mb-1"
                        htmlFor="vision-notes"
                      >
                        Low vision accommodation notes:
                      </label>
                      <input
                        className="w-full text-xs rounded border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                        id="vision-notes"
                        name="vision_notes"
                        onChange={handleChange('visionNotes')}
                        placeholder="e.g. Accessible slides and handouts emailed 48 hours prior with full image ALT text"
                        type="text"
                        value={values.visionNotes}
                      />
                    </div>
                  </div>
                  {/* Group D: Neurodivergent & Sensory Considerations */}
                  <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-on-surface border-b border-outline-variant/30 pb-2">
                      <span className="material-symbols-outlined text-primary text-xl">
                        psychology
                      </span>
                      <h4 className="font-label-lg font-bold">
                        D. Neurodivergent &amp; Sensory Support
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.quiet_room}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="quiet_room"
                          onChange={handleChange('quiet_room')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Dedicated low-stimulus quiet room / sensory
                          decompression area
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.pre_agenda}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="pre_agenda"
                          onChange={handleChange('pre_agenda')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Predictable agenda &amp; interview questions provided
                          in advance
                        </span>
                      </label>
                      <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
                        <input
                          checked={values.camera_optional}
                          className="rounded text-primary focus:ring-primary size-4"
                          name="camera_optional"
                          onChange={handleChange('camera_optional')}
                          type="checkbox"
                        />
                        <span className="text-on-surface">
                          Flexible work hours &amp; camera-optional meeting
                          policy
                        </span>
                      </label>
                    </div>
                    <div className="mt-2">
                      <label
                        className="text-xs font-semibold text-secondary block mb-1"
                        htmlFor="sensory-notes"
                      >
                        Sensory considerations notes:
                      </label>
                      <input
                        className="w-full text-xs rounded border-outline-variant bg-surface px-3 py-2 text-on-surface focus:border-primary focus:ring-primary"
                        id="sensory-notes"
                        name="sensory_notes"
                        onChange={handleChange('sensoryNotes')}
                        placeholder="e.g. Fluorescent flicker-free environment, sensory breaks scheduled every 45 mins"
                        type="text"
                        value={values.sensoryNotes}
                      />
                    </div>
                  </div>
                </div>
                {/* Accommodation Coordinator Contact Card */}
                <div className="bg-secondary-fixed/20 border border-secondary-container rounded-xl p-5 flex flex-col gap-4 mt-2">
                  <div className="flex items-center gap-2 text-on-secondary-fixed">
                    <span className="material-symbols-outlined text-primary text-2xl">
                      support_agent
                    </span>
                    <div>
                      <h4 className="font-label-lg font-bold">
                        Designated Accessibility Coordinator
                      </h4>
                      <p className="text-xs text-secondary">
                        Applicants with specific access questions can reach
                        this point person directly.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label
                        className="text-xs font-bold text-on-surface block mb-1"
                        htmlFor="coord-name"
                      >
                        Coordinator Full Name{' '}
                        <span className="text-error" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <input
                        aria-describedby={
                          fieldError('coordinatorName')
                            ? 'coord-name-error'
                            : undefined
                        }
                        aria-invalid={
                          fieldError('coordinatorName') ? true : undefined
                        }
                        aria-required="true"
                        autoComplete="name"
                        className={`w-full text-sm rounded bg-surface px-3 py-2 focus:ring-primary ${
                          fieldError('coordinatorName')
                            ? 'border border-error'
                            : 'border-outline-variant'
                        }`}
                        id="coord-name"
                        name="coordinator_name"
                        onBlur={handleBlur('coordinatorName')}
                        onChange={handleChange('coordinatorName')}
                        placeholder="Grace M., DEI Officer"
                        required
                        type="text"
                        value={values.coordinatorName}
                      />
                      {fieldError('coordinatorName') && (
                        <span
                          className="text-xs text-error mt-1 block"
                          id="coord-name-error"
                        >
                          {fieldError('coordinatorName')}
                        </span>
                      )}
                    </div>
                    <div>
                      <label
                        className="text-xs font-bold text-on-surface block mb-1"
                        htmlFor="coord-contact"
                      >
                        Direct Email or WhatsApp{' '}
                        <span className="text-error" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <input
                        aria-describedby={
                          fieldError('coordinatorContact')
                            ? 'coord-contact-error'
                            : undefined
                        }
                        aria-invalid={
                          fieldError('coordinatorContact') ? true : undefined
                        }
                        aria-required="true"
                        autoComplete="email"
                        className={`w-full text-sm rounded bg-surface px-3 py-2 focus:ring-primary ${
                          fieldError('coordinatorContact')
                            ? 'border border-error'
                            : 'border-outline-variant'
                        }`}
                        id="coord-contact"
                        name="coordinator_contact"
                        onBlur={handleBlur('coordinatorContact')}
                        onChange={handleChange('coordinatorContact')}
                        placeholder="accommodations@org.or.ke"
                        required
                        type="text"
                        value={values.coordinatorContact}
                      />
                      {fieldError('coordinatorContact') && (
                        <span
                          className="text-xs text-error mt-1 block"
                          id="coord-contact-error"
                        >
                          {fieldError('coordinatorContact')}
                        </span>
                      )}
                    </div>
                    <div>
                      <label
                        className="text-xs font-bold text-on-surface block mb-1"
                        htmlFor="coord-notice"
                      >
                        Notice Required for Special Requests
                      </label>
                      <select
                        className="w-full text-sm rounded border-outline-variant bg-surface px-3 py-2 focus:ring-primary"
                        id="coord-notice"
                        name="coordinator_notice"
                        onChange={handleChange('coordinatorNotice')}
                        value={values.coordinatorNotice}
                      >
                        <option>At least 2 business days</option>
                        <option>At least 3 business days</option>
                        <option>At least 1 week prior</option>
                        <option>Same-day accommodations supported</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>
              {/* SECTION 4: FULL DESCRIPTION & APPLICATION METHOD */}
              <section
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-sm"
                id="section-description"
              >
                <div className="flex items-center justify-between border-b border-surface-container pb-4">
                  <div>
                    <h3 className="font-headline-md text-primary font-bold">
                      4. Full Description &amp; Application Procedure
                    </h3>
                    <p className="font-body-sm text-secondary">
                      Write clear, jargon-free role descriptions with
                      accessible formatting.
                    </p>
                  </div>
                </div>
                {/* Rich Text Editor with Formatting Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="opportunity-desc"
                    >
                      Full Opportunity Description{' '}
                      <span className="text-error" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <span className="text-xs text-primary font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">
                        check_circle
                      </span>{' '}
                      Plain Language Recommended
                    </span>
                  </div>
                  {/* Formatting Action Bar */}
                  <div
                    className="border border-outline-variant rounded-t-lg bg-surface-container-low px-3 py-1.5 flex flex-wrap items-center gap-1 text-on-surface"
                    role="toolbar"
                    aria-label="Description formatting options"
                  >
                    <button
                      aria-label="Bold"
                      className="p-1.5 hover:bg-surface-container rounded text-sm font-bold"
                      title="Bold"
                      type="button"
                      onClick={() => applyFormat('bold')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        format_bold
                      </span>
                    </button>
                    <button
                      aria-label="Italic"
                      className="p-1.5 hover:bg-surface-container rounded text-sm italic"
                      title="Italic"
                      type="button"
                      onClick={() => applyFormat('italic')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        format_italic
                      </span>
                    </button>
                    <div className="h-4 w-px bg-outline-variant mx-1"></div>
                    <button
                      aria-label="Heading 2"
                      className="p-1.5 hover:bg-surface-container rounded text-xs font-bold"
                      title="Heading 2"
                      type="button"
                      onClick={() => applyFormat('h2')}
                    >
                      H2
                    </button>
                    <button
                      aria-label="Heading 3"
                      className="p-1.5 hover:bg-surface-container rounded text-xs font-bold"
                      title="Heading 3"
                      type="button"
                      onClick={() => applyFormat('h3')}
                    >
                      H3
                    </button>
                    <div className="h-4 w-px bg-outline-variant mx-1"></div>
                    <button
                      aria-label="Bullet List"
                      className="p-1.5 hover:bg-surface-container rounded"
                      title="Bullet List"
                      type="button"
                      onClick={() => applyFormat('bullet')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        format_list_bulleted
                      </span>
                    </button>
                    <button
                      aria-label="Numbered List"
                      className="p-1.5 hover:bg-surface-container rounded"
                      title="Numbered List"
                      type="button"
                      onClick={() => applyFormat('numbered')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        format_list_numbered
                      </span>
                    </button>
                    <div className="h-4 w-px bg-outline-variant mx-1"></div>
                    <button
                      aria-label="Insert Link"
                      className="p-1.5 hover:bg-surface-container rounded"
                      title="Insert Link"
                      type="button"
                      onClick={() => applyFormat('link')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        link
                      </span>
                    </button>
                    <button
                      aria-label="Code block"
                      className="p-1.5 hover:bg-surface-container rounded"
                      title="Code snippet"
                      type="button"
                      onClick={() => applyFormat('code')}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        code
                      </span>
                    </button>
                  </div>
                  {/* Textarea with accessible helper placeholder */}
                  <textarea
                    aria-describedby={
                      fieldError('description')
                        ? 'desc-help opportunity-desc-error'
                        : 'desc-help'
                    }
                    aria-invalid={
                      fieldError('description') ? true : undefined
                    }
                    aria-required="true"
                    className={`w-full rounded-b-lg border-t-0 bg-surface text-on-surface px-4 py-3 font-body-md focus:border-primary focus:ring-primary ${
                      fieldError('description')
                        ? 'border border-error'
                        : 'border-outline-variant'
                    }`}
                    id="opportunity-desc"
                    name="description"
                    onBlur={handleBlur('description')}
                    onChange={handleChange('description')}
                    placeholder="Provide the opportunity scope, responsibilities, physical/workplace expectations, required skills, and team support structures. Emphasize that persons with disabilities and neurodivergent individuals are strongly encouraged to apply."
                    ref={descriptionRef}
                    required
                    rows="8"
                    value={values.description}
                  ></textarea>
                  <span className="text-xs text-secondary" id="desc-help">
                    Markdown formatting is fully supported. Avoid using images
                    without descriptions or decorative jargon.
                  </span>
                  {fieldError('description') && (
                    <span
                      className="text-xs text-error"
                      id="opportunity-desc-error"
                    >
                      {fieldError('description')}
                    </span>
                  )}
                </div>
                {/* Application URL & Multimodal Option */}
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex flex-col gap-2">
                    <label
                      className="font-label-lg text-on-surface"
                      htmlFor="app-url"
                    >
                      Primary Application or Registration URL{' '}
                      <span className="text-error" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      aria-describedby={
                        fieldError('appUrl')
                          ? 'app-url-help app-url-error'
                          : 'app-url-help'
                      }
                      aria-invalid={fieldError('appUrl') ? true : undefined}
                      aria-required="true"
                      autoComplete="url"
                      className={`w-full rounded-lg border bg-surface text-on-surface px-4 py-2.5 font-body-md focus:border-primary focus:ring-primary ${
                        fieldError('appUrl')
                          ? 'border-error'
                          : 'border-outline-variant'
                      }`}
                      id="app-url"
                      name="app_url"
                      onBlur={handleTextBlur('appUrl', normalizeUrlValue)}
                      onChange={handleChange('appUrl')}
                      placeholder="https://company.applytojob.com/apply/xyz123 or https://forms.gle/..."
                      required
                      type="url"
                      value={values.appUrl}
                    />
                    <span className="text-xs text-secondary" id="app-url-help">
                      Must be an accessible web portal or direct application
                      form.
                    </span>
                    {fieldError('appUrl') && (
                      <span className="text-xs text-error" id="app-url-error">
                        {fieldError('appUrl')}
                      </span>
                    )}
                  </div>
                  {/* Multimodal Application Toggle Box */}
                  <div className="border border-tertiary-container/30 bg-tertiary-fixed/10 p-4 rounded-lg flex items-start gap-3">
                    <input
                      checked={values.multimodalSupport}
                      className="mt-1 rounded text-tertiary focus:ring-tertiary size-4"
                      id="multimodal-check"
                      name="multimodal_support"
                      onChange={handleChange('multimodalSupport')}
                      type="checkbox"
                    />
                    <div>
                      <label
                        className="font-label-md text-on-surface font-bold block cursor-pointer"
                        htmlFor="multimodal-check"
                      >
                        Support Multimodal Alternative Submissions
                      </label>
                      <p className="text-xs text-secondary mt-0.5">
                        Accept voice note applications, video introductions
                        with sign language, or plain-text email CVs for
                        candidates with visual or motor impairments who face
                        portal barriers.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
              {/* SECTION 5: VALIDATION & SUBMISSION */}
              <section
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 flex flex-col gap-6 shadow-sm"
                id="section-review"
              >
                <div className="flex items-center justify-between border-b border-surface-container pb-4">
                  <div>
                    <h3 className="font-headline-md text-primary font-bold">
                      Certification &amp; Submission
                    </h3>
                    <p className="font-body-sm text-secondary">
                      Final review before your listing undergoes expedited
                      2-hour accessibility screening.
                    </p>
                  </div>
                </div>
                {/* Poster Agreement Card */}
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <input
                      aria-describedby={
                        fieldError('pledgeAgree')
                          ? 'pledge-label pledge-agree-error'
                          : 'pledge-label'
                      }
                      aria-invalid={
                        fieldError('pledgeAgree') ? true : undefined
                      }
                      aria-required="true"
                      className="mt-1 size-5 rounded text-primary focus:ring-primary border-outline"
                      id="pledge-agree"
                      name="pledge_agree"
                      onBlur={handleBlur('pledgeAgree')}
                      onChange={handleChange('pledgeAgree')}
                      required
                      type="checkbox"
                    />
                    <label
                      className="font-body-sm text-on-surface cursor-pointer leading-relaxed"
                      htmlFor="pledge-agree"
                      id="pledge-label"
                    >
                      <strong className="font-bold text-on-surface block mb-1">
                        AccessAble True-Inclusion Certification Guarantee
                      </strong>
                      I solemnly certify and confirm on behalf of my
                      organization that all accessibility accommodations marked
                      on this form are active, funded, and verified. I
                      understand that listings found to offer tokenistic or
                      misleading accommodations will be revoked from the
                      platform immediately.
                    </label>
                  </div>
                  {fieldError('pledgeAgree') && (
                    <span
                      className="text-xs text-error"
                      id="pledge-agree-error"
                    >
                      {fieldError('pledgeAgree')}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-secondary bg-surface-container px-3 py-2 rounded">
                    <span className="material-symbols-outlined text-[18px] text-tertiary">
                      gavel
                    </span>
                    <span>
                      Protected under National Disability Non-Discrimination
                      Provisions &amp; WCAG 2.2 Standards.
                    </span>
                  </div>
                </div>
                {/* Actions & Submission Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-container">
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <span className="material-symbols-outlined text-primary text-base">
                      schedule
                    </span>
                    <span>
                      Estimated review time:{' '}
                      <strong>&lt; 2 hours</strong> by our inclusive screening
                      board.
                    </span>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-outline font-label-md font-semibold text-on-surface hover:bg-surface-container transition-colors"
                      type="button"
                      onClick={() => persistDraft(true)}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        bookmark_border
                      </span>
                      Save Draft
                    </button>
                    <button
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary-container text-on-primary font-label-md font-bold shadow hover:bg-primary transition-all focus:ring-4 focus:ring-primary-fixed disabled:opacity-60 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      <span>{isSubmitting ? 'Submitting…' : 'Submit for Review'}</span>
                      {!isSubmitting && (
                        <span className="material-symbols-outlined text-[18px]">
                          arrow_forward
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                {submitStatus && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`w-full text-right text-xs font-semibold ${
                      submitStatus.tone === 'error' ? 'text-error' : 'text-tertiary'
                    }`}
                  >
                    {submitStatus.text}
                  </p>
                )}
                {draftStatus && (
                  <p
                    aria-live="polite"
                    className={`w-full text-right text-xs font-semibold ${
                      draftStatus.tone === 'error'
                        ? 'text-error'
                        : 'text-tertiary'
                    }`}
                  >
                    {draftStatus.text}
                  </p>
                )}
              </section>
            </form>
          </div>
        </div>
      </div>
      {/* Accessible Footer Anchor Component */}
      <footer className="bg-surface-container-highest border-t border-outline-variant mt-auto py-10 px-6 sm:px-12 lg:px-24 text-on-surface">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-3">
              <div className="size-6 bg-primary text-on-primary flex items-center justify-center rounded font-bold text-xs">
                A+
              </div>
              <span className="font-headline-sm font-bold tracking-tight text-on-surface">
                AccessAble PWD Platform
              </span>
            </div>
            <p className="text-xs text-secondary text-center md:text-left">
              Bridging opportunities and barrier-free career ecosystems across
              East Africa and globally.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-secondary">
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="hover:text-primary transition-colors" href="#">
              WCAG 2.2 AAA Guidelines
            </a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="hover:text-primary transition-colors" href="#">
              Accommodation Policy
            </a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="hover:text-primary transition-colors" href="#">
              Screen Reader Shortcuts
            </a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a className="hover:text-primary transition-colors" href="#">
              Data Privacy &amp; Dignity
            </a>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border border-outline-variant bg-surface">
            <span className="material-symbols-outlined text-tertiary text-base">
              verified
            </span>
            <span>WCAG 2.2 AAA Validated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default SubmissionForm;
