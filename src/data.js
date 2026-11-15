export const STORAGE_KEY = 'flame:data';
export const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
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

export const emptyData = () => ({
  version: 2,
  disciplineRecords: [], expenseEntries: [], dailyMissions: [], importantEvents: [],
  settings: { theme: 'dark', accentColor: 'orange', lang: 'ar', startDate: dateKey() },
});

export function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = emptyData();
  const records = new Map();
  for (const item of Array.isArray(raw.disciplineRecords) ? raw.disciplineRecords : []) {
    if (item && validDate(item.date) && ['success', 'failure'].includes(item.status)) records.set(item.date, { date: item.date, status: item.status, ...(item.auto ? { auto: true } : {}) });
  }
  data.disciplineRecords = [...records.values()].sort((a, b) => a.date.localeCompare(b.date));

  const expenses = new Map();
  for (const item of Array.isArray(raw.expenseEntries) ? raw.expenseEntries : []) {
    if (item && typeof item.id === 'string' && validDate(item.date) && typeof item.description === 'string' && item.description.trim() && Number.isFinite(item.amount) && item.amount > 0) {
      expenses.set(item.id, { id: item.id, date: item.date, description: item.description.trim(), amount: Math.round(item.amount * 100) / 100 });
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
  const firstRecord = data.disciplineRecords[0]?.date;
  const startDate = validDate(settings.startDate) ? settings.startDate : (firstRecord || data.settings.startDate);
  const minStart = shiftDate(dateKey(), -36500);
  data.settings.startDate = startDate < minStart ? minStart : startDate;
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
  const dailyMissions = data.dailyMissions.map((mission) => {
    const status = mission.scheduledDate < today ? 'archived' : mission.scheduledDate === today ? 'active' : 'upcoming';
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
  const importantEvents = data.importantEvents.map((event) => {
    if (event.status === 'upcoming' && eventDeadline(event).getTime() < now.getTime()) { changed = true; return { ...event, status: 'expired' }; }
    return event;
  });
  return changed ? { ...data, dailyMissions, disciplineRecords, importantEvents } : data;
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
  for (const mission of data.dailyMissions) if (mission.status !== 'upcoming' && mission.tasks.length && mission.tasks.every((task) => task.completed)) score += 20;
  return Math.max(0, score);
}
