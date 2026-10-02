'use client';

import { useEffect, useState } from 'react';
import { listGeoLocations } from '@/src/lib/api/platform-locations';
import type { GeoCatalog } from '@/src/lib/api/platform-locations';

type Props = {
  kind: 'country' | 'state';
  value: string;
  onChange: (value: string) => void;
  countryName?: string;
  placeholder?: string;
  disabled?: boolean;
  className: string;
};

export default function GeoSelect({ kind, value, onChange, countryName, placeholder, disabled = false, className }: Props) {
  const [catalog, setCatalog] = useState<GeoCatalog | null>(null);

  useEffect(() => {
    let current = true;
    listGeoLocations().then((locations) => {
      if (current) setCatalog(locations);
    }).catch(() => {
      if (current) setCatalog({ countries: [], states: [] });
    });
    return () => { current = false; };
  }, []);

  const options = kind === 'country'
    ? (catalog?.countries || []).map((country) => ({ value: country.name, label: country.name }))
    : (() => {
      const states = catalog?.states.filter((state) => !countryName || state.countryName.toLocaleLowerCase() === countryName.toLocaleLowerCase()) || [];
      const uniqueNames = new Set(states.map((state) => state.name.toLocaleLowerCase()));
      return states.map((state) => ({
        value: state.name,
        label: uniqueNames.has(state.name.toLocaleLowerCase()) && states.filter((item) => item.name.toLocaleLowerCase() === state.name.toLocaleLowerCase()).length > 1
          ? `${state.name} (${state.countryName})`
          : state.name,
      })).filter((option, index, list) => list.findIndex((item) => item.value.toLocaleLowerCase() === option.value.toLocaleLowerCase()) === index);
    })();
  const currentValueExists = options.some((option) => option.value.toLocaleLowerCase() === value.toLocaleLowerCase());

  return <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className={className}>
    <option value="">{placeholder || `Select ${kind}`}</option>
    {value && !currentValueExists && <option value={value}>{value}</option>}
    {options.map((option) => <option key={`${kind}-${option.value}`} value={option.value}>{option.label}</option>)}
  </select>;
}