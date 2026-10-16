'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';

const formatDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

const parseDate = (value: string) => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
};

export default function DateInput({
  value,
  onChange,
  className,
  ariaLabel,
  max,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
  ariaLabel: string;
  max?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState(() => ({ sourceValue: value, displayValue: formatDate(value) }));
  const displayValue = draft.sourceValue === value ? draft.displayValue : formatDate(value);
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const parsed = parseDate(displayValue);
    textRef.current?.setCustomValidity(
      displayValue && !parsed
        ? 'Enter a valid date in DD/MM/YYYY format.'
        : parsed && max && parsed > max
          ? 'Date cannot be in the future.'
          : '',
    );
  }, [displayValue, max]);

  const updateDisplay = (nextValue: string) => {
    setDraft({ sourceValue: value, displayValue: nextValue });
    const parsed = parseDate(nextValue);
    if (!nextValue || !parsed) {
      textRef.current?.setCustomValidity(nextValue ? 'Enter a valid date in DD/MM/YYYY format.' : '');
      if (!nextValue) onChange('');
      return;
    }
    if (max && parsed > max) {
      textRef.current?.setCustomValidity('Date cannot be in the future.');
      return;
    }
    textRef.current?.setCustomValidity('');
    onChange(parsed);
  };

  const selectDate = (nextValue: string) => {
    onChange(nextValue);
    setDraft({ sourceValue: nextValue, displayValue: formatDate(nextValue) });
    textRef.current?.setCustomValidity('');
  };

  return (
    <div className="relative">
      <input
        ref={textRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={displayValue}
        onChange={(event) => updateDisplay(event.target.value)}
        required={required}
        aria-label={ariaLabel}
        className={`${className} pr-10`}
      />
      <CalendarDays aria-hidden="true" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
      <input
        ref={pickerRef}
        type="date"
        value={value}
        max={max}
        onChange={(event) => selectDate(event.target.value)}
        aria-label={`Choose ${ariaLabel.toLowerCase()}`}
        title="Choose date"
        tabIndex={-1}
        className="absolute right-0 top-0 h-full w-10 cursor-pointer opacity-0"
      />
    </div>
  );
}
