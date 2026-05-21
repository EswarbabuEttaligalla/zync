const axios = require('axios');
const leoProfanity = require('leo-profanity');

let Filter;
try {
  Filter = require('bad-words');
} catch (error) {
  Filter = class FallbackFilter {
    addWords() {}
    isProfane() { return false; }
    clean(text) { return text; }
  };
}
const ModerationLog = require('../models/ModerationLog');

const DEFAULT_BANNED_TERMS = [
  'fuck',
  'fck',
  'fuk',
  'phuck',
  'shit',
  'sh1t',
  'bitch',
  'btch',
  'bi7ch',
  'idiot',
  'id10t',
  'moron',
  'stupid',
  'dumb',
  'loser',
  'asshole',
  'a55hole',
  'motherfucker',
  'mother fucker',
  'mf',
  'retard',
  'retarded',
  'fuck you',
  'fuck off',
  'go fuck yourself',
  'shut up',
  'piece of shit',
  'go to hell',
  'you idiot',
  'you moron',
  'you are stupid',
];

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '!': 'i',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  '$': 's',
  '7': 't',
  '+': 't',
  '8': 'b',
  '9': 'g',
};

const VARIANT_MAP = {
  fuck: ['fck', 'fuk', 'phuck', 'fucck'],
  bitch: ['btch', 'b1tch', 'bi7ch'],
  idiot: ['id10t'],
  asshole: ['a55hole', 'ashole'],
  shit: ['sh1t'],
  motherfucker: ['mother fucker', 'mother-fucker', 'muthafucker'],
};

const UNICODE_CONFUSABLES = {
  'а': 'a', 'ɑ': 'a', 'á': 'a', 'à': 'a', 'ä': 'a', 'â': 'a', 'ã': 'a', 'å': 'a',
  'б': 'b', 'ɓ': 'b',
  'с': 'c', 'ϲ': 'c',
  'ԁ': 'd',
  'е': 'e', 'ё': 'e', 'ê': 'e', 'è': 'e', 'é': 'e',
  'ғ': 'f', 'ƒ': 'f',
  'ɡ': 'g',
  'һ': 'h',
  'і': 'i', 'í': 'i', 'ì': 'i', 'ï': 'i', 'ɩ': 'i',
  'ј': 'j',
  'κ': 'k', 'ḱ': 'k',
  'ⅼ': 'l', 'ӏ': 'l',
  'м': 'm',
  'ո': 'n', 'ñ': 'n',
  'о': 'o', 'ö': 'o', 'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o',
  'р': 'p',
  'ԛ': 'q',
  'г': 'r',
  'ѕ': 's', 'ś': 's', 'š': 's',
  'т': 't', 'ţ': 't',
  'υ': 'u', 'ս': 'u', 'ü': 'u', 'ú': 'u', 'ù': 'u', 'û': 'u',
  'ѵ': 'v',
  'ԝ': 'w',
  'х': 'x',
  'у': 'y', 'ý': 'y', 'ÿ': 'y',
  'ᴢ': 'z',
};

const INVISIBLE_RE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g;

const MUTE_AFTER_WARNINGS = Number(process.env.MUTE_AFTER_WARNINGS || 3);
const TEMP_MUTE_MINUTES = Number(process.env.TEMP_MUTE_MINUTES || 15);

const LOCAL_ENDPOINT_RE = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?(?:\/|$)/i;

const customFilter = new Filter({ placeHolder: '*' });

try {
  if (typeof leoProfanity.loadDictionary === 'function') {
    leoProfanity.loadDictionary('en');
  }
} catch (error) {
  // Dictionary loading is best-effort; built-in terms still apply.
}

const configuredTerms = Array.from(new Set([
  ...DEFAULT_BANNED_TERMS,
  ...(process.env.BANNED_WORDS || '')
    .split(',')
    .map(term => term.trim().toLowerCase())
    .filter(Boolean),
]));

if (typeof leoProfanity.add === 'function') {
  leoProfanity.add(configuredTerms);
}

