import { useCallback } from 'react';
import { ArrowRight, ClipboardList, MapPinned, School, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRemoteData } from '../hooks/useRemoteData';
import { getDashboardSummary, getDistricts, getOrganizationUsers } from '../lib/dataService';

export function AdminDashboardPage() {
  const load = useCallback(async () => {
    const [summary, users, districts] = await Promise.all([getDashboardSummary(), getOrganizationUsers(), getDistricts()]);
    return { summary, users, districts };
  }, []);
  const { data, isLoading, error, reload } = useRemoteData(load);

  if (isLoading) return <p role="status" className="py-8 text-center text-sm text-slate-500">Loading organization overview…</p>;
  if (error || !data) return <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">Organization data could not be loaded: {error ?? 'No data returned.'}<button onClick={reload} className="ml-2 underline">Retry</button></div>;

  const cards = [
    { title: 'Students screened', count: data.summary.studentCount, icon: Users },
    { title: 'Screening sessions', count: data.summary.sessionCount, icon: ClipboardList },
    { title: 'Districts', count: data.summary.districtCount, icon: MapPinned },
    { title: 'Organization users', count: data.users.length, icon: School },
  ];

  return <div className="space-y-6">
    <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-7">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">Organization administrator</p>
      <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Program overview</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-300">Manage district coverage, schools, role-based staff access, assignments, screening sessions, and audit history from this dedicated workspace.</p>
      <Link to="/users" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400">Invite staff <ArrowRight size={17} /></Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ title, count, icon: Icon }) => <div key={title} className="card"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold text-slate-900">{count.toLocaleString()}</p></div><div className="rounded-xl bg-cyan-50 p-3 text-cyan-700"><Icon size={19} /></div></div></div>)}
    </div>
    <section className="card">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="text-lg font-semibold">Staff directory</h3><p className="mt-1 text-sm text-slate-500">People provisioned in this organization.</p></div><Link to="/users" className="text-sm font-semibold text-cyan-700 hover:underline">Manage staff</Link></div>
      {data.users.length === 0 ? <p className="text-sm text-slate-500">No staff profiles are available.</p> : <div className="table-shell"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>District</th></tr></thead><tbody>{data.users.map((member) => <tr key={member.id}><td>{member.name}</td><td>{member.email}</td><td className="capitalize">{member.role === 'district_manager' ? 'District supervisor' : member.role.replace('_', ' ')}</td><td>{data.districts.find((district) => district.id === member.districtId)?.name ?? (member.districtId ? 'Assigned district' : 'Organization-wide')}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="grid gap-3 sm:grid-cols-2">
      {[['Set up districts and schools', '/districts', 'Configure geography and school records.'], ['Review assignments and audit history', '/assignments', 'Track field work and administrative changes.']].map(([label, href, description]) => <Link key={href} to={href} className="card flex items-center justify-between gap-3 hover:border-cyan-300"><div><h3 className="font-semibold">{label}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div><ArrowRight size={18} className="shrink-0 text-cyan-700" /></Link>)}
    </section>
  </div>;
}
