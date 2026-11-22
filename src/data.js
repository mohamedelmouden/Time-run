export const STORAGE_KEY = 'flame:data';
export const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
export const LEGACY_COMMITMENT_ID = 'legacy-leave-distractions';
export const PURCHASE_PERIODS = ['morning', 'noon', 'afternoon', 'night'];
export const purchasePeriodLabels = { morning: 'صباحاً', noon: 'زوالاً', afternoon: 'بعد الزوال', night: 'ليلاً', unspecified: 'غير محدد' };
export const accents = [
  { id: 'orange', label: 'برتقالي', primary: '#ff8a32', glow: '#ffc15a' },
  { id: 'yellow', label: 'أصفر', primary: '#ca8a04', glow: '#facc15' },
  { id: 'pink', label: 'وردي', primary: '#db2777', glow: '#f472b6' },
  { id: 'red', label: 'أحمر', primary: '#dc2626', glow: '#f87171' },
  { id: 'blue', label: 'أزرق', primary: '#2563eb', glow: '#60a5fa' },
  { id: 'purple', label: 'بنفسجي', primary: '#9333ea', glow: '#c084fc' },
  { id: 'green', label: 'أخضر', primary: '#16a34a', glow: '#4ade80' },
  { id: 'cyan', label: 'سماوي', primary: '#0891b2', glow: '#67e8f9' },
];

