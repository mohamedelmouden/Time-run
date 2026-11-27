import React, { createContext, useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity, AlarmClock, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Award, BarChart3, CalendarDays,
  CalendarPlus, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3, CloudDownload,
  Download, Flame, Home, Languages, ListChecks, Menu, Moon, Pencil, Plus, Receipt, RotateCcw, Settings2,
  BadgeCheck, Ban, CircleAlert, CircleOff, CircleX, Flag, Gem, Medal, PieChart, ShieldAlert, ShieldCheck, Sparkles, Sun, Target, Timer, Trash2, TrendingDown, TrendingUp, Trophy, TriangleAlert, Upload, X, Zap,
} from 'lucide-react';
import {
  accents, commitmentIncludesDate, commitmentStreak, dateKey, emptyData, effectiveDay, eventDeadline, LEGACY_COMMITMENT_ID, loadData, markableCommitmentDay, markableDay, nextCommitmentDay, normalizeData,
  pad, points, PURCHASE_PERIODS, purchasePeriodLabels, saveData, shiftDate, streaks, syncData, uid, validCommitmentSchedule, validCommitmentWindow, validDate, weekdayIndex,
} from './data.js';
import { localeTag, tr } from './i18n.js';

const Ctx = createContext(null);
const useFlame = () => useContext(Ctx);
const CAT = { exam: 'امتحان', deadline: 'موعد نهائي', competition: 'مسابقة', appointment: 'موعد', personal: 'شخصي', other: 'أخرى' };
const PRIORITIES = { normal: 'عادية', important: 'مهم', critical: 'حرجة' };
const WEEKDAYS = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
const COMMITMENT_FEEDBACK_MESSAGES = {
  success: [
    { title: 'وعدك لنفسك أمانة، وقد حفظته اليوم.', body: 'استمر؛ فالانضباط الذي تكرره يصبح قوة.', icon: Trophy },
    { title: 'خطوة ثابتة نحو هدفك.', body: 'التزام اليوم تقدم حقيقي، مهما بدا صغيراً.', icon: TrendingUp },
    { title: 'أنت من انتصر على التردد.', body: 'اخترت الفعل اليوم، وهذا ما يصنع الفرق.', icon: Zap },
    { title: 'اليوم فعلت ما وعدت به.', body: 'احتفظ بهذا الشعور، وابنِ عليه غداً.', icon: ShieldCheck },
    { title: 'إرادتك تحولت إلى إنجاز.', body: 'كل مرة تفي فيها بوعدك، تزداد ثقتك بنفسك.', icon: Gem },
    { title: 'أحسنت، انضباطك يثمر.', body: 'النجاحات الصغيرة تصنع عادة قوية مع الوقت.', icon: BadgeCheck },
    { title: 'تقدّمك واضح اليوم.', body: 'أثبتّ أن قراراتك أقوى من أعذارك.', icon: CheckCircle2 },
    { title: 'نجاح مستحق؛ لقد التزمت.', body: 'واجهت الصعوبة واخترت الطريق الصحيح.', icon: Medal },
    { title: 'أضفت انتصاراً جديداً إلى رصيدك.', body: 'واصل بنفس الهدوء، وسترى أثر تراكم الأيام.', icon: Sparkles },
    { title: 'أنت أقرب إلى هدفك مما كنت.', body: 'لا تتوقف الآن؛ احمِ هذا الإيقاع غداً.', icon: Target },
  ],
  failure: [
    { title: 'أخفقت اليوم؛ واجه ذلك بصدق.', body: 'كان عليك الالتزام. لا تكرر القرار نفسه غداً.', icon: TriangleAlert },
    { title: 'وعدك لنفسك لم يُحفظ اليوم.', body: 'تحمّل مسؤولية الإخفاق، وابدأ تصحيحه من الغد.', icon: CircleX },
    { title: 'اليوم لم يكن في مستوى هدفك.', body: 'لا تختلق الأعذار؛ غيّر سلوكك قبل أن يتكرر الإخفاق.', icon: ShieldAlert },
    { title: 'أهدرت فرصة اليوم.', body: 'كان بإمكانك الاختيار الأفضل. استعد للغد بخطة واضحة.', icon: Ban },
    { title: 'توقّف عن تأجيل التزامك.', body: 'النية وحدها لا تكفي؛ التزم بالفعل في المرة القادمة.', icon: Timer },
    { title: 'خذ هذا الإخفاق بجدية.', body: 'إذا كررت السبب نفسه، ستكرر النتيجة نفسها.', icon: CircleAlert },
    { title: 'خيّبت وعدك لنفسك اليوم.', body: 'تقبّل النتيجة، ثم أثبت غداً أنك قادر على التصحيح.', icon: CircleOff },
    { title: 'غاب الانضباط عن قرارك اليوم.', body: 'لا تجعل هذا الإخفاق يتحول إلى عادة.', icon: TrendingDown },
    { title: 'لم تلتزم، وهذه مسؤوليتك.', body: 'راجع اختيارك وعد إلى المسار من دون تبرير.', icon: Flag },
    { title: 'اليوم خسرت أمام ترددك.', body: 'احسم قرارك غداً، ولا تترك الفرصة تمر مرة أخرى.', icon: RotateCcw },
  ],
};
const commitmentFeedbackBags = { success: [], failure: [] };
const lastCommitmentFeedback = { success: -1, failure: -1 };

function chooseCommitmentFeedback(status) {
  const messages = COMMITMENT_FEEDBACK_MESSAGES[status];
  const bag = commitmentFeedbackBags[status];
  if (!bag.length) {
    const shuffled = messages.map((_, index) => index);
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    const lastIndex = shuffled.length - 1;
    if (shuffled.length > 1 && shuffled[lastIndex] === lastCommitmentFeedback[status]) [shuffled[lastIndex], shuffled[lastIndex - 1]] = [shuffled[lastIndex - 1], shuffled[lastIndex]];
    commitmentFeedbackBags[status] = shuffled;
  }
  const variant = commitmentFeedbackBags[status].pop();
  lastCommitmentFeedback[status] = variant;
  return { ...messages[variant], status, variant: variant + 1 };
}

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

function Modal({ open, title, close, children, wide = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);
  if (!open) return null;
  return createPortal(<div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="إغلاق"><X size={19}/></button></header>
      <div className="modal-body">{children}</div>
    </section>
  </div>, document.body);
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

function Countdown({ event, large = false }) {
  const [now, setNow] = useState(Date.now());
  const { t, lang } = useFlame();
  const gradientId = `countdown-${useId().replace(/:/g, '')}`;
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const dayLength = 86400000;
  const end = eventDeadline(event).getTime();
  const remaining = Math.max(0, end - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.ceil(remaining / dayLength);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const createdValue = new Date(event.createdAt).getTime();
  const created = Number.isFinite(createdValue) ? createdValue : now;
  const cycleElapsed = event.status === 'upcoming' ? ((Math.max(0, now - created) % dayLength) / dayLength) : event.status === 'expired' ? 1 : 0;
  const circumference = 2 * Math.PI * 52;
  const ringLength = circumference * (1 - cycleElapsed);
  const ringGap = Math.max(0.001, circumference * cycleElapsed);
  const dotAngle = cycleElapsed * Math.PI * 2 - Math.PI / 2;
  const dotX = 60 + 52 * Math.cos(dotAngle);
  const dotY = 60 + 52 * Math.sin(dotAngle);
  const urgent = remaining < 3600000 && event.status === 'upcoming';
  const stateClass = event.status === 'completed' ? 'countdown-complete' : event.status === 'expired' ? 'countdown-expired' : '';
  const label = event.status === 'completed' ? t('اكتمل') : event.status === 'expired' ? t('انتهى الموعد') : t('متبقٍ');
  const accessibleTime = `${days} ${t(days === 1 ? 'يوم' : 'أيام')}, ${hours} ${t(hours === 1 ? 'ساعة' : 'ساعات')}, ${minutes} ${t(minutes === 1 ? 'دقيقة' : 'دقائق')}, ${seconds} ${t(seconds === 1 ? 'ثانية' : 'ثوان')}`;
  const clockNow = new Date(now);
  const secondAngle = clockNow.getSeconds() * 6;
  const minuteAngle = (clockNow.getMinutes() + clockNow.getSeconds() / 60) * 6;
  const hourAngle = ((clockNow.getHours() % 12) + clockNow.getMinutes() / 60 + clockNow.getSeconds() / 3600) * 30;
  const numeral = (value) => new Intl.NumberFormat(localeTag(lang)).format(value);
  return <div className={`countdown ${large ? 'countdown-large' : ''} ${urgent ? 'countdown-critical' : ''} ${stateClass}`}>
    <div className="countdown-ring">
      <span className="countdown-aura" aria-hidden="true"/>
      <svg viewBox="0 0 120 120" role="img" aria-label={accessibleTime}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0"><stop className="countdown-stop-start" offset="0"/><stop className="countdown-stop-end" offset="1"/></linearGradient>
          <filter id={`${gradientId}-blur`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.7"/></filter>
        </defs>
        <circle className="countdown-rim" cx="60" cy="60" r="57"/>
        <circle className="countdown-track" cx="60" cy="60" r="52"/>
        <circle className="countdown-glow" cx="60" cy="60" r="52" stroke={`url(#${gradientId})`} filter={`url(#${gradientId}-blur)`} transform="rotate(-90 60 60)" style={{ strokeDasharray: `${ringLength} ${ringGap}`, strokeDashoffset: -circumference * cycleElapsed }}/>
        <circle className="countdown-progress" cx="60" cy="60" r="52" stroke={`url(#${gradientId})`} transform="rotate(-90 60 60)" style={{ strokeDasharray: `${ringLength} ${ringGap}`, strokeDashoffset: -circumference * cycleElapsed }}/>
        {Array.from({ length: 12 }, (_, index) => {
          const number = index === 0 ? 12 : index;
          const angle = index * Math.PI / 6 - Math.PI / 2;
          return <text key={number} className="countdown-numeral" x={60 + Math.cos(angle) * 40} y={60 + Math.sin(angle) * 40} textAnchor="middle" dominantBaseline="central">{numeral(number)}</text>;
        })}
        <g className="countdown-clock-hands" aria-hidden="true">
          <line className="countdown-hour-hand" x1="60" y1="64" x2="60" y2="39" transform={`rotate(${hourAngle} 60 60)`}/>
          <line className="countdown-minute-hand" x1="60" y1="65" x2="60" y2="27" transform={`rotate(${minuteAngle} 60 60)`}/>
          <line className="countdown-second-hand" x1="60" y1="69" x2="60" y2="23" transform={`rotate(${secondAngle} 60 60)`}/>
          <circle className="countdown-hub" cx="60" cy="60" r="3.3"/>
        </g>
        <circle className="countdown-dot-halo" cx={dotX} cy={dotY} r="5.5"/>
        <circle className="countdown-dot" cx={dotX} cy={dotY} r="2.8"/>
      </svg>
      <div className="countdown-center" role="timer" aria-live="off">
        {event.status === 'completed' ? <><strong>✓</strong><span>{label}</span></>
          : event.status === 'expired' ? <span>{label}</span>
            : <><strong>{numeral(days)}</strong><span>{t(days === 1 ? 'يوم' : 'أيام')}</span></>}
      </div>
    </div>
  </div>;
}

function CommitmentCalendar({ commitment, s }) {
  const [month, setMonth] = useState(() => { const [year, m] = s.today.split('-').map(Number); return new Date(year, m - 1, 1); });
  const y = month.getFullYear(), m = month.getMonth();
  const count = new Date(y, m + 1, 0).getDate();
  const offset = (new Date(y, m, 1).getDay() + (s.lang === 'ar' ? 1 : 6)) % 7;
  const days = Array.from({ length: count }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`);
  const records = new Map(commitment.records.map((record) => [record.date, record.status]));
  const labels = s.lang === 'ar' ? ['س','ح','ن','ث','ر','خ','ج'] : ['L','M','M','J','V','S','D'];
  const monthLabel = new Intl.DateTimeFormat(localeTag(s.lang), { month: 'long', year: 'numeric' }).format(month);
  return <section className="panel calendar-panel commitment-calendar-panel"><div className="calendar-head"><button className="icon-button" onClick={() => setMonth(new Date(y, m - 1, 1))} aria-label={s.t('الشهر السابق')}>{s.lang === 'ar' ? <ChevronRight/> : <ChevronLeft/>}</button><h2>{monthLabel}</h2><button className="icon-button" onClick={() => setMonth(new Date(y, m + 1, 1))} aria-label={s.t('الشهر التالي')}>{s.lang === 'ar' ? <ChevronLeft/> : <ChevronRight/>}</button></div><div className="calendar-grid">{labels.map((label, i) => <span className="weekday" key={`${label}-${i}`}>{label}</span>)}{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`}/>)}{days.map((day) => {
    const required = commitmentIncludesDate(commitment, day) && commitment.weekdays.includes(weekdayIndex(day));
    const status = records.get(day);
    return <span key={day} title={s.fd(day)} className={`calendar-day ${required ? 'commitment-calendar-required' : 'commitment-calendar-off'} ${status === 'success' ? 'calendar-win' : status === 'failure' ? 'calendar-loss' : ''} ${day === s.today ? 'calendar-today' : ''}`}>{Number(day.slice(-2))}</span>;
  })}</div><div className="calendar-legend"><span><i className="legend-win"/>{s.t('نجاح')}</span><span><i className="legend-loss"/>{s.t('خسارة')}</span><span><i className="commitment-legend-off"/>{s.t('يوم راحة')}</span></div></section>;
}

function CommitmentFeedback({ feedback, s, commitmentTitle }) {
  const success = feedback.status === 'success';
  const FeedbackIcon = feedback.icon;
  return createPortal(<div className={`commitment-feedback commitment-feedback-${feedback.status} commitment-feedback-variant-${feedback.variant}`} role="status" aria-live="assertive" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}>
    <section className="commitment-feedback-card">
      <div className="commitment-feedback-mark" aria-hidden="true"><span className="commitment-feedback-ring commitment-feedback-ring-one"/><span className="commitment-feedback-ring commitment-feedback-ring-two"/><span className="commitment-feedback-symbol"><FeedbackIcon size={31} strokeWidth={1.8}/></span><span className="commitment-feedback-result">{success ? <Check size={15}/> : <X size={15}/>}</span></div>
      <div className="commitment-feedback-brand"><b>FLAME</b><small>KEEP YOUR FIRE</small></div>
      <span className="commitment-feedback-kicker">{s.t('نتيجة الالتزام')}</span>
      <span className="commitment-feedback-target">{commitmentTitle}</span>
      <h2>{s.t(feedback.title)}</h2>
      <p>{s.t(feedback.body)}</p>
      <span className="commitment-feedback-progress" aria-hidden="true"><i/></span>
    </section>
  </div>, document.body);
}

