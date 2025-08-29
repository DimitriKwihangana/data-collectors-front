import React, { useEffect, useState } from 'react';
import axios from 'axios';

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

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const avg = (arr) => {
  const xs = arr.map(Number).filter((n) => Number.isFinite(n));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
};

const Dashboard = () => {
  const [members, setMembers] = useState([]);
  const [activeProjectsMap, setActiveProjectsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch team + active projects
  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamResp = await axios.get(`${API_BASE}/col/teammembers/`);
        const teamData = teamResp.data?.data || teamResp.data || [];
        // Hard-normalize roles up front
        const normalized = (Array.isArray(teamData) ? teamData : []).map((m) => ({
          ...m,
          role: normalizeRole(m.role),
          projects_count: safeNum(m.projects_count),
          assigned_projects_count: safeNum(m.assigned_projects_count),
        }));
        setMembers(normalized);

        const projResp = await axios.get(`${API_BASE}/col/get-project/`);
        const ap = projResp.data?.active_projects || {};
        setActiveProjectsMap(ap);

        setLoading(false);
      } catch (e) {
        console.error('Error fetching data:', e);
        setError(e.message || 'Fetch failed');
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="bg-yellow-50 p-6 rounded-xl mb-8 border border-yellow-300 text-yellow-800">
        <h2 className="text-xl font-semibold">Loading...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-xl mb-8 border border-red-300 text-red-800">
        <h2 className="text-xl font-semibold">Error: {error}</h2>
      </div>
    );
  }

  // ----- Slices by role -----
  const DCs = members.filter((m) => m.role === 'data_collector');
  const SUPs = members.filter((m) => m.role === 'supervisor');
  const BCKs = members.filter((m) => m.role === 'backchecker');

  // Ready to assign (available) by role
  const readyDCs = DCs.filter((m) => m.status === 'available');
  const readySUPs = SUPs.filter((m) => m.status === 'available');
  const readyBCKs = BCKs.filter((m) => m.status === 'available');

  // Deployed by role
  const deployedDCs = DCs.filter((m) => m.status === 'deployed');
  const deployedSUPs = SUPs.filter((m) => m.status === 'deployed');
  const deployedBCKs = BCKs.filter((m) => m.status === 'deployed');

  // Global stats
  const totalMembers = members.length;
  const totalDeployed = members.filter((m) => m.status === 'deployed').length;
  const totalAvailable = totalMembers - totalDeployed;
  const utilizationPct = totalMembers ? Math.round((totalDeployed / totalMembers) * 100) : 0;
  const avgPerfOverall = avg(members.map((m) => m.performance_score)).toFixed(1);
  const avgPerfDC = avg(DCs.map((m) => m.performance_score));
  const avgPerfSUP = avg(SUPs.map((m) => m.performance_score));
  const avgPerfBCK = avg(BCKs.map((m) => m.performance_score));

  // Anomalies: "available" but still shows a current_project or assigned_projects_count > 0
  const anomalies = members.filter(
    (m) => m.status === 'available' && ((m.current_project && m.current_project !== null) || (m.assigned_projects_count > 0))
  );

  // ----- Active projects staffing needs & assignment aggregates -----
  let needed = { dc: 0, sup: 0, bck: 0 };
  let assigned = { dc: 0, sup: 0, bck: 0 };
  const activeProjectCount = Object.keys(activeProjectsMap).length;

  Object.values(activeProjectsMap).forEach((p) => {
    const info = p?.project_info || {};
    const status = (info.status || '').toLowerCase();

    if (status === 'active') {
      needed.dc += safeNum(info.collectors_needed);
      needed.sup += safeNum(info.supervisors_needed);
      // If you later store backcheckers_needed in API, add it here:
      needed.bck += safeNum(info.backcheckers_needed);

      assigned.dc += Array.isArray(p.data_collectors) ? p.data_collectors.length : 0;
      assigned.sup += Array.isArray(p.supervisors) ? p.supervisors.length : 0;
      assigned.bck += Array.isArray(p.backcheckers) ? p.backcheckers.length : 0;
    }
  });

  const gap = {
    dc: Math.max(0, needed.dc - assigned.dc),
    sup: Math.max(0, needed.sup - assigned.sup),
    bck: Math.max(0, needed.bck - assigned.bck),
  };

  // UI helpers (avoid dynamic Tailwind color classes)
  const StatCard = ({ label, value, bg = 'bg-white', border = 'border-t-4', borderColor = 'border-indigo-500' }) => (
    <div className={`${bg} rounded-xl p-6 shadow ${border} ${borderColor} text-center`}>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-sm font-medium text-gray-500 mt-1">{label}</div>
    </div>
  );

  const PeopleList = ({ title, people, badgeClass = 'bg-blue-50 text-blue-700' }) => {
    if (!people || people.length === 0) return null;
    return (
      <div className="bg-white p-4 rounded-xl border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{title} ({people.length})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {people.map((p, i) => (
            <div key={`${p.id || p.ve_code || p.name}-${i}`} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <div className="text-gray-800 text-sm">{p.name}</div>
              {p.ve_code && <span className={`text-xs px-2 py-0.5 rounded-full ${badgeClass}`}>{p.ve_code}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Topline stats */}
      <div className="bg-gray-100 p-6 rounded-xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Members" value={totalMembers} borderColor="border-gray-400" />
          <StatCard label="Data Collectors" value={DCs.length} borderColor="border-blue-500" />
          <StatCard label="Supervisors" value={SUPs.length} borderColor="border-green-500" />
          <StatCard label="Backcheckers" value={BCKs.length} borderColor="border-yellow-500" />
          <StatCard label="Deployed" value={totalDeployed} borderColor="border-red-500" />
          <StatCard label="Available (Bench)" value={totalAvailable} borderColor="border-purple-500" />
        </div>
      </div>

      {/* Role-level readiness */}
      <div className="bg-white p-6 rounded-xl border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Readiness by Role</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Ready DCs" value={readyDCs.length} borderColor="border-blue-500" />
          <StatCard label="Deployed DCs" value={deployedDCs.length} borderColor="border-blue-300" />
          <StatCard label="Ready SUPs" value={readySUPs.length} borderColor="border-green-500" />
          <StatCard label="Deployed SUPs" value={deployedSUPs.length} borderColor="border-green-300" />
          <StatCard label="Ready BCKs" value={readyBCKs.length} borderColor="border-yellow-500" />
          <StatCard label="Deployed BCKs" value={deployedBCKs.length} borderColor="border-yellow-300" />
        </div>
      </div>


      {/* Anomalies / sanity checks */}
      {anomalies.length > 0 && (
        <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
          <h3 className="text-lg font-semibold text-orange-800 mb-3">Sanity Check: Available but Still Assigned</h3>
          <p className="text-sm text-orange-700 mb-4">These members are marked <span className="font-semibold">available</span> but still show a current/assigned project. Consider recalculating their status.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {anomalies.map((m, i) => (
              <div key={`${m.id || m.ve_code || m.name}-${i}`} className="bg-white p-3 rounded-lg shadow-sm border border-orange-100">
                <div className="font-medium text-gray-800">{m.name}</div>
                <div className="text-xs text-gray-600">Current: {m.current_project || '—'} | Assigned Count: {m.assigned_projects_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty-state for no active projects */}
      {activeProjectCount === 0 && (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-600">No Active Projects</h3>
          <p className="text-sm text-gray-500 mt-1">Projects will appear here when team members are assigned</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
