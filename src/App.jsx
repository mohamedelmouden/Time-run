import React, { createContext, useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, AlarmClock, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, CalendarDays,
  CalendarPlus, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3, CloudDownload,
  Download, Flame, Home, Languages, ListChecks, Menu, Moon, Pencil, Plus, Receipt, RotateCcw, Settings2,
  ShieldCheck, Sparkles, Star, Sun, Target, Trash2, Upload, X,
} from 'lucide-react';
import {
  accents, dateKey, emptyData, effectiveDay, eventDeadline, loadData, markableDay, normalizeData,
  pad, points, PURCHASE_PERIODS, purchasePeriodLabels, saveData, shiftDate, streaks, syncData, uid,
} from './data.js';
import { localeTag, tr } from './i18n.js';

const Ctx = createContext(null);
const useFlame = () => useContext(Ctx);
const CAT = { exam: 'امتحان', deadline: 'موعد نهائي', competition: 'مسابقة', appointment: 'موعد', personal: 'شخصي', other: 'أخرى' };
const PRIORITIES = { normal: 'عادية', important: 'مهم', critical: 'حرجة' };
const WIN_MESSAGES = ['أحسنت! شعلتك تكبر.', 'انضباطك يصنع الفرق.', 'يوم آخر في رصيدك. استمر ولا تستسلم.'];

function useDateLabel(language) {
  return (key, options = {}) => {
    if (!key) return '';
    const date = new Date(`${key}T12:00:00`);
    return new Intl.DateTimeFormat(localeTag(language), { weekday: options.weekday ?? 'long', day: 'numeric', month: options.month ?? 'long', ...(options.year ? { year: 'numeric' } : {}) }).format(date);
  };
}

function money(amount, language) {
  return `${new Intl.NumberFormat(localeTag(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${language === 'fr' ? 'MAD' : 'د.م.'}`;
}

function printSelected(kind, fileName) {
  const previousTitle = document.title;
  let done = false;
  const clean = () => {
    if (done) return;
    done = true;
    delete document.body.dataset.printReport;
    document.title = previousTitle;
    window.removeEventListener('afterprint', clean);
  };
  document.title = fileName;
  document.body.dataset.printReport = kind;
  window.addEventListener('afterprint', clean, { once: true });
  window.setTimeout(clean, 60000);
  window.print();
}

function FireMark({ days }) {
  const level = days === 0 ? 0 : days <= 3 ? 1 : days <= 7 ? 2 : days <= 14 ? 3 : days <= 30 ? 4 : 5;
  return <div className={`fire-mark fire-level-${level}`} aria-hidden="true">
    <svg viewBox="0 0 120 140">
      <defs>
        <radialGradient id="flameHalo" cx="50%" cy="76%" r="56%"><stop stopColor="#ffb629" stopOpacity=".72"/><stop offset=".38" stopColor="#ff5b12" stopOpacity=".28"/><stop offset="1" stopColor="#e92d10" stopOpacity="0"/></radialGradient>
        <linearGradient id="flameOuter" x1=".18" y1=".05" x2=".82" y2=".96"><stop stopColor="#ffe75a"/><stop offset=".2" stopColor="#ff9d19"/><stop offset=".57" stopColor="#f44913"/><stop offset=".82" stopColor="#e82b13"/><stop offset="1" stopColor="#ff8c16"/></linearGradient>
        <linearGradient id="flameTongue" x1=".28" y1=".08" x2=".72" y2=".98"><stop stopColor="#fff36b"/><stop offset=".38" stopColor="#ffc42d"/><stop offset=".76" stopColor="#ff6718"/><stop offset="1" stopColor="#f53b12"/></linearGradient>
        <radialGradient id="flameCore" cx="50%" cy="70%" r="65%"><stop stopColor="#fffce0"/><stop offset=".38" stopColor="#fff080"/><stop offset=".76" stopColor="#ffc52b"/><stop offset="1" stopColor="#ff8a18"/></radialGradient>
      </defs>
      <ellipse className="fire-halo" cx="60" cy="106" rx="43" ry="27" fill="url(#flameHalo)"/>
      <path className="fire-body" d="M61 7C54 21 59 35 68 48c6 9 12 15 13 24 5-5 5-13 2-21 13 15 20 31 17 48-3 21-19 35-40 35-22 0-38-15-40-36-2-17 7-31 19-44 0 11 3 19 8 25 2-15 11-25 16-38 5-12 3-24-2-34z" fill="url(#flameOuter)"/>
      <path className="fire-tongue" d="M60 126c-17-2-28-14-27-29 1-9 6-17 13-25-1 11 5 16 10 22 4-8 5-15 3-23 10 12 15 21 13 33-1 10-6 18-12 22z" fill="url(#flameTongue)"/>
      <path className="fire-core" d="M61 119c-10-8-11-17-5-27 4-6 7-12 7-20 9 10 15 18 14 29-1 9-7 16-16 18z" fill="url(#flameCore)"/>
      <circle className="ember ember-a" cx="39" cy="77" r="1.4"/><circle className="ember ember-b" cx="77" cy="68" r="1.1"/><circle className="ember ember-c" cx="53" cy="53" r="1.4"/><circle className="ember ember-d" cx="68" cy="88" r="1.1"/>
    </svg>
  </div>;
}

function Modal({ open, title, close, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);
  if (!open) return null;
  return <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="إغلاق"><X size={19}/></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>;
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function EmptyState({ icon: Icon = Sparkles, text }) { return <div className="empty-state"><span><Icon size={22}/></span><p>{text}</p></div>; }

const SignaturePad = React.forwardRef(function SignaturePad({ value, onChange, t }, ref) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  useImperativeHandle(ref, () => ({ read: () => {
    const canvas = canvasRef.current;
    if (!canvas) return '';
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) return canvas.toDataURL('image/png');
    return '';
  } }), []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  }, [value]);
  const position = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * event.currentTarget.width / bounds.width, y: (event.clientY - bounds.top) * event.currentTarget.height / bounds.height };
  };
  const start = (event) => {
    event.preventDefault();
    const canvas = event.currentTarget, context = canvas.getContext('2d'), point = position(event);
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(point.x + .1, point.y + .1);
    context.strokeStyle = '#27233d'; context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round'; context.stroke();
  };
  const move = (event) => {
    if (!drawing.current) return;
    const context = event.currentTarget.getContext('2d'), point = position(event);
    context.lineTo(point.x, point.y); context.stroke();
  };
  const finish = (event) => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(event.currentTarget.toDataURL('image/png'));
  };
  const clear = () => { const canvas = canvasRef.current; if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); onChange(''); };
  return <div className="signature-field"><div className="signature-pad-wrap"><canvas ref={canvasRef} className="signature-pad" width="720" height="180" aria-label={t('ارسم توقيعك')} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/><span className="signature-baseline"/></div><div className="signature-pad-actions"><small>{t('ارسم توقيعك هنا')}</small><button type="button" className="button subtle compact" onClick={clear}><RotateCcw size={14}/>{t('مسح التوقيع')}</button></div></div>;
});

function ProfileFields({ s, name, setName, signature, setSignature, padRef }) {
  return <><Field label={s.t('الاسم الكامل')}><input required maxLength={100} autoComplete="name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={s.t('اكتب اسمك الكامل')}/></Field><Field label={s.t('التوقيع')}><SignaturePad ref={padRef} value={signature} onChange={setSignature} t={s.t}/></Field></>;
}

function ProfileSetup({ s, onSave }) {
  const [name, setName] = useState(s.data.settings.userName || '');
  const [signature, setSignature] = useState(s.data.settings.signature || '');
  const [error, setError] = useState('');
  const padRef = useRef(null);
  const submit = (event) => {
    event.preventDefault();
    const drawn = padRef.current?.read() || signature;
    if (!name.trim()) { setError(s.t('أدخل اسمك الكامل للمتابعة.')); return; }
    if (!drawn) { setError(s.t('ارسم توقيعك قبل المتابعة.')); return; }
    setError(''); onSave(name.trim(), drawn);
  };
  return <div className="profile-setup-scrim"><section className="profile-setup-card" role="dialog" aria-modal="true" aria-labelledby="profile-setup-title" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}><div className="profile-setup-brand"><span className="brand-flame"><Flame size={20} fill="currentColor"/></span><span><b>FLAME</b><small>{s.t('ملف المستخدم')}</small></span></div><h1 id="profile-setup-title">{s.t('أكمل ملفك الشخصي')}</h1><p>{s.t('أدخل اسمك الكامل وارسم توقيعك للمتابعة.')}</p><form className="form-stack" onSubmit={submit}><ProfileFields s={s} name={name} setName={setName} signature={signature} setSignature={setSignature} padRef={padRef}/>{error && <p className="profile-form-error" role="alert">{error}</p>}<button className="button primary full-width" type="submit" disabled={!name.trim()}><Check size={17}/>{s.t('حفظ ومتابعة')}</button></form></section></div>;
}