const FLAME_PALETTES = [
  { start: '#fff18a', middle: '#ff9a27', end: '#ed381b', glow: '#ff8a32' },
  { start: '#c5fbff', middle: '#4ccaff', end: '#5653ef', glow: '#42c8f3' },
  { start: '#ffe0ff', middle: '#ef75e7', end: '#8c3be5', glow: '#cc68f1' },
  { start: '#e4ff9b', middle: '#65dc75', end: '#159b7a', glow: '#55d78d' },
  { start: '#ffe2ad', middle: '#ff8b75', end: '#dd3677', glow: '#ff6689' },
  { start: '#fff5b4', middle: '#e9bc4c', end: '#b75c27', glow: '#edbb54' },
];

function CommitmentFlame({ style = 0, days = 0, label, countBelow = false }) {
  const id = `commitment-flame-${useId().replace(/:/g, '')}`;
  const flameStyle = Math.max(0, Number.isInteger(style) ? style : 0);
  const hue = (flameStyle * 137.508 + 25) % 360;
  const palette = FLAME_PALETTES[flameStyle] || { start: `hsl(${hue} 100% 83%)`, middle: `hsl(${hue} 91% 57%)`, end: `hsl(${(hue + 24) % 360} 82% 35%)`, glow: `hsl(${hue} 94% 57%)` };
  return <span className={`commitment-flame commitment-flame-style-${flameStyle % 6}${countBelow ? ' commitment-flame-count-below' : ''}`} style={{ '--flame-start': palette.start, '--flame-middle': palette.middle, '--flame-end': palette.end, '--flame-glow': palette.glow }} role="img" aria-label={`${days} ${label}`}>
    <span className="commitment-flame-aura"/>
    <svg viewBox="0 0 80 90" aria-hidden="true"><defs><linearGradient id={`${id}-outer`} x1=".2" y1="0" x2=".8" y2="1"><stop stopColor={palette.start}/><stop offset=".43" stopColor={palette.middle}/><stop offset="1" stopColor={palette.end}/></linearGradient><radialGradient id={`${id}-core`} cx="50%" cy="64%" r="53%"><stop stopColor="#fffde9"/><stop offset=".52" stopColor={palette.start}/><stop offset="1" stopColor={palette.middle}/></radialGradient></defs><path className="commitment-flame-shape" d="M42 4C36 17 43 25 48 32c3 4 5 8 5 12 5-5 5-12 2-17 10 11 17 23 15 35-2 15-14 25-30 25S10 76 10 60c0-12 6-21 16-32 0 9 2 14 6 19 0-13 5-19 9-27 3-6 3-11 1-16z" fill={`url(#${id}-outer)`}/><path d="M41 77c-9-3-14-10-13-18 0-6 4-11 9-17 0 8 4 12 8 16 3-6 3-10 2-15 6 8 10 14 9 21-1 7-6 12-15 13z" fill={`url(#${id}-core)`}/><circle className="commitment-flame-spark spark-one" cx="17" cy="46" r="2"/><circle className="commitment-flame-spark spark-two" cx="64" cy="36" r="1.6"/></svg>
    <b>{days}</b>
  </span>;
}

function CommitmentCard({ commitment, s, compact = false, onEdit, focusTarget = false, cardId }) {
  const [expanded, setExpanded] = useState(false);
  const [editMark, setEditMark] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 4800);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const now = new Date(clockNow);
  const day = commitment.id === LEGACY_COMMITMENT_ID ? markableDay(now) : markableCommitmentDay(commitment, now);
  const record = day ? commitment.records.find((item) => item.date === day) : null;
  const required = !!day && commitment.weekdays.includes(weekdayIndex(day)) && commitmentIncludesDate(commitment, day);
  const canRecord = !!day && required;
  const stats = commitmentStreak(commitment, s.effective);
  const windowStartTime = commitment.windowStartTime || '08:30';
  const windowEndTime = commitment.windowEndTime || '22:30';
  const checkInTime = commitment.checkInTime || windowEndTime;
  const todayKey = dateKey(now);
  const todayScheduled = commitment.weekdays.includes(weekdayIndex(todayKey)) && commitmentIncludesDate(commitment, todayKey);
  let periodStart, periodEnd;
  let timeProgressLabel = 'الوقت المتبقي في التحدي اليوم';
  let timeProgressDetail = '';
  let dayRemaining = 0;
  let dayRemainingRatio = 0;
  let showDailyProgress = true;
  let nextWindowDay = null;
  if (commitment.id === LEGACY_COMMITMENT_ID) {
    const hour = now.getHours(), yesterdayKey = shiftDate(todayKey, -1), tomorrowKey = shiftDate(todayKey, 1);
    if (hour < 8) { periodStart = new Date(`${yesterdayKey}T22:00:00`); periodEnd = new Date(`${todayKey}T08:00:00`); }
    else if (hour < 22) { periodStart = new Date(`${todayKey}T08:00:00`); periodEnd = new Date(`${todayKey}T22:00:00`); }
    else { periodStart = new Date(`${todayKey}T22:00:00`); periodEnd = new Date(`${tomorrowKey}T08:00:00`); }
    timeProgressLabel = 'الوقت المتبقي لموعد التقييم';
    dayRemaining = Math.max(0, periodEnd.getTime() - clockNow);
    dayRemainingRatio = Math.max(0, Math.min(1, dayRemaining / (periodEnd.getTime() - periodStart.getTime())));
    const dayHours = Math.floor(dayRemaining / 3600000), dayMinutes = Math.floor((dayRemaining % 3600000) / 60000);
    timeProgressDetail = `${s.t('حتى')} ${pad(periodEnd.getHours())}:${pad(periodEnd.getMinutes())} · ${new Intl.NumberFormat(localeTag(s.lang)).format(dayHours)} ${s.t('ساعات')} ${new Intl.NumberFormat(localeTag(s.lang)).format(dayMinutes)} ${s.t('دقائق')}`;
  } else if (todayScheduled) {
    periodStart = new Date(`${todayKey}T${windowStartTime}:00`);
    periodEnd = new Date(`${todayKey}T${windowEndTime}:00`);
    if (now < periodStart) {
      dayRemaining = periodEnd.getTime() - periodStart.getTime();
      dayRemainingRatio = 1;
      timeProgressLabel = 'نافذة الالتزام اليوم';
      timeProgressDetail = `${windowStartTime} – ${windowEndTime}`;
    } else if (now < periodEnd) {
      dayRemaining = periodEnd.getTime() - clockNow;
      dayRemainingRatio = Math.max(0, Math.min(1, dayRemaining / (periodEnd.getTime() - periodStart.getTime())));
      const dayHours = Math.floor(dayRemaining / 3600000), dayMinutes = Math.floor((dayRemaining % 3600000) / 60000);
      timeProgressDetail = `${s.t('حتى')} ${windowEndTime} · ${new Intl.NumberFormat(localeTag(s.lang)).format(dayHours)} ${s.t('ساعات')} ${new Intl.NumberFormat(localeTag(s.lang)).format(dayMinutes)} ${s.t('دقائق')}`;
    } else {
      const nextDay = nextCommitmentDay(commitment, todayKey);
      if (now < new Date(`${todayKey}T${checkInTime}:00`)) {
        timeProgressLabel = 'موعد تقييم النتيجة';
        timeProgressDetail = `${s.t('يفتح التسجيل عند')} ${checkInTime}`;
      } else {
        timeProgressLabel = 'انتهى وقت الالتزام اليوم';
        timeProgressDetail = nextDay ? `${s.t('التسجيل متاح حتى')} ${s.fd(nextDay)} · ${windowStartTime}` : windowStartTime;
      }
    }
  } else {
    showDailyProgress = false;
    nextWindowDay = nextCommitmentDay(commitment, todayKey);
  }
  const recordResult = (status) => {
    if (record && !editMark && !window.confirm(s.t('تعديل تسجيل اليوم؟'))) return;
    s.recordCommitmentDay(commitment.id, day, status);
    setEditMark(false);
    setFeedback(chooseCommitmentFeedback(status));
  };
  const enableReminder = async () => {
    if (!('Notification' in window)) { window.alert(s.t('الإشعارات غير مدعومة في هذا المتصفح.')); return; }
    try {
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission === 'granted') s.setCommitmentReminder(commitment.id, true);
      else window.alert(s.t('اسمح بالإشعارات من إعدادات المتصفح لتفعيل التذكير.'));
    } catch { window.alert(s.t('اسمح بالإشعارات من إعدادات المتصفح لتفعيل التذكير.')); }
  };
  return <article id={cardId} tabIndex={focusTarget ? -1 : undefined} className={`panel commitment-card ${compact ? 'commitment-card-compact' : ''} ${focusTarget ? 'commitment-card-target' : ''}`}>
    {feedback && <CommitmentFeedback feedback={feedback} s={s} commitmentTitle={commitment.title}/>}
    <div className="commitment-card-head"><div className="commitment-card-title"><CommitmentFlame style={commitment.flameStyle} days={stats.current} label={s.t('أيام متتالية')}/><div><h3>{commitment.title}</h3><small>{s.t('يبدأ الالتزام')} · {s.fd(commitment.startDate, { year: true })}</small></div></div><div className="row-actions">{commitment.id !== LEGACY_COMMITMENT_ID && <button className="icon-button" aria-label={s.t('تعديل الالتزام')} onClick={() => onEdit?.(commitment)}><Pencil size={15}/></button>}<button className="icon-button" aria-label={s.t(expanded ? 'إخفاء التقويم' : 'عرض التقويم')} onClick={() => setExpanded((value) => !value)}><CalendarDays size={16}/></button>{commitment.id !== LEGACY_COMMITMENT_ID && <button className="icon-button icon-danger" aria-label={s.t('حذف الالتزام')} onClick={() => window.confirm(s.t('حذف هذا الالتزام؟')) && s.deleteCommitment(commitment.id)}><Trash2 size={15}/></button>}</div></div>
    <div className="commitment-weekdays">{commitment.weekdays.map((index) => <span key={index}>{s.t(WEEKDAYS[index])}</span>)}</div>
    <div className="commitment-progress-stack">
      {showDailyProgress && <div className="commitment-progress-block daily-window-progress"><div><span>{s.t(timeProgressLabel)}</span><b>{timeProgressDetail}</b></div><div className="commitment-progress-track" role="progressbar" aria-label={s.t(timeProgressLabel)} aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(dayRemainingRatio * 100)}><span style={{ width: `${dayRemainingRatio * 100}%` }}/></div></div>}
      {!showDailyProgress && nextWindowDay && s.today >= (commitment.scheduleStartDate || commitment.startDate) && <div className="commitment-progress-block"><div><span>{s.t('نافذة الالتزام القادمة')}</span><b>{s.fd(nextWindowDay)} · {windowStartTime} – {windowEndTime}</b></div></div>}
    </div>
    <div className="commitment-stats"><div><b>{stats.current}</b><small>{s.t('أيام متتالية')}</small></div><div><b>{stats.best}</b><small>{s.t('أفضل سلسلة')}</small></div><div><b>{stats.total}</b><small>{s.t('أيام الالتزام')}</small></div></div>
    <div className="commitment-record-box">
      {canRecord && <div className="mark-date">{s.t('اليوم المفتوح للتسجيل:')} <b>{s.fd(day)}</b></div>}
      {!canRecord && !record ? <p className="mark-hint">{commitment.startDate > s.today ? `${s.t('يبدأ الالتزام في')} ${s.fd(commitment.startDate, { year: true })}` : !day ? commitment.id === LEGACY_COMMITMENT_ID ? s.t('التسجيل مفتوح من 22:00 إلى 08:00 فقط. إن لم تسجّل قبل 08:00 يُحتسب اليوم خسارة.') : `${s.t('يفتح التسجيل عند')} ${checkInTime}` : s.t('هذا اليوم خارج جدول الالتزام.')}</p>
        : record && !editMark ? <div className="mark-result"><span className={record.status === 'success' ? 'text-success' : 'text-danger'}><CheckCircle2 size={17}/>{s.t(record.status === 'success' ? 'سجّلت التزام اليوم' : 'سجّلت إخفاق اليوم')}</span>{canRecord && <button className="button subtle compact" onClick={() => setEditMark(true)}><Pencil size={14}/>{s.t('تعديل')}</button>}</div>
          : <div className="mark-actions"><button className="button primary" onClick={() => recordResult('success')}><Flame size={16} fill="currentColor"/>{s.t('التزمت اليوم')}</button><button className="button danger-soft" onClick={() => recordResult('failure')}>{s.t('لم ألتزم اليوم')}</button></div>}
    </div>
    {commitment.id !== LEGACY_COMMITMENT_ID && (commitment.reminders ? <div className="commitment-reminder-status"><AlarmClock size={13}/>{s.t('التذكير مفعل')}</div> : <button className="commitment-reminder-link" onClick={enableReminder}><AlarmClock size={14}/>{s.t('تفعيل إشعار التقييم')}</button>)}
    {expanded && <CommitmentCalendar commitment={commitment} s={s}/>}
  </article>;
}