if (typeof customFilter.addWords === 'function') {
  customFilter.addWords(...configuredTerms);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapConfusableCharacter = (character) => {
  if (UNICODE_CONFUSABLES[character]) {
    return UNICODE_CONFUSABLES[character];
  }

  const normalized = character.normalize('NFKC');
  if (normalized.length === 1 && normalized !== character) {
    return UNICODE_CONFUSABLES[normalized] || normalized;
  }

  return normalized;
};

const normalizeText = (input = '') => {
  const lowered = String(input)
    .normalize('NFKC')
    .toLowerCase()
    .replace(INVISIBLE_RE, ' ')
    .replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g, '');

  const leetNormalized = lowered
    .split('')
    .map((character) => mapConfusableCharacter(LEET_MAP[character] || character))
    .join('');

  return leetNormalized
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/[\p{Cf}\p{Cc}]/gu, ' ')
    .replace(/(.)\1{1,}/g, '$1')
    .replace(/\s+/g, '')
    .trim();
};

const normalizeServerUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\/+$/, '');
};

const isLocalEndpoint = (value) => LOCAL_ENDPOINT_RE.test(normalizeServerUrl(value));

const resolveAiServerUrl = (providedUrl) => {
  const configuredUrl = normalizeServerUrl(providedUrl || process.env.AI_SERVER_URL || '');

  if (!configuredUrl) {
    return process.env.NODE_ENV === 'production' ? null : 'http://localhost:8000';
  }

  if (process.env.NODE_ENV === 'production' && isLocalEndpoint(configuredUrl)) {
    return null;
  }

  return configuredUrl;
};

const buildAiUnavailableResult = ({ reason, error, degradedReason = 'ai-unavailable' }) => {
  console.warn('[moderation] AI moderation degraded', {
    reason,
    degradedReason,
    error: error?.message || null,
  });

  return {
    approved: true,
    pendingReview: false,
    degraded: true,
    aiUnavailable: true,
    status: 'degraded',
    reason,
    message: reason,
    toxicityScore: 0,
    hasFallacy: false,
    fallacies: [],
    factCheckRequired: false,
    sentiment: 'neutral',
    error: error?.message || null,
  };
};

const buildFlexiblePattern = (term) => {
  const tokens = term
    .toLowerCase()
    .split('')
    .filter(Boolean)
  .map(character => escapeRegExp(character));

  return new RegExp(`(?:^|[^a-z0-9])${tokens.join('[^a-z0-9]*')}(?:[^a-z0-9]|$)`, 'i');
};

const getCandidateTerms = () => {
  const terms = new Set();

  configuredTerms.forEach((term) => {
    terms.add(term);
    if (VARIANT_MAP[term]) {
      VARIANT_MAP[term].forEach(variant => terms.add(variant));
    }
  });

  return Array.from(terms);
};

const detectProfanity = (content = '') => {
  const normalizedContent = normalizeText(content);
  const detectedTerms = new Set();
  const candidateTerms = getCandidateTerms();

  const directChecks = [
    typeof leoProfanity.check === 'function' ? leoProfanity.check(content) : false,
    typeof leoProfanity.check === 'function' ? leoProfanity.check(normalizedContent) : false,
    typeof customFilter.isProfane === 'function' ? customFilter.isProfane(content) : false,
    typeof customFilter.isProfane === 'function' ? customFilter.isProfane(normalizedContent) : false,
  ];

  candidateTerms.forEach((term) => {
    const pattern = buildFlexiblePattern(term);
    if (pattern.test(normalizedContent)) {
      detectedTerms.add(term);
    }
  });

  const matchedTerms = Array.from(detectedTerms);
  const isProfane = directChecks.some(Boolean) || matchedTerms.length > 0;
  const severity = matchedTerms.length > 1 ? 'high' : 'medium';

  return {
    blocked: isProfane,
    normalizedContent,
    matchedTerms,
    severity,
    reason: isProfane ? 'Message blocked due to inappropriate language.' : null,
    filterEngine: 'leo-profanity+bad-words+custom-regex',
  };
};

const runAiModeration = async ({ content, roomId, userId, timeout = 5000, aiServerUrl }) => {
  const resolvedAiServerUrl = resolveAiServerUrl(aiServerUrl);

  if (!resolvedAiServerUrl) {
    return buildAiUnavailableResult({
      reason: 'AI moderation unavailable. Message allowed under local moderation fallback.',
      degradedReason: 'ai-missing-or-local-endpoint',
    });
  }

  try {
    const response = await axios.post(`${resolvedAiServerUrl}/api/analyze`, {
      content,
      roomId,
      userId,
      timestamp: new Date().toISOString(),
    }, {
      timeout,
    });

    const analysis = response.data || {};
    const approved = analysis.approved !== false;

    return {
      ...analysis,
      approved,
      pendingReview: Boolean(analysis.pendingReview),
      status: approved ? (analysis.pendingReview ? 'review_queued' : 'approved') : 'blocked',
    };
  } catch (error) {
    return buildAiUnavailableResult({
      reason: 'AI moderation unavailable. Message allowed under local moderation fallback.',
      error,
      degradedReason: error.code || error.cause?.code || 'ai-request-failed',
    });
  }
};

