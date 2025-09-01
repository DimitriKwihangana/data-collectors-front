import React, { useEffect, useState } from 'react';

const ProjectDetailPage = ({ projectId, onBack }) => {
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingRatings, setSubmittingRatings] = useState({});
  const [theid, setTheId] = useState(null);
  const [activeTab, setActiveTab] = useState('to-rate'); // 'to-rate' | 'rated'
  const [ratedMembers, setRatedMembers] = useState([]);
  const [unratedMembers, setUnratedMembers] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [allRatings, setAllRatings] = useState([]);

  // ---- role helpers ----
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

  const labelForRole = (r) =>
    r === 'data_collector' ? 'Data Collector' : r === 'supervisor' ? 'Supervisor' : r === 'backchecker' ? 'Backchecker' : r;

  useEffect(() => {
    if (projectId) fetchProjectDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (teamMembers.length > 0 && theid) {
      fetchRatingsAndSeparateMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamMembers, theid, activeTab]);

  const fetchProjectDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectsResponse, teamMembersResponse] = await Promise.all([
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/get-project/'),
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/teammembers/')
      ]);

      if (!projectsResponse.ok || !teamMembersResponse.ok) {
        throw new Error('Failed to fetch project data');
      }

      const projectsData = await projectsResponse.json();
      const teamMembersData = await teamMembersResponse.json();
      const allTeamMembersData = teamMembersData.data || [];

      setAllTeamMembers(allTeamMembersData);

      if (projectsData.active_projects && projectsData.active_projects[projectId]) {
        const projectData = projectsData.active_projects[projectId];
        setTheId(projectData.project_info.id);

        const processed = processProjectData(projectId, projectData, allTeamMembersData);
        setProject(processed);
        setTeamMembers(processed.members);
      } else {
        throw new Error('Project not found');
      }
    } catch (err) {
      console.error('Failed to fetch project details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const processProjectData = (projectName, projectData, allTeam) => {
    // Map for quick augmentation by name
    const byName = new Map();
    (allTeam || []).forEach((m) => byName.set((m.name || '').trim(), m));

    const augment = (member, role) => {
      const full = byName.get((member.name || '').trim());
      return {
        ...full,             // bring in numeric id, etc.
        ...member,           // keep fields from project payload
        role,                // normalized role
        ve_code: member.ve_code || full?.ve_code || 'N/A',
        name: member.name || full?.name || 'Unknown'
      };
    };

    // From project payload
    const dcsFromProject = (projectData.data_collectors || []).map((m) => augment(m, 'data_collector'));
    const supsFromProject = (projectData.supervisors || []).map((m) => augment(m, 'supervisor'));
    const backsFromProject = (projectData.backcheckers || []).map((m) => augment(m, 'backchecker'));

    // From team API (assigned_projects includes this project)
    const assignedByRole = (roleKey) =>
      (allTeam || [])
        .filter((m) =>
          Array.isArray(m.assigned_projects) &&
          m.assigned_projects.includes(projectName) &&
          normalizeRole(m.role) === roleKey
        )
        .map((m) => ({ ...m, role: roleKey }));

    const dcsAssigned = assignedByRole('data_collector');
    const supsAssigned = assignedByRole('supervisor');
    const backsAssigned = assignedByRole('backchecker');

    // Deduplicate within each role by name
    const dedupe = (primary, extras) => [
      ...primary,
      ...extras.filter(
        (x) => !primary.some((y) => (y.name || '').trim() === (x.name || '').trim())
      )
    ];

    const allDCs = dedupe(dcsFromProject, dcsAssigned);
    const allSUPs = dedupe(supsFromProject, supsAssigned);
    const allBACKs = dedupe(backsFromProject, backsAssigned);

    const info = projectData.project_info || {};
    const members = [...allDCs, ...allSUPs, ...allBACKs];

    return {
      id: projectName,
      name: info.name || projectName,
      scrumMaster: info.scrum_master || 'Not specified',
      startDate: info.start_date,
      endDate: info.end_date,
      durationDays: info.duration_days,
      status: info.status || 'Unknown',
      numCollectorsNeeded: info.collectors_needed || 0,
      numSupervisorsNeeded: info.supervisors_needed || 0,
      numBackcheckersNeeded: info.backcheckers_needed || 0, // present if you added this field
      totalCollectors: allDCs.length,
      totalSupervisors: allSUPs.length,
      totalBackcheckers: allBACKs.length,
      members,
      memberCount: members.length,
      dataCollectors: allDCs,
      supervisors: allSUPs,
      backcheckers: allBACKs
    };
  };

  const fetchRatingsAndSeparateMembers = async () => {
    if (!theid) return;
    setTabLoading(true);
    try {
      const res = await fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/rating/');
      if (res.ok) {
        const arr = await res.json(); // expecting an array
        setAllRatings(arr);

        const projectRatings = arr.filter((r) => r.project === theid);
        const ratedIds = new Set(projectRatings.map((r) => r.team_member));

        const unrated = teamMembers.filter((m) => !ratedIds.has(m.id));
        const rated = projectRatings.map((r) => {
          const tm = allTeamMembers.find((m) => m.id === r.team_member);
          return { ...r, memberDetails: tm || { name: 'Unknown Member', id: r.team_member } };
        });

        setUnratedMembers(unrated);
        setRatedMembers(rated);

        const map = {};
        projectRatings.forEach((r) => {
          map[r.team_member] = { rating: r.rating, feedback: r.feedback || '' };
        });
        setRatings(map);
      }
    } catch (e) {
      console.error('Failed to fetch ratings:', e);
    } finally {
      setTabLoading(false);
    }
  };

  const handleRatingChange = (memberId, field, value) => {
    setRatings((prev) => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value
      }
    }));
  };

  const submitRating = async (member) => {
    const memberId = member.id; // numeric id only
    const ratingData = ratings[memberId];

    if (!theid) {
      alert('Project ID is not yet ready. Please wait a moment.');
      return;
    }
    if (!ratingData || (!ratingData.rating && !ratingData.feedback)) {
      alert('Please provide a rating or feedback before submitting.');
      return;
    }
    if (ratingData.rating && ratingData.rating > 12) {
      alert('Rating cannot be more than 12.');
      return;
    }

    const body = {
      team_member: memberId,
      project: theid,
      rating: ratingData.rating || null,
      feedback: ratingData.feedback || ''
    };

    setSubmittingRatings((p) => ({ ...p, [memberId]: true }));
    try {
      const response = await fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/rating/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        alert(`✅ Rating submitted successfully for ${member.name}!`);
        await fetchRatingsAndSeparateMembers();
        setRatings((prev) => {
          const copy = { ...prev };
          delete copy[memberId];
          return copy;
        });
      } else {
        const err = await response.json();
        throw new Error(err.message || 'Failed to submit rating');
      }
    } catch (e) {
      console.error('Failed to submit rating:', e);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRatings((p) => ({ ...p, [memberId]: false }));
    }
  };

  const formatStatus = (status) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      upcoming: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      'on-hold': 'bg-yellow-100 text-yellow-800',
      planning: 'bg-purple-100 text-purple-800'
    };
    return statusColors[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const staffedPercent = () => {
    if (!project) return 0;
    const assigned =
      (project.totalCollectors || 0) +
      (project.totalSupervisors || 0) +
      (project.totalBackcheckers || 0);
    const needed =
      (project.numCollectorsNeeded || 0) +
      (project.numSupervisorsNeeded || 0) +
      (project.numBackcheckersNeeded || 0);
    if (!needed) return 0;
    return Math.min(100, Math.round((assigned / needed) * 100));
  };

  const renderUnratedMemberCard = (member, index) => {
    const memberId = member.id;
    const memberRating = ratings[memberId] || { rating: '', feedback: '' };
    const isSubmitting = submittingRatings[memberId];

    const roleColorDot =
      member.role === 'supervisor' ? 'bg-green-500'
        : member.role === 'backchecker' ? 'bg-yellow-500'
        : 'bg-blue-500';

    return (
      <div key={index} className="p-3 hover:bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="lg:w-1/3 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${roleColorDot}`}></div>
              <h4 className="font-medium text-gray-800 text-sm truncate">{member.name}</h4>
              <span className="text-xs text-gray-500">#{member.id}</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div className="flex gap-3">
                <span><strong>Role:</strong> {labelForRole(member.role)}</span>
                {member.ve_code && <span><strong>VE:</strong> {member.ve_code}</span>}
              </div>
              {(member.experience_level || member.status) && (
                <div className="flex gap-3">
                  {member.experience_level && <span><strong>Exp:</strong> {member.experience_level}</span>}
                  {member.status && <span><strong>Status:</strong> {member.status}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-2/3 flex flex-col sm:flex-row gap-3">
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 mb-1">Rating (1-12)</label>
              <input
                type="number"
                min="1"
                max="12"
                className="w-20 p-2 border border-gray-300 rounded text-xs"
                placeholder="1-12"
                value={memberRating.rating || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
                    handleRatingChange(memberId, 'rating', value ? parseInt(value) : '');
                  }
                }}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex-1 flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Feedback</label>
                <textarea
                  className="w-full p-2 border border-gray-300 rounded text-xs resize-none"
                  rows="2"
                  placeholder="Performance feedback..."
                  value={memberRating.feedback || ''}
                  onChange={(e) => handleRatingChange(memberId, 'feedback', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex-shrink-0 flex items-end">
                <button
                  onClick={() => submitRating(member)}
                  disabled={isSubmitting || (!memberRating.rating && !memberRating.feedback)}
                  className="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs h-fit"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  ) : '💾'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRatedMemberCard = (ratingData, index) => {
    const member = ratingData.memberDetails || {};
    const roleColorDot =
      normalizeRole(member.role) === 'supervisor' ? 'bg-green-500'
        : normalizeRole(member.role) === 'backchecker' ? 'bg-yellow-500'
        : 'bg-blue-500';

    return (
      <div key={index} className="p-3 hover:bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="lg:w-1/3 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${roleColorDot}`}></div>
              <h4 className="font-medium text-gray-800 text-sm truncate">{member.name}</h4>
              <span className="text-xs text-gray-500">#{member.id}</span>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">✓ Rated</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div className="flex gap-3">
                <span><strong>Role:</strong> {labelForRole(normalizeRole(member.role))}</span>
                {member.ve_code && <span><strong>VE:</strong> {member.ve_code}</span>}
              </div>
              {(member.experience_level || member.status) && (
                <div className="flex gap-3">
                  {member.experience_level && <span><strong>Exp:</strong> {member.experience_level}</span>}
                  {member.status && <span><strong>Status:</strong> {member.status}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="lg:w-2/3 flex flex-col sm:flex-row gap-3">
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 mb-1">Rating</label>
              <div className="w-20 p-2 bg-gray-100 border border-gray-300 rounded text-xs text-center font-medium">
                {ratingData.rating || 'N/A'}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Feedback</label>
              <div className="w-full p-2 bg-gray-100 border border-gray-300 rounded text-xs min-h-[2.5rem] overflow-auto">
                {ratingData.feedback || 'No feedback provided'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-500">Loading project details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-2">❌</div>
          <div className="text-lg font-medium text-gray-600 mb-2">Error Loading Project</div>
          <div className="text-sm text-gray-500 mb-4">{error}</div>
          <button onClick={onBack} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="bg-white p-6 rounded-xl shadow">
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">📂</div>
          <div className="text-lg font-medium text-gray-600 mb-2">Project Not Found</div>
          <div className="text-sm text-gray-500 mb-4">The requested project could not be found.</div>
          <button onClick={onBack} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const totalNeeded =
    (project.numCollectorsNeeded || 0) +
    (project.numSupervisorsNeeded || 0) +
    (project.numBackcheckersNeeded || 0);

  return (
    <div className="bg-white p-4 rounded-xl shadow max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">📊 {project.name} - Rate Team</h1>
            <p className="text-xs text-gray-600">
              {project.memberCount} members • {project.durationDays} days
            </p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${formatStatus(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Project Info */}
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div><span className="font-medium">Scrum Master:</span> {project.scrumMaster}</div>
          <div><span className="font-medium">Progress:</span> {staffedPercent()}% staffed</div>
          <div><span className="font-medium">Data Collectors:</span> {project.totalCollectors}/{project.numCollectorsNeeded}</div>
          <div><span className="font-medium">Supervisors:</span> {project.totalSupervisors}/{project.numSupervisorsNeeded}</div>
          <div><span className="font-medium">Backcheckers:</span> {project.totalBackcheckers}/{project.numBackcheckersNeeded || 0}</div>
        </div>
        {totalNeeded > 0 && (
          <div className="mt-1 text-[11px] text-gray-600">
            Total assigned: {project.totalCollectors + project.totalSupervisors + project.totalBackcheckers} / {totalNeeded}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('to-rate')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'to-rate'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            To Rate ({unratedMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('rated')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'rated'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Rated ({ratedMembers.length})
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {tabLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-500 text-sm">Loading members...</span>
          </div>
        ) : (
          <>
            {activeTab === 'to-rate' && (
              <>
                <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <span>🎯 Members to Rate</span>
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                    {unratedMembers.length} remaining
                  </span>
                </h3>

                {unratedMembers.length === 0 ? (
                  <div className="text-center py-6 bg-green-50 rounded-lg border border-green-200">
                    <div className="text-green-600 text-lg mb-2">🎉</div>
                    <div className="text-green-800 text-sm font-medium">All team members have been rated!</div>
                    <div className="text-green-600 text-xs">Great job completing the evaluations.</div>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <div className="divide-y divide-gray-200">
                      {unratedMembers.map((member, index) => renderUnratedMemberCard(member, index))}
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === 'rated' && (
              <>
                <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                  <span>✅ Rated Members</span>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                    {ratedMembers.length} completed
                  </span>
                </h3>

                {ratedMembers.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-gray-400 text-lg mb-2">📝</div>
                    <div className="text-gray-600 text-sm">No members have been rated yet</div>
                    <div className="text-gray-500 text-xs">Start rating team members to see them here</div>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <div className="divide-y divide-gray-200">
                      {ratedMembers.map((ratingData, index) => renderRatedMemberCard(ratingData, index))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Summary */}
      {teamMembers.length > 0 && !tabLoading && (
        <div className="mt-4 bg-blue-50 p-3 rounded-lg">
          <div className="flex justify-between items-center text-xs text-blue-700">
            <span>
              Progress: {ratedMembers.length} / {teamMembers.length} rated (
              {teamMembers.length > 0 ? ((ratedMembers.length / teamMembers.length) * 100).toFixed(0) : 0}%)
            </span>
            <span>
              DC: {teamMembers.filter((m) => normalizeRole(m.role) === 'data_collector').length} |
              SUP: {teamMembers.filter((m) => normalizeRole(m.role) === 'supervisor').length} |
              BACK: {teamMembers.filter((m) => normalizeRole(m.role) === 'backchecker').length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;
