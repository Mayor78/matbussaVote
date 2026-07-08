import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function useCountdown(closesAt) {
  const [remaining, setRemaining] = useState(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!closesAt) {
      setRemaining(null);
      setExpired(false);
      return;
    }

    const update = () => {
      const diff = new Date(closesAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining(null);
        setExpired(true);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining({ hours: h, minutes: m, seconds: s, totalMs: diff });
      setExpired(false);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  return { remaining, expired };
}

export function CountdownTimer({ closesAt, className = '' }) {
  const { remaining, expired } = useCountdown(closesAt);

  if (!closesAt) return null;

  if (expired) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800 ${className}`}>
        <Clock className="w-3 h-3" />
        Expired
      </span>
    );
  }

  if (!remaining) return null;

  const { hours, minutes, seconds, totalMs } = remaining;
  const isUrgent = totalMs < 3600000;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${isUrgent ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-blue-100 text-blue-800'} ${className}`}>
      <Clock className="w-3 h-3" />
      {hours > 0 && `${hours}h `}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      {isUrgent && ' remaining'}
    </span>
  );
}

export function CountdownBanner({ closesAt, onExpired }) {
  const { remaining, expired } = useCountdown(closesAt);

  useEffect(() => {
    if (expired && onExpired) onExpired();
  }, [expired, onExpired]);

  if (!closesAt || expired) return null;

  if (!remaining) return null;

  const { hours, minutes, seconds } = remaining;

  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl p-4 text-center shadow-md">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Clock className="w-5 h-5" />
        <span className="font-semibold">Election closes in</span>
      </div>
      <div className="text-3xl sm:text-4xl font-bold tracking-wider">
        {hours > 0 && `${hours}h `}{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
    </div>
  );
}
