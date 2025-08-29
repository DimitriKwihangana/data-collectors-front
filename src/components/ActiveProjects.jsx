// ActiveProjects.jsx
import React, { useEffect, useState } from 'react';
import ProjectDetailPage from './DetailProject';

const API_BASE = 'https://databankvanguard-b3d326c04ab4.herokuapp.com';

const ActiveProjectsManager = ({ onProjectUpdateTrigger }) => {
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingProject, setDeletingProject] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState(null);

  // detail page navigation
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [showDetailPage, setShowDetailPage] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [refreshKey]);

  useEffect(() => {
    if (onProjectUpdateTrigger) {
      onProjectUpdateTrigger(() => {
        setRefreshKey(prev => prev + 1);
      });
    }
  }, [onProjectUpdateTrigger]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [projectsResponse, teamMembersResponse] = await Promise.all([
        fetch(`${API_BASE}/col/get-project/`),
        fetch(`${API_BASE}/col/teammembers/`)
      ]);

      if (!projectsResponse.ok) {
        throw new Error(`Projects API failed: ${projectsResponse.status} ${projectsResponse.statusText}`);
      }
      if (!teamMembersResponse.ok) {
        throw new Error(`Team Members API failed: ${teamMembersResponse.status} ${teamMembersResponse.statusText}`);
      }

      const projectsData = await projectsResponse.json();
      const teamMembersData = await teamMembersResponse.json();

      setTeamMembers(teamMembersData.data || []);

      if (projectsData.active_projects) {
        const projectsArray = Object.entries(projectsData.active_projects).map(([projectName, projectData]) => {
          return processProjectData(projectName, projectData, teamMembersData.data || []);
        });

        const activeProjects = projectsArray.filter(project =>
          (project.status || '').toLowerCase() === 'active'
        );

        setProjects(activeProjects);
      } else {
        console.error("Unexpected response format - no active_projects found", projectsData);
        setProjects([]);
        setError("No projects data found in API response");
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setError(error.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeRole = (role) => {
    if (!role) return '';
    const r = String(role).trim().toLowerCase().replace(/[-\s]/g, '_');
    const map = {
      data_collector: 'data_collector',
      collector: 'data_collector',
      supervisor: 'supervisor',
      backchecker: 'backchecker',
      back_checker: 'backchecker'
    };
    return map[r] || r;
  };

  const processProjectData = (projectName, projectData, allTeamMembers) => {
    // Members from project payload
    const dataCollectorsFromProject = (projectData.data_collectors || []).map(m => ({
      ...m,
      role: 'data_collector',
      ve_code: m.ve_code || 'N/A'
    }));

    const supervisorsFromProject = (projectData.supervisors || []).map(m => ({
      ...m,
      role: 'supervisor',
      ve_code: m.ve_code || 'N/A'
    }));

    const backcheckersFromProject = (projectData.backcheckers || []).map(m => ({
      ...m,
      role: 'backchecker',
      ve_code: m.ve_code || 'N/A'
    }));

    // Additional via teamMembers API (assigned_projects contains keys)
    const assignedByRole = (roleKey) =>
      allTeamMembers
        .filter(member =>
          Array.isArray(member.assigned_projects) &&
          member.assigned_projects.includes(projectName) &&
          normalizeRole(member.role) === roleKey
        )
        .map(member => ({ ...member, role: roleKey }));

    const assignedDataCollectors = assignedByRole('data_collector');
    const assignedSupervisors = assignedByRole('supervisor');
    const assignedBackcheckers = assignedByRole('backchecker');

    // Deduplicate by name within each role
    const dedupeByName = (primary, extras) =>
      [
        ...primary,
        ...extras.filter(assigned =>
          !primary.some(existing => (existing.name || '').trim() === (assigned.name || '').trim())
        )
      ];

    const allDataCollectors = dedupeByName(dataCollectorsFromProject, assignedDataCollectors);
    const allSupervisors = dedupeByName(supervisorsFromProject, assignedSupervisors);
    const allBackcheckers = dedupeByName(backcheckersFromProject, assignedBackcheckers);

    const allMembers = [...allDataCollectors, ...allSupervisors, ...allBackcheckers];

    const info = projectData.project_info || {};

    return {
      id: projectName, // key is the ID used elsewhere
      name: info.name || projectName,
      scrumMaster: info.scrum_master || 'Not specified',
      startDate: info.start_date,
      endDate: info.end_date,
      durationDays: info.duration_days,
      status: info.status || 'Unknown',
      numCollectorsNeeded: info.collectors_needed || 0,
      numSupervisorsNeeded: info.supervisors_needed || 0,
      numBackcheckersNeeded: info.backcheckers_needed || 0, // optional if you add this field later
      totalCollectors: allDataCollectors.length,
      totalSupervisors: allSupervisors.length,
      totalBackcheckers: allBackcheckers.length,
      members: allMembers,
      memberCount: allMembers.length,
      dataCollectors: allDataCollectors,
      supervisors: allSupervisors,
      backcheckers: allBackcheckers
    };
  };

  const handleViewDetails = (projectId) => {
    setSelectedProjectId(projectId);
    setShowDetailPage(true);
  };

  const handleBackToProjects = () => {
    setShowDetailPage(false);
    setSelectedProjectId(null);
    setRefreshKey(prev => prev + 1);
  };

  // UPDATED: end a project with POST /col/end-project/
  const handleEndProject = async (projectId, projectName) => {
    const project = projects.find(p => p.id === projectId);
    const memberCount = project ? project.memberCount : 0;

    const confirmMessage =
      `⚠️ Are you sure you want to END project "${projectName}"?\n\n` +
      `📋 Project Details:\n` +
      `• Scrum Master: ${project?.scrumMaster || 'N/A'}\n` +
      `• Duration: ${project?.durationDays || 'N/A'} days\n` +
      `• Status: ${project?.status || 'N/A'}\n` +
      `• Team Members: ${memberCount}\n\n` +
      `🔄 This action will:\n` +
      `• Unassign all ${memberCount} team member${memberCount !== 1 ? 's' : ''}\n` +
      `• Set project status to "completed"\n\n` +
      `❌ This action CANNOT be undone!`;

    if (!window.confirm(confirmMessage)) return;

    setDeletingProject(projectId);

    try {
      const response = await fetch(`${API_BASE}/col/end-project/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_name: projectId })
      });

      if (response.ok) {
        const result = await response.json();

        // Remove from local active list (backend keeps the row but status != active)
        setProjects(prev => prev.filter(p => p.id !== projectId));

        const summary = result.summary || {};
        const madeAvailable = summary.made_available || 0;
        const stillDeployed = summary.still_deployed || 0;

        let successMessage = ` Project "${projectName}" has been successfully ended!\n\n`;
        successMessage += ` Summary:\n`;
        successMessage += `• ${summary.total_unassigned || 0} team members unassigned\n`;
        if (madeAvailable > 0) successMessage += `• ${madeAvailable} now available for new projects\n`;
        if (stillDeployed > 0) successMessage += `• ${stillDeployed} still deployed on other projects\n`;

        if (result.members_made_available && result.members_made_available.length > 0) {
          successMessage += `\n🟢 Available members:\n`;
          result.members_made_available.forEach(member => {
            successMessage += `• ${member.name} (${member.ve_code || 'No VE Code'})\n`;
          });
        }

        alert(successMessage);
        setRefreshKey(prev => prev + 1);
      } else {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || errorData.error || 'Unknown error';
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        alert(`❌ Failed to end project: ${errorMessage}`);
      }
    } catch (error) {
      alert(`❌ Network error occurred: ${error.message || 'Please check your connection and try again.'}`);
    } finally {
      setDeletingProject(null);
    }
  };

  const getMembersByRole = (members, role) =>
    members.filter(m => (m.role || '').toLowerCase() === role.toLowerCase());

  const formatDuration = (project) => {
    if (project.startDate && project.endDate) {
      return `${project.startDate} to ${project.endDate} (${project.durationDays} days)`;
    }
    return "Duration not specified";
  };

  const formatStatus = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800',
      'upcoming': 'bg-blue-100 text-blue-800',
      'completed': 'bg-gray-100 text-gray-800',
      'on-hold': 'bg-yellow-100 text-yellow-800',
      'planning': 'bg-purple-100 text-purple-800'
    };
    return colors[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getProjectTimingInfo = (project) => {
    if (project.startDate) {
      const startDate = new Date(project.startDate);
      const today = new Date();
      const diffTime = startDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return `Started ${Math.abs(diffDays)} days ago`;
      if (diffDays === 0) return "Started today";
      return `Starting in ${diffDays} days`;
    }
    return "Start date not set";
  };

  const getTotalAssignedMembers = () =>
    projects.reduce((total, p) => total + p.memberCount, 0);

  const getProjectsByStatus = () =>
    projects.reduce((acc, p) => {
      const s = (p.status || 'unknown').toLowerCase();
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});

  const staffedPercent = (project) => {
    const assigned = (project.totalCollectors || 0) + (project.totalSupervisors || 0) + (project.totalBackcheckers || 0);
    const needed = (project.numCollectorsNeeded || 0) + (project.numSupervisorsNeeded || 0) + (project.numBackcheckersNeeded || 0);
    if (!needed) return 0;
    return Math.min(100, Math.round((assigned / needed) * 100));
  };

  if (showDetailPage && selectedProjectId) {
    return (
      <ProjectDetailPage
        projectId={selectedProjectId}
        onBack={handleBackToProjects}
      />
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Active Projects</h2>
          <p className="text-sm text-gray-600 mt-1">
            {projects.length} active project{projects.length !== 1 ? 's' : ''} • {getTotalAssignedMembers()} team members assigned
          </p>
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {Object.entries(getProjectsByStatus()).map(([status, count]) => (
                <span
                  key={status}
                  className={`text-xs font-medium px-2 py-1 rounded capitalize ${formatStatus(status)}`}
                >
                  {status}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="bg-gray-500 text-white text-sm font-medium px-4 py-2 rounded hover:bg-gray-600 flex items-center gap-2"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? '👁️‍🗨️ Hide' : '👁️ Show'}
          </button>
          <button
            className="bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            onClick={() => setRefreshKey(prev => prev + 1)}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Loading...
              </>
            ) : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">❌ Error: {error}</p>
          <button
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="text-red-600 hover:text-red-800 text-sm underline mt-1"
          >
            Try again
          </button>
        </div>
      )}

      {isVisible && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-500">Loading active projects and team members...</span>
            </div>
          ) : projects.length === 0 && !error ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-2">🟢</div>
              <div className="text-lg font-medium text-gray-600 mb-2">No Active Projects Found</div>
              <div className="text-sm text-gray-500">There are currently no active projects in the system.</div>
            </div>
          ) : (
            <div className="space-y-6">
              {projects.map((project) => (
                <div key={project.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm border-l-4 border-l-green-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{project.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{getProjectTimingInfo(project)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${formatStatus(project.status)}`}>
                        {project.status}
                      </span>
                      {project.memberCount > 0 && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                          {project.memberCount} Team Members
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Scrum Master:</span>
                        <span className="text-sm text-gray-800">{project.scrumMaster}</span>
                      </div>

                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Duration:</span>
                        <span className="text-sm text-gray-800">{formatDuration(project)}</span>
                      </div>

                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Requirements:</span>
                        <span className="text-sm text-gray-800">
                          {project.numCollectorsNeeded} Collectors, {project.numSupervisorsNeeded} Supervisors{project.numBackcheckersNeeded ? `, ${project.numBackcheckersNeeded} Backcheckers` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Assigned:</span>
                        <span className="text-sm text-gray-800">
                          {project.totalCollectors} Data Collectors, {project.totalSupervisors} Supervisors{project.totalBackcheckers ? `, ${project.totalBackcheckers} Backcheckers` : ''}
                        </span>
                      </div>

                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Progress:</span>
                        <span className="text-sm text-gray-800">
                          {staffedPercent(project)}% staffed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Team Members Display */}
                  {project.members.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {getMembersByRole(project.members, 'supervisor').length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">Supervisors:</span>
                          <div className="flex flex-wrap gap-2">
                            {getMembersByRole(project.members, 'supervisor').map((m, i) => (
                              <span key={i} className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                {m.name}{m.ve_code ? <span className="ml-1 text-green-600">({m.ve_code})</span> : null}
                                {m.performance_score != null ? <span className="ml-1 text-green-600">- Score: {m.performance_score}</span> : null}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {getMembersByRole(project.members, 'backchecker').length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">Backcheckers:</span>
                          <div className="flex flex-wrap gap-2">
                            {getMembersByRole(project.members, 'backchecker').map((m, i) => (
                              <span key={i} className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded">
                                {m.name}{m.ve_code ? <span className="ml-1 text-yellow-700">({m.ve_code})</span> : null}
                                {m.performance_score != null ? <span className="ml-1 text-yellow-700">- Score: {m.performance_score}</span> : null}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {project.members.length === 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No team members assigned to this project yet.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors flex items-center gap-2"
                      onClick={() => handleViewDetails(project.id)}
                    >
                      📊 View Details & Rate Team
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      onClick={() => handleEndProject(project.id, project.name)}
                      disabled={deletingProject === project.id}
                    >
                      {deletingProject === project.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Ending...
                        </>
                      ) : '🛑 End Project'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!isVisible && (
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">👁️‍🗨️</div>
          <div className="text-gray-500">Active projects section is hidden</div>
          <div className="text-sm text-gray-400 mt-1">Click "Show" to view active projects</div>
        </div>
      )}
    </div>
  );
};

export default ActiveProjectsManager;
