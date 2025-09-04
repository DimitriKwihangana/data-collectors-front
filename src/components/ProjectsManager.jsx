// src/components/ProjectsManager.jsx
import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://databankvanguard-b3d326c04ab4.herokuapp.com';

const normalizeRole = (role) => {
  if (!role) return '';
  const r = String(role).trim().toLowerCase().replace(/[-\s]/g, '_');
  const map = {
    data_collector: 'data_collector',
    collector: 'data_collector',
    supervisor: 'supervisor',
    backchecker: 'backchecker',
    back_checker: 'backchecker',
  };
  return map[r] || r;
};

const ProjectsManager = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [endingId, setEndingId] = useState(null);
  const [projectsActive, setProjectsActive] = useState({});
  const [projectsAll, setProjectsAll] = useState(null);
  const [error, setError] = useState(null);
  const [editTargets, setEditTargets] = useState({});
  const [bulkCounts, setBulkCounts] = useState({});

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Active only
      const activeRes = await fetch(`${API_BASE}/col/get-project/`);
      if (!activeRes.ok) throw new Error(`Active projects failed: ${activeRes.status}`);
      const activeJson = await activeRes.json();
      setProjectsActive(activeJson.active_projects || {});

      // All statuses
      const allRes = await fetch(`${API_BASE}/col/projects/`);
      if (allRes.ok) {
        const allJson = await allRes.json();
        setProjectsAll(allJson.projects || {});
      } else {
        setProjectsAll(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const listFromMap = (obj) =>
    Object.entries(obj || {}).map(([key, val]) => {
      const info = val?.project_info || {};
      const dc = (val?.data_collectors || []).map(m => ({...m, role: 'data_collector'}));
      const sup = (val?.supervisors || []).map(m => ({...m, role: 'supervisor'}));
      const bc  = (val?.backcheckers || []).map(m => ({...m, role: 'backchecker'}));
      const members = [...dc, ...sup, ...bc];
      const totals = {
        collectors: dc.length,
        supervisors: sup.length,
        backcheckers: bc.length,
      };
      return {
        id: info.name || key,
        key,
        name: info.name || key,
        status: info.status || 'unknown',
        scrum_master: info.scrum_master || '',
        start_date: info.start_date,
        end_date: info.end_date,
        duration_days: info.duration_days,
        need_collectors: info.collectors_needed || 0,
        need_supervisors: info.supervisors_needed || 0,
        need_backcheckers: info.backcheckers_needed || 0,
        totals,
        members,
      };
    });

  const activeProjects = useMemo(() => {
    const arr = listFromMap(projectsActive);
    return arr.filter(p => (p.status || '').toLowerCase() === 'active');
  }, [projectsActive]);

  const completedProjects = useMemo(() => {
    if (!projectsAll) return [];
    const arr = listFromMap(projectsAll);
    return arr.filter(p => (p.status || '').toLowerCase() === 'completed');
  }, [projectsAll]);

  const staffedPercent = (p) => {
    const assigned = (p.totals.collectors || 0) + (p.totals.supervisors || 0) + (p.totals.backcheckers || 0);
    const needed = (p.need_collectors || 0) + (p.need_supervisors || 0) + (p.need_backcheckers || 0);
    if (!needed) return 0;
    return Math.min(100, Math.round((assigned / needed) * 100));
  };

  const onTargetChange = (projectId, field, value) => {
    setEditTargets(prev => ({
      ...prev,
      [projectId]: { ...(prev[projectId] || {}), [field]: Math.max(0, Number(value) || 0) }
    }));
  };

  const onBulkChange = (projectId, field, value) => {
    setBulkCounts(prev => ({
      ...prev,
      [projectId]: { ...(prev[projectId] || {}), [field]: Math.max(0, Number(value) || 0) }
    }));
  };

  const saveTargets = async (project) => {
    const t = editTargets[project.id] || {};
    const body = {
      projectName: project.id,
      name: project.scrum_master || '(unchanged)',
      startDate: project.start_date || '2099-01-01',
      endDate: project.end_date || '2099-12-31',
      status: project.status || 'active',
      num_data_collectors: t.collectors ?? project.need_collectors,
      num_supervisors: t.supervisors ?? project.need_supervisors,
      num_backcheckers: t.backcheckers ?? project.need_backcheckers ?? 0,
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/col/assign-project/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to save targets');
      alert('✅ Project targets updated.');
      setEditTargets(prev => ({ ...prev, [project.id]: undefined }));
      fetchAll();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const bulkAssignByCounts = async (project) => {
    const b = bulkCounts[project.id] || {};
    const dc = b.collectors || 0;
    const sv = b.supervisors || 0;
    const bc = b.backcheckers || 0;
    if (dc + sv + bc === 0) {
      alert('Enter at least one count to assign.');
      return;
    }

    const body = {
      projectName: project.id,
      name: project.scrum_master || '(unchanged)',
      startDate: project.start_date || '2099-01-01',
      endDate: project.end_date || '2099-12-31',
      status: project.status || 'active',
      num_data_collectors: dc,
      num_supervisors: sv,
      num_backcheckers: bc,
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/col/assign-project/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Bulk assign failed');
      alert('✅ Bulk assignment complete.');
      setBulkCounts(prev => ({ ...prev, [project.id]: undefined }));
      fetchAll();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const endProject = async (project) => {
    if (!window.confirm(`End project "${project.name}"? This will unassign all members and set status to "completed".`)) return;
    setEndingId(project.id);
    try {
      const res = await fetch(`${API_BASE}/col/end-project/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: project.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'End project failed');
      alert('✅ Project ended.');
      fetchAll();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setEndingId(null);
    }
  };

  const downloadProjectExcel = async (projectName) => {
    try {
      const res = await fetch(`${API_BASE}/col/projects/export/?project_name=${encodeURIComponent(projectName)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const isXlsx = res.headers.get('Content-Type')?.includes('spreadsheet');
      a.href = url;
      a.download = `${projectName}_members.${isXlsx ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(`❌ ${e.message}`);
    }
  };

  const Section = ({ title, hint, children }) => (
    <div className="bg-white p-5 rounded-xl shadow border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
      </div>
      {children}
    </div>
  );

  const ProjectCard = ({ p }) => {
    const t = editTargets[p.id] || {};
    const b = bulkCounts[p.id] || {};
    return (
      <div className="border rounded-lg p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
          <div>
            <div className="text-base font-semibold text-gray-800">{p.name}</div>
            <div className="text-xs text-gray-500">
              {p.start_date || '—'} → {p.end_date || '—'} • {p.duration_days ?? '—'} days • SM: {p.scrum_master || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-gray-100">{p.status}</span>
            <span className="text-xs px-2 py-1 rounded bg-blue-100">{p.members.length} members</span>
            <span className="text-xs px-2 py-1 rounded bg-green-100">{staffedPercent(p)}% staffed</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm font-medium text-gray-700 mb-2">Targets</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Collectors</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  defaultValue={p.need_collectors}
                  onChange={(e) => onTargetChange(p.id, 'collectors', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Supervisors</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  defaultValue={p.need_supervisors}
                  onChange={(e) => onTargetChange(p.id, 'supervisors', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Backcheckers</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  defaultValue={p.need_backcheckers}
                  onChange={(e) => onTargetChange(p.id, 'backcheckers', e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => saveTargets(p)}
                disabled={saving}
                className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Targets'}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm font-medium text-gray-700 mb-2">Quick Assign</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Collectors</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={b.collectors || ''}
                  onChange={(e) => onBulkChange(p.id, 'collectors', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Supervisors</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={b.supervisors || ''}
                  onChange={(e) => onBulkChange(p.id, 'supervisors', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">+ Backcheckers</label>
                <input
                  type="number"
                  min="0"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={b.backcheckers || ''}
                  onChange={(e) => onBulkChange(p.id, 'backcheckers', e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => bulkAssignByCounts(p)}
                disabled={saving}
                className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
              >
                {saving ? 'Assigning…' : 'Assign by Counts'}
              </button>
              <button
                onClick={() => downloadProjectExcel(p.name)}
                className="bg-teal-600 text-white text-sm px-3 py-1.5 rounded hover:bg-teal-700"
              >
                ⬇️ Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Members snapshot */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-blue-50 rounded p-2">
            <div className="font-medium text-blue-800 mb-1">Data Collectors ({p.totals.collectors})</div>
            <div className="flex flex-wrap gap-1">
              {p.members.filter(m => normalizeRole(m.role) === 'data_collector').map((m, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border rounded">{m.name}</span>
              ))}
            </div>
          </div>
          <div className="bg-green-50 rounded p-2">
            <div className="font-medium text-green-800 mb-1">Supervisors ({p.totals.supervisors})</div>
            <div className="flex flex-wrap gap-1">
              {p.members.filter(m => normalizeRole(m.role) === 'supervisor').map((m, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border rounded">{m.name}</span>
              ))}
            </div>
          </div>
          <div className="bg-yellow-50 rounded p-2">
            <div className="font-medium text-yellow-800 mb-1">Backcheckers ({p.totals.backcheckers})</div>
            <div className="flex flex-wrap gap-1">
              {p.members.filter(m => normalizeRole(m.role) === 'backchecker').map((m, i) => (
                <span key={i} className="px-2 py-0.5 bg-white border rounded">{m.name}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => endProject(p)}
            disabled={endingId === p.id}
            className="bg-red-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {endingId === p.id ? 'Ending…' : 'End Project'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Projects Manager</h2>
        <button onClick={fetchAll} className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded">Refresh</button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-800 rounded">{error}</div>
      )}

      {loading ? (
        <div className="p-6 text-gray-500">Loading projects…</div>
      ) : (
        <>
          <div className="bg-white p-5 rounded-xl shadow border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Active Projects</h3>
            </div>
            {activeProjects.length === 0 ? (
              <div className="text-sm text-gray-500">No active projects.</div>
            ) : activeProjects.map((p) => <ProjectCard key={p.id} p={p} />)}
          </div>

          <div className="bg-white p-5 rounded-xl shadow border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-800">Completed Projects</h3>
              {!projectsAll && <div className="text-xs text-gray-500">Expose GET /col/projects/ to see completed.</div>}
            </div>
            {completedProjects.length === 0 ? (
              <div className="text-sm text-gray-500">No completed projects found.</div>
            ) : completedProjects.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.start_date || '—'} → {p.end_date || '—'} • {p.duration_days ?? '—'} days
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{p.status}</span>
                    <button
                      onClick={() => downloadProjectExcel(p.name)}
                      className="bg-teal-600 text-white text-xs px-3 py-1.5 rounded hover:bg-teal-700"
                    >
                      ⬇️ Export Excel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectsManager;