function SiteFooter({ s }) {
  if (!s.data.settings.userName) return null;
  return <footer className="site-footer" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}><div><small>{s.t('المستخدم')}</small><b>{s.data.settings.userName}</b></div><div className="site-footer-signature"><small>{s.t('التوقيع')}</small>{s.data.settings.signature && <img src={s.data.settings.signature} alt={s.t('توقيع المستخدم')}/>}</div><span className="site-footer-mark">FLAME <i>✦</i></span></footer>;
}

function AnalogCountdownClock({ hours, minutes, seconds }) {
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6 + seconds * 0.1;
  const secondAngle = seconds * 6;
  return <svg className="countdown-analog-clock" viewBox="0 0 60 60" aria-hidden="true">
    <circle className="analog-clock-bezel" cx="30" cy="30" r="29"/>
    <circle className="analog-clock-face" cx="30" cy="30" r="27"/>
    {Array.from({ length: 12 }, (_, index) => <line key={index} className={index % 3 === 0 ? 'analog-clock-major-tick' : 'analog-clock-tick'} x1="30" y1="6" x2="30" y2={index % 3 === 0 ? '11' : '9'} transform={`rotate(${index * 30} 30 30)`}/>)}
    <text className="analog-clock-number" x="30" y="15" textAnchor="middle">12</text><text className="analog-clock-number" x="45" y="31.5" textAnchor="middle">3</text><text className="analog-clock-number" x="30" y="49" textAnchor="middle">6</text><text className="analog-clock-number" x="15" y="31.5" textAnchor="middle">9</text>
    <line className="analog-clock-hour-hand" x1="30" y1="31" x2="30" y2="19" transform={`rotate(${hourAngle} 30 30)`}/>
    <line className="analog-clock-minute-hand" x1="30" y1="31" x2="30" y2="12" transform={`rotate(${minuteAngle} 30 30)`}/>
    <line className="analog-clock-second-hand" x1="30" y1="34" x2="30" y2="10" transform={`rotate(${secondAngle} 30 30)`}/>
    <circle className="analog-clock-hub" cx="30" cy="30" r="2.6"/>
  </svg>;
}

