'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, FileUp, MapPin, Pencil, Plus, RotateCcw, Save, X } from 'lucide-react';
import { useAuth } from '@/src/auth/AuthProvider';
import { createGeoCountry, createGeoState, importGeoCsv, listGeoLocations, updateGeoCountry, updateGeoState } from '@/src/lib/api/platform-locations';
import type { GeoCatalog, GeoImportResult } from '@/src/lib/api/platform-locations';

const inputClass = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] disabled:opacity-55';
type EditTarget = { type: 'country' | 'state'; id: string } | null;

export default function LocationsPage() {
  const { accessToken } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<GeoCatalog>({ countries: [], states: [] });
  const [countryName, setCountryName] = useState('');
  const [stateName, setStateName] = useState('');
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listGeoLocations(true, accessToken);
      setCatalog(data);
      setSelectedCountryId((current) => data.countries.some((country) => country.id === current)
        ? current
        : data.countries.find((country) => country.isActive)?.id || data.countries[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the location catalog.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedCountry = catalog.countries.find((country) => country.id === selectedCountryId);
  const selectedStates = useMemo(() => catalog.states.filter((state) => state.countryId === selectedCountryId), [catalog.states, selectedCountryId]);
  const activeCountries = catalog.countries.filter((country) => country.isActive);

  const addCountry = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !countryName.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const country = await createGeoCountry(countryName.trim(), accessToken);
      setCountryName(''); setSelectedCountryId(country.id); setMessage('Country added.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add country.');
    } finally { setSaving(false); }
  };

  const addState = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !selectedCountryId || !stateName.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      await createGeoState(selectedCountryId, stateName.trim(), accessToken);
      setStateName(''); setMessage(`State added to ${selectedCountry?.name || 'country'}.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add state.');
    } finally { setSaving(false); }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken || !editTarget || !editName.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      if (editTarget.type === 'country') await updateGeoCountry(editTarget.id, { name: editName.trim() }, accessToken);
      else await updateGeoState(editTarget.id, { name: editName.trim() }, accessToken);
      setEditTarget(null); setEditName(''); setMessage('Location name updated.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not rename location.');
    } finally { setSaving(false); }
  };

  const toggleStatus = async (type: 'country' | 'state', id: string, isActive: boolean) => {
    if (!accessToken) return;
    setError(null); setMessage(null);
    try {
      if (type === 'country') await updateGeoCountry(id, { isActive: !isActive }, accessToken);
      else await updateGeoState(id, { isActive: !isActive }, accessToken);
      setMessage(isActive ? 'Location archived.' : 'Location reactivated.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update location status.');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accessToken) return;
    setImporting(true); setError(null); setMessage(null);
    try {
      const result: GeoImportResult = await importGeoCsv(file, accessToken);
      setMessage(`Import complete: ${result.countriesAdded} countries and ${result.statesAdded} states added; ${result.existingRowsSkipped} existing rows skipped.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import the CSV.');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob(['Country,State\r\nIndia,Maharashtra\r\nIndia,Gujarat\r\nCanada,\r\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'country-state-template.csv'; link.click();
    URL.revokeObjectURL(url);
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Platform data</p><h1 className="text-[26px] font-semibold">Countries &amp; states</h1><p className="mt-1 text-[13px] text-[var(--muted)]">Maintain the selectable location catalog used throughout the portal.</p></div>
      <div className="flex gap-2 text-[12px] text-[var(--muted)]"><span>{catalog.countries.filter((country) => country.isActive).length} active countries</span><span aria-hidden="true">·</span><span>{catalog.states.filter((state) => state.isActive).length} active states</span></div>
    </header>

    <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-semibold">Import CSV</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Use columns <span className="font-mono">Country,State</span>. Leave State blank for a country-only row.</p></div><button type="button" onClick={downloadTemplate} title="Download CSV template" aria-label="Download CSV template" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Download size={15} /></button></div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(event) => void handleImport(event)} className="hidden" />
        <button type="button" disabled={importing} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3.5 py-2.5 text-[12px] font-semibold hover:border-[var(--primary)] disabled:opacity-50"><FileUp size={15} />{importing ? 'Importing CSV...' : 'Choose CSV file'}</button>
      </div>
      <form onSubmit={addCountry} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[14px] font-semibold">Add a country</h2><p className="mt-1 text-[12px] text-[var(--muted)]">Enter one country manually, then add its states below.</p>
        <div className="mt-4 flex gap-2"><input value={countryName} onChange={(event) => setCountryName(event.target.value)} maxLength={150} required placeholder="Country name" className={inputClass} /><button disabled={saving || !countryName.trim()} title="Add country" aria-label="Add country" className="grid h-10 w-11 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50"><Plus size={16} /></button></div>
      </form>
    </section>

    {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-[12.5px] ${error ? 'border border-rose-500/20 bg-rose-500/5 text-rose-600' : 'border border-emerald-500/20 bg-emerald-500/5 text-emerald-700'}`}>{error || message}</p>}

    <section className="grid gap-5 lg:grid-cols-2">
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-[14px] font-semibold">Country catalog</h2><p className="mt-0.5 text-[11px] text-[var(--muted)]">Select a country to manage its states.</p></div><button type="button" onClick={() => void load()} disabled={loading} title="Refresh catalog" aria-label="Refresh catalog" className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] text-[var(--muted)]"><RotateCcw size={14} /></button></div>
        {loading ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">Loading catalog...</p> : catalog.countries.length === 0 ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">No countries yet. Add one manually or import a CSV.</p> : <div className="max-h-[520px] divide-y divide-[var(--border)] overflow-y-auto">{catalog.countries.map((country) => <div key={country.id} className={`flex items-center gap-3 px-4 py-3 ${selectedCountryId === country.id ? 'bg-[var(--primary)]/[0.06]' : ''}`}>
          <button type="button" onClick={() => setSelectedCountryId(country.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><MapPin size={15} className={country.isActive ? 'shrink-0 text-[var(--primary)]' : 'shrink-0 text-[var(--muted)]'} /><span className="min-w-0"><span className="block truncate text-[12.5px] font-medium">{country.name}</span><span className="block text-[10.5px] text-[var(--muted)]">{country.states.filter((state) => state.isActive).length} active states</span></span></button>
          {editTarget?.type === 'country' && editTarget.id === country.id ? <form onSubmit={saveEdit} className="flex w-40 gap-1"><input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className="min-w-0 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs" /><button title="Save name" aria-label="Save name" className="text-emerald-600"><Save size={14} /></button><button type="button" onClick={() => setEditTarget(null)} title="Cancel" aria-label="Cancel" className="text-[var(--muted)]"><X size={14} /></button></form> : <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => { setEditTarget({ type: 'country', id: country.id }); setEditName(country.name); }} title={`Rename ${country.name}`} aria-label={`Rename ${country.name}`} className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Pencil size={13} /></button><button type="button" onClick={() => void toggleStatus('country', country.id, country.isActive)} title={country.isActive ? 'Archive country' : 'Reactivate country'} aria-label={country.isActive ? 'Archive country' : 'Reactivate country'} className={`grid h-8 w-8 place-items-center rounded-md ${country.isActive ? 'text-rose-600 hover:bg-rose-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}`}>{country.isActive ? <X size={14} /> : <Check size={14} />}</button></div>}
        </div>)}</div>}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-5 py-4"><h2 className="text-[14px] font-semibold">State catalog</h2><div className="mt-3 flex flex-col gap-3 sm:flex-row"><select value={selectedCountryId} onChange={(event) => setSelectedCountryId(event.target.value)} className={inputClass}><option value="">Select country</option>{catalog.countries.map((country) => <option key={country.id} value={country.id}>{country.name}{country.isActive ? '' : ' (archived)'}</option>)}</select><form onSubmit={addState} className="flex gap-2"><input value={stateName} onChange={(event) => setStateName(event.target.value)} maxLength={150} required disabled={!activeCountries.some((country) => country.id === selectedCountryId)} placeholder="State name" className={inputClass} /><button disabled={saving || !stateName.trim() || !activeCountries.some((country) => country.id === selectedCountryId)} title="Add state" aria-label="Add state" className="grid h-10 w-11 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50"><Plus size={16} /></button></form></div></div>
        {!selectedCountry ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">Choose a country to view its states.</p> : selectedStates.length === 0 ? <p className="px-5 py-10 text-center text-[12px] text-[var(--muted)]">No states in {selectedCountry.name} yet.</p> : <div className="max-h-[520px] divide-y divide-[var(--border)] overflow-y-auto">{selectedStates.map((state) => <div key={state.id} className="flex items-center justify-between gap-3 px-4 py-3">
          {editTarget?.type === 'state' && editTarget.id === state.id ? <form onSubmit={saveEdit} className="flex min-w-0 flex-1 gap-2"><input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-xs" /><button title="Save name" aria-label="Save name" className="text-emerald-600"><Save size={14} /></button><button type="button" onClick={() => setEditTarget(null)} title="Cancel" aria-label="Cancel" className="text-[var(--muted)]"><X size={14} /></button></form> : <><span className={`min-w-0 truncate text-[12.5px] ${state.isActive ? '' : 'text-[var(--muted)]'}`}>{state.name}</span><div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => { setEditTarget({ type: 'state', id: state.id }); setEditName(state.name); }} title={`Rename ${state.name}`} aria-label={`Rename ${state.name}`} className="grid h-8 w-8 place-items-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-muted)]"><Pencil size={13} /></button><button type="button" onClick={() => void toggleStatus('state', state.id, state.isActive)} title={state.isActive ? 'Archive state' : 'Reactivate state'} aria-label={state.isActive ? 'Archive state' : 'Reactivate state'} className={`grid h-8 w-8 place-items-center rounded-md ${state.isActive ? 'text-rose-600 hover:bg-rose-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'}`}>{state.isActive ? <X size={14} /> : <Check size={14} />}</button></div></>}
        </div>)}</div>}
      </div>
    </section>
  </div>;
}