import React, { useState, useEffect } from 'react';

const API_BASE = 'https://databankvanguard-b3d326c04ab4.herokuapp.com';

const CollectorTable = ({ collectors, refresh, currentProject = null }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeProjects, setActiveProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // local fallback when parent does not pass currentProject
  const [localProject, setLocalProject] = useState('');
  const selectedProject = currentProject || localProject;

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

  // load active projects (names) once
  useEffect(() => {
    const loadActive = async () => {
      try {
        setProjectsLoading(true);
        const res = await fetch(`${API_BASE}/col/get-project/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const names = [];
        const ap = data?.active_projects || {};
        for (const [key, obj] of Object.entries(ap)) {
          const info = obj?.project_info || {};
          if ((info.status || '').toLowerCase() === 'active') {
            names.push(info.name || key);
          }
        }
        setActiveProjects(names);
        // pick first project locally if parent didn't provide one
        if (!currentProject && names.length > 0) {
          setLocalProject(names[0]);
        }
      } catch (e) {
        console.error('Active projects load failed:', e);
        setActiveProjects([]);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadActive();
  }, [currentProject]);

  const explainWhyCannotAssign = (member) => {
    if (!selectedProject) return 'Select a project first.';
    if (member.status !== 'available') return 'Member is not available to assign.';
    return null;
  };

  const explainWhyCannotUnassign = (member) => {
    if (!selectedProject) return 'Select a project first.';
    if (!Array.isArray(member.assigned_projects) || !member.assigned_projects.includes(selectedProject)) {
      return `Not assigned to "${selectedProject}".`;
    }
    return null;
  };

  const handleAssign = async (member) => {
    const reason = explainWhyCannotAssign(member);
    if (reason) {
      alert(`❗ ${reason}`);
      return;
    }
    if (!window.confirm(`Assign ${member.name} to "${selectedProject}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/col/assign-member/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: selectedProject,
          member_id: member.id,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Assign failed');
      alert(`✅ ${payload.message}`);
      refresh?.();
    } catch (e) {
      console.error(e);
      alert(`❌ ${e.message}`);
    }
  };

  const handleUnassign = async (member) => {
    const reason = explainWhyCannotUnassign(member);
    if (reason) {
      alert(`❗ ${reason}`);
      return;
    }
    if (!window.confirm(`Unassign ${member.name} from "${selectedProject}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/col/unassign-member/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: selectedProject,
          member_id: member.id,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.message || 'Unassign failed');
      alert(`✅ ${payload.message}`);
      refresh?.();
    } catch (e) {
      console.error(e);
      alert(`❌ ${e.message}`);
    }
  };

  const getFilteredCollectors = () => {
    const arr = Array.isArray(collectors) ? collectors : (collectors?.data || []);
    const inc = (v, q) => (String(v || '').toLowerCase().includes(String(q || '').toLowerCase()));

    return arr.filter((c) => {
      const normalizedRole = normalizeRole(c.role);
      return (
        (inc(c.name, searchTerm) || inc(c.ve_code, searchTerm)) &&
        (statusFilter === '' || c.status === statusFilter) &&
        (roleFilter === '' || normalizedRole === roleFilter)
      );
    });
  };

  const formatAssignedProjects = (projects) => {
    if (projectsLoading) return <span className="text-gray-400 italic">Loading...</span>;
    if (!Array.isArray(projects) || projects.length === 0) return <span className="text-gray-400 italic">None</span>;
    const activeOnly = projects.filter(p => activeProjects.includes(p));
    if (activeOnly.length === 0) return <span className="text-gray-400 italic">No active projects</span>;
    return (
      <div className="space-y-1">
        {activeOnly.map((p, i) => (
          <span key={i} className="inline-block bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full mr-1 mb-1">
            {p}
          </span>
        ))}
      </div>
    );
  };

  const filtered = getFilteredCollectors();

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Team Members</h2>

        {/* Local project selector (only shows if parent didn't pass one) */}
        {!currentProject && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Project:</label>
            <select
              className="border rounded px-3 py-2"
              value={selectedProject}
              onChange={(e) => setLocalProject(e.target.value)}
            >
              {projectsLoading && <option>Loading...</option>}
              {!projectsLoading && activeProjects.length === 0 && <option value="">No active projects</option>}
              {!projectsLoading && activeProjects.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4 w-full">
        <input
          type="text"
          placeholder="Search by name or code"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded px-3 py-2 w-60"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="deployed">Deployed</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Roles</option>
          <option value="data_collector">Data Collector</option>
          <option value="supervisor">Supervisor</option>
          <option value="backchecker">Backchecker</option>
        </select>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-800 text-white sticky top-0">
            <tr>
              {[
                'VE Code', 'Name', 'Role', 'Projects Count',
                'Performance Score', 'Rotation Rank', 'Status',
                'Current Project', 'Assigned Projects', 'Actions',
              ].map((h) => (
                <th key={h} className="px-4 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const role = normalizeRole(m.role);
              const assignReason = explainWhyCannotAssign(m);
              const unassignReason = explainWhyCannotUnassign(m);

              return (
                <tr key={m.id} className="border-b">
                  <td className="px-4 py-2">{m.ve_code || '—'}</td>
                  <td className="px-4 py-2">{m.name}</td>
                  <td className="px-4 py-2 capitalize">{role.replace('_', ' ')}</td>
                  <td className="px-4 py-2">{m.projects_count}</td>
                  <td className="px-4 py-2">{m.performance_score ?? 'N/A'}</td>
                  <td className="px-4 py-2">{m.rotation_rank ?? 'N/A'}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${m.status === 'available' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={m.current_project ? 'text-gray-900' : 'text-gray-400'}>
                      {m.current_project || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-4 py-2">{formatAssignedProjects(m.assigned_projects)}</td>
                  <td className="px-4 py-2 space-x-2 whitespace-nowrap">
                    <button
                      className={`text-xs px-3 py-1 rounded font-semibold transition ${
                        assignReason
                          ? 'bg-gray-300 text-gray-500 cursor-help'
                          : 'bg-indigo-500 text-white hover:bg-indigo-600 cursor-pointer'
                      }`}
                      onClick={() => handleAssign(m)}
                      title={assignReason || 'Assign to selected project'}
                    >
                      Assign
                    </button>
                    <button
                      className={`text-xs px-3 py-1 rounded font-semibold transition ${
                        unassignReason
                          ? 'bg-gray-300 text-gray-500 cursor-help'
                          : 'bg-red-500 text-white hover:bg-red-600 cursor-pointer'
                      }`}
                      onClick={() => handleUnassign(m)}
                      title={unassignReason || 'Unassign from selected project'}
                    >
                      Unassign
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="10" className="px-4 py-4 text-center text-gray-500">
                  No team members match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectorTable;