function Countdown({ event, large = false, split = false }) {
  const [now, setNow] = useState(Date.now());
  const { t, lang } = useFlame();
  const gradientId = `countdown-${useId().replace(/:/g, '')}`;
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const end = eventDeadline(event).getTime();
  const remaining = Math.max(0, end - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const created = new Date(event.createdAt).getTime();
  const span = end - created;
  const percentage = event.status === 'completed' ? 1 : event.status === 'expired' ? 0 : span > 0 ? Math.min(1, Math.max(0, remaining / span)) : (remaining > 0 ? 1 : 0);
  const circumference = 314.16;
  const dashOffset = circumference * (1 - percentage);
  const dotAngle = percentage * Math.PI * 2;
  const dotX = 60 + 50 * Math.cos(dotAngle);
  const dotY = 60 + 50 * Math.sin(dotAngle);
  const urgent = remaining < 3600000 && event.status === 'upcoming';
  const stateClass = event.status === 'completed' ? 'countdown-complete' : event.status === 'expired' ? 'countdown-expired' : '';
  const label = event.status === 'completed' ? t('اكتمل') : event.status === 'expired' ? t('انتهى الموعد') : t('متبقٍ');
  const units = lang === 'ar'
    ? [{ value: hours, short: 'س', full: 'ساعة' }, { value: minutes, short: 'د', full: 'دقيقة' }, { value: seconds, short: 'ث', full: 'ثانية' }]
    : [{ value: hours, short: 'h', full: 'hours' }, { value: minutes, short: 'min', full: 'minutes' }, { value: seconds, short: 's', full: 'seconds' }];
  const accessibleTime = `${days > 0 ? `${days} ${t(days === 1 ? 'يوم' : 'أيام')}, ` : ''}${units.map((unit) => `${unit.value} ${unit.full}`).join(', ')}`;
  return <div className={`countdown ${split ? 'countdown-split' : ''} ${large ? 'countdown-large' : ''} ${urgent ? 'countdown-critical' : ''} ${stateClass}`}>
    <div className="countdown-ring">
      <span className="countdown-aura" aria-hidden="true"/>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0"><stop className="countdown-stop-start" offset="0"/><stop className="countdown-stop-end" offset="1"/></linearGradient>
          <filter id={`${gradientId}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.7"/></filter>
        </defs>
        <circle className="countdown-rim" cx="60" cy="60" r="56"/>
        <circle className="countdown-track" cx="60" cy="60" r="50"/>
        <circle className="countdown-glow" cx="60" cy="60" r="50" stroke={`url(#${gradientId})`} filter={`url(#${gradientId}-blur)`} style={{ strokeDashoffset: dashOffset }}/>
        <circle className="countdown-progress" cx="60" cy="60" r="50" stroke={`url(#${gradientId})`} style={{ strokeDashoffset: dashOffset }}/>
        <circle className="countdown-dot-halo" cx={dotX} cy={dotY} r="5.5"/>
        <circle className="countdown-dot" cx={dotX} cy={dotY} r="2.8"/>
      </svg>
      <div className="countdown-center">
        {event.status === 'completed' ? <><strong>✓</strong><span>{label}</span></>
          : event.status === 'expired' ? <span>{label}</span>
            : days > 0 ? <><strong>{new Intl.NumberFormat(localeTag(lang)).format(days)}</strong><span>{t(days === 1 ? 'يوم' : 'أيام')}</span></>
              : <span>{label}</span>}
      </div>
    </div>
    {event.status === 'upcoming' && <div className="countdown-side"><AnalogCountdownClock hours={hours} minutes={minutes} seconds={seconds}/><div className="countdown-units" role="timer" aria-label={accessibleTime}>
      {units.map((unit) => <span className="countdown-unit" key={unit.short}><strong>{pad(unit.value)}</strong><small>{unit.short}</small></span>)}
    </div></div>}
  </div>;
}

function HomePage({ s, onPlan, onEvent, onWeekly }) {
  const t = s.t, fd = s.fd, { current, best } = streaks(s.data.disciplineRecords, s.effective);
  const todayRecord = s.data.disciplineRecords.find((record) => record.date === (markableDay() || s.today));
  const mission = s.data.dailyMissions.find((item) => item.scheduledDate === s.today);
  const upcoming = s.data.dailyMissions.filter((item) => item.scheduledDate > s.today).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const upcomingEvents = s.data.importantEvents.filter((event) => event.status === 'upcoming').sort((a, b) => eventDeadline(a) - eventDeadline(b));
  const nextEvent = upcomingEvents[0];
  const canMark = !!markableDay();
  const [editMark, setEditMark] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraDescription, setExtraDescription] = useState('');
  const allDone = !!mission?.tasks.length && mission.tasks.every((task) => task.completed);
  const submitExtra = (event) => {
    event.preventDefault();
    if (!extraTitle.trim()) return;
    s.addTodayTask(extraTitle, extraDescription);
    setExtraTitle(''); setExtraDescription(''); setExtraOpen(false);
  };
  const validate = (status) => {
    const day = markableDay();
    if (!day) return;
    if (todayRecord && !editMark && !window.confirm(t('تعديل تسجيل اليوم؟'))) return;
    s.recordDay(day, status);
    setEditMark(false);
    setFeedback(status === 'success' ? `+10 ${t('نقطة')} · ${t(WIN_MESSAGES[Math.floor(Math.random() * WIN_MESSAGES.length)])}` : `−10 ${t('نقطة')} · ${t('خسرت اليوم')}`);
    window.setTimeout(() => setFeedback(''), 3500);
  };
  return <div className="page-stack">
    {s.weeklyReminder && <section className="panel reminder-panel"><div className="reminder-copy"><span className="eyebrow">FLAME · WEEKLY</span><h2>{t('لا تنسَ تحصيل هذا الأسبوع')}</h2><p>{t('أصبح تقرير الأسبوع جاهزاً. احفظ مصاريفك ومهامك المنجزة في PDF.')}</p></div><button className="button primary" onClick={onWeekly}><Download size={17}/>{t('تحميل التقرير الأسبوعي')}</button></section>}
    <section className="panel streak-panel">
      <div className="streak-top"><div className="score-chip"><Star size={15} fill="currentColor"/>{s.points} {t('نقطة')}</div><div className="best-chip"><Award size={15}/>{t('الرقم القياسي:')} <b>{best}</b></div></div>
      <div className="fire-stage"><div className="fire-aura"/><FireMark days={current}/></div>
      <div className="streak-number">{current}</div><div className="streak-label">{t('أيام من الانضباط')}</div>
      <div className="streak-motto">{t('شعلتك مستمرة. انضباطك يتحول إلى قوة.')}</div>
      <div className="discipline-box">
        {canMark && <div className="mark-date">{t('اليوم المفتوح للتسجيل:')} <b>{s.fd(markableDay())}</b></div>}
        {!canMark && !todayRecord ? <p className="mark-hint">{t('التسجيل مفتوح من 22:00 إلى 08:00 فقط. إن لم تسجّل قبل 08:00 يُحتسب اليوم خسارة.')}</p>
          : todayRecord && !editMark ? <div className="mark-result"><span className={todayRecord.status === 'success' ? 'text-success' : 'text-danger'}><CheckCircle2 size={17}/>{t(todayRecord.status === 'success' ? 'سجّلت انتصار اليوم' : 'سجّلت خسارة اليوم')}</span>{canMark && <button className="button subtle compact" onClick={() => setEditMark(true)}><Pencil size={14}/>{t('تعديل')}</button>}</div>
            : <div className="mark-actions"><button className="button primary" onClick={() => validate('success')}>🔥 {t('انتصرت اليوم')}</button><button className="button danger-soft" onClick={() => validate('failure')}>{t('خسرت اليوم')}</button></div>}
      </div>
      {feedback && <div className="feedback-chip">{feedback}</div>}
    </section>

    <section className="panel mission-panel">
      <div className="section-heading"><span className="heading-icon"><Target size={19}/></span><div><h2>{t('مهمتي اليوم')}</h2><p>{mission ? `${mission.tasks.filter((task) => task.completed).length} / ${mission.tasks.length} ${t('اكتملت')}` : t('لا توجد مهام لهذا اليوم، استعد لمهمتك القادمة.')}</p></div><strong className="completion-percent">{mission?.tasks.length ? Math.round(mission.tasks.filter((task) => task.completed).length / mission.tasks.length * 100) : 0}%</strong></div>
      {mission && <><div className="progress-track"><div className={allDone ? 'progress-fill complete' : 'progress-fill'} style={{ width: `${Math.round(mission.tasks.filter((task) => task.completed).length / mission.tasks.length * 100)}%` }}/></div>
        <ul className="task-list">{mission.tasks.map((task) => <li key={task.id}><button className="task-toggle" onClick={() => s.toggleTask(mission.id, task.id)}><span className={`task-check ${task.completed ? 'checked' : ''}`}>{task.completed && <Check size={15}/>}</span><span className={`task-text ${task.completed ? 'is-complete' : ''}`}><b>{task.title}</b>{task.description && <small>{task.description}</small>}</span></button></li>)}</ul>
        {allDone && <div className="mission-complete"><Flame size={17} fill="currentColor"/>{t('أحسنت! لقد أوفيت بوعدك لنفسك.')} <b>+20</b></div>}</>}
      <button className="button subtle full-width add-done" onClick={() => setExtraOpen((value) => !value)}><Plus size={17}/>{t('أضف مهمة أنجزتها اليوم')}</button>
      {extraOpen && <form className="inline-form" onSubmit={submitExtra}><Field label={t('عنوان المهمة')}><input autoFocus required maxLength={100} value={extraTitle} onChange={(event) => setExtraTitle(event.target.value)} placeholder={t('مثال: ساعدت عائلتي')}/></Field><Field label={t('وصف (اختياري)')}><input maxLength={180} value={extraDescription} onChange={(event) => setExtraDescription(event.target.value)}/></Field><div className="form-actions"><button className="button primary" type="submit"><Check size={16}/>{t('أضفها إلى إنجازات اليوم')}</button><button type="button" className="button subtle" onClick={() => setExtraOpen(false)}>{t('إلغاء')}</button></div><p className="helper-text">{t('ستُضاف إلى مهام اليوم بحالة مكتملة.')}</p></form>}
    </section>

    <section className="panel upcoming-panel">
      <div className="section-heading"><span className="heading-icon"><AlarmClock size={19}/></span><div><h2>{t('أقرب موعد')}</h2><p>{t('تذكّر ما ينتظرك')}</p></div><button className="button subtle compact" onClick={onEvent}><Plus size={15}/>{t('موعد')}</button></div>
      {nextEvent ? <div className="next-event"><Countdown event={nextEvent} large split/><div className="next-event-info" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}><span className="eyebrow">{t('أقرب موعد')}</span><h3>{nextEvent.title}</h3><p>{fd(nextEvent.eventDate, { year: true })}{nextEvent.eventTime ? ` · ${nextEvent.eventTime}` : ''}</p><span className={`priority-pill ${nextEvent.priority}`}>{t(CAT[nextEvent.category])} · {t(PRIORITIES[nextEvent.priority])}</span></div></div> : <EmptyState icon={CalendarDays} text={t('لا توجد مواعيد قادمة. أضف موعداً لتبقيه أمام عينيك.')}/>}
      {upcomingEvents.length > 1 && <div className="event-mini-list">{upcomingEvents.slice(1, 4).map((event) => <div className="event-mini" key={event.id}><span className="mini-date">{fd(event.eventDate, { weekday: 'short' })}</span><b>{event.title}</b><span className="mini-left">{timeLeft(event)}</span></div>)}</div>}
    </section>

    <section className="coming-section"><div className="section-title-row"><div><span className="eyebrow">{t('التخطيط')}</span><h2>{t('مهام الغد والأيام القادمة')}</h2></div><button className="button primary compact" onClick={onPlan}><Plus size={15}/>{t('مهمة')}</button></div>
      {upcoming.length ? <div className="plan-list">{upcoming.slice(0, 4).map((item) => <MissionCard key={item.id} mission={item} s={s} onEdit={() => onPlan(item)}/>)}</div> : <EmptyState icon={ListChecks} text={t('حضّر مهام الغد اليوم، وأوفِ بها غداً.')}/>}
    </section>
  </div>;
}

function timeLeft(event) {
  const remaining = eventDeadline(event).getTime() - Date.now();
  const days = Math.max(0, Math.ceil(remaining / 86400000));
  return days === 0 ? 'اليوم' : days === 1 ? 'غداً' : `بعد ${days} أيام`;
}

function MissionCard({ mission, s, onEdit }) {
  return <article className="plan-card"><div className="plan-card-top"><div><span className="plan-date"><CalendarDays size={14}/>{s.fd(mission.scheduledDate, { year: true })}</span><span className="muted-caption">{mission.tasks.length} {s.t('مهام')}</span></div><div className="row-actions"><button className="icon-button" aria-label={s.t('تعديل')} onClick={onEdit}><Pencil size={15}/></button><button className="icon-button icon-danger" aria-label={s.t('حذف')} onClick={() => window.confirm(s.t('حذف هذه المهمة؟')) && s.deleteMission(mission.id)}><Trash2 size={15}/></button></div></div><div className="plan-task-preview">{mission.tasks.slice(0, 3).map((task) => <span key={task.id}><Circle size={8}/>{task.title}</span>)}{mission.tasks.length > 3 && <small>+{mission.tasks.length - 3}</small>}</div></article>;
}

function EventsPage({ s, onEdit, onAdd }) {
  const [expanded, setExpanded] = useState(null);
  const live = s.data.importantEvents.filter((event) => event.status === 'upcoming').sort((a, b) => eventDeadline(a) - eventDeadline(b));
  const past = s.data.importantEvents.filter((event) => event.status !== 'upcoming').sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const card = (event) => <article className="event-card panel" key={event.id}>
    <button className="event-card-main" onClick={() => setExpanded(expanded === event.id ? null : event.id)}><Countdown event={event} split/><span className="event-card-copy"><b>{event.title}</b><small>{s.fd(event.eventDate, { year: true })}{event.eventTime ? ` · ${event.eventTime}` : ''}</small><span className={`priority-pill ${event.priority}`}>{s.t(CAT[event.category])} · {s.t(PRIORITIES[event.priority])}</span></span><ChevronDown size={17} className={expanded === event.id ? 'chevron-open' : ''}/></button>
    {expanded === event.id && <div className="event-detail">{event.description && <p>{event.description}</p>}{event.status === 'upcoming' ? <div className="form-actions"><button className="button primary" onClick={() => s.completeEvent(event.id)}><Check size={16}/>{s.t('اكتمل')}</button><button className="button subtle" onClick={() => onEdit(event)}><Pencil size={15}/>{s.t('تعديل')}</button><button className="button danger-soft" onClick={() => window.confirm(s.t('حذف هذا الموعد؟')) && s.deleteEvent(event.id)}><Trash2 size={15}/>{s.t('حذف')}</button></div> : <div className="form-actions"><span className={event.status === 'completed' ? 'text-success' : 'text-danger'}>{s.t(event.status === 'completed' ? 'اكتمل' : 'انتهى الموعد')}</span><button className="button danger-soft" onClick={() => window.confirm(s.t('حذف هذا الموعد؟')) && s.deleteEvent(event.id)}><Trash2 size={15}/>{s.t('حذف')}</button></div>}</div>}
  </article>;
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · CALENDAR</span><h1>{s.t('الأحداث المهمة القادمة')}</h1></div><button className="button primary" onClick={() => onAdd()}><CalendarPlus size={17}/>{s.t('موعد')}</button></div>
    {live.length ? <div className="page-stack tight-stack">{live.map(card)}</div> : <EmptyState icon={CalendarDays} text={s.t('لا توجد مواعيد قادمة. أضف موعداً لتبقيه أمام عينيك.')}/>}
    {!!past.length && <section className="page-stack"><h2 className="subsection-heading">{s.t('المنتهية والمكتملة')}</h2>{past.map(card)}</section>}
  </div>;
}

function CalendarBoard({ s }) {
  const [month, setMonth] = useState(() => { const [year, m] = s.today.split('-').map(Number); return new Date(year, m - 1, 1); });
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1), count = new Date(y, m + 1, 0).getDate();
  const offset = (first.getDay() + (s.lang === 'ar' ? 1 : 6)) % 7;
  const days = Array.from({ length: count }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`);
  const weekdayLabels = s.lang === 'ar' ? ['س','ح','ن','ث','ر','خ','ج'] : ['L','M','M','J','V','S','D'];
  const recordMap = new Map(s.data.disciplineRecords.map((record) => [record.date, record.status]));
  const monthLabel = new Intl.DateTimeFormat(localeTag(s.lang), { month: 'long', year: 'numeric' }).format(month);
  return <section className="panel calendar-panel"><div className="calendar-head"><button className="icon-button" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label={s.t('الشهر السابق')}>{s.lang === 'ar' ? <ChevronRight/> : <ChevronLeft/>}</button><h2>{monthLabel}</h2><button className="icon-button" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label={s.t('الشهر التالي')}>{s.lang === 'ar' ? <ChevronLeft/> : <ChevronRight/>}</button></div><div className="calendar-grid">{weekdayLabels.map((label, i) => <span className="weekday" key={`${label}-${i}`}>{label}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`}/>)}{days.map((day) => { const status = recordMap.get(day); return <span key={day} className={`calendar-day ${status === 'success' ? 'calendar-win' : status === 'failure' ? 'calendar-loss' : ''} ${day === s.today ? 'calendar-today' : ''}`}>{Number(day.slice(-2))}</span>; })}</div><div className="calendar-legend"><span><i className="legend-win"/>{s.t('نجاح')}</span><span><i className="legend-loss"/>{s.t('خسارة')}</span><span><i className="legend-today"/>{s.t('اليوم')}</span></div></section>;
}