const clearExpiredMute = (participant) => {
  if (!participant) {
    return false;
  }

  if (participant.isMuted && participant.mutedUntil && participant.mutedUntil <= new Date()) {
    participant.isMuted = false;
    participant.mutedUntil = null;
    participant.muteReason = null;
    participant.violationCount = 0;
    return true;
  }

  return false;
};

const applyViolationAndMute = async ({ room, userId, reason, muteAfterWarnings = MUTE_AFTER_WARNINGS, muteMinutes = TEMP_MUTE_MINUTES }) => {
  if (!room) {
    return {
      warningCount: 0,
      violationCount: 0,
      muteApplied: false,
      mutedUntil: null,
    };
  }

  const participant = room.participants.find(participantEntry => participantEntry.user && participantEntry.user.toString() === userId.toString());

  if (!participant) {
    return {
      warningCount: 0,
      violationCount: 0,
      muteApplied: false,
      mutedUntil: null,
    };
  }

  clearExpiredMute(participant);

  participant.violationCount = (participant.violationCount || 0) + 1;

  const shouldMute = participant.violationCount >= muteAfterWarnings;
  let mutedUntil = null;

  if (shouldMute) {
    mutedUntil = new Date(Date.now() + muteMinutes * 60 * 1000);
    participant.isMuted = true;
    participant.mutedUntil = mutedUntil;
    participant.muteReason = reason;
    participant.violationCount = 0;
  }

  room.stats.flaggedMessages = (room.stats.flaggedMessages || 0) + 1;
  room.stats.warningsIssued = (room.stats.warningsIssued || 0) + 1;

  await room.save();

  return {
    warningCount: room.stats.warningsIssued,
    violationCount: participant.violationCount,
    muteApplied: shouldMute,
    mutedUntil,
  };
};

const recordModerationDecision = async ({
  room,
  user,
  userId,
  content,
  normalizedContent,
  matchedTerms = [],
  severity = 'medium',
  action = 'message-blocked',
  source = 'system',
  reason = 'Message blocked due to inappropriate language.',
  filterEngine = 'moderation-service',
  aiScores = {},
  factCheckResults = null,
  notes = null,
  countWarning = true,
}) => {
  const targetUser = user || null;
  const targetUserId = targetUser?._id || userId;

  if (countWarning && targetUser && targetUser.stats) {
    targetUser.stats.warningsReceived = (targetUser.stats.warningsReceived || 0) + 1;
    await targetUser.save();
  }

  const roomOutcome = countWarning && room && targetUserId
    ? await applyViolationAndMute({ room, userId: targetUserId, reason })
    : {
        warningCount: targetUser?.stats?.warningsReceived || 0,
        violationCount: 0,
        muteApplied: false,
        mutedUntil: null,
      };

  const log = await ModerationLog.create({
    targetUser: targetUserId,
    room: room?._id,
    action,
    severity,
    source,
    details: {
      originalContent: content,
      normalizedContent,
      matchedTerms,
      filterEngine,
      blockedReason: reason,
      warningCount: roomOutcome.warningCount,
      violationCount: roomOutcome.violationCount,
      muteExpiresAt: roomOutcome.mutedUntil,
      aiScores,
      factCheckResults,
      reason,
      notes,
    },
  });

  return {
    log,
    ...roomOutcome,
    warningCount: targetUser?.stats?.warningsReceived || roomOutcome.warningCount,
  };
};

const logModerationDegradation = async ({ room, user, userId, content, normalizedContent, reason, source = 'system', aiScores = {}, notes = null }) => recordModerationDecision({
  room,
  user,
  userId,
  content,
  normalizedContent,
  matchedTerms: [],
  severity: 'low',
  action: 'ai-override',
  source,
  reason,
  filterEngine: 'ai-fallback',
  aiScores,
  notes: notes || reason,
  countWarning: false,
});

module.exports = {
  normalizeText,
  detectProfanity,
  resolveAiServerUrl,
  isLocalEndpoint,
  runAiModeration,
  clearExpiredMute,
  applyViolationAndMute,
  recordModerationDecision,
  logModerationDegradation,
};