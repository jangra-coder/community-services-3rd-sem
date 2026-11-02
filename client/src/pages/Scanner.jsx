import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatCodeInput, normalizeTicketCode } from '../lib/ticketCode.js';
import { AlertIcon, CameraIcon, CheckCircleIcon, KeyboardIcon, XIcon } from '../components/Icons.jsx';
import { cx } from '../lib/cx.js';
import { Alert, Button, Input, PageHeader } from '../components/ui.jsx';

const RESULT_TTL_MS = 4000; // how long a scan result stays on screen
const DEDUPE_MS = 5000; // ignore the same code re-scanned within this window
const STATS_POLL_MS = 10000;

const resultStyles = {
  checked_in: { wrap: 'bg-emerald-600', Icon: CheckCircleIcon, label: 'Checked in' },
  duplicate: { wrap: 'bg-amber-500', Icon: AlertIcon, label: 'Already used' },
  wrong_event: { wrap: 'bg-amber-600', Icon: AlertIcon, label: 'Wrong event' },
  cancelled: { wrap: 'bg-red-600', Icon: XIcon, label: 'Cancelled' },
  invalid: { wrap: 'bg-red-600', Icon: XIcon, label: 'Invalid ticket' },
  error: { wrap: 'bg-slate-700', Icon: AlertIcon, label: 'Error' },
};

export default function Scanner() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [totals, setTotals] = useState(null);
  const [camera, setCamera] = useState('idle'); // idle | starting | running | error
  const [cameraError, setCameraError] = useState(null);
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const [checking, setChecking] = useState(false);

  const scannerRef = useRef(null);
  const lastScan = useRef({ code: null, at: 0 });
  const inFlight = useRef(false);
  const resultTimer = useRef(null);
  const inputRef = useRef(null);

  // Live totals for the header
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api.events
        .stats(id)
        .then((data) => {
          if (cancelled) return;
          setEvent(data.event);
          setTotals(data.totals);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, STATS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  const showResult = useCallback((next) => {
    clearTimeout(resultTimer.current);
    setResult(next);
    resultTimer.current = setTimeout(() => setResult(null), RESULT_TTL_MS);
  }, []);

  const submitCode = useCallback(
    async (raw, { force = false } = {}) => {
      const code = normalizeTicketCode(raw);
      const key = code || raw.trim();
      const now = Date.now();
      // The camera reports the same QR many times per second; ignore repeats
      // unless the organizer deliberately typed the code and pressed the button.
      if (!force && lastScan.current.code === key && now - lastScan.current.at < DEDUPE_MS) return;
      if (inFlight.current) return; // one check at a time
      lastScan.current = { code: key, at: now };

      // Not an EventPass ticket (poster QR, payment QR...): answer locally, no API call.
      if (!code) {
        feedback('error');
        showResult({ result: 'invalid', message: 'That QR code is not an EventPass ticket.' });
        return;
      }

      inFlight.current = true;
      setChecking(true);
      try {
        const data = await api.events.checkin(id, raw);
        feedback('success');
        setSessionCount((n) => n + 1);
        setTotals((t) => (t ? { ...t, checkedIn: t.checkedIn + 1, pending: Math.max(0, t.pending - 1) } : t));
        showResult({ result: 'checked_in', ...data });
      } catch (err) {
        feedback('error');
        const result = err.body?.result || 'error';
        showResult({ result, message: err.message, attendee: err.body?.attendee });
      } finally {
        inFlight.current = false;
        setChecking(false);
      }
    },
    [id, showResult],
  );

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        /* already stopped */
      }
    }
    setCamera('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setCamera('starting');
    setCameraError(null);
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (w, h) => {
            const size = Math.floor(Math.min(w, h) * 0.75);
            return { width: size, height: size };
          },
        },
        (decodedText) => submitCode(decodedText),
        () => {}, // per-frame "no QR found" noise
      );
      setCamera('running');
    } catch (err) {
      scannerRef.current = null;
      setCamera('error');
      setCameraError(
        typeof err === 'string'
          ? err
          : err?.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access in your browser settings, or type codes below.'
            : err?.message || 'Could not start the camera on this device.',
      );
    }
  }, [submitCode]);

  // Stop the camera when leaving the page
  useEffect(() => () => {
    stopCamera();
    clearTimeout(resultTimer.current);
  }, [stopCamera]);

  const handleManual = (e) => {
    e.preventDefault();
    if (!manual.trim()) return;
    submitCode(manual, { force: true });
    setManual('');
    inputRef.current?.focus();
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        back={{ to: `/organizer/events/${id}`, label: 'Dashboard' }}
        title="Scan tickets"
        subtitle={event ? event.title : 'Loading…'}
      />

      {totals && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <Counter label="Checked in" value={totals.checkedIn} tone="text-emerald-700" />
          <Counter label="Registered" value={totals.registrations} tone="text-slate-800" />
          <Counter label="This session" value={sessionCount} tone="text-indigo-700" />
        </div>
      )}

      {/* Result banner */}
      <div className="mb-4 min-h-28" aria-live="assertive">
        {result ? (
          <ResultBanner result={result} />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 text-sm text-slate-500">
            {checking ? 'Checking ticket…' : 'Point the camera at a ticket QR code'}
          </div>
        )}
      </div>

      {/* Camera */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <div id="qr-reader" className={cx('aspect-square w-full', camera !== 'running' && 'hidden')} />
        {camera !== 'running' && (
          <div className="flex aspect-square flex-col items-center justify-center gap-4 p-6 text-center text-slate-300">
            <CameraIcon className="h-10 w-10" />
            {camera === 'error' ? (
              <p className="text-sm text-red-300">{cameraError}</p>
            ) : (
              <p className="text-sm">Use the rear camera to scan QR tickets at the entrance.</p>
            )}
            <Button onClick={startCamera} loading={camera === 'starting'} size="lg">
              <CameraIcon className="h-5 w-5" /> {camera === 'error' ? 'Try again' : 'Start camera'}
            </Button>
          </div>
        )}
      </div>
      {camera === 'running' && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={stopCamera}>
            Stop camera
          </Button>
        </div>
      )}

      {/* Manual / hardware scanner entry */}
      <form onSubmit={handleManual} className="mt-6 rounded-2xl bg-white p-4 shadow-xs ring-1 ring-slate-200">
        <label htmlFor="manual-code" className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <KeyboardIcon className="h-4 w-4 text-slate-400" />
          Type a ticket code or use a USB/Bluetooth scanner
        </label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            ref={inputRef}
            value={manual}
            onChange={(e) => setManual(formatCodeInput(e.target.value))}
            placeholder="ABCDE-FGHJK"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono uppercase tracking-widest"
            maxLength={11}
          />
          <Button type="submit" disabled={!normalizeTicketCode(manual) || checking}>
            Check in
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">Hardware scanners type the code and press Enter automatically – keep this box focused.</p>
      </form>

      {!window.isSecureContext && (
        <Alert tone="warning" className="mt-4">
          Camera access needs HTTPS (or localhost). Open the app over a secure URL to scan with the camera.
        </Alert>
      )}
    </div>
  );
}