function HistoryPage({ s }) {
  const [tab, setTab] = useState('discipline');
  const { current, best } = streaks(s.data.disciplineRecords, s.effective);
  const archived = s.data.dailyMissions.filter((mission) => mission.status === 'archived').sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate));
  const past = s.data.importantEvents.filter((event) => event.status !== 'upcoming').sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · JOURNAL</span><h1>{s.t('سجل الإنجازات')}</h1></div><div className="history-streak"><b>{current}</b><small>{s.t('الحالية')}</small></div></div>
    <div className="segmented">{[['discipline', 'الانضباط'], ['missions', 'المهام'], ['events', 'المواعيد']].map(([key, label]) => <button className={tab === key ? 'selected' : ''} key={key} onClick={() => setTab(key)}>{s.t(label)}</button>)}</div>
    {tab === 'discipline' && <><CalendarBoard s={s}/><div className="stats-pair"><div className="panel mini-stat"><span className="stat-symbol"><Activity size={17}/></span><b>{current}</b><small>{s.t('الحالية')}</small></div><div className="panel mini-stat"><span className="stat-symbol gold"><Award size={17}/></span><b>{best}</b><small>{s.t('الأطول')}</small></div></div></>}
    {tab === 'missions' && (archived.length ? archived.map((mission) => <article className="panel archive-card" key={mission.id}><div className="archive-card-head"><b>{s.fd(mission.scheduledDate, { year: true })}</b><span>{mission.tasks.filter((task) => task.completed).length}/{mission.tasks.length} · {mission.tasks.length ? Math.round(mission.tasks.filter((task) => task.completed).length / mission.tasks.length * 100) : 0}%</span></div>{mission.tasks.map((task) => <div className={`archive-task ${task.completed ? 'text-success' : 'text-danger'}`} key={task.id}><span>{task.completed ? '✓' : '○'}</span><span>{task.title}</span><small>{s.t(task.completed ? 'مكتملة' : 'غير مكتملة')}</small></div>)}</article>) : <EmptyState icon={ListChecks} text={s.t('لا توجد مهام مؤرشفة بعد.')}/>)}
    {tab === 'events' && (past.length ? past.map((event) => <article className="panel archive-event" key={event.id}><b>{event.title}</b><span>{s.fd(event.eventDate, { year: true })} · {s.t(CAT[event.category])}</span><small className={event.status === 'completed' ? 'text-success' : 'text-danger'}>{s.t(event.status === 'completed' ? 'اكتمل' : 'انتهى الموعد')}</small></article>) : <EmptyState icon={CalendarDays} text={s.t('لا توجد مواعيد منتهية بعد.')}/>)}
  </div>;
}

function DailyReport({ s, date, expenses, total, record, mission }) {
  const completed = mission?.tasks.filter((task) => task.completed).length ?? 0;
  return <article className="print-report daily-report" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}><ReportHeader s={s} title={s.t('تقرير اليوم')} subtitle={s.t('دفتر يومي للإنفاق والانضباط')} period={s.fd(date, { year: true })}/><div className="report-summary"><ReportStat label={s.t('إجمالي المصروف')} value={money(total, s.lang)} highlight/><ReportStat label={s.t('عدد المصاريف')} value={expenses.length}/><ReportStat label={s.t('نتيجة التحدي')} value={s.t(record?.status === 'success' ? 'أكملت التحدي' : record?.status === 'failure' ? 'ضيعت الوقت' : 'لم تسجل النتيجة')}/></div><ReportSection title={s.t('تفاصيل المصاريف')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('فترة الشراء')}</th><th>{s.t('الوصف')}</th><th>{s.t('السعر')} · MAD</th></tr></thead><tbody>{expenses.length ? expenses.map((entry) => <tr key={entry.id}><td>{s.fd(entry.date, { year: true })}</td><td>{s.t(purchasePeriodLabels[entry.purchasePeriod] || purchasePeriodLabels.unspecified)}</td><td>{entry.description}</td><td className="amount-cell">{money(entry.amount, s.lang)}</td></tr>) : <tr><td colSpan="4" className="report-empty">{s.t('لا توجد مصاريف مسجلة لهذا اليوم.')}</td></tr>}</tbody><tfoot><tr><td colSpan="3">{s.t('الإجمالي')}</td><td className="amount-cell">{money(total, s.lang)}</td></tr></tfoot></table></ReportSection><ReportSection title={s.t('الانضباط والتحدي')}><div className="report-pair"><ReportStat label={s.t('نتيجة اليوم')} value={s.t(record?.status === 'success' ? 'أكملت التحدي' : record?.status === 'failure' ? 'ضيعت الوقت' : 'لم تسجل النتيجة')}/><ReportStat label={s.t('المهام اليومية')} value={mission ? `${completed} / ${mission.tasks.length} ${s.t('مكتملة')}` : s.t('لا توجد مهام لهذا اليوم')}/></div>{mission?.tasks.map((task) => <div className="report-task" key={task.id}><span>{task.completed ? '✓' : '○'}</span><span>{task.title}{task.description && <small>{task.description}</small>}</span><b>{s.t(task.completed ? 'مكتملة' : 'غير مكتملة')}</b></div>)}</ReportSection><ReportFooter s={s}/></article>;
}

