import React, { useEffect, useState } from 'react';
import ProjectDetailPage  from './DetailProject'

const ActiveProjectsManager = ({ onProjectUpdateTrigger }) => {
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingProject, setDeletingProject] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [error, setError] = useState(null);
  
  // New state for detail page navigation
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
      // Fetch both projects and team members data simultaneously
      const [projectsResponse, teamMembersResponse] = await Promise.all([
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/get-project/'),
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/teammembers/')
      ]);

      // Check if responses are OK
      if (!projectsResponse.ok) {
        throw new Error(`Projects API failed: ${projectsResponse.status} ${projectsResponse.statusText}`);
      }
      if (!teamMembersResponse.ok) {
        throw new Error(`Team Members API failed: ${teamMembersResponse.status} ${teamMembersResponse.statusText}`);
      }

      const projectsData = await projectsResponse.json();
      const teamMembersData = await teamMembersResponse.json();
      

      
      // Set team members data
      setTeamMembers(teamMembersData.data || []);
      
      // Process projects data
      if (projectsData.active_projects) {
        const projectsArray = Object.entries(projectsData.active_projects).map(([projectName, projectData]) => {
          return processProjectData(projectName, projectData, teamMembersData.data || []);
        });

        // Filter to show ONLY active projects
        const activeProjects = projectsArray.filter(project => 
          project.status?.toLowerCase() === 'active'
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

  const processProjectData = (projectName, projectData, allTeamMembers) => {
    console.log(`Processing project: ${projectName}`, projectData);
    console.log('All team members:', allTeamMembers);

    // Get data collectors from project data first (these are the ones in data_collectors array)
    const dataCollectorsFromProject = (projectData.data_collectors || []).map(member => ({
      ...member,
      role: 'data_collector',
      // Map to standardized format
      ve_code: member.ve_code || 'N/A'
    }));

    // Get supervisors from project data (if supervisors array exists)
    const supervisorsFromProject = (projectData.supervisors || []).map(member => ({
      ...member,
      role: 'supervisor',
      ve_code: member.ve_code || 'N/A'
    }));

    // Get additional team members assigned to this project from team members API
    const assignedDataCollectors = allTeamMembers.filter(member => 
      member.assigned_projects && 
      member.assigned_projects.includes(projectName) &&
      member.role?.toLowerCase() === 'data_collector'
    ).map(member => ({
      ...member,
      role: 'data_collector'
    }));

    const assignedSupervisors = allTeamMembers.filter(member => 
      member.assigned_projects && 
      member.assigned_projects.includes(projectName) &&
      member.role?.toLowerCase() === 'supervisor'
    ).map(member => ({
      ...member,
      role: 'supervisor'
    }));

    // Combine data collectors, avoiding duplicates based on name
    const allDataCollectors = [
      ...dataCollectorsFromProject,
      ...assignedDataCollectors.filter(assigned => 
        !dataCollectorsFromProject.some(existing => 
          existing.name?.trim() === assigned.name?.trim()
        )
      )
    ];

    // Combine supervisors, avoiding duplicates based on name
    const allSupervisors = [
      ...supervisorsFromProject,
      ...assignedSupervisors.filter(assigned => 
        !supervisorsFromProject.some(existing => 
          existing.name?.trim() === assigned.name?.trim()
        )
      )
    ];

    // Combine all members
    const allMembers = [...allDataCollectors, ...allSupervisors];

    console.log(`Project ${projectName} - Data Collectors:`, allDataCollectors.length);
    console.log(`Project ${projectName} - Supervisors:`, allSupervisors.length);
    console.log(`Project ${projectName} - Total Members:`, allMembers.length);

    return {
      id: projectName,
      name: projectData.project_info.name,
      scrumMaster: projectData.project_info.scrum_master || 'Not specified',
      startDate: projectData.project_info.start_date,
      endDate: projectData.project_info.end_date,
      durationDays: projectData.project_info.duration_days,
      status: projectData.project_info.status || 'Unknown',
      numCollectorsNeeded: projectData.project_info.collectors_needed || 0,
      numSupervisorsNeeded: projectData.project_info.supervisors_needed || 0,
      totalCollectors: allDataCollectors.length,
      totalSupervisors: allSupervisors.length,
      members: allMembers,
      memberCount: allMembers.length,
      dataCollectors: allDataCollectors,
      supervisors: allSupervisors
    };
  };

  // Navigation functions
  const handleViewDetails = (projectId) => {
    setSelectedProjectId(projectId);
    setShowDetailPage(true);
  };

  const handleBackToProjects = () => {
    setShowDetailPage(false);
    setSelectedProjectId(null);
    // Refresh data when coming back to ensure any rating changes are reflected
    setRefreshKey(prev => prev + 1);
  };

  const handleEndProject = async (projectId, projectName) => {
    const project = projects.find(p => p.id === projectId);
    const memberCount = project ? project.memberCount : 0;
    
    // Enhanced confirmation dialog

    const confirmMessage = `⚠️ Are you sure you want to END project "${projectName}"?\n\n` +
      `📋 Project Details:\n` +
      `• Scrum Master: ${project?.scrumMaster || 'N/A'}\n` +
      `• Duration: ${project?.durationDays || 'N/A'} days\n` +
      `• Status: ${project?.status || 'N/A'}\n` +
      `• Team Members: ${memberCount}\n\n` +
      `🔄 This action will:\n` +
      `• Permanently delete the project\n` +
      `• Unassign all ${memberCount} team member${memberCount !== 1 ? 's' : ''}\n` +
      `• Update member statuses automatically\n\n` +
      `❌ This action CANNOT be undone!`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingProject(projectId);
    
    try {
      const response = await fetch(`https://databankvanguard-b3d326c04ab4.herokuapp.com/col/assign-project/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_name: projectId
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Remove the project from local state immediately
        setProjects(prev => prev.filter(p => p.id !== projectId));
        
        // Show success message
        const summary = result.summary || {};
        const madeAvailable = summary.made_available || 0;
        const stillDeployed = summary.still_deployed || 0;
        
        let successMessage = ` Project "${projectName}" has been successfully deleted!\n\n`;
        successMessage += ` Summary:\n`;
        successMessage += `• ${summary.total_unassigned || 0} team members unassigned\n`;
        
        if (madeAvailable > 0) {
          successMessage += `• ${madeAvailable} member${madeAvailable !== 1 ? 's' : ''} now available for new projects\n`;
        }
        
        if (stillDeployed > 0) {
          successMessage += `• ${stillDeployed} member${stillDeployed !== 1 ? 's' : ''} still deployed on other projects\n`;
        }
        
        if (result.members_made_available && result.members_made_available.length > 0) {
          successMessage += `\n🟢 Available members:\n`;
          result.members_made_available.forEach(member => {
            successMessage += `• ${member.name} (${member.ve_code || 'No VE Code'})\n`;
          });
        }
        
        alert(successMessage);
        
        // Refresh data to ensure consistency
        setRefreshKey(prev => prev + 1);
      } else {
        let errorMessage = 'Unknown error';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || errorData.error || 'Unknown error';
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error("Failed to delete project:", response.status, errorMessage);
        alert(`❌ Failed to end project: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Error ending project:", error);
      alert(`❌ Network error occurred: ${error.message || 'Please check your connection and try again.'}`);
    } finally {
      setDeletingProject(null);
    }
  };

  const getMembersByRole = (members, role) => {
    return members.filter(member => 
      member.role && member.role.toLowerCase() === role.toLowerCase()
    );
  };

  const formatDuration = (project) => {
    if (project.startDate && project.endDate) {
      return `${project.startDate} to ${project.endDate} (${project.durationDays} days)`;
    }
    return "Duration not specified";
  };

  const formatStatus = (status) => {
    const statusColors = {
      'active': 'bg-green-100 text-green-800',
      'upcoming': 'bg-blue-100 text-blue-800',
      'completed': 'bg-gray-100 text-gray-800',
      'on-hold': 'bg-yellow-100 text-yellow-800',
      'planning': 'bg-purple-100 text-purple-800'
    };
    
    return statusColors[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  const getProjectTimingInfo = (project) => {
    if (project.startDate) {
      const startDate = new Date(project.startDate);
      const today = new Date();
      const diffTime = startDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return `Started ${Math.abs(diffDays)} days ago`;
      } else if (diffDays === 0) {
        return "Started today";
      } else {
        return `Starting in ${diffDays} days`;
      }
    }
    return "Start date not set";
  };

  const getTotalAssignedMembers = () => {
    return projects.reduce((total, project) => total + project.memberCount, 0);
  };

  const getProjectsByStatus = () => {
    const statusGroups = projects.reduce((acc, project) => {
      const status = project.status?.toLowerCase() || 'unknown';
      if (!acc[status]) acc[status] = 0;
      acc[status]++;
      return acc;
    }, {});
    return statusGroups;
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
          {/* Hide/Show Button */}
          <button
            className="bg-gray-500 text-white text-sm font-medium px-4 py-2 rounded hover:bg-gray-600 flex items-center gap-2"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? (
              <>
                👁️‍🗨️ Hide
              </>
            ) : (
              <>
                👁️ Show
              </>
            )}
          </button>
          
          {/* Refresh Button */}
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
            ) : (
              <>
                🔄 Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            ❌ Error: {error}
          </p>
          <button 
            onClick={() => setRefreshKey(prev => prev + 1)}
            className="text-red-600 hover:text-red-800 text-sm underline mt-1"
          >
            Try again
          </button>
        </div>
      )}

      {/* Conditionally render content based on visibility */}
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
                <div key={project.id} className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm border-l-4 border-l-green-500`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {getProjectTimingInfo(project)}
                      </p>
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
                          {project.numCollectorsNeeded} Collectors, {project.numSupervisorsNeeded} Supervisors
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Assigned:</span>
                        <span className="text-sm text-gray-800">
                          {project.totalCollectors} Data Collectors, {project.totalSupervisors} Supervisors
                        </span>
                      </div>

                      <div className="flex">
                        <span className="text-sm font-medium text-gray-600 w-32">Progress:</span>
                        <span className="text-sm text-gray-800">
                          {((project.totalCollectors + project.totalSupervisors) / 
                            (project.numCollectorsNeeded + project.numSupervisorsNeeded) * 100).toFixed(0)}% staffed
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Team Members Display */}
                  {project.members.length > 0 && (
                    <div className="mb-4 space-y-3">
                      {/* {getMembersByRole(project.members, 'data_collector').length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">Data Collectors:</span>
                          <div className="flex flex-wrap gap-2">
                            {getMembersByRole(project.members, 'data_collector').map((collector, index) => (
                              <span key={index} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                {collector.name}
                                {collector.ve_code && (
                                  <span className="ml-1 text-blue-600">({collector.ve_code})</span>
                                )}
                                {collector.performance_score !== undefined && collector.performance_score !== null && (
                                  <span className="ml-1 text-blue-600">- Score: {collector.performance_score}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )} */}

                      {getMembersByRole(project.members, 'supervisor').length > 0 && (
                        <div className="flex flex-wrap items-start gap-2">
                          <span className="text-sm font-medium text-gray-600 w-32 flex-shrink-0">Supervisors:</span>
                          <div className="flex flex-wrap gap-2">
                            {getMembersByRole(project.members, 'supervisor').map((supervisor, index) => (
                              <span key={index} className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
                                {supervisor.name}
                                {supervisor.ve_code && (
                                  <span className="ml-1 text-green-600">({supervisor.ve_code})</span>
                                )}
                                {supervisor.performance_score !== undefined && supervisor.performance_score !== null && (
                                  <span className="ml-1 text-green-600">- Score: {supervisor.performance_score}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Team Member Statistics */}
                      {project.members.length > 0 && (
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Team Overview:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-medium">Experience Levels:</span>
                              <div className="ml-2">
                                {Object.entries(
                                  project.members.reduce((acc, member) => {
                                    const level = member.experience_level || 'Unknown';
                                    acc[level] = (acc[level] || 0) + 1;
                                    return acc;
                                  }, {})
                                ).map(([level, count]) => (
                                  <div key={level} className="text-gray-600">
                                    {level}: {count} member{count !== 1 ? 's' : ''}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Deployment Status:</span>
                              <div className="ml-2">
                                {Object.entries(
                                  project.members.reduce((acc, member) => {
                                    const status = member.status || 'Unknown';
                                    acc[status] = (acc[status] || 0) + 1;
                                    return acc;
                                  }, {})
                                ).map(([status, count]) => (
                                  <div key={status} className="text-gray-600">
                                    {status}: {count} member{count !== 1 ? 's' : ''}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No team members assigned warning */}
                  {project.members.length === 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        ⚠️ No team members assigned to this project yet.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
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
                      ) : (
                        <>
                          🛑 End Project
                        </>
                      )}
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