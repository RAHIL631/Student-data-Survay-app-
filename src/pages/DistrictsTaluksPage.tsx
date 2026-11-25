import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDistricts, getTaluks } from '../lib/dataService';
import { useRemoteData } from '../hooks/useRemoteData';
import { createDistrict, createTaluk } from '../lib/dataService';

export function DistrictsTaluksPage() {
  const { user } = useAuth();
  const { data: districts, isLoading: districtsLoading, error: districtsError, reload: reloadDistricts } = useRemoteData(getDistricts);
  const { data: taluks, isLoading: taluksLoading, error: taluksError, reload: reloadTaluks } = useRemoteData(getTaluks);
  const [districtForm, setDistrictForm] = useState({ name: '', code: '' });
  const [talukForm, setTalukForm] = useState({ name: '', districtId: '' });
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const canManage = user?.role === 'organization_admin';

  const handleDistrictSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      await createDistrict({ organizationId: user.organizationId, ...districtForm });
      setDistrictForm({ name: '', code: '' });
      reloadDistricts();
    } catch (error) {
      console.error('Unable to create the district.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to create district.');
    } finally {
      setSaving(false);
    }
  };

  const handleTalukSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      await createTaluk({ organizationId: user.organizationId, ...talukForm });
      setTalukForm({ name: '', districtId: '' });
      reloadTaluks();
    } catch (error) {
      console.error('Unable to create the taluk.', error);
      setSaveError(error instanceof Error ? error.message : 'Unable to create taluk.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div><h2 className="text-2xl font-bold text-slate-900">Districts and Taluks</h2><p className="mt-1 text-sm text-slate-600">Karnataka&apos;s 31 districts are preloaded for each organization. Add local taluks here before creating schools in them.</p></div>
      {(districtsError || taluksError) && (
        <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          Organization locations could not be loaded: {districtsError ?? taluksError}
          <button onClick={() => { reloadDistricts(); reloadTaluks(); }} className="ml-2 underline">Retry</button>
        </div>
      )}
      {saveError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{saveError}</div>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Districts</h3>
          {canManage && <form onSubmit={(event) => void handleDistrictSubmit(event)} className="mb-4 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <input aria-label="District name" required placeholder="District name" value={districtForm.name} onChange={(event) => setDistrictForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            <input aria-label="District code" required placeholder="Code" value={districtForm.code} onChange={(event) => setDistrictForm((current) => ({ ...current, code: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            <button disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white disabled:opacity-50">Add</button>
          </form>}
          {districtsLoading ? <p role="status" className="text-sm text-slate-500">Loading districts…</p> : (districts?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No districts have been configured.</p> : (
            <div className="space-y-3">
              {(districts ?? []).map((district) => (
                <div key={district.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span>{district.name}</span><span className="text-sm text-slate-600">{district.code} · {district.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">Taluks</h3>
          {canManage && <form onSubmit={(event) => void handleTalukSubmit(event)} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <select aria-label="District for taluk" required value={talukForm.districtId} onChange={(event) => setTalukForm((current) => ({ ...current, districtId: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <option value="">Select district</option>{(districts ?? []).map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
            </select>
            <input aria-label="Taluk name" required placeholder="Taluk name" value={talukForm.name} onChange={(event) => setTalukForm((current) => ({ ...current, name: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" />
            <button disabled={saving || !districts?.length} className="rounded-xl bg-cyan-600 px-4 py-2 font-medium text-white disabled:opacity-50">Add</button>
          </form>}
          {taluksLoading ? <p role="status" className="text-sm text-slate-500">Loading taluks…</p> : (taluks?.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No taluks have been configured.</p> : (
            <div className="space-y-3">
              {(taluks ?? []).map((taluk) => (
                <div key={taluk.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                  <span>{taluk.name}</span>
                  <span className="text-sm text-slate-600">{districts?.find((district) => district.id === taluk.districtId)?.name ?? taluk.districtId} · {taluk.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