function ReportHeader({ s, title, subtitle, period }) { return <header className="report-header"><div className="report-brand"><span className="report-logo">✦</span><span><b>FLAME</b><small>{subtitle}</small></span></div><div className="report-heading"><b>{title}</b><small>{period}</small></div></header>; }
function SiteStamp({ s }) {
  const nameLength = Math.min(Math.max(s.data.settings.userName.length * 3.8, 25), 60);
  return <svg className="site-stamp" viewBox="0 0 120 120" role="img" aria-label={s.t('ختم FLAME الرقمي')}>
    <circle cx="60" cy="60" r="56"/><circle cx="60" cy="60" r="48"/><circle cx="60" cy="60" r="33"/>
    <text className="stamp-user" x="60" y="51" textAnchor="middle" direction="rtl" unicodeBidi="plaintext" textLength={nameLength} lengthAdjust="spacingAndGlyphs">{s.data.settings.userName}</text>
    <text className="stamp-center" x="60" y="69" textAnchor="middle">FLAME</text>
  </svg>;
}
function ReportFooter({ s }) { return <><footer className="report-footer"><b>FLAME</b><span>{s.t('وقت أوضح، ومال أوعى.')}</span><span>{s.t('تقرير شخصي')}</span></footer><div className="report-authentication"><div className="report-signed-by"><small>{s.t('أُعدّ بواسطة')}</small><b>{s.data.settings.userName}</b><span>{s.t('التوقيع')}</span>{s.data.settings.signature && <img src={s.data.settings.signature} alt={s.t('توقيع المستخدم')}/>}</div><div className="report-stamp"><SiteStamp s={s}/></div></div></>; }
function ReportStat({ label, value, highlight = false }) { return <div className={`report-stat ${highlight ? 'report-stat-highlight' : ''}`}><small>{label}</small><b>{value}</b></div>; }
function ReportSection({ title, children }) { return <section className="report-section"><h2>{title}</h2>{children}</section>; }