function Counter({ label, value, tone }) {
  return (
    <div className="rounded-xl bg-white px-2 py-3 ring-1 ring-slate-200">
      <p className={cx('text-2xl font-bold tabular-nums', tone)}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function ResultBanner({ result }) {
  const style = resultStyles[result.result] || resultStyles.error;
  const { Icon } = style;
  return (
    <div className={cx('animate-rise flex items-center gap-4 rounded-2xl p-4 text-white shadow-lg', style.wrap)} role="status">
      <Icon className="h-10 w-10 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{style.label}</p>
        <p className="truncate text-xl font-bold">{result.attendee?.name || result.message}</p>
        {result.attendee && <p className="truncate text-sm text-white/90">{result.message}</p>}
        {result.attendee?.ticketCode && <p className="font-mono text-xs text-white/70">{result.attendee.ticketCode}</p>}
      </div>
    </div>
  );
}

/** Short beep + vibration so staff can keep their eyes on the queue. */
function feedback(kind) {
  try {
    navigator.vibrate?.(kind === 'success' ? 80 : [120, 60, 120]);
  } catch {
    /* unsupported */
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    feedback.ctx = feedback.ctx || new AudioCtx();
    const ctx = feedback.ctx;
    const tones = kind === 'success' ? [[880, 0, 0.12]] : [[220, 0, 0.15], [220, 0.2, 0.15]];
    for (const [freq, delay, duration] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    }
  } catch {
    /* audio blocked */
  }
}