export const pad = (value) => String(value).padStart(2, '0');
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const shiftDate = (key, amount) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
};
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `flame-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const validDate = (value) => typeof value === 'string' && DATE_FORMAT.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime()) && dateKey(new Date(`${value}T12:00:00`)) === value;
export const weekdayIndex = (key) => (new Date(`${key}T12:00:00`).getDay() + 6) % 7;

export function previousCommitmentDay(commitment, from) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = shiftDate(from, -offset);
    if (day < commitment.startDate) return null;
    if (commitment.weekdays.includes(weekdayIndex(day))) return day;
  }
  return null;
}

export function nextCommitmentDay(commitment, from) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = shiftDate(from, offset);
    if (commitment.weekdays.includes(weekdayIndex(day))) return day;
  }
  return null;
}

export function commitmentStreak(commitment, effective) {
  const records = new Map(commitment.records.map((record) => [record.date, record.status]));
  const successes = commitment.records.filter((record) => record.status === 'success');
  let best = 0, run = 0, previous = null;
  for (const record of commitment.records) {
    if (record.status !== 'success') { run = 0; previous = null; continue; }
    run = previous && nextCommitmentDay(commitment, previous) === record.date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = record.date;
  }

  let current = 0;
  if (effective >= commitment.startDate) {
    let cursor = commitment.weekdays.includes(weekdayIndex(effective)) ? effective : null;
    const failedToday = cursor && records.get(cursor) === 'failure';
    if (!failedToday) {
      if (!cursor || records.get(cursor) !== 'success') cursor = previousCommitmentDay(commitment, effective);
      while (cursor && records.get(cursor) === 'success') {
        current += 1;
        cursor = previousCommitmentDay(commitment, cursor);
      }
    }
  }
  return { current, best, total: successes.length };
}

export const emptyData = () => ({
  version: 3,
  disciplineRecords: [], commitments: [{ id: LEGACY_COMMITMENT_ID, title: 'ترك التفاهة', startDate: dateKey(), weekdays: [0, 1, 2, 3, 4, 5, 6], records: [], flameStyle: 0 }], expenseEntries: [], dailyMissions: [], importantEvents: [],
  settings: { theme: 'dark', accentColor: 'orange', lang: 'ar', startDate: dateKey(), userName: '', signature: '' },
});

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = emptyData();
  const records = new Map();
  for (const item of Array.isArray(raw.disciplineRecords) ? raw.disciplineRecords : []) {
    if (item && validDate(item.date) && ['success', 'failure'].includes(item.status)) records.set(item.date, { date: item.date, status: item.status, ...(item.auto ? { auto: true } : {}) });
  }
  data.disciplineRecords = [...records.values()].sort((a, b) => a.date.localeCompare(b.date));

  const commitments = new Map();
  for (const item of Array.isArray(raw.commitments) ? raw.commitments : []) {
    if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || !item.title.trim() || !validDate(item.startDate)) continue;
    const weekdays = [...new Set((Array.isArray(item.weekdays) ? item.weekdays : []).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
    if (!weekdays.length) continue;
    const commitmentRecords = new Map();
    for (const record of Array.isArray(item.records) ? item.records : []) {
      if (record && validDate(record.date) && record.date >= item.startDate && weekdays.includes(weekdayIndex(record.date)) && ['success', 'failure'].includes(record.status)) {
        commitmentRecords.set(record.date, { date: record.date, status: record.status, ...(record.auto ? { auto: true } : {}) });
      }
    }
    commitments.set(item.id, {
      id: item.id,
      title: item.title.trim().slice(0, 120),
      startDate: item.startDate,
      weekdays,
      records: [...commitmentRecords.values()].sort((a, b) => a.date.localeCompare(b.date)),
      flameStyle: Number.isInteger(item.flameStyle) && item.flameStyle >= 0 && item.flameStyle <= 100000 ? item.flameStyle : commitments.size + 1,
    });
  }
  data.commitments = [...commitments.values()];

  const expenses = new Map();
  for (const item of Array.isArray(raw.expenseEntries) ? raw.expenseEntries : []) {
    if (item && typeof item.id === 'string' && validDate(item.date) && typeof item.description === 'string' && item.description.trim() && Number.isFinite(item.amount) && item.amount > 0) {
      expenses.set(item.id, { id: item.id, date: item.date, description: item.description.trim(), amount: Math.round(item.amount * 100) / 100, purchasePeriod: PURCHASE_PERIODS.includes(item.purchasePeriod) ? item.purchasePeriod : 'unspecified' });
    }
  }
  data.expenseEntries = [...expenses.values()].sort((a, b) => a.date.localeCompare(b.date));

  const missions = new Map();
  for (const item of Array.isArray(raw.dailyMissions) ? raw.dailyMissions : []) {
    if (!item || typeof item.id !== 'string' || !validDate(item.scheduledDate) || !Array.isArray(item.tasks)) continue;
    const tasks = item.tasks.filter((task) => task && typeof task.id === 'string' && typeof task.title === 'string' && task.title.trim()).map((task) => ({
      id: task.id, title: task.title.trim(), description: typeof task.description === 'string' ? task.description.trim() || undefined : undefined, completed: !!task.completed,
    }));
    missions.set(item.id, { id: item.id, scheduledDate: item.scheduledDate, tasks, status: ['upcoming', 'active', 'archived'].includes(item.status) ? item.status : 'upcoming', createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), ...(typeof item.archivedAt === 'string' ? { archivedAt: item.archivedAt } : {}) });
  }
  data.dailyMissions = [...missions.values()];

  const categories = ['exam', 'deadline', 'competition', 'appointment', 'personal', 'other'];
  const priorities = ['normal', 'important', 'critical'];
  const events = new Map();
  for (const item of Array.isArray(raw.importantEvents) ? raw.importantEvents : []) {
    if (!item || typeof item.id !== 'string' || typeof item.title !== 'string' || !item.title.trim() || !validDate(item.eventDate)) continue;
    const eventTime = typeof item.eventTime === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.eventTime) ? item.eventTime : undefined;
    events.set(item.id, {
      id: item.id, title: item.title.trim(), description: typeof item.description === 'string' ? item.description.trim() || undefined : undefined,
      eventDate: item.eventDate, ...(eventTime ? { eventTime } : {}), category: categories.includes(item.category) ? item.category : 'other',
      priority: priorities.includes(item.priority) ? item.priority : 'normal', status: ['upcoming', 'completed', 'expired'].includes(item.status) ? item.status : 'upcoming',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(), ...(typeof item.completedAt === 'string' ? { completedAt: item.completedAt } : {}),
    });
  }
  data.importantEvents = [...events.values()];

  const settings = raw.settings ?? {};
  if (['dark', 'light', 'system'].includes(settings.theme)) data.settings.theme = settings.theme;
  if (accents.some((accent) => accent.id === settings.accentColor)) data.settings.accentColor = settings.accentColor;
  if (settings.lang === 'fr' || settings.lang === 'ar') data.settings.lang = settings.lang;
  if (typeof settings.userName === 'string') data.settings.userName = settings.userName.trim().slice(0, 100);
  if (typeof settings.signature === 'string' && settings.signature.length <= 600_000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(settings.signature)) data.settings.signature = settings.signature;
  const firstRecord = data.disciplineRecords[0]?.date;
  const startDate = validDate(settings.startDate) ? settings.startDate : (firstRecord || data.settings.startDate);
  const minStart = shiftDate(dateKey(), -36500);
  data.settings.startDate = startDate < minStart ? minStart : startDate;
  const legacy = commitments.get(LEGACY_COMMITMENT_ID);
  const legacyRecords = new Map((legacy?.records || []).map((record) => [record.date, record]));
  for (const record of data.disciplineRecords) legacyRecords.set(record.date, record);
  const legacyCommitment = {
    id: LEGACY_COMMITMENT_ID,
    title: 'ترك التفاهة',
    startDate: data.settings.startDate,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    records: [...legacyRecords.values()].filter((record) => record.date >= data.settings.startDate).sort((a, b) => a.date.localeCompare(b.date)),
    flameStyle: 0,
  };
  const usedFlames = new Set([0]);
  const customCommitments = [...commitments.values()].filter((item) => item.id !== LEGACY_COMMITMENT_ID).map((item, index) => {
    let flameStyle = item.flameStyle;
    if (usedFlames.has(flameStyle)) flameStyle = index + 1;
    while (usedFlames.has(flameStyle)) flameStyle += 1;
    usedFlames.add(flameStyle);
    return { ...item, flameStyle };
  });
  data.commitments = [legacyCommitment, ...customCommitments];
  return data;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    let stored;
    try { stored = JSON.parse(raw); }
    catch { try { localStorage.setItem(`${STORAGE_KEY}:corrupt`, raw); } catch { /* storage may be unavailable */ } return emptyData(); }
    const parsed = normalizeData(stored);
    return parsed ?? emptyData();
  } catch {
    return emptyData();
  }
}

export function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}

export function effectiveDay(now = new Date()) { return dateKey(now.getHours() < 8 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12) : now); }
export function markableDay(now = new Date()) {
  if (now.getHours() >= 22) return dateKey(now);
  if (now.getHours() < 8) return shiftDate(dateKey(now), -1);
  return null;
}
export const eventDeadline = (event) => new Date(`${event.eventDate}T${event.eventTime || '23:59'}:00`);

export function syncData(data, today = dateKey(), now = new Date()) {
  let changed = false;
  const missionDay = effectiveDay(now);
  const dailyMissions = data.dailyMissions.map((mission) => {
    const status = mission.scheduledDate < missionDay ? 'archived' : mission.scheduledDate === missionDay ? 'active' : 'upcoming';
    if (status === mission.status) return mission;
    changed = true;
    return { ...mission, status, archivedAt: status === 'archived' ? (mission.archivedAt || now.toISOString()) : undefined };
  });
  const have = new Set(data.disciplineRecords.map((record) => record.date));
  const additions = [];
  for (let cursor = data.settings.startDate; cursor < effectiveDay(now); cursor = shiftDate(cursor, 1)) {
    if (!have.has(cursor)) additions.push({ date: cursor, status: 'failure', auto: true });
  }
  const disciplineRecords = additions.length ? [...data.disciplineRecords, ...additions].sort((a, b) => a.date.localeCompare(b.date)) : data.disciplineRecords;
  if (additions.length) changed = true;
  const commitments = data.commitments.map((commitment) => {
    const have = new Set(commitment.records.map((record) => record.date));
    const missing = [];
    for (let cursor = commitment.startDate; cursor < effectiveDay(now); cursor = shiftDate(cursor, 1)) {
      if (commitment.weekdays.includes(weekdayIndex(cursor)) && !have.has(cursor)) missing.push({ date: cursor, status: 'failure', auto: true });
    }
    if (!missing.length) return commitment;
    changed = true;
    return { ...commitment, records: [...commitment.records, ...missing].sort((a, b) => a.date.localeCompare(b.date)) };
  });
  const importantEvents = data.importantEvents.map((event) => {
    if (event.status === 'upcoming' && eventDeadline(event).getTime() < now.getTime()) { changed = true; return { ...event, status: 'expired' }; }
    return event;
  });
  return changed ? { ...data, dailyMissions, disciplineRecords, commitments, importantEvents } : data;
}

export function streaks(records, effective) {
  const wins = new Set(records.filter((record) => record.status === 'success').map((record) => record.date));
  const todayLost = records.some((record) => record.date === effective && record.status === 'failure');
  let current = 0;
  if (!todayLost) for (let day = wins.has(effective) ? effective : shiftDate(effective, -1); wins.has(day); day = shiftDate(day, -1)) current += 1;
  let best = 0, run = 0, previous = null;
  for (const day of [...wins].sort()) { run = previous && Math.round((new Date(`${day}T12:00`).getTime() - new Date(`${previous}T12:00`).getTime()) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); previous = day; }
  return { current, best };
}

export function points(data) {
  let score = data.disciplineRecords.reduce((sum, record) => sum + (record.status === 'success' ? 10 : -10), 0);
  for (const commitment of data.commitments) if (commitment.id !== LEGACY_COMMITMENT_ID) score += commitment.records.reduce((sum, record) => sum + (record.status === 'success' ? 10 : -10), 0);
  for (const mission of data.dailyMissions) if (mission.status !== 'upcoming' && mission.tasks.length && mission.tasks.every((task) => task.completed)) score += 20;
  return Math.max(0, score);
}