function ExpensesPage({ s }) {
  const [date, setDate] = useState(s.today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [purchasePeriod, setPurchasePeriod] = useState('morning');
  const [editing, setEditing] = useState(null);
  const expenses = s.data.expenseEntries.filter((entry) => entry.date === date).sort((a, b) => a.id.localeCompare(b.id));
  const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
  const record = s.data.disciplineRecords.find((entry) => entry.date === date);
  const mission = s.data.dailyMissions.find((entry) => entry.scheduledDate === date);
  const parsedAmount = Number(amount);
  const canSave = !!description.trim() && Number.isFinite(parsedAmount) && parsedAmount >= 0.01 && Math.round(parsedAmount * 100) === parsedAmount * 100 && date <= s.today;
  const reset = () => { setEditing(null); setDescription(''); setAmount(''); setPurchasePeriod('morning'); };
  const save = (event) => { event.preventDefault(); if (!canSave) return; if (editing) s.updateExpense(editing, description, parsedAmount, purchasePeriod); else s.addExpense(date, description, parsedAmount, purchasePeriod); reset(); };
  const changeDate = (value) => { setDate(value); reset(); };
  const editExpense = (entry) => { setEditing(entry.id); setDescription(entry.description); setAmount(String(entry.amount)); setPurchasePeriod(PURCHASE_PERIODS.includes(entry.purchasePeriod) ? entry.purchasePeriod : 'morning'); };
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · WALLET</span><h1>{s.t('المصاريف اليومية')}</h1></div><span className="title-icon"><Receipt size={20}/></span></div>
    <section className="panel date-panel"><Field label={s.t('اختر اليوم')}><input type="date" max={s.today} value={date} onChange={(event) => changeDate(event.target.value)}/></Field><p>{s.fd(date, { year: true })}</p></section>
    <section className="panel expense-total"><span>{s.t('إجمالي المصروف')}</span><b dir="auto">{money(total, s.lang)}</b><small>{expenses.length} {s.t(expenses.length === 1 ? 'مصروف' : 'مصروفات')}</small></section>
    <form className="panel form-panel" onSubmit={save}><h2>{s.t(editing ? 'تعديل المصروف' : 'أضف مصروفاً')}</h2><Field label={s.t('وصف المصروف')}><input required maxLength={120} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={s.t('مثال: وجبة الغداء')}/></Field><div className="field-grid"><Field label={`${s.t('السعر')} · MAD`}><input type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00"/></Field><Field label={s.t('فترة الشراء')}><select required value={purchasePeriod} onChange={(event) => setPurchasePeriod(event.target.value)}>{PURCHASE_PERIODS.map((period) => <option key={period} value={period}>{s.t(purchasePeriodLabels[period])}</option>)}</select></Field></div><div className="form-actions"><button disabled={!canSave} className="button primary" type="submit">{editing ? <Check size={16}/> : <Plus size={17}/>} {s.t(editing ? 'حفظ التعديل' : 'أضف إلى اليوم')}</button>{editing && <button className="button subtle" type="button" onClick={reset}>{s.t('إلغاء التعديل')}</button>}</div></form>
    <section className="panel expense-list-panel"><div className="section-heading"><span className="heading-icon"><Receipt size={18}/></span><div><h2>{s.t('تفاصيل المصاريف')}</h2><p>{expenses.length} {s.t('مصروفات')}</p></div></div>{expenses.length ? <div className="expense-list">{expenses.map((entry, index) => <div className="expense-row" key={entry.id}><span className="expense-index">{pad(index + 1)}</span><div className="expense-name"><b>{entry.description}</b><small>{s.fd(entry.date, { year: true })} · {s.t(purchasePeriodLabels[entry.purchasePeriod] || purchasePeriodLabels.unspecified)} · {money(entry.amount, s.lang)}</small></div><button className="icon-button" aria-label={s.t('تعديل')} onClick={() => editExpense(entry)}><Pencil size={15}/></button><button className="icon-button icon-danger" aria-label={s.t('حذف المصروف؟')} onClick={() => { if (window.confirm(s.t('حذف المصروف؟'))) { s.deleteExpense(entry.id); if (editing === entry.id) reset(); } }}><Trash2 size={15}/></button></div>)}</div> : <EmptyState icon={Receipt} text={s.t('لا توجد مصاريف مسجلة لهذا اليوم.')}/>}</section>
    <section className="panel print-action"><div><h2>{s.t('تقرير اليوم PDF')}</h2><p>{s.t('يجمع التقرير مصاريف اليوم ونتيجة التحدي والمهام.')}</p></div><button className="button primary full-width" onClick={() => printSelected('daily', `FLAME-${date}`)}><Download size={17}/>{s.t('طباعة أو حفظ PDF')}</button></section>
    {createPortal(<DailyReport s={s} date={date} expenses={expenses} total={total} record={record} mission={mission}/>, document.getElementById('print-area'))}
  </div>;
}

function WeeklyReport({ s, start, end, expenses, missions, completed, totalTasks, wins, losses, spent, expensesOnly = false }) {
  const allTasks = missions.flatMap((mission) => mission.tasks.map((task) => ({ date: mission.scheduledDate, task })));
  return <article className={`print-report ${expensesOnly ? 'expense-only-report' : 'weekly-report'}`} dir={s.lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReportHeader s={s} title={s.t(expensesOnly ? 'تقرير المصاريف الأسبوعي' : 'التقرير الأسبوعي')} subtitle={s.t(expensesOnly ? 'تقرير المصاريف فقط' : 'دفتر أسبوعي للإنفاق والإنجاز')} period={`${s.fd(start, { year: true })} — ${s.fd(end, { year: true })}`}/>
    <div className="report-summary">{expensesOnly ? <><ReportStat label={s.t('إجمالي المصروف')} value={money(spent, s.lang)} highlight/><ReportStat label={s.t('عدد المصاريف')} value={expenses.length}/></> : <><ReportStat label={s.t('إجمالي المصروف')} value={money(spent, s.lang)} highlight/><ReportStat label={s.t('المهام المكتملة')} value={`${completed} / ${totalTasks}`}/><ReportStat label={s.t('عدد المصاريف')} value={expenses.length}/><ReportStat label={s.t('أيام الانضباط')} value={`${wins} ${s.t('نجاح')} · ${losses} ${s.t('خسارة')}`}/></>}</div>
    <ReportSection title={s.t('تفاصيل مصاريف الأسبوع')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('فترة الشراء')}</th><th>{s.t('الوصف')}</th><th>{s.t('السعر')} · MAD</th></tr></thead><tbody>{expenses.length ? expenses.map((entry) => <tr key={entry.id}><td>{s.fd(entry.date, { year: true })}</td><td>{s.t(purchasePeriodLabels[entry.purchasePeriod] || purchasePeriodLabels.unspecified)}</td><td>{entry.description}</td><td className="amount-cell">{money(entry.amount, s.lang)}</td></tr>) : <tr><td colSpan="4" className="report-empty">{s.t('لا توجد مصاريف مسجلة لهذا الأسبوع.')}</td></tr>}</tbody><tfoot><tr><td colSpan="3">{s.t('الإجمالي')}</td><td className="amount-cell">{money(spent, s.lang)}</td></tr></tfoot></table></ReportSection>
    {!expensesOnly && <ReportSection title={s.t('المهام المنجزة خلال الأسبوع')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('المهمة')}</th><th>{s.t('الحالة')}</th></tr></thead><tbody>{allTasks.length ? allTasks.map(({ date, task }) => <tr key={`${date}-${task.id}`}><td>{s.fd(date, { weekday: 'short' })}</td><td>{task.title}{task.description && <small className="report-description">{task.description}</small>}</td><td className={task.completed ? 'text-success' : 'report-muted'}>{s.t(task.completed ? 'مكتملة' : 'غير مكتملة')}</td></tr>) : <tr><td colSpan="3" className="report-empty">{s.t('لا توجد مهام مسجلة لهذا الأسبوع.')}</td></tr>}</tbody></table></ReportSection>}
    <ReportFooter s={s}/>
  </article>;
}

function WeeklyStats({ s }) {
  const [weekStart, setWeekStart] = useState(() => { const today = new Date(`${s.today}T12:00:00`); const day = (today.getDay() + 6) % 7; return shiftDate(s.today, -day); });
  const weekEnd = shiftDate(weekStart, 6);
  const currentStart = (() => { const day = (new Date(`${s.today}T12:00:00`).getDay() + 6) % 7; return shiftDate(s.today, -day); })();
  const expenses = s.data.expenseEntries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd && entry.date <= s.today);
  const missions = s.data.dailyMissions.filter((mission) => mission.scheduledDate >= weekStart && mission.scheduledDate <= weekEnd && mission.scheduledDate <= s.today);
  const records = s.data.disciplineRecords.filter((record) => record.date >= weekStart && record.date <= weekEnd && record.date <= s.today);
  const completed = missions.reduce((total, mission) => total + mission.tasks.filter((task) => task.completed).length, 0);
  const totalTasks = missions.reduce((total, mission) => total + mission.tasks.length, 0);
  const spent = expenses.reduce((total, entry) => total + entry.amount, 0);
  const wins = records.filter((record) => record.status === 'success').length, losses = records.filter((record) => record.status === 'failure').length;
  const print = (kind) => printSelected(kind, `FLAME-${kind}-${weekStart}`);
  return <><section className="panel weekly-panel"><div className="week-heading"><button className="icon-button" onClick={() => setWeekStart(shiftDate(weekStart, -7))} aria-label={s.t('الأسبوع السابق')}>{s.lang === 'ar' ? <ChevronRight/> : <ChevronLeft/>}</button><div><span className="eyebrow">FLAME · WEEKLY</span><h2>{s.t('التحصيل الأسبوعي')}</h2><p>{s.fd(weekStart, { month: 'short' })} — {s.fd(weekEnd, { month: 'short', year: true })}</p></div><button className="icon-button" disabled={weekStart >= currentStart} onClick={() => setWeekStart(shiftDate(weekStart, 7))} aria-label={s.t('الأسبوع التالي')}>{s.lang === 'ar' ? <ChevronLeft/> : <ChevronRight/>}</button></div><div className="weekly-metrics"><div className="weekly-metric total-metric"><span>{s.t('إجمالي المصروف')}</span><b>{money(spent, s.lang)}</b></div><div className="weekly-metric"><span>{s.t('المهام المكتملة')}</span><b>{completed} / {totalTasks}</b></div><div className="weekly-metric"><span>{s.t('عدد المصاريف')}</span><b>{expenses.length}</b></div><div className="weekly-metric"><span>{s.t('أيام النجاح')} / {s.t('أيام الخسارة')}</span><b><i className="text-success">{wins}</i> / <i className="text-danger">{losses}</i></b></div></div><p className="helper-text">{s.t('يبدأ الأسبوع يوم الإثنين وينتهي يوم الأحد.')}</p><div className="report-buttons"><button className="button primary" onClick={() => print('weekly')}><Download size={16}/>{s.t('التقرير الكامل PDF')}</button><button className="button subtle" onClick={() => print('expenses')}><Receipt size={16}/>{s.t('المصاريف فقط PDF')}</button></div><p className="helper-text center-text">{s.t('عند الطباعة اختر حفظ كملف PDF.')}</p></section>
    {createPortal(<><WeeklyReport s={s} start={weekStart} end={weekEnd} expenses={expenses} missions={missions} completed={completed} totalTasks={totalTasks} wins={wins} losses={losses} spent={spent}/><WeeklyReport s={s} start={weekStart} end={weekEnd} expenses={expenses} missions={missions} completed={completed} totalTasks={totalTasks} wins={wins} losses={losses} spent={spent} expensesOnly/></>, document.getElementById('print-area'))}
  </>;
}

function ProfileModal({ s, open, close }) {
  const [name, setName] = useState('');
  const [signature, setSignature] = useState('');
  const [error, setError] = useState('');
  const padRef = useRef(null);
  useEffect(() => { if (open) { setName(s.data.settings.userName || ''); setSignature(s.data.settings.signature || ''); } }, [open, s.data.settings.userName, s.data.settings.signature]);
  const submit = (event) => { event.preventDefault(); const drawn = padRef.current?.read() || signature; if (!name.trim()) { setError(s.t('أدخل اسمك الكامل للمتابعة.')); return; } if (!drawn) { setError(s.t('ارسم توقيعك قبل المتابعة.')); return; } s.setUserProfile(name.trim(), drawn); close(); };
  return <Modal open={open} title={s.t('ملف المستخدم')} close={close} wide><form className="form-stack" onSubmit={submit}><ProfileFields s={s} name={name} setName={setName} signature={signature} setSignature={setSignature} padRef={padRef}/>{error && <p className="profile-form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button primary" disabled={!name.trim()}><Check size={16}/>{s.t('حفظ الملف الشخصي')}</button><button className="button subtle" type="button" onClick={close}>{s.t('إلغاء')}</button></div></form></Modal>;
}

function SettingsPage({ s, fileRef, onReset }) {
  const exp = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(s.data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `flame-backup-${s.today}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const imp = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (window.confirm(s.t('سيتم استبدال بياناتك الحالية. متابعة؟'))) s.importData(String(reader.result)); };
    reader.readAsText(file);
  };
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · INSIGHTS</span><h1>{s.t('الإحصائيات')}</h1></div><span className="title-icon"><BarChart3 size={20}/></span></div>
    <WeeklyStats s={s}/><section className="panel lifetime-panel"><span className="eyebrow">{s.t('النقاط التراكمية')}</span><b>{s.points}</b><p>+10 {s.t('لكل يوم انتصار')} · +20 {s.t('عند إتمام كل مهام اليوم')} · −10 {s.t('عند الخسارة')}</p></section><div className="stats-four">{[[s.t('الحالية'),s.current],[s.t('الأطول'),s.best],[s.t('أيام النجاح'),s.wins],[s.t('أيام الخسارة'),s.losses]].map(([label, value]) => <div className="panel stat-tile" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="settings-heading"><span className="eyebrow">FLAME · SETUP</span><h2>{s.t('الإعدادات')}</h2></div><section className="panel settings-panel"><div className="settings-section-title"><span className="heading-icon"><Settings2 size={18}/></span><div><h2>{s.t('المظهر والتخصيص')}</h2><p>{s.t('سمة الواجهة')}</p></div></div><div className="segmented theme-segment">{[['dark', Moon, 'داكن'],['light', Sun, 'فاتح'],['system', Settings2, 'النظام']].map(([value, Icon, label]) => <button key={value} className={s.data.settings.theme === value ? 'selected' : ''} onClick={() => s.setTheme(value)}><Icon size={15}/>{s.t(label)}</button>)}</div><div className="settings-section-title accent-title"><span className="heading-icon"><Sparkles size={18}/></span><div><h3>{s.t('لون الموقع')}</h3><p>{s.t('البرتقالي هو اللون الافتراضي.')}</p></div></div><div className="accent-grid">{accents.map((accent) => <button className={`accent-option ${s.data.settings.accentColor === accent.id ? 'accent-selected' : ''}`} key={accent.id} onClick={() => s.setAccent(accent.id)}><i style={{ '--swatch': accent.primary, '--swatch-glow': accent.glow }}/><span>{s.t(accent.label)}</span>{s.data.settings.accentColor === accent.id && <Check size={14}/>}</button>)}</div></section>
    <section className="panel settings-panel"><div className="settings-section-title"><span className="heading-icon"><ShieldCheck size={18}/></span><div><h2>{s.t('البيانات والنسخ الاحتياطي')}</h2><p>{s.t('احفظ نسخة من بياناتك أو استعد نسخة سابقة.')}</p></div></div><div className="backup-actions"><button className="button subtle" onClick={exp}><CloudDownload size={16}/>{s.t('تصدير')} JSON</button><button className="button subtle" onClick={() => fileRef.current?.click()}><Upload size={16}/>{s.t('استيراد')} JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { imp(event.target.files?.[0]); event.target.value = ''; }}/></div><p className="helper-text">{s.t('بياناتك محفوظة في هذا المتصفح وهذا الجهاز فقط، ولا توجد مزامنة بين الهاتف والحاسوب. استخدم التصدير والاستيراد لنقلها.')}</p></section>
    <section className="panel settings-panel danger-zone"><div className="settings-section-title"><span className="heading-icon danger-icon"><Trash2 size={18}/></span><div><h2>{s.t('إدارة البيانات')}</h2><p>{s.t('سيتم حذف الانضباط والمهام والمصاريف والمواعيد نهائياً. صدّر نسخة احتياطية أولاً.')}</p></div></div><button className="button danger-outline full-width" onClick={onReset}>{s.t('مسح كل البيانات')}</button></section>
  </div>;
}

function PlanModal({ s, open, close, editing }) {
  const [date, setDate] = useState(s.tomorrow);
  const [tasks, setTasks] = useState([{ title: '', description: '' }]);
  useEffect(() => { if (open) { setDate(editing?.scheduledDate || s.tomorrow); setTasks(editing ? editing.tasks.map((task) => ({ ...task })) : [{ title: '', description: '' }]); } }, [open, editing?.id, s.tomorrow]);
  const update = (index, value) => setTasks((items) => items.map((task, i) => i === index ? { ...task, ...value } : task));
  const remove = (index) => setTasks((items) => items.filter((_, i) => i !== index));
  const submit = (event) => { event.preventDefault(); const filtered = tasks.filter((task) => task.title.trim()); if (!filtered.length || date <= s.today) return; if (editing) s.updateMission(editing.id, date, filtered); else s.addMission(date, filtered); close(); };
  return <Modal open={open} title={s.t(editing ? 'تعديل المهمة' : 'مهمة جديدة')} close={close} wide><form className="form-stack" onSubmit={submit}><Field label={s.t('تاريخ المهمة')}><input type="date" min={s.tomorrow} value={date} onChange={(event) => setDate(event.target.value)}/></Field>{tasks.map((task, index) => <div className="task-editor" key={index}><div className="task-editor-head"><span>{s.t('المهمة')} {index + 1}</span>{tasks.length > 1 && <button type="button" className="icon-button icon-danger" onClick={() => remove(index)}><Trash2 size={15}/></button>}</div><Field label={s.t('عنوان المهمة')}><input maxLength={100} value={task.title} onChange={(event) => update(index, { title: event.target.value })} placeholder={s.t('عنوان المهمة')}/></Field><Field label={s.t('وصف (اختياري)')}><input maxLength={180} value={task.description || ''} onChange={(event) => update(index, { description: event.target.value })}/></Field></div>)}<button className="button subtle full-width" type="button" onClick={() => setTasks((items) => [...items, { title: '', description: '' }])}><Plus size={16}/>{s.t('أضف مهمة')}</button><div className="form-actions"><button className="button primary" type="submit" disabled={!tasks.some((task) => task.title.trim()) || date <= s.today}>{s.t(editing ? 'احفظ التعديلات' : 'احفظ المهمة')}</button><button className="button subtle" type="button" onClick={close}>{s.t('إلغاء')}</button></div></form></Modal>;
}

function EventModal({ s, open, close, editing }) {
  const initial = () => ({ title: '', description: '', eventDate: s.today, eventTime: '', category: 'exam', priority: 'normal' });
  const [form, setForm] = useState(initial);
  useEffect(() => { if (open) setForm(editing ? { title: editing.title, description: editing.description || '', eventDate: editing.eventDate, eventTime: editing.eventTime || '', category: editing.category, priority: editing.priority } : initial()); }, [open, editing?.id, s.today]);
  const change = (value) => setForm((previous) => ({ ...previous, ...value }));
  const submit = (event) => { event.preventDefault(); if (!form.title.trim()) return; if (editing) s.updateEvent(editing.id, form); else s.addEvent(form); close(); };
  return <Modal open={open} title={s.t(editing ? 'تعديل الموعد' : 'موعد جديد')} close={close}><form className="form-stack" onSubmit={submit}><Field label={s.t('عنوان الموعد')}><input required maxLength={120} value={form.title} onChange={(event) => change({ title: event.target.value })}/></Field><Field label={s.t('وصف (اختياري)')}><input maxLength={200} value={form.description} onChange={(event) => change({ description: event.target.value })}/></Field><div className="field-grid"><Field label={s.t('التاريخ')}><input type="date" min={editing ? undefined : s.today} value={form.eventDate} onChange={(event) => change({ eventDate: event.target.value })}/></Field><Field label={`${s.t('الوقت')} (${s.t('اختياري')})`}><input type="time" value={form.eventTime} onChange={(event) => change({ eventTime: event.target.value })}/></Field><Field label={s.t('الفئة')}><select value={form.category} onChange={(event) => change({ category: event.target.value })}>{Object.entries(CAT).map(([value, label]) => <option value={value} key={value}>{s.t(label)}</option>)}</select></Field><Field label={s.t('الأولوية')}><select value={form.priority} onChange={(event) => change({ priority: event.target.value })}>{Object.entries(PRIORITIES).map(([value, label]) => <option value={value} key={value}>{s.t(label)}</option>)}</select></Field></div><div className="form-actions"><button className="button primary" type="submit" disabled={!form.title.trim()}>{s.t(editing ? 'احفظ التعديلات' : 'احفظ الموعد')}</button><button className="button subtle" type="button" onClick={close}>{s.t('إلغاء')}</button></div></form></Modal>;
}

export default function App() {
  const [data, setData] = useState(() => syncData(loadData()));
  const dataRef = useRef(data); dataRef.current = data;
  const [today, setToday] = useState(dateKey());
  const [tab, setTab] = useState('home');
  const [planOpen, setPlanOpen] = useState(false), [planEdit, setPlanEdit] = useState(null);
  const [eventOpen, setEventOpen] = useState(false), [eventEdit, setEventEdit] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const fileRef = useRef(null);
  const lang = data.settings.lang;
  const t = (text) => tr(text, lang);
  const fd = useDateLabel(lang);
  const effective = effectiveDay();
  const currentStats = streaks(data.disciplineRecords, effective);
  const wins = data.disciplineRecords.filter((record) => record.status === 'success').length;
  const losses = data.disciplineRecords.length - wins;
  const score = points(data);
  const tomorrow = shiftDate(today, 1);
  const s = useMemo(() => ({ data, today, lang, t, fd, tomorrow, effective, points: score, current: currentStats.current, best: currentStats.best, wins, losses,
    addTodayTask: (title, description) => update((current, currentDate) => {
      const mission = current.dailyMissions.find((item) => item.scheduledDate === currentDate);
      const task = { id: uid(), title: title.trim(), description: description.trim() || undefined, completed: true };
      if (!task.title) return current;
      if (mission) return { ...current, dailyMissions: current.dailyMissions.map((item) => item.id === mission.id ? { ...item, status: 'active', tasks: [...item.tasks, task] } : item) };
      return { ...current, dailyMissions: [...current.dailyMissions, { id: uid(), scheduledDate: currentDate, tasks: [task], status: 'active', createdAt: new Date().toISOString() }] };
    }),
    toggleTask: (missionId, taskId) => update((current, date) => ({ ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === missionId && mission.scheduledDate === date ? { ...mission, tasks: mission.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task) } : mission) })),
    recordDay: (date, status) => update((current) => ({ ...current, disciplineRecords: [...current.disciplineRecords.filter((record) => record.date !== date), { date, status }].sort((a, b) => a.date.localeCompare(b.date)) })),
    addMission: (date, tasks) => update((current) => {
      if (date <= today) return current;
      const clean = tasks.filter((task) => task.title.trim()).map((task) => ({ id: task.id || uid(), title: task.title.trim(), description: task.description?.trim() || undefined, completed: !!task.completed }));
      if (!clean.length) return current;
      const existing = current.dailyMissions.find((mission) => mission.scheduledDate === date && mission.status === 'upcoming');
      if (existing) return { ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === existing.id ? { ...mission, tasks: [...mission.tasks, ...clean] } : mission) };
      return { ...current, dailyMissions: [...current.dailyMissions, { id: uid(), scheduledDate: date, tasks: clean, status: 'upcoming', createdAt: new Date().toISOString() }] };
    }),
    updateMission: (id, date, tasks) => update((current) => {
      const existing = current.dailyMissions.find((mission) => mission.id === id);
      if (!existing || existing.status !== 'upcoming' || existing.scheduledDate <= today || date <= today) return current;
      const clean = tasks.filter((task) => task.title.trim()).map((task) => ({ id: task.id || uid(), title: task.title.trim(), description: task.description?.trim() || undefined, completed: !!task.completed }));
      const other = current.dailyMissions.find((mission) => mission.id !== id && mission.scheduledDate === date && mission.status === 'upcoming');
      if (other) return { ...current, dailyMissions: current.dailyMissions.filter((mission) => mission.id !== id).map((mission) => mission.id === other.id ? { ...mission, tasks: [...mission.tasks, ...clean] } : mission) };
      return { ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === id ? { ...mission, scheduledDate: date, tasks: clean } : mission) };
    }),
    deleteMission: (id) => update((current) => ({ ...current, dailyMissions: current.dailyMissions.filter((mission) => mission.id !== id || mission.status !== 'upcoming' || mission.scheduledDate <= today) })),
    addEvent: (event) => update((current) => ({ ...current, importantEvents: [...current.importantEvents, { ...event, title: event.title.trim(), description: event.description.trim() || undefined, eventTime: event.eventTime || undefined, id: uid(), status: 'upcoming', createdAt: new Date().toISOString() }] })),
    updateEvent: (id, event) => update((current) => ({ ...current, importantEvents: current.importantEvents.map((item) => item.id === id && item.status === 'upcoming' ? { ...item, ...event, title: event.title.trim(), description: event.description.trim() || undefined, eventTime: event.eventTime || undefined } : item) })),
    deleteEvent: (id) => update((current) => ({ ...current, importantEvents: current.importantEvents.filter((item) => item.id !== id) })),
    completeEvent: (id) => update((current) => ({ ...current, importantEvents: current.importantEvents.map((item) => item.id === id && item.status === 'upcoming' ? { ...item, status: 'completed', completedAt: new Date().toISOString() } : item) })),
    addExpense: (date, description, amount, purchasePeriod) => update((current) => date > today || !description.trim() || !Number.isFinite(amount) || amount <= 0 || !PURCHASE_PERIODS.includes(purchasePeriod) ? current : { ...current, expenseEntries: [...current.expenseEntries, { id: uid(), date, description: description.trim(), amount: Math.round(amount * 100) / 100, purchasePeriod }] }),
    updateExpense: (id, description, amount, purchasePeriod) => update((current) => !description.trim() || !Number.isFinite(amount) || amount <= 0 || !PURCHASE_PERIODS.includes(purchasePeriod) ? current : { ...current, expenseEntries: current.expenseEntries.map((item) => item.id === id && item.date <= today ? { ...item, description: description.trim(), amount: Math.round(amount * 100) / 100, purchasePeriod } : item) }),
    deleteExpense: (id) => update((current) => ({ ...current, expenseEntries: current.expenseEntries.filter((item) => item.id !== id) })),
    setTheme: (theme) => update((current) => ({ ...current, settings: { ...current.settings, theme } })),
    setAccent: (accentColor) => update((current) => ({ ...current, settings: { ...current.settings, accentColor } })),
    setUserProfile: (userName, signature) => update((current) => ({ ...current, settings: { ...current.settings, userName: userName.trim().slice(0, 100), signature } })),
    importData: (text) => { try { const imported = normalizeData(JSON.parse(text)); if (!imported) { window.alert(t('ملف غير صالح')); return false; } update(() => imported); window.alert(t('تم الاستيراد')); return true; } catch { window.alert(t('ملف غير صالح')); return false; } },
  }), [data, today, lang, score, currentStats.current, currentStats.best, wins, losses]);

  function update(mutator) {
    const current = dataRef.current;
    const currentDate = dateKey();
    const next = syncData(mutator(current, currentDate), currentDate);
    dataRef.current = next;
    setData(next);
    setToday(currentDate);
    saveData(next);
  }

  useEffect(() => {
    const refresh = () => {
      const now = new Date(), currentDate = dateKey(now);
      setToday(currentDate);
      const current = dataRef.current, next = syncData(current, currentDate, now);
      if (next !== current) { dataRef.current = next; setData(next); saveData(next); }
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dataset.accent = data.settings.accentColor;
    document.documentElement.classList.toggle('light', data.settings.theme === 'light' || (data.settings.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: light)').matches));
    const color = accents.find((accent) => accent.id === data.settings.accentColor)?.primary || '#ff8a32';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [lang, data.settings.theme, data.settings.accentColor]);
  useEffect(() => {
    if (data.settings.theme !== 'system') return undefined;
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return undefined;
    const syncTheme = () => document.documentElement.classList.toggle('light', media.matches);
    if (media.addEventListener) { media.addEventListener('change', syncTheme); return () => media.removeEventListener('change', syncTheme); }
    media.addListener?.(syncTheme); return () => media.removeListener?.(syncTheme);
  }, [data.settings.theme]);

  const weeklyReminder = new Date().getDay() === 0 && (new Date().getHours() > 18 || (new Date().getHours() === 18 && new Date().getMinutes() >= 30));
  const context = { ...s, weeklyReminder, today, tomorrow };
  const openPlan = (mission = null) => { setPlanEdit(mission); setPlanOpen(true); };
  const openEvent = (event = null) => { setEventEdit(event); setEventOpen(true); };
  const nav = [[Home,'الرئيسية','home'],[Activity,'السجل','history'],[Receipt,'المصاريف','expenses'],[CalendarDays,'المواعيد','events'],[BarChart3,'الإحصائيات','stats']];
  return <Ctx.Provider value={context}><div className="app-shell">
    <header className="app-header"><div className="header-brand"><span className="brand-flame"><Flame size={19} fill="currentColor"/></span><span><b>FLAME</b><small>KEEP YOUR FIRE</small></span></div><div className="header-actions"><div className="today-label"><b>{fd(today)}</b><small>{t('احمِ وقتك، واحفظ شعلتك.')}</small></div><button className="language-button" onClick={() => update((current) => ({ ...current, settings: { ...current.settings, lang: current.settings.lang === 'ar' ? 'fr' : 'ar' } }))}><Languages size={15}/>{lang === 'ar' ? 'FR' : 'AR'}</button></div></header>
    {data.settings.userName && <button className="app-identity" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={() => setProfileOpen(true)}><span>{t('المستخدم')}</span><b>{data.settings.userName}</b><Pencil size={14}/></button>}
    <main className="main-content">{tab === 'home' && <HomePage s={context} onPlan={() => openPlan()} onEvent={() => openEvent()} onWeekly={() => setTab('stats')}/ >}{tab === 'history' && <HistoryPage s={context}/ >}{tab === 'expenses' && <ExpensesPage s={context}/ >}{tab === 'events' && <EventsPage s={context} onEdit={openEvent} onAdd={() => openEvent()}/ >}{tab === 'stats' && <SettingsPage s={context} fileRef={fileRef} onReset={() => setResetOpen(true)}/ >}</main>
    <SiteFooter s={context}/>
    {(tab === 'home' || tab === 'events') && <button className="floating-add" aria-label={t(tab === 'home' ? 'مهمة جديدة' : 'موعد جديد')} onClick={() => tab === 'home' ? openPlan() : openEvent()}>{tab === 'home' ? <ListChecks size={20}/> : <CalendarPlus size={20}/>}</button>}
    <nav className="bottom-nav" aria-label="Navigation"><div>{nav.map(([Icon, label, id]) => <button key={id} className={tab === id ? 'nav-item nav-active' : 'nav-item'} onClick={() => setTab(id)}><Icon size={20}/><span>{t(label)}</span></button>)}</div></nav>
    <PlanModal s={context} open={planOpen} close={() => setPlanOpen(false)} editing={planEdit}/><EventModal s={context} open={eventOpen} close={() => setEventOpen(false)} editing={eventEdit}/>
    <ProfileModal s={context} open={profileOpen} close={() => setProfileOpen(false)}/>
    <Modal open={resetOpen} title={t('مسح كل البيانات؟')} close={() => setResetOpen(false)}><p className="modal-copy">{t('سيتم حذف الانضباط والمهام والمصاريف والمواعيد نهائياً. صدّر نسخة احتياطية أولاً.')}</p><div className="form-actions"><button className="button subtle" onClick={() => setResetOpen(false)}>{t('إلغاء')}</button><button className="button danger-solid" onClick={() => { const current = dataRef.current; const cleared = emptyData(); cleared.settings = { ...current.settings, startDate: dateKey() }; dataRef.current = cleared; setData(cleared); saveData(cleared); setResetOpen(false); }}>{t('نعم، امسح')}</button></div></Modal>
    {(!data.settings.userName || !data.settings.signature) && <ProfileSetup s={context} onSave={s.setUserProfile}/>}
  </div></Ctx.Provider>;
}