function HomeCommitmentItem({ commitment, s, onOpen }) {
  const stats = commitmentStreak(commitment, s.effective);
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  const now = new Date(clockNow);
  const resultDay = commitment.id === LEGACY_COMMITMENT_ID ? markableDay(now) : markableCommitmentDay(commitment, now);
  const resultDue = !!resultDay
    && commitment.weekdays.includes(weekdayIndex(resultDay))
    && commitmentIncludesDate(commitment, resultDay)
    && !commitment.records.some((record) => record.date === resultDay);
  return <button type="button" className={`home-commitment-item ${resultDue ? 'home-commitment-item-due' : ''}`} dir={s.lang === 'ar' ? 'rtl' : 'ltr'} aria-label={`${s.t(resultDue ? 'سجّل نتيجة اليوم' : 'فتح الالتزام')}: ${commitment.title}`} onClick={() => onOpen(commitment.id)}>
    {resultDue && <span className="commitment-result-due" role="status" aria-live="polite"><AlarmClock size={12}/>{s.t('سجّل نتيجة اليوم')}</span>}
    <CommitmentFlame style={commitment.flameStyle} days={stats.current} label={s.t('أيام متتالية')} countBelow/>
    <h3>{commitment.title}</h3>
  </button>;
}

function CommitmentsHomeSection({ s, onAdd, onView, onOpenCommitment }) {
  const commitments = [...s.data.commitments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return <section className="commitments-home-section"><div className="section-title-row"><div><span className="eyebrow">FLAME · PROMISES</span><h2>{s.t('التزاماتي')}</h2></div><button className="button primary compact" onClick={onAdd}><Plus size={15}/>{s.t('التزام جديد')}</button></div>
    {commitments.length ? <div className="home-commitment-row">{commitments.map((commitment) => <HomeCommitmentItem key={commitment.id} commitment={commitment} s={s} onOpen={onOpenCommitment}/>)}</div> : <div className="panel commitment-empty"><Target size={24}/><p>{s.t('لا توجد التزامات بعد. ابدأ بإنشاء أول التزام لك.')}</p><button className="button subtle" onClick={onView}>{s.t('إدارة الالتزامات')}</button></div>}
  </section>;
}

function CommitmentsPage({ s, onAdd, onEdit, focusId }) {
  const commitments = [...s.data.commitments].sort((a, b) => a.startDate.localeCompare(b.startDate));
  useEffect(() => {
    if (!focusId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`commitment-card-${focusId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusId]);
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · PROMISES</span><h1>{s.t('التزاماتي')}</h1></div><button className="button primary" onClick={onAdd}><Plus size={17}/>{s.t('التزام جديد')}</button></div><p className="commitment-page-intro">{s.t('أنشئ عاداتك، وحدد أيامها، وتابع استمرارك.')}</p>
    {commitments.length ? <div className="commitment-list">{commitments.map((commitment) => <CommitmentCard key={commitment.id} commitment={commitment} s={s} onEdit={onEdit} focusTarget={commitment.id === focusId} cardId={`commitment-card-${commitment.id}`}/>)}</div> : <div className="panel commitment-empty"><Target size={28}/><p>{s.t('لا توجد التزامات بعد. ابدأ بإنشاء أول التزام لك.')}</p><button className="button primary" onClick={onAdd}><Plus size={16}/>{s.t('أنشئ التزاماً')}</button></div>}
  </div>;
}

function CommitmentModal({ s, open, close, onCreated, editing }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(s.today);
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [windowStartTime, setWindowStartTime] = useState('08:30');
  const [windowEndTime, setWindowEndTime] = useState('22:30');
  const [checkInTime, setCheckInTime] = useState('22:30');
  const [reminders, setReminders] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setTitle(editing?.title || ''); setStartDate(editing?.startDate || s.today); setWeekdays(editing?.weekdays || [0, 1, 2, 3, 4, 5, 6]); setWindowStartTime(editing?.windowStartTime || '08:30'); setWindowEndTime(editing?.windowEndTime || '22:30'); setCheckInTime(editing?.checkInTime || editing?.windowEndTime || '22:30'); setReminders(editing ? !!editing.reminders : true); setError(''); } }, [open, s.today, editing]);
  const toggleDay = (day) => setWeekdays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b));
  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) { setError(s.t('أدخل اسم الالتزام.')); return; }
    if (!validDate(startDate) || (!editing && startDate < s.today)) { setError(s.t('اختر تاريخ بدء صالحاً.')); return; }
    if (!weekdays.length) { setError(s.t('اختر يوماً واحداً على الأقل.')); return; }
    if (!validCommitmentWindow(windowStartTime, windowEndTime)) { setError(s.t('يجب أن يكون وقت النهاية بعد وقت البداية في اليوم نفسه.')); return; }
    if (!validCommitmentSchedule(windowStartTime, windowEndTime, checkInTime)) { setError(s.t('يجب أن يكون وقت التقييم عند نهاية النافذة أو بعدها.')); return; }
    let enableNotifications = false;
    if (reminders && 'Notification' in window) {
      try {
        const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        enableNotifications = permission === 'granted';
      } catch { enableNotifications = false; }
    }
    const payload = { title, startDate, weekdays, windowStartTime, windowEndTime, checkInTime, reminders: enableNotifications };
    const saved = editing ? s.updateCommitment(editing.id, payload) : s.addCommitment(payload);
    if (!saved) { setError(s.t(editing ? 'تعذر تعديل الالتزام، حاول مرة أخرى.' : 'تعذر إنشاء الالتزام، حاول مرة أخرى.')); return; }
    close();
    onCreated?.();
  };
  return <Modal open={open} title={s.t(editing ? 'تعديل الالتزام' : 'التزام جديد')} close={close}><form className="form-stack" onSubmit={submit}><Field label={s.t('اسم الالتزام')}><input autoFocus required maxLength={120} value={title} onChange={(event) => { setTitle(event.target.value); setError(''); }} placeholder={s.t('مثال: أترك التفاهة أو لا أسهر')}/></Field><Field label={s.t('تاريخ البدء')}><input type="date" min={editing?.startDate || s.today} value={startDate} onChange={(event) => { setStartDate(event.target.value || s.today); setError(''); }}/></Field><div className="commitment-form-grid"><Field label={s.t('من وقت')}><input type="time" required value={windowStartTime} onChange={(event) => { setWindowStartTime(event.target.value); setError(''); }}/></Field><Field label={s.t('إلى وقت')}><input type="time" required value={windowEndTime} onChange={(event) => { setWindowEndTime(event.target.value); setError(''); }}/></Field></div><div className="commitment-evaluation-field"><Field label={s.t('وقت تقييم النتيجة')}><input type="time" required value={checkInTime} onChange={(event) => { setCheckInTime(event.target.value); setError(''); }}/></Field></div>{windowStartTime && windowEndTime && !validCommitmentWindow(windowStartTime, windowEndTime) && <p className="profile-form-error" role="alert">{s.t('يجب أن يكون وقت النهاية بعد وقت البداية في اليوم نفسه.')}</p>}{validCommitmentWindow(windowStartTime, windowEndTime) && checkInTime && checkInTime < windowEndTime && <p className="profile-form-error" role="alert">{s.t('يجب أن يكون وقت التقييم عند نهاية النافذة أو بعدها.')}</p>}<p className="helper-text">{s.t('حدد بداية ونهاية نافذة الالتزام لكل يوم مختار، ثم اختر وقت تقييم النتيجة. يفتح التسجيل عند هذا الموعد ويبقى متاحاً حتى بداية النافذة التالية.')}</p><fieldset className="weekday-picker"><legend>{s.t('أيام الالتزام كل أسبوع')}</legend><div>{WEEKDAYS.map((label, index) => <button type="button" key={label} aria-pressed={weekdays.includes(index)} className={weekdays.includes(index) ? 'weekday-choice selected' : 'weekday-choice'} onClick={() => { toggleDay(index); setError(''); }}>{s.t(label)}</button>)}</div></fieldset><p className="helper-text">{s.t('يمكنك تحديد يوم واحد أو عدة أيام، مثل الإثنين إلى الأحد.')}</p>{editing && <p className="helper-text commitment-edit-note">{s.t('تسري تغييرات الأيام والوقت من اليوم، وتبقى السجلات السابقة محفوظة.')}</p>}<label className="commitment-notify-choice"><input type="checkbox" checked={reminders} onChange={(event) => setReminders(event.target.checked)}/><span><b>{s.t('ذكّرني بموعد التقييم')}</b><small>{s.t('يلزم السماح بإشعارات المتصفح وترك الموقع مفتوحاً وقت التذكير.')}</small></span></label>{error && <p className="profile-form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button primary" type="submit" disabled={!title.trim() || !weekdays.length || !validDate(startDate) || (!editing && startDate < s.today) || !validCommitmentSchedule(windowStartTime, windowEndTime, checkInTime)}><Check size={16}/>{s.t(editing ? 'حفظ التعديلات' : 'ابدأ الالتزام')}</button><button className="button subtle" type="button" onClick={close}>{s.t('إلغاء')}</button></div></form></Modal>;
}

function HomePage({ s, onPlan, onEvent, onWeekly, onAddCommitment, onViewCommitments, onOpenCommitment }) {
  const t = s.t, fd = s.fd;
  const mission = s.data.dailyMissions.find((item) => item.scheduledDate === s.effective);
  const upcoming = s.data.dailyMissions.filter((item) => item.scheduledDate > s.effective).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const upcomingEvents = s.data.importantEvents.filter((event) => event.status === 'upcoming').sort((a, b) => eventDeadline(a) - eventDeadline(b));
  const nextEvent = upcomingEvents[0];
  const [planDate, setPlanDate] = useState(s.nextMissionDate);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraDate, setExtraDate] = useState('today');
  const [extraTitle, setExtraTitle] = useState('');
  const [extraDescription, setExtraDescription] = useState('');
  const allDone = !!mission?.tasks.length && mission.tasks.every((task) => task.completed);
  useEffect(() => { if (planDate < s.nextMissionDate) setPlanDate(s.nextMissionDate); }, [planDate, s.nextMissionDate]);
  const submitExtra = (event) => {
    event.preventDefault();
    if (!extraTitle.trim()) return;
    s.addCompletedTask(extraTitle, extraDescription, extraDate === 'yesterday' ? s.yesterday : s.today);
    setExtraTitle(''); setExtraDescription(''); setExtraOpen(false); setExtraDate('today');
  };
  return <div className="page-stack">
    {s.weeklyReminder && <section className="panel reminder-panel"><div className="reminder-copy"><span className="eyebrow">FLAME · WEEKLY</span><h2>{t('لا تنسَ تحصيل هذا الأسبوع')}</h2><p>{t('حدد فترة التقرير ومحتواه، ثم احفظه PDF.')}</p></div><button className="button primary" onClick={onWeekly}><Download size={17}/>{t('إعداد التقرير')}</button></section>}
    <CommitmentsHomeSection s={s} onAdd={onAddCommitment} onView={onViewCommitments} onOpenCommitment={onOpenCommitment}/>

    <section className="panel mission-panel">
      <div className="section-heading"><span className="heading-icon"><Target size={19}/></span><div><h2>{t(s.effective === s.today ? 'مهمتي اليوم' : 'مهام الأمس حتى 08:00')}</h2><p>{mission ? `${fd(s.effective)} · ${mission.tasks.filter((task) => task.completed).length} / ${mission.tasks.length} ${t('اكتملت')}` : `${fd(s.effective)} · ${t('لا توجد مهام لهذا اليوم، استعد لمهمتك القادمة.')}`}</p></div><strong className="completion-percent">{mission?.tasks.length ? Math.round(mission.tasks.filter((task) => task.completed).length / mission.tasks.length * 100) : 0}%</strong></div>
      {mission && <><div className="progress-track"><div className={allDone ? 'progress-fill complete' : 'progress-fill'} style={{ width: `${Math.round(mission.tasks.filter((task) => task.completed).length / mission.tasks.length * 100)}%` }}/></div>
        <ul className="task-list">{mission.tasks.map((task) => <li key={task.id}><button className="task-toggle" onClick={() => s.toggleTask(mission.id, task.id)}><span className={`task-check ${task.completed ? 'checked' : ''}`}>{task.completed && <Check size={15}/>}</span><span className={`task-text ${task.completed ? 'is-complete' : ''}`}><b>{task.title}</b>{task.description && <small>{task.description}</small>}</span></button></li>)}</ul>
        {allDone && <div className="mission-complete"><Flame size={17} fill="currentColor"/>{t('أحسنت! لقد أوفيت بوعدك لنفسك.')} <b>+20</b></div>}</>}
      <div className="add-done-actions">
        {s.effective === s.today && <button className="button subtle full-width add-done" onClick={() => { setExtraDate('today'); setExtraOpen((value) => extraDate !== 'today' || !value); }}><Plus size={17}/>{t('أضف مهمة أنجزتها اليوم')}</button>}
        <button className="button subtle full-width add-done" onClick={() => { setExtraDate('yesterday'); setExtraOpen((value) => extraDate !== 'yesterday' || !value); }}><RotateCcw size={16}/>{t('أضف مهمة أنجزتها أمس')}</button>
      </div>
      {extraOpen && <form className="inline-form" onSubmit={submitExtra}><Field label={t('عنوان المهمة')}><input autoFocus required maxLength={100} value={extraTitle} onChange={(event) => setExtraTitle(event.target.value)} placeholder={t('مثال: ساعدت عائلتي')}/></Field><Field label={t('وصف (اختياري)')}><input maxLength={180} value={extraDescription} onChange={(event) => setExtraDescription(event.target.value)}/></Field><div className="form-actions"><button className="button primary" type="submit"><Check size={16}/>{t(extraDate === 'yesterday' ? 'أضفها إلى إنجازات أمس' : 'أضفها إلى إنجازات اليوم')}</button><button type="button" className="button subtle" onClick={() => { setExtraOpen(false); setExtraDate('today'); }}>{t('إلغاء')}</button></div><p className="helper-text">{t(extraDate === 'yesterday' ? 'ستُضاف إلى مهام أمس بحالة مكتملة.' : 'ستُضاف إلى مهام اليوم بحالة مكتملة.')}</p></form>}
    </section>

    <section className="panel upcoming-panel">
      <div className="section-heading"><span className="heading-icon"><AlarmClock size={19}/></span><div><h2>{t('أقرب موعد')}</h2><p>{t('تذكّر ما ينتظرك')}</p></div><button className="button subtle compact" onClick={onEvent}><Plus size={15}/>{t('موعد')}</button></div>
      {nextEvent ? <div className="next-event"><Countdown event={nextEvent} large/><div className="next-event-info" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}><span className="eyebrow">{t('أقرب موعد')}</span><h3>{nextEvent.title}</h3><p>{fd(nextEvent.eventDate, { year: true })}{nextEvent.eventTime ? ` · ${nextEvent.eventTime}` : ''}</p><span className={`priority-pill ${nextEvent.priority}`}>{t(CAT[nextEvent.category])} · {t(PRIORITIES[nextEvent.priority])}</span></div></div> : <EmptyState icon={CalendarDays} text={t('لا توجد مواعيد قادمة. أضف موعداً لتبقيه أمام عينيك.')}/>}
      {upcomingEvents.length > 1 && <div className="event-mini-list">{upcomingEvents.slice(1, 4).map((event) => <div className="event-mini" key={event.id}><span className="mini-date">{fd(event.eventDate, { weekday: 'short' })}</span><b>{event.title}</b><span className="mini-left">{timeLeft(event)}</span></div>)}</div>}
    </section>

    <section className="coming-section"><div className="section-title-row"><div><span className="eyebrow">{t('التخطيط')}</span><h2>{t('مهامي حسب التاريخ')}</h2><p>{t('اختر تاريخاً وأضف مهاماً لأيام مختلفة.')}</p></div></div>
      <p className="helper-text planner-cutoff-note">{t('تبدأ مهام اليوم الجديد عند 08:00 صباحاً، ويمكنك إعدادها قبل ذلك.')}</p>
      <div className="planner-controls"><label className="field planner-date-field"><span>{t('تاريخ المهام')}</span><input type="date" min={s.nextMissionDate} value={planDate} onChange={(event) => setPlanDate(event.target.value || s.nextMissionDate)}/></label><button className="button primary planner-add" onClick={() => onPlan(null, planDate)}><Plus size={15}/>{t('أضف لهذا التاريخ')}</button></div>
      {upcoming.length ? <div className="plan-list">{upcoming.map((item) => <MissionCard key={item.id} mission={item} s={s} onEdit={() => onPlan(item)}/>)}</div> : <EmptyState icon={ListChecks} text={t('لا توجد مهام قادمة. اختر تاريخاً لإضافتها.')}/>}
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
    <button className="event-card-main" onClick={() => setExpanded(expanded === event.id ? null : event.id)}><Countdown event={event}/><span className="event-card-copy"><b>{event.title}</b><small>{s.fd(event.eventDate, { year: true })}{event.eventTime ? ` · ${event.eventTime}` : ''}</small><span className={`priority-pill ${event.priority}`}>{s.t(CAT[event.category])} · {s.t(PRIORITIES[event.priority])}</span></span><ChevronDown size={17} className={expanded === event.id ? 'chevron-open' : ''}/></button>
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

function sumExpenses(entries) { return entries.reduce((total, entry) => total + Math.round(entry.amount * 100), 0) / 100; }

function expenseDateLabel(key, language, options = {}) {
  return new Intl.DateTimeFormat(localeTag(language), options).format(new Date(`${key}T12:00:00`));
}

function expenseChartSeries({ period, anchor, customStart, customEnd, expenses, s }) {
  const byDate = new Map();
  expenses.forEach((entry) => {
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  });
  if (period === 'يومي') {
    const points = [...PURCHASE_PERIODS, 'unspecified'].map((purchasePeriod) => {
      const entries = (byDate.get(anchor) || []).filter((entry) => entry.purchasePeriod === purchasePeriod).sort((a, b) => a.id.localeCompare(b.id));
      const value = Math.round(sumExpenses(entries) * 100) / 100;
      return { key: `${anchor}-${purchasePeriod}`, date: anchor, label: s.t(purchasePeriodLabels[purchasePeriod]), value, entries, high: value > 20 };
    });
    return { points, threshold: 20, rangeStart: anchor, rangeEnd: anchor };
  }

  let start, end, threshold;
  if (period === 'أسبوعي') {
    const weekday = new Date(`${anchor}T12:00:00`).getDay();
    start = shiftDate(anchor, -((weekday + 6) % 7));
    end = shiftDate(start, 6);
    threshold = 50;
  } else if (period === 'شهري') {
    const [year, month] = anchor.split('-').map(Number);
    start = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${pad(month)}-${pad(lastDay)}`;
    const currentMonth = s.today.slice(0, 7) === anchor.slice(0, 7);
    end = currentMonth && s.today < monthEnd ? s.today : monthEnd;
    threshold = 100;
  } else {
    start = customStart;
    end = customEnd;
    if (!start || !end || start > end) return { points: [], threshold: 50, rangeStart: start, rangeEnd: end, invalid: true };
    const rangeDays = Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1;
    threshold = rangeDays === 1 ? 20 : rangeDays <= 7 ? 50 : 100;
  }
  end = end > s.today ? s.today : end;
  if (start > end) return { points: [], threshold, rangeStart: start, rangeEnd: end, invalid: true };
  const points = [];
  for (let key = start; key <= end; key = shiftDate(key, 1)) {
    const entries = (byDate.get(key) || []).sort((a, b) => a.id.localeCompare(b.id));
    const value = Math.round(sumExpenses(entries) * 100) / 100;
    const label = period === 'أسبوعي'
      ? expenseDateLabel(key, s.lang, { weekday: 'short' })
      : period === 'شهري'
        ? numeralDateDay(key, s.lang)
        : expenseDateLabel(key, s.lang, { day: 'numeric', month: 'short' });
    points.push({ key, date: key, label, value, entries, high: value > threshold });
  }
  return { points, threshold, rangeStart: start, rangeEnd: end };
}

function numeralDateDay(key, language) {
  return new Intl.NumberFormat(localeTag(language)).format(Number(key.slice(-2)));
}

function niceExpenseAxis(value) {
  if (value <= 0) return { step: 1, top: 4 };
  const target = value / 4;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const normalized = target / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  return { step, top: Math.ceil(value / step) * step };
}

function ExpenseTrendChart({ s, anchor }) {
  const [period, setPeriod] = useState('أسبوعي');
  const [chartType, setChartType] = useState(() => {
    try {
      const saved = window.localStorage.getItem('flame:expense-chart-type');
      return ['line', 'bar', 'donut'].includes(saved) ? saved : 'bar';
    } catch { return 'bar'; }
  });
  const [chartAnchor, setChartAnchor] = useState(anchor);
  const [customStart, setCustomStart] = useState(shiftDate(s.today, -6));
  const [customEnd, setCustomEnd] = useState(s.today);
  const [selected, setSelected] = useState(null);
  const chartScrollRef = useRef(null);
  const [chartViewportWidth, setChartViewportWidth] = useState(360);
  useEffect(() => setChartAnchor(anchor), [anchor]);
  useEffect(() => {
    try { window.localStorage.setItem('flame:expense-chart-type', chartType); } catch { /* Preferences are optional. */ }
  }, [chartType]);
  useEffect(() => setSelected(null), [period, chartType, chartAnchor, customStart, customEnd]);
  const series = expenseChartSeries({ period, anchor: chartAnchor, customStart, customEnd, expenses: s.data.expenseEntries, s });
  useEffect(() => {
    const element = chartScrollRef.current;
    if (!element || series.invalid) return undefined;
    const measure = () => {
      const width = Math.round(element.getBoundingClientRect().width);
      if (width > 0) setChartViewportWidth((current) => current === width ? current : width);
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [series.invalid]);
  const points = series.points;
  const width = points.length > 31 ? Math.max(chartViewportWidth, (points.length - 1) * 48 + 72) : chartViewportWidth;
  const height = 232, left = 42, right = 16, top = 25, bottom = 42;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const dataMaximum = Math.max(0, ...points.map((point) => point.value));
  const axis = niceExpenseAxis(dataMaximum);
  const scaleTop = axis.top;
  const tickCount = Math.round(scaleTop / axis.step);
  const pointGap = points.length <= 1 ? plotWidth : plotWidth / (points.length - 1);
  const coordinates = points.map((point, index) => {
    const x = left + (points.length <= 1 ? plotWidth / 2 : index * pointGap);
    const hitGap = Math.max(pointGap, 18);
    return {
      ...point,
      x,
      y: top + plotHeight - point.value / scaleTop * plotHeight,
      hitLeft: Math.max(left, x - hitGap / 2),
      hitRight: Math.min(left + plotWidth, x + hitGap / 2),
    };
  });
  const selectNearestPoint = (event) => {
    const svg = event.currentTarget.ownerSVGElement;
    const bounds = svg?.getBoundingClientRect();
    if (!bounds?.width) return;
    const chartX = (event.clientX - bounds.left) * width / bounds.width;
    const nearest = coordinates.reduce((closest, point) => Math.abs(point.x - chartX) < Math.abs(closest.x - chartX) ? point : closest, coordinates[0]);
    if (nearest) choosePoint(nearest);
  };
  const line = coordinates.length ? coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ') : '';
  const area = coordinates.length ? `${line} L ${coordinates[coordinates.length - 1].x} ${top + plotHeight} L ${coordinates[0].x} ${top + plotHeight} Z` : '';
  const thresholdY = top + plotHeight - series.threshold / scaleTop * plotHeight;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const formatAxisValue = (value) => new Intl.NumberFormat(localeTag(s.lang), { maximumFractionDigits: Number.isInteger(axis.step) ? 0 : 2 }).format(value);
  const allEntries = [...new Map(points.flatMap((point) => point.entries).map((entry) => [entry.id, entry])).values()];
  const periodTotalCents = allEntries.reduce((total, entry) => total + Math.round(entry.amount * 100), 0);
  const periodTotal = periodTotalCents / 100;
  const rangeDayCount = series.rangeStart && series.rangeEnd
    ? Math.max(1, Math.round((new Date(`${series.rangeEnd}T12:00:00`) - new Date(`${series.rangeStart}T12:00:00`)) / 86400000) + 1)
    : 1;
  const dayTotals = new Map();
  allEntries.forEach((entry) => dayTotals.set(entry.date, (dayTotals.get(entry.date) || 0) + Math.round(entry.amount * 100)));
  const highestDay = [...dayTotals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const purchaseBreakdown = [...PURCHASE_PERIODS, 'unspecified'].map((purchasePeriod, index) => {
    const entries = allEntries.filter((entry) => entry.purchasePeriod === purchasePeriod);
    const cents = entries.reduce((total, entry) => total + Math.round(entry.amount * 100), 0);
    return { key: purchasePeriod, label: s.t(purchasePeriodLabels[purchasePeriod]), entries, value: cents / 100, percentage: periodTotalCents ? cents / periodTotalCents * 100 : 0, color: ['#d94a45', '#3b82f6', '#14a38b', '#e59a24', '#8b63c7'][index] };
  }).filter((item) => item.value > 0);
  const donutCircumference = 2 * Math.PI * 51;
  const title = period === 'مخصص' && series.rangeStart && series.rangeEnd
    ? `${s.fd(series.rangeStart, { year: true })} — ${s.fd(series.rangeEnd, { year: true })}`
    : period === 'يومي' ? s.fd(chartAnchor, { year: true }) : period === 'أسبوعي' ? `${s.t('المصاريف حسب أيام الأسبوع')} · ${s.fd(series.rangeStart, { month: 'short' })} — ${s.fd(series.rangeEnd, { month: 'short', year: true })}` : new Intl.DateTimeFormat(localeTag(s.lang), { month: 'long', year: 'numeric' }).format(new Date(`${chartAnchor}T12:00:00`));
  const detailTitle = selected?.detailsTitle || '';
  const choosePoint = (point) => setSelected({ ...point, detailsTitle: `${point.label} · ${s.fd(point.date, { year: true })}` });
  const activateWithKeyboard = (event, action) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
  };
  let donutOffset = 0;
  return <>
    <section className="panel expense-chart-panel" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="expense-chart-heading"><div><span className="eyebrow">FLAME · TREND</span><h2>{s.t('اتجاه المصاريف')}</h2><p>{title}</p></div><span className="expense-chart-icon"><Activity size={18}/></span></div>
      <div className="segmented expense-chart-periods" role="group" aria-label={s.t('الفترة')}>
        {['يومي', 'أسبوعي', 'شهري', 'مخصص'].map((value) => <button type="button" aria-pressed={period === value} className={period === value ? 'selected' : ''} key={value} onClick={() => setPeriod(value)}>{s.t(value)}</button>)}
      </div>
      {period === 'مخصص' ? <div className="expense-chart-range"><Field label={s.t('من')}><input type="date" max={s.today} value={customStart} onChange={(event) => setCustomStart(event.target.value)}/></Field><Field label={s.t('إلى')}><input type="date" max={s.today} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}/></Field></div>
        : <div className="expense-chart-anchor"><Field label={s.t(period === 'شهري' ? 'الشهر المرجعي' : 'التاريخ المرجعي')}><input type={period === 'شهري' ? 'month' : 'date'} max={period === 'شهري' ? s.today.slice(0, 7) : s.today} value={period === 'شهري' ? chartAnchor.slice(0, 7) : chartAnchor} onChange={(event) => { const value = event.target.value; if (value) setChartAnchor(period === 'شهري' ? `${value}-01` : value); }}/></Field></div>}
      <div className="segmented expense-chart-types" role="group" aria-label={s.t('نوع المبيان')}>
        {[['line', Activity, 'خطي'], ['bar', BarChart3, 'أعمدة'], ['donut', PieChart, 'قرص']].map(([value, Icon, label]) => <button type="button" aria-pressed={chartType === value} className={chartType === value ? 'selected' : ''} key={value} onClick={() => setChartType(value)}><Icon size={14}/>{s.t(label)}</button>)}
      </div>
      {!series.invalid && <div className="expense-chart-summary">
        <div className="expense-chart-total"><span>{s.t('إجمالي الفترة')}</span><b>{money(periodTotal, s.lang)}</b></div>
        <div><span>{s.t('المتوسط اليومي')}</span><b>{money(periodTotal / rangeDayCount, s.lang)}</b></div>
        <div><span>{s.t('أعلى يوم')}</span><b>{highestDay ? money(highestDay[1] / 100, s.lang) : money(0, s.lang)}</b><small>{highestDay ? expenseDateLabel(highestDay[0], s.lang, { day: 'numeric', month: 'short' }) : '—'}</small></div>
      </div>}
      <p className="expense-chart-threshold"><span className="expense-high-dot"/>{s.t('إنفاق مرتفع')} · {s.t('أكثر من')} {money(series.threshold, s.lang)} {period === 'يومي' ? `· ${s.t('لكل فترة شراء')}` : `· ${s.t('لليوم')}`}</p>
      {series.invalid ? <p className="expense-chart-empty">{s.t('راجع نطاق التاريخ المختار.')}</p> : <div className="expense-chart-scroll" ref={chartScrollRef}>
        {chartType === 'donut' ? purchaseBreakdown.length ? <div className="expense-donut-layout">
          <svg className="expense-donut-svg" viewBox="0 0 144 144" role="group" aria-label={s.t('توزيع المصاريف حسب فترة الشراء')}>
            <circle className="expense-donut-track" cx="72" cy="72" r="51"/>
            {purchaseBreakdown.map((slice) => {
              const segmentLength = slice.percentage / 100 * donutCircumference;
              const offset = donutOffset;
              donutOffset += segmentLength;
              return <circle key={slice.key} className="expense-donut-segment" cx="72" cy="72" r="51" stroke={slice.color} strokeDasharray={`${segmentLength} ${donutCircumference - segmentLength}`} strokeDashoffset={-offset} role="button" tabIndex="0" aria-label={`${slice.label}: ${money(slice.value, s.lang)}، ${Math.round(slice.percentage)}%`} onClick={() => setSelected({ label: slice.label, value: slice.value, entries: slice.entries, high: false, detailsTitle: slice.label })} onKeyDown={(event) => activateWithKeyboard(event, () => setSelected({ label: slice.label, value: slice.value, entries: slice.entries, high: false, detailsTitle: slice.label }))}><title>{`${slice.label}: ${money(slice.value, s.lang)} · ${Math.round(slice.percentage)}%`}</title></circle>;
            })}
            <text className="expense-donut-center-label" x="72" y="67" textAnchor="middle">{s.t('إجمالي الفترة')}</text>
            <text className="expense-donut-center-value" x="72" y="86" textAnchor="middle">{new Intl.NumberFormat(localeTag(s.lang), { maximumFractionDigits: 0 }).format(periodTotal)}</text>
          </svg>
          <div className="expense-donut-legend">{purchaseBreakdown.map((slice) => <button type="button" className="expense-donut-legend-item" key={slice.key} onClick={() => setSelected({ label: slice.label, value: slice.value, entries: slice.entries, high: false, detailsTitle: slice.label })}><span className="expense-donut-legend-name"><i style={{ background: slice.color }}/>{slice.label}<small>{Math.round(slice.percentage)}%</small></span><b>{money(slice.value, s.lang)}</b></button>)}</div>
        </div> : <p className="expense-chart-empty">{s.t('لا توجد نقاط في هذه الفترة.')}</p> : points.length ? <svg className="expense-chart-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={s.t(chartType === 'bar' ? 'أعمدة المصاريف' : 'منحنى المصاريف')}>
          {Array.from({ length: tickCount + 1 }, (_, index) => { const fraction = index / tickCount; const y = top + plotHeight * fraction; const value = scaleTop - axis.step * index; return <g key={index}><line className="expense-chart-grid" x1={left} y1={y} x2={width - right} y2={y}/><text className="expense-chart-y-label" x={left - 7} y={y + 3} textAnchor="end">{formatAxisValue(value)}</text></g>; })}
          <text className="expense-chart-unit" x={left} y="13">{s.t('درهم')}</text>
          {series.threshold <= scaleTop && <line className="expense-chart-threshold-line" x1={left} y1={thresholdY} x2={width - right} y2={thresholdY}/>}
          {chartType === 'line' && <><defs><linearGradient id="expenseChartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--primary)" stopOpacity=".25"/><stop offset="1" stopColor="var(--primary)" stopOpacity=".02"/></linearGradient></defs><path className="expense-chart-area" d={area}/><path className="expense-chart-line" d={line}/></>}
          {coordinates.map((point, index) => {
            const barWidth = Math.min(20, Math.max(6, pointGap * .64));
            const barY = Math.min(point.y, top + plotHeight - 1);
            const barHeight = Math.max(0, top + plotHeight - point.y);
            return <g className={`expense-chart-point ${point.high ? 'expense-chart-point-high' : ''}`} key={point.key} role="button" tabIndex="0" aria-label={`${point.label}: ${money(point.value, s.lang)}`} onClick={selectNearestPoint} onKeyDown={(event) => activateWithKeyboard(event, () => choosePoint(point))}>
              <title>{`${point.label}: ${money(point.value, s.lang)}`}</title><rect className="expense-chart-point-hit-band" x={point.hitLeft} y={top} width={point.hitRight - point.hitLeft} height={plotHeight}/>
              {chartType === 'bar' ? <rect className="expense-chart-bar" x={point.x - barWidth / 2} y={barY} width={barWidth} height={barHeight} rx="3"/> : <><circle className="expense-chart-point-hit" cx={point.x} cy={point.y} r="12"/><circle className="expense-chart-point-dot" cx={point.x} cy={point.y} r={point.high ? 5.5 : 4.5}/></>}
              {points.length <= 7 && point.value > 0 && <text className={`expense-chart-value ${point.high ? 'expense-chart-value-high' : ''}`} x={point.x} y={point.y - 11} textAnchor="middle">{new Intl.NumberFormat(localeTag(s.lang), { maximumFractionDigits: 2 }).format(point.value)}</text>}
              {(index % labelEvery === 0 || index === points.length - 1) && <text className="expense-chart-x-label" x={point.x} y={height - 13} textAnchor="middle">{point.label}</text>}
            </g>;
          })}
        </svg> : <p className="expense-chart-empty">{s.t('لا توجد نقاط في هذه الفترة.')}</p>}
      </div>}
      <p className="expense-chart-hint">{s.t(chartType === 'donut' ? 'اضغط على فئة لعرض تفاصيلها.' : 'اضغط على أي نقطة لعرض تفاصيلها.')}</p>
    </section>
    <Modal open={!!selected} title={detailTitle} close={() => setSelected(null)}>
      {selected && <div className="expense-point-details"><div className={`expense-point-total ${selected.high ? 'expense-point-total-high' : ''}`}><span>{s.t('الإجمالي')}</span><b>{money(selected.value, s.lang)}</b></div>{selected.entries.length ? <div className="expense-point-list">{selected.entries.map((entry) => <div className="expense-point-row" key={entry.id}><div><b>{entry.description}</b><small>{s.t(purchasePeriodLabels[entry.purchasePeriod] || purchasePeriodLabels.unspecified)}{chartType === 'donut' ? ` · ${s.fd(entry.date, { month: 'short', year: true })}` : ''}</small></div><strong className={entry.amount > series.threshold ? 'expense-point-amount-high' : ''}>{money(entry.amount, s.lang)}</strong></div>)}</div> : <p className="expense-chart-empty">{s.t('لا توجد مصاريف في هذه النقطة.')}</p>}</div>}
    </Modal>
  </>;
}

function ExpensesPage({ s, onReport }) {
  const [date, setDate] = useState(s.today);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [purchasePeriod, setPurchasePeriod] = useState('morning');
  const [editing, setEditing] = useState(null);
  const expenses = s.data.expenseEntries.filter((entry) => entry.date === date).sort((a, b) => a.id.localeCompare(b.id));
  const total = expenses.reduce((sum, entry) => sum + entry.amount, 0);
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
    <section className="panel print-action"><div><h2>{s.t('التقرير حسب الاختيار')}</h2><p>{s.t('اختر الفترة ونوع التقرير ثم احفظه PDF.')}</p></div><button className="button primary full-width" onClick={() => onReport(date)}><Download size={17}/>{s.t('إعداد التقرير')}</button></section>
  </div>;
}

function PeriodReport({ s, start, end, period, financialOnly = false }) {
  const expenses = s.data.expenseEntries.filter((entry) => entry.date >= start && entry.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const missions = s.data.dailyMissions.filter((mission) => mission.scheduledDate >= start && mission.scheduledDate <= end).sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  const records = s.data.disciplineRecords.filter((record) => record.date >= start && record.date <= end).sort((a, b) => a.date.localeCompare(b.date));
  const allTasks = missions.flatMap((mission) => mission.tasks.map((task) => ({ date: mission.scheduledDate, task })));
  const completed = allTasks.filter(({ task }) => task.completed).length;
  const spent = expenses.reduce((total, entry) => total + entry.amount, 0);
  const wins = records.filter((record) => record.status === 'success').length;
  const losses = records.filter((record) => record.status === 'failure').length;
  const titlePeriod = period === 'يومي' ? 'اليومي' : period === 'أسبوعي' ? 'الأسبوعي' : period === 'شهري' ? 'الشهري' : 'المخصص';
  const title = financialOnly ? s.t(`التقرير المالي ${titlePeriod}`) : s.t(`التقرير ${titlePeriod}`);
  return <article className={`print-report period-report ${financialOnly ? 'period-financial-report' : 'period-full-report'}`} dir={s.lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReportHeader s={s} title={title} subtitle={s.t(financialOnly ? 'تقرير المصاريف فقط' : 'دفتر للإنفاق والإنجاز')} period={`${s.fd(start, { year: true })} — ${s.fd(end, { year: true })}`}/>
    <div className="report-summary">{financialOnly ? <><ReportStat label={s.t('إجمالي المصروف')} value={money(spent, s.lang)} highlight/><ReportStat label={s.t('عدد المصاريف')} value={expenses.length}/></> : <><ReportStat label={s.t('إجمالي المصروف')} value={money(spent, s.lang)} highlight/><ReportStat label={s.t('المهام المكتملة')} value={`${completed} / ${allTasks.length}`}/><ReportStat label={s.t('عدد المصاريف')} value={expenses.length}/><ReportStat label={s.t('أيام الانضباط')} value={`${wins} ${s.t('نجاح')} · ${losses} ${s.t('خسارة')}`}/></>}</div>
    <ReportSection title={s.t('تفاصيل المصاريف خلال الفترة')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('فترة الشراء')}</th><th>{s.t('الوصف')}</th><th>{s.t('السعر')} · MAD</th></tr></thead><tbody>{expenses.length ? expenses.map((entry) => <tr key={entry.id}><td>{s.fd(entry.date, { year: true })}</td><td>{s.t(purchasePeriodLabels[entry.purchasePeriod] || purchasePeriodLabels.unspecified)}</td><td>{entry.description}</td><td className="amount-cell">{money(entry.amount, s.lang)}</td></tr>) : <tr><td colSpan="4" className="report-empty">{s.t('لا توجد مصاريف مسجلة خلال هذه الفترة.')}</td></tr>}</tbody><tfoot><tr><td colSpan="3">{s.t('الإجمالي')}</td><td className="amount-cell">{money(spent, s.lang)}</td></tr></tfoot></table></ReportSection>
    {!financialOnly && <>
      <ReportSection title={s.t('المهام خلال الفترة')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('المهمة')}</th><th>{s.t('الحالة')}</th></tr></thead><tbody>{allTasks.length ? allTasks.map(({ date, task }) => <tr key={`${date}-${task.id}`}><td>{s.fd(date, { weekday: 'short' })}</td><td>{task.title}{task.description && <small className="report-description">{task.description}</small>}</td><td className={task.completed ? 'text-success' : 'report-muted'}>{s.t(task.completed ? 'مكتملة' : 'غير مكتملة')}</td></tr>) : <tr><td colSpan="3" className="report-empty">{s.t('لا توجد مهام مسجلة خلال هذه الفترة.')}</td></tr>}</tbody></table></ReportSection>
      <ReportSection title={s.t('سجل الانضباط خلال الفترة')}><table className="report-table"><thead><tr><th>{s.t('التاريخ')}</th><th>{s.t('نتيجة التحدي')}</th></tr></thead><tbody>{records.length ? records.map((record) => <tr key={record.date}><td>{s.fd(record.date, { weekday: 'long', year: true })}</td><td className={record.status === 'success' ? 'text-success' : 'text-danger'}>{s.t(record.status === 'success' ? 'أكملت التحدي' : 'ضيعت الوقت')}</td></tr>) : <tr><td colSpan="2" className="report-empty">{s.t('لا توجد سجلات انضباط خلال هذه الفترة.')}</td></tr>}</tbody></table></ReportSection>
    </>}
    <ReportFooter s={s}/>
  </article>;
}

function ReportChooser({ s, open, close, initialDate }) {
  const [period, setPeriod] = useState('يومي');
  const [day, setDay] = useState(initialDate || s.today);
  const anchorDate = initialDate && initialDate <= s.today ? initialDate : s.today;
  const [customStart, setCustomStart] = useState(`${anchorDate.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(anchorDate);
  useEffect(() => { if (open) { setDay(anchorDate); setCustomStart(`${anchorDate.slice(0, 7)}-01`); setCustomEnd(anchorDate); } }, [open, anchorDate]);
  const weekStart = (() => { const dayIndex = (new Date(`${anchorDate}T12:00:00`).getDay() + 6) % 7; return shiftDate(anchorDate, -dayIndex); })();
  const weekEnd = shiftDate(weekStart, 6);
  const monthStart = `${anchorDate.slice(0, 7)}-01`;
  const monthLastDay = new Date(Number(anchorDate.slice(0, 4)), Number(anchorDate.slice(5, 7)), 0).getDate();
  const monthEnd = `${anchorDate.slice(0, 7)}-${pad(monthLastDay)}`;
  const range = period === 'يومي' ? { start: day, end: day }
    : period === 'أسبوعي' ? { start: weekStart, end: weekEnd < anchorDate ? weekEnd : anchorDate }
      : period === 'شهري' ? { start: monthStart, end: monthEnd < anchorDate ? monthEnd : anchorDate }
        : { start: customStart, end: customEnd };
  const invalid = !range.start || !range.end || range.start > range.end || range.end > s.today;
  const periodKey = period === 'يومي' ? 'يومي' : period === 'أسبوعي' ? 'أسبوعي' : period === 'شهري' ? 'شهري' : 'المخصص';
  const download = (financialOnly) => {
    if (invalid) return;
    printSelected(financialOnly ? 'period-financial' : 'period-full', `FLAME-${periodKey}-${range.start}-${range.end}`);
    close();
  };
  return <Modal open={open} title={s.t('التقرير حسب الاختيار')} close={close}>
    <div className="form-stack report-chooser" dir={s.lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="segmented report-period-options" role="group" aria-label={s.t('الفترة')}>
        {['يومي', 'أسبوعي', 'شهري', 'آخر'].map((label) => <button type="button" key={label} aria-pressed={period === (label === 'آخر' ? 'مخصص' : label)} className={period === (label === 'آخر' ? 'مخصص' : label) ? 'selected' : ''} onClick={() => setPeriod(label === 'آخر' ? 'مخصص' : label)}>{s.t(label)}</button>)}
      </div>
      {period === 'يومي' && <Field label={s.t('اختر اليوم')}><input type="date" max={s.today} value={day} onChange={(event) => setDay(event.target.value)}/></Field>}
      {period === 'مخصص' && <div className="field-grid"><Field label={s.t('تاريخ البدء')}><input type="date" max={s.today} value={customStart} onChange={(event) => setCustomStart(event.target.value)}/></Field><Field label={s.t('تاريخ الانتهاء')}><input type="date" max={s.today} value={customEnd} onChange={(event) => setCustomEnd(event.target.value)}/></Field></div>}
      {(period === 'أسبوعي' || period === 'شهري') && <div className="report-range-note"><small>{s.t('الفترة المحددة')}</small><b>{s.fd(range.start, { year: true })} — {s.fd(range.end, { year: true })}</b><span>{s.t(period === 'أسبوعي' ? 'يبدأ الأسبوع يوم الإثنين وينتهي مساء الأحد، ويُختصر حتى تاريخ التقرير إذا كان الأسبوع جارياً.' : 'يبدأ الشهر من اليوم الأول، وينتهي في آخر أيامه أو بتاريخ التقرير إذا كان الشهر جارياً.')}</span></div>}
      {invalid && <p className="profile-form-error" role="alert">{s.t('يجب أن يكون تاريخ الانتهاء مساوياً لتاريخ البدء أو بعده، وألا يتجاوز اليوم.')}</p>}
      <div className="report-chooser-actions"><button type="button" className="button primary" disabled={invalid} onClick={() => download(false)}><Download size={16}/>{s.t('التقرير الكامل')}</button><button type="button" className="button subtle" disabled={invalid} onClick={() => download(true)}><Receipt size={16}/>{s.t('التقرير المالي فقط')}</button></div>
      <p className="helper-text center-text">{s.t('عند الطباعة اختر حفظ كملف PDF.')}</p>
    </div>
    {!invalid && createPortal(<><PeriodReport s={s} start={range.start} end={range.end} period={periodKey}/><PeriodReport s={s} start={range.start} end={range.end} period={periodKey} financialOnly/></>, document.getElementById('print-area'))}
  </Modal>;
}

function WeeklyStats({ s, onReport }) {
  const [weekStart, setWeekStart] = useState(() => { const today = new Date(`${s.today}T12:00:00`); const day = (today.getDay() + 6) % 7; return shiftDate(s.today, -day); });
  const weekEnd = shiftDate(weekStart, 6);
  const currentStart = (() => { const day = (new Date(`${s.today}T12:00:00`).getDay() + 6) % 7; return shiftDate(s.today, -day); })();
  const expenses = s.data.expenseEntries.filter((entry) => entry.date >= weekStart && entry.date <= weekEnd && entry.date <= s.today);
  const missions = s.data.dailyMissions.filter((mission) => mission.scheduledDate >= weekStart && mission.scheduledDate <= weekEnd && mission.scheduledDate <= s.effective);
  const records = s.data.disciplineRecords.filter((record) => record.date >= weekStart && record.date <= weekEnd && record.date <= s.today);
  const completed = missions.reduce((total, mission) => total + mission.tasks.filter((task) => task.completed).length, 0);
  const totalTasks = missions.reduce((total, mission) => total + mission.tasks.length, 0);
  const spent = expenses.reduce((total, entry) => total + entry.amount, 0);
  const wins = records.filter((record) => record.status === 'success').length, losses = records.filter((record) => record.status === 'failure').length;
  return <section className="panel weekly-panel"><div className="week-heading"><button className="icon-button" onClick={() => setWeekStart(shiftDate(weekStart, -7))} aria-label={s.t('الأسبوع السابق')}>{s.lang === 'ar' ? <ChevronRight/> : <ChevronLeft/>}</button><div><span className="eyebrow">FLAME · WEEKLY</span><h2>{s.t('التحصيل الأسبوعي')}</h2><p>{s.fd(weekStart, { month: 'short' })} — {s.fd(weekEnd, { month: 'short', year: true })}</p></div><button className="icon-button" disabled={weekStart >= currentStart} onClick={() => setWeekStart(shiftDate(weekStart, 7))} aria-label={s.t('الأسبوع التالي')}>{s.lang === 'ar' ? <ChevronLeft/> : <ChevronRight/>}</button></div><div className="weekly-metrics"><div className="weekly-metric total-metric"><span>{s.t('إجمالي المصروف')}</span><b>{money(spent, s.lang)}</b></div><div className="weekly-metric"><span>{s.t('المهام المكتملة')}</span><b>{completed} / {totalTasks}</b></div><div className="weekly-metric"><span>{s.t('عدد المصاريف')}</span><b>{expenses.length}</b></div><div className="weekly-metric"><span>{s.t('أيام النجاح')} / {s.t('أيام الخسارة')}</span><b><i className="text-success">{wins}</i> / <i className="text-danger">{losses}</i></b></div></div><p className="helper-text">{s.t('يبدأ الأسبوع يوم الإثنين وينتهي يوم الأحد.')}</p><button className="button primary full-width" onClick={() => onReport(weekEnd <= s.today ? weekEnd : s.today)}><Download size={16}/>{s.t('التقرير حسب الاختيار')}</button></section>;
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

function SettingsPage({ s, fileRef, onReset, onReport }) {
  const exp = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(s.data, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `flame-backup-${s.today}.json`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const imp = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { if (window.confirm(s.t('سيتم استبدال بياناتك الحالية. متابعة؟'))) s.importData(String(reader.result)); };
    reader.readAsText(file);
  };
  return <div className="page-stack"><div className="page-title-row"><div><span className="eyebrow">FLAME · INSIGHTS</span><h1>{s.t('الإحصائيات')}</h1></div><span className="title-icon"><BarChart3 size={20}/></span></div>
    <WeeklyStats s={s} onReport={onReport}/><ExpenseTrendChart s={s} anchor={s.today}/><section className="panel lifetime-panel"><span className="eyebrow">{s.t('النقاط التراكمية')}</span><b>{s.points}</b><p>+10 {s.t('لكل يوم انتصار')} · +20 {s.t('عند إتمام كل مهام اليوم')} · −10 {s.t('عند الخسارة')}</p></section><div className="stats-four">{[[s.t('الحالية'),s.current],[s.t('الأطول'),s.best],[s.t('أيام النجاح'),s.wins],[s.t('أيام الخسارة'),s.losses]].map(([label, value]) => <div className="panel stat-tile" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
    <div className="settings-heading"><span className="eyebrow">FLAME · SETUP</span><h2>{s.t('الإعدادات')}</h2></div><section className="panel settings-panel"><div className="settings-section-title"><span className="heading-icon"><Settings2 size={18}/></span><div><h2>{s.t('المظهر والتخصيص')}</h2><p>{s.t('سمة الواجهة')}</p></div></div><div className="segmented theme-segment">{[['dark', Moon, 'داكن'],['light', Sun, 'فاتح'],['system', Settings2, 'النظام']].map(([value, Icon, label]) => <button key={value} className={s.data.settings.theme === value ? 'selected' : ''} onClick={() => s.setTheme(value)}><Icon size={15}/>{s.t(label)}</button>)}</div><div className="settings-section-title accent-title"><span className="heading-icon"><Sparkles size={18}/></span><div><h3>{s.t('لون الموقع')}</h3><p>{s.t('البرتقالي هو اللون الافتراضي.')}</p></div></div><div className="accent-grid">{accents.map((accent) => <button className={`accent-option ${s.data.settings.accentColor === accent.id ? 'accent-selected' : ''}`} key={accent.id} onClick={() => s.setAccent(accent.id)}><i style={{ '--swatch': accent.primary, '--swatch-glow': accent.glow }}/><span>{s.t(accent.label)}</span>{s.data.settings.accentColor === accent.id && <Check size={14}/>}</button>)}</div></section>
    <section className="panel settings-panel"><div className="settings-section-title"><span className="heading-icon"><ShieldCheck size={18}/></span><div><h2>{s.t('البيانات والنسخ الاحتياطي')}</h2><p>{s.t('احفظ نسخة من بياناتك أو استعد نسخة سابقة.')}</p></div></div><div className="backup-actions"><button className="button subtle" onClick={exp}><CloudDownload size={16}/>{s.t('تصدير')} JSON</button><button className="button subtle" onClick={() => fileRef.current?.click()}><Upload size={16}/>{s.t('استيراد')} JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => { imp(event.target.files?.[0]); event.target.value = ''; }}/></div><p className="helper-text">{s.t('بياناتك محفوظة في هذا المتصفح وهذا الجهاز فقط، ولا توجد مزامنة بين الهاتف والحاسوب. استخدم التصدير والاستيراد لنقلها.')}</p></section>
    <section className="panel settings-panel danger-zone"><div className="settings-section-title"><span className="heading-icon danger-icon"><Trash2 size={18}/></span><div><h2>{s.t('إدارة البيانات')}</h2><p>{s.t('سيتم حذف الانضباط والالتزامات والمهام والمصاريف والمواعيد نهائياً. صدّر نسخة احتياطية أولاً.')}</p></div></div><button className="button danger-outline full-width" onClick={onReset}>{s.t('مسح كل البيانات')}</button></section>
  </div>;
}

function PlanModal({ s, open, close, editing, initialDate }) {
  const [date, setDate] = useState(initialDate || s.nextMissionDate);
  const [tasks, setTasks] = useState([{ title: '', description: '' }]);
  useEffect(() => { if (open) { setDate(editing?.scheduledDate || initialDate || s.nextMissionDate); setTasks(editing ? editing.tasks.map((task) => ({ ...task })) : [{ title: '', description: '' }]); } }, [open, editing?.id, initialDate, s.nextMissionDate]);
  useEffect(() => { if (date < s.nextMissionDate) setDate(s.nextMissionDate); }, [date, s.nextMissionDate]);
  const update = (index, value) => setTasks((items) => items.map((task, i) => i === index ? { ...task, ...value } : task));
  const remove = (index) => setTasks((items) => items.filter((_, i) => i !== index));
  const submit = (event) => { event.preventDefault(); const filtered = tasks.filter((task) => task.title.trim()); if (!filtered.length || date < s.nextMissionDate) return; if (editing) s.updateMission(editing.id, date, filtered); else s.addMission(date, filtered); close(); };
  return <Modal open={open} title={s.t(editing ? 'تعديل المهمة' : 'مهمة جديدة')} close={close} wide><form className="form-stack" onSubmit={submit}><Field label={s.t('تاريخ المهمة')}><input type="date" min={s.nextMissionDate} value={date} onChange={(event) => setDate(event.target.value)}/></Field>{tasks.map((task, index) => <div className="task-editor" key={index}><div className="task-editor-head"><span>{s.t('المهمة')} {index + 1}</span>{tasks.length > 1 && <button type="button" className="icon-button icon-danger" onClick={() => remove(index)}><Trash2 size={15}/></button>}</div><Field label={s.t('عنوان المهمة')}><input maxLength={100} value={task.title} onChange={(event) => update(index, { title: event.target.value })} placeholder={s.t('عنوان المهمة')}/></Field><Field label={s.t('وصف (اختياري)')}><input maxLength={180} value={task.description || ''} onChange={(event) => update(index, { description: event.target.value })}/></Field></div>)}<button className="button subtle full-width" type="button" onClick={() => setTasks((items) => [...items, { title: '', description: '' }])}><Plus size={16}/>{s.t('أضف مهمة')}</button><div className="form-actions"><button className="button primary" type="submit" disabled={!tasks.some((task) => task.title.trim()) || date < s.nextMissionDate}>{s.t(editing ? 'احفظ التعديلات' : 'احفظ المهمة')}</button><button className="button subtle" type="button" onClick={close}>{s.t('إلغاء')}</button></div></form></Modal>;
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
  const [data, setData] = useState(() => {
    const loaded = loadData();
    const synced = syncData(loaded);
    if (synced !== loaded) saveData(synced);
    return synced;
  });
  const dataRef = useRef(data); dataRef.current = data;
  const [today, setToday] = useState(dateKey());
  const [workDay, setWorkDay] = useState(() => effectiveDay());
  const [tab, setTab] = useState('home');
  const [commitmentTarget, setCommitmentTarget] = useState('');
  const [planOpen, setPlanOpen] = useState(false), [planEdit, setPlanEdit] = useState(null);
  const [planInitialDate, setPlanInitialDate] = useState('');
  const [eventOpen, setEventOpen] = useState(false), [eventEdit, setEventEdit] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false), [reportDate, setReportDate] = useState(today);
  const [commitmentOpen, setCommitmentOpen] = useState(false);
  const [commitmentEdit, setCommitmentEdit] = useState(null);
  const fileRef = useRef(null);
  const lang = data.settings.lang;
  const t = (text) => tr(text, lang);
  const fd = useDateLabel(lang);
  const effective = workDay;
  const currentStats = streaks(data.disciplineRecords, effective);
  const wins = data.disciplineRecords.filter((record) => record.status === 'success').length;
  const losses = data.disciplineRecords.length - wins;
  const score = points(data);
  const yesterday = shiftDate(today, -1);
  const tomorrow = shiftDate(today, 1);
  const nextMissionDate = shiftDate(effective, 1);
  const openReport = (date = today) => { setReportDate(date); setReportOpen(true); };
  const s = useMemo(() => ({ data, today, yesterday, lang, t, fd, tomorrow, nextMissionDate, effective, points: score, current: currentStats.current, best: currentStats.best, wins, losses,
    addCompletedTask: (title, description, requestedDate) => update((current, currentDate) => {
      const missionDate = requestedDate === shiftDate(currentDate, -1) ? requestedDate : currentDate;
      const mission = current.dailyMissions.find((item) => item.scheduledDate === missionDate);
      const task = { id: uid(), title: title.trim(), description: description.trim() || undefined, completed: true };
      if (!task.title) return current;
      if (mission) return { ...current, dailyMissions: current.dailyMissions.map((item) => item.id === mission.id ? { ...item, tasks: [...item.tasks, task] } : item) };
      const createdAt = new Date().toISOString();
      const archived = missionDate < effectiveDay();
      return { ...current, dailyMissions: [...current.dailyMissions, { id: uid(), scheduledDate: missionDate, tasks: [task], status: archived ? 'archived' : 'active', createdAt, ...(archived ? { archivedAt: createdAt } : {}) }] };
    }),
    toggleTask: (missionId, taskId) => update((current) => { const activeDate = effectiveDay(); return { ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === missionId && mission.scheduledDate === activeDate ? { ...mission, tasks: mission.tasks.map((task) => task.id === taskId ? { ...task, completed: !task.completed } : task) } : mission) }; }),
    recordDay: (date, status) => update((current) => ({ ...current, disciplineRecords: [...current.disciplineRecords.filter((record) => record.date !== date), { date, status }].sort((a, b) => a.date.localeCompare(b.date)) })),
    addCommitment: ({ title, startDate, weekdays, windowStartTime, windowEndTime, checkInTime, reminders }) => {
      const id = uid();
      const nextStyle = Math.max(-1, ...dataRef.current.commitments.map((commitment) => commitment.flameStyle ?? -1)) + 1;
      const next = update((current, currentDate) => {
        const cleanTitle = title.trim().slice(0, 120);
        const cleanWeekdays = [...new Set(Array.isArray(weekdays) ? weekdays : [])].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);
        if (!cleanTitle || !cleanWeekdays.length || !validDate(startDate) || startDate < currentDate || !validCommitmentSchedule(windowStartTime, windowEndTime, checkInTime)) return current;
        return { ...current, commitments: [...current.commitments, { id, title: cleanTitle, startDate, scheduleStartDate: startDate, weekdays: cleanWeekdays, windowStartTime, windowEndTime, checkInTime, reminders: !!reminders, reminderSentDate: '', records: [], flameStyle: nextStyle }] };
      });
      return !!next?.commitments.some((commitment) => commitment.id === id);
    },
    updateCommitment: (id, { title, startDate, weekdays, windowStartTime, windowEndTime, checkInTime, reminders }) => {
      const next = update((current, currentDate) => {
        const existing = current.commitments.find((commitment) => commitment.id === id && commitment.id !== LEGACY_COMMITMENT_ID);
        const cleanTitle = typeof title === 'string' ? title.trim().slice(0, 120) : '';
        const cleanWeekdays = [...new Set(Array.isArray(weekdays) ? weekdays : [])].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b);
        if (!existing || !cleanTitle || !cleanWeekdays.length || !validDate(startDate) || !validCommitmentSchedule(windowStartTime, windowEndTime, checkInTime)) return current;
        const scheduleChanged = existing.windowStartTime !== windowStartTime || existing.windowEndTime !== windowEndTime || existing.checkInTime !== checkInTime || existing.weekdays.join(',') !== cleanWeekdays.join(',');
        return { ...current, commitments: current.commitments.map((commitment) => commitment.id === id ? { ...commitment, title: cleanTitle, startDate, scheduleStartDate: startDate > currentDate ? startDate : currentDate, weekdays: cleanWeekdays, windowStartTime, windowEndTime, checkInTime, reminders: !!reminders, reminderSentDate: scheduleChanged ? '' : commitment.reminderSentDate } : commitment) };
      });
      return !!next?.commitments.some((commitment) => commitment.id === id && commitment.title === title.trim());
    },
    setCommitmentReminder: (id, enabled) => update((current) => ({ ...current, commitments: current.commitments.map((commitment) => commitment.id === id && commitment.id !== LEGACY_COMMITMENT_ID ? { ...commitment, reminders: !!enabled, reminderSentDate: '' } : commitment) })),
    recordCommitmentDay: (id, date, status) => update((current) => {
      if (!date || !['success', 'failure'].includes(status)) return current;
      const record = { date, status };
      return { ...current, commitments: current.commitments.map((commitment) => {
        if (commitment.id !== id || !commitment.weekdays.includes(weekdayIndex(date)) || !commitmentIncludesDate(commitment, date)) return commitment;
        return { ...commitment, records: [...commitment.records.filter((existing) => existing.date !== date), record].sort((a, b) => a.date.localeCompare(b.date)) };
      }), disciplineRecords: id === LEGACY_COMMITMENT_ID ? [...current.disciplineRecords.filter((item) => item.date !== date), record].sort((a, b) => a.date.localeCompare(b.date)) : current.disciplineRecords };
    }),
    deleteCommitment: (id) => id === LEGACY_COMMITMENT_ID ? undefined : update((current) => ({ ...current, commitments: current.commitments.filter((commitment) => commitment.id !== id) })),
    addMission: (date, tasks) => update((current) => {
      if (date <= effectiveDay()) return current;
      const clean = tasks.filter((task) => task.title.trim()).map((task) => ({ id: task.id || uid(), title: task.title.trim(), description: task.description?.trim() || undefined, completed: !!task.completed }));
      if (!clean.length) return current;
      const existing = current.dailyMissions.find((mission) => mission.scheduledDate === date && mission.status === 'upcoming');
      if (existing) return { ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === existing.id ? { ...mission, tasks: [...mission.tasks, ...clean] } : mission) };
      return { ...current, dailyMissions: [...current.dailyMissions, { id: uid(), scheduledDate: date, tasks: clean, status: 'upcoming', createdAt: new Date().toISOString() }] };
    }),
    updateMission: (id, date, tasks) => update((current) => {
      const existing = current.dailyMissions.find((mission) => mission.id === id);
      if (!existing || existing.status !== 'upcoming' || existing.scheduledDate <= effectiveDay() || date <= effectiveDay()) return current;
      const clean = tasks.filter((task) => task.title.trim()).map((task) => ({ id: task.id || uid(), title: task.title.trim(), description: task.description?.trim() || undefined, completed: !!task.completed }));
      const other = current.dailyMissions.find((mission) => mission.id !== id && mission.scheduledDate === date && mission.status === 'upcoming');
      if (other) return { ...current, dailyMissions: current.dailyMissions.filter((mission) => mission.id !== id).map((mission) => mission.id === other.id ? { ...mission, tasks: [...mission.tasks, ...clean] } : mission) };
      return { ...current, dailyMissions: current.dailyMissions.map((mission) => mission.id === id ? { ...mission, scheduledDate: date, tasks: clean } : mission) };
    }),
    deleteMission: (id) => update((current) => ({ ...current, dailyMissions: current.dailyMissions.filter((mission) => mission.id !== id || mission.status !== 'upcoming' || mission.scheduledDate <= effectiveDay()) })),
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
    }), [data, today, yesterday, nextMissionDate, effective, lang, score, currentStats.current, currentStats.best, wins, losses]);

  function update(mutator) {
    const current = dataRef.current;
    const currentDate = dateKey();
    const next = syncData(mutator(current, currentDate), currentDate);
    dataRef.current = next;
    setData(next);
    setToday(currentDate);
    setWorkDay(effectiveDay());
    saveData(next);
    return next;
  }

  useEffect(() => {
    const refresh = () => {
      const now = new Date(), currentDate = dateKey(now);
      setToday(currentDate);
      setWorkDay(effectiveDay(now));
      const current = dataRef.current, next = syncData(current, currentDate, now);
      if (next !== current) { dataRef.current = next; setData(next); saveData(next); }
    };
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  useEffect(() => {
    const sendDueReminders = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const now = new Date(), todayKey = dateKey(now), time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const due = dataRef.current.commitments.filter((commitment) => commitment.id !== LEGACY_COMMITMENT_ID && commitment.reminders && commitment.reminderSentDate !== todayKey && commitment.weekdays.includes(weekdayIndex(todayKey)) && commitmentIncludesDate(commitment, todayKey) && time >= commitment.checkInTime && !commitment.records.some((record) => record.date === todayKey));
      if (!due.length) return;
      due.forEach((commitment) => {
        try {
          const language = dataRef.current.settings.lang;
          const title = tr('حان وقت تسجيل التزامك', language);
          const options = { body: `${commitment.title} · ${tr('حدد نتيجة اليوم', language)}`, icon: './icon.svg', tag: `flame-commitment-${commitment.id}-${todayKey}` };
          if (navigator.serviceWorker?.controller) navigator.serviceWorker.ready.then((registration) => registration.showNotification(title, options)).catch(() => new Notification(title, options));
          else {
            const notification = new Notification(title, options);
            notification.onclick = () => { window.focus(); notification.close(); };
          }
        } catch { /* notifications may be unavailable in this browser context */ }
      });
      const sent = new Set(due.map((commitment) => commitment.id));
      update((current) => ({ ...current, commitments: current.commitments.map((commitment) => sent.has(commitment.id) ? { ...commitment, reminderSentDate: todayKey } : commitment) }));
    };
    sendDueReminders();
    const timer = window.setInterval(sendDueReminders, 30000);
    window.addEventListener('focus', sendDueReminders);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', sendDueReminders); };
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
  const context = { ...s, weeklyReminder, today, tomorrow, nextMissionDate };
  const openPlan = (mission = null, date = nextMissionDate) => { setPlanEdit(mission); setPlanInitialDate(mission?.scheduledDate || date || nextMissionDate); setPlanOpen(true); };
  const openEvent = (event = null) => { setEventEdit(event); setEventOpen(true); };
  const openCommitment = (editing = null) => { setCommitmentEdit(editing); setCommitmentOpen(true); };
  const viewCommitment = (id) => { setCommitmentTarget(id); setTab('commitments'); };
  const closeCommitment = () => { setCommitmentOpen(false); setCommitmentEdit(null); };
  const nav = [[Home,'الرئيسية','home'],[Target,'التزاماتي','commitments'],[Activity,'السجل','history'],[Receipt,'المصاريف','expenses'],[CalendarDays,'المواعيد','events'],[BarChart3,'الإحصائيات','stats']];
  return <Ctx.Provider value={context}><div className="app-shell">
    <header className="app-header"><div className="header-brand"><span className="brand-flame"><Flame size={19} fill="currentColor"/></span><span><b>FLAME</b><small>KEEP YOUR FIRE</small></span></div><div className="header-actions"><div className="today-label"><b>{fd(today)}</b><small>{t('احمِ وقتك، واحفظ شعلتك.')}</small></div><button className="language-button" onClick={() => update((current) => ({ ...current, settings: { ...current.settings, lang: current.settings.lang === 'ar' ? 'fr' : 'ar' } }))}><Languages size={15}/>{lang === 'ar' ? 'FR' : 'AR'}</button></div></header>
    {data.settings.userName && <button className="app-identity" dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={() => setProfileOpen(true)}><span>{t('المستخدم')}</span><b>{data.settings.userName}</b><Pencil size={14}/></button>}
    <main className="main-content"><div className="page-transition" key={tab}>{tab === 'home' && <HomePage s={context} onPlan={openPlan} onEvent={() => openEvent()} onWeekly={() => openReport()} onAddCommitment={() => openCommitment()} onEditCommitment={openCommitment} onViewCommitments={() => setTab('commitments')} onOpenCommitment={viewCommitment}/ >}{tab === 'commitments' && <CommitmentsPage s={context} onAdd={() => openCommitment()} onEdit={openCommitment} focusId={commitmentTarget}/ >}{tab === 'history' && <HistoryPage s={context}/ >}{tab === 'expenses' && <ExpensesPage s={context} onReport={openReport}/ >}{tab === 'events' && <EventsPage s={context} onEdit={openEvent} onAdd={() => openEvent()}/ >}{tab === 'stats' && <SettingsPage s={context} fileRef={fileRef} onReset={() => setResetOpen(true)} onReport={openReport}/ >}</div></main>
    <SiteFooter s={context}/>
    {(tab === 'home' || tab === 'events') && <button className="floating-add" aria-label={t(tab === 'home' ? 'مهمة جديدة' : 'موعد جديد')} onClick={() => tab === 'home' ? openPlan() : openEvent()}>{tab === 'home' ? <ListChecks size={20}/> : <CalendarPlus size={20}/>}</button>}
    <nav className="bottom-nav" aria-label="Navigation"><div>{nav.map(([Icon, label, id]) => <button key={id} className={tab === id ? 'nav-item nav-active' : 'nav-item'} onClick={() => { setCommitmentTarget(''); setTab(id); }}><Icon size={20}/><span>{t(label)}</span></button>)}</div></nav>
    <PlanModal s={context} open={planOpen} close={() => setPlanOpen(false)} editing={planEdit} initialDate={planInitialDate}/><EventModal s={context} open={eventOpen} close={() => setEventOpen(false)} editing={eventEdit}/>
    <ReportChooser s={context} open={reportOpen} close={() => setReportOpen(false)} initialDate={reportDate}/>
    <ProfileModal s={context} open={profileOpen} close={() => setProfileOpen(false)}/>
    <CommitmentModal s={context} open={commitmentOpen} close={closeCommitment} editing={commitmentEdit} onCreated={() => { setCommitmentTarget(''); setTab('commitments'); }}/>
    <Modal open={resetOpen} title={t('مسح كل البيانات؟')} close={() => setResetOpen(false)}><p className="modal-copy">{t('سيتم حذف الانضباط والالتزامات والمهام والمصاريف والمواعيد نهائياً. صدّر نسخة احتياطية أولاً.')}</p><div className="form-actions"><button className="button subtle" onClick={() => setResetOpen(false)}>{t('إلغاء')}</button><button className="button danger-solid" onClick={() => { const current = dataRef.current; const cleared = emptyData(); cleared.settings = { ...current.settings, startDate: dateKey() }; dataRef.current = cleared; setData(cleared); saveData(cleared); setResetOpen(false); }}>{t('نعم، امسح')}</button></div></Modal>
    {(!data.settings.userName || !data.settings.signature) && <ProfileSetup s={context} onSave={s.setUserProfile}/>}
  </div></Ctx.Provider>;
}
