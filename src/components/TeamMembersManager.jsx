// src/components/TeamMembersManager.jsx
import React, { useEffect, useMemo, useState } from 'react';

const API_BASE = 'https://databankvanguard-b3d326c04ab4.herokuapp.com'; // change to your base

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

const emptyForm = {
  ve_code: '',
  name: '',
  role: 'data_collector',
  status: 'available',
  rotation_rank: 1,
};

const TeamMembersManager = () => {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/col/teammembers/`);
      if (!res.ok) throw new Error(`Team members failed: ${res.status}`);
      const json = await res.json();
      setMembers(json.data || json || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const filtered = useMemo(() => {
    const q = String(search || '').toLowerCase();
    return (Array.isArray(members) ? members : []).filter(m => {
      const rn = normalizeRole(m.role);
      return (
        (!q || (String(m.name || '').toLowerCase().includes(q) || String(m.ve_code || '').toLowerCase().includes(q))) &&
        (!roleFilter || rn === roleFilter) &&
        (!statusFilter || m.status === statusFilter)
      );
    });
  }, [members, search, roleFilter, statusFilter]);

  const onChangeForm = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const createMember = async () => {
    if (!form.name || !form.ve_code) {
      alert('Name and VE code are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/col/teammembers/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Create failed');
      setForm(emptyForm);
      await fetchMembers();
      alert('✅ Member created.');
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const saveRow = async (m) => {
    setSavingId(m.id);
    try {
      const res = await fetch(`${API_BASE}/col/teammembers/${m.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(m),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Update failed');
      await fetchMembers();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm('Delete this member?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/col/teammembers/${id}/`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Delete failed');
      }
      await fetchMembers();
    } catch (e) {
      alert(`❌ ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const EditableCell = ({ value, onChange, type = 'text', className = '' }) => (
    <input
      className={`border rounded px-2 py-1 text-sm w-full ${className}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      type={type}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Team Members</h2>
        <button onClick={fetchMembers} className="bg-gray-700 text-white text-sm px-3 py-1.5 rounded">Refresh</button>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-sm text-red-800 rounded">{error}</div>}

      {/* Create new member */}
      <div className="bg-white p-4 rounded-xl shadow border">
        <div className="text-sm font-semibold mb-2">Create Member</div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
          <EditableCell value={form.name} onChange={(v) => onChangeForm('name', v)} />
          <EditableCell value={form.ve_code} onChange={(v) => onChangeForm('ve_code', v)} />
          <select
            className="border rounded px-2 py-1 text-sm"
            value={form.role}
            onChange={(e) => onChangeForm('role', e.target.value)}
          >
            <option value="data_collector">Data Collector</option>
            <option value="supervisor">Supervisor</option>
            <option value="backchecker">Backchecker</option>
          </select>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={form.status}
            onChange={(e) => onChangeForm('status', e.target.value)}
          >
            <option value="available">Available</option>
            <option value="deployed">Deployed</option>
            <option value="inactive">Inactive</option>
          </select>
          <EditableCell type="number" value={form.rotation_rank} onChange={(v) => onChangeForm('rotation_rank', Number(v) || 1)} />
          <button
            onClick={createMember}
            disabled={creating}
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-500">Order: Name • VE Code • Role • Status • Rotation Rank</div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Search by name or VE"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border rounded px-3 py-2 text-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            <option value="data_collector">Data Collector</option>
            <option value="supervisor">Supervisor</option>
            <option value="backchecker">Backchecker</option>
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All status</option>
            <option value="available">Available</option>
            <option value="deployed">Deployed</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="text-sm text-gray-500 flex items-center">Showing {filtered.length} of {members.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white p-4 rounded-xl shadow border overflow-x-auto">
        {loading ? (
          <div className="text-gray-500">Loading team members…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                {['Name', 'VE Code', 'Role', 'Status', 'Rotation', 'Projects', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="px-3 py-2">
                    <EditableCell value={m.name} onChange={(v) => (m.name = v)} />
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell value={m.ve_code} onChange={(v) => (m.ve_code = v)} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={normalizeRole(m.role)}
                      onChange={(e) => (m.role = e.target.value)}
                    >
                      <option value="data_collector">Data Collector</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="backchecker">Backchecker</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={m.status}
                      onChange={(e) => (m.status = e.target.value)}
                    >
                      <option value="available">Available</option>
                      <option value="deployed">Deployed</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <EditableCell type="number" value={m.rotation_rank ?? 1} onChange={(v) => (m.rotation_rank = Number(v) || 1)} />
                  </td>
                  <td className="px-3 py-2">{m.projects_count ?? 0}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      onClick={() => saveRow(m)}
                      disabled={savingId === m.id}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
                    >
                      {savingId === m.id ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => deleteRow(m.id)}
                      disabled={deletingId === m.id}
                      className="bg-red-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
                    >
                      {deletingId === m.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">No matching members</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TeamMembersManager;
