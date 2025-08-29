import React, { useEffect, useState } from 'react';

const ProjectDetailPage = ({ projectId, onBack }) => {
  const [project, setProject] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingRatings, setSubmittingRatings] = useState({});
  const [theid, settheId] = useState(null);
  const [activeTab, setActiveTab] = useState('to-rate'); // 'to-rate' or 'rated'
  const [ratedMembers, setRatedMembers] = useState([]);
  const [unratedMembers, setUnratedMembers] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [allRatings, setAllRatings] = useState([]);

  console.log(theid);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  useEffect(() => {
    if (teamMembers.length > 0 && theid) {
      fetchRatingsAndSeparateMembers();
    }
  }, [teamMembers, theid, activeTab]);

  const fetchProjectDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch project and team members data
      const [projectsResponse, teamMembersResponse] = await Promise.all([
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/get-project/'),
        fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/teammembers/')
      ]);

      if (!projectsResponse.ok || !teamMembersResponse.ok) {
        throw new Error('Failed to fetch project data');
      }

      const projectsData = await projectsResponse.json();
      const teamMembersData = await teamMembersResponse.json();

      // Store all team members for later reference
      setAllTeamMembers(teamMembersData.data || []);

      // Find the specific project
      if (projectsData.active_projects && projectsData.active_projects[projectId]) {
        const projectData = projectsData.active_projects[projectId];

        settheId(projectData.project_info.id);
        const allTeamMembersData = teamMembersData.data || [];

        // Process project data
        const processedProject = processProjectData(projectId, projectData, allTeamMembersData);
        setProject(processedProject);
        setTeamMembers(processedProject.members);
      } else {
        throw new Error('Project not found');
      }
    } catch (error) {
      console.error("Failed to fetch project details:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const processProjectData = (projectName, projectData, allTeamMembers) => {
    // Create a map of team members by name for easy lookup
    const teamMemberMap = new Map();
    allTeamMembers.forEach(member => {
      teamMemberMap.set(member.name?.trim(), member);
    });

    // Get data collectors from project data and match with full team member data
    const dataCollectorsFromProject = (projectData.data_collectors || []).map(member => {
      const fullMemberData = teamMemberMap.get(member.name?.trim());
      return {
        ...member,
        ...fullMemberData, // This will include the numeric ID
        role: 'data_collector',
        ve_code: member.ve_code || fullMemberData?.ve_code || 'N/A'
      };
    });

    // Get supervisors from project data and match with full team member data
    const supervisorsFromProject = (projectData.supervisors || []).map(member => {
      const fullMemberData = teamMemberMap.get(member.name?.trim());
      return {
        ...member,
        ...fullMemberData, // This will include the numeric ID
        role: 'supervisor',
        ve_code: member.ve_code || fullMemberData?.ve_code || 'N/A'
      };
    });

    // Get team members assigned to this project
    const assignedDataCollectors = allTeamMembers.filter(member => 
      member.assigned_projects && 
      member.assigned_projects.includes(projectName) &&
      member.role?.toLowerCase() === 'data_collector'
    );

    const assignedSupervisors = allTeamMembers.filter(member => 
      member.assigned_projects && 
      member.assigned_projects.includes(projectName) &&
      member.role?.toLowerCase() === 'supervisor'
    );

    // Combine all members, avoiding duplicates
    const allDataCollectors = [
      ...dataCollectorsFromProject,
      ...assignedDataCollectors.filter(assigned => 
        !dataCollectorsFromProject.some(existing => 
          existing.name?.trim() === assigned.name?.trim()
        )
      )
    ];

    const allSupervisors = [
      ...supervisorsFromProject,
      ...assignedSupervisors.filter(assigned => 
        !supervisorsFromProject.some(existing => 
          existing.name?.trim() === assigned.name?.trim()
        )
      )
    ];

    const allMembers = [...allDataCollectors, ...allSupervisors];

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

  const fetchRatingsAndSeparateMembers = async () => {
    if (!theid) return;
    
    setTabLoading(true);
    try {
      // Fetch all ratings
      const ratingsResponse = await fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/rating/');
      
      if (ratingsResponse.ok) {
        const allRatingsData = await ratingsResponse.json();
        setAllRatings(allRatingsData);
        
        // Filter ratings for this specific project
        const projectRatings = allRatingsData.filter(rating => rating.project === theid);
        
        // Create a set of team member IDs who have been rated for this project
        const ratedMemberIds = new Set(projectRatings.map(rating => rating.team_member));
        
        // Separate team members into rated and unrated based on their IDs
        const unrated = teamMembers.filter(member => !ratedMemberIds.has(member.id));
        const rated = projectRatings.map(rating => {
          // Find the team member details from allTeamMembers
          const teamMember = allTeamMembers.find(member => member.id === rating.team_member);
          return {
            ...rating,
            memberDetails: teamMember || { name: 'Unknown Member', id: rating.team_member }
          };
        });
        
        setUnratedMembers(unrated);
        setRatedMembers(rated);
        
        // Create ratings map for form handling
        const ratingsMap = {};
        projectRatings.forEach(rating => {
          ratingsMap[rating.team_member] = {
            rating: rating.rating,
            feedback: rating.feedback || ''
          };
        });
        setRatings(ratingsMap);
      }
    } catch (error) {
      console.error("Failed to fetch ratings:", error);
    } finally {
      setTabLoading(false);
    }
  };

  const handleRatingChange = (memberId, field, value) => {
    setRatings(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        [field]: value
      }
    }));
  };

  const submitRating = async (member) => {
    // ONLY use the numeric ID - no name fallbacks
    const memberId = member.id; // Always numeric ID only
    const ratingData = ratings[memberId];
    
    // ✅ Guard against missing project ID
    if (!theid) {
      alert("Project ID is not yet ready. Please wait a moment.");
      return;
    }

    // ✅ Guard against empty rating + feedback
    if (!ratingData || (!ratingData.rating && !ratingData.feedback)) {
      alert('Please provide a rating or feedback before submitting.');
      return;
    }

    // ✅ Validate rating is not more than 12
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

    setSubmittingRatings(prev => ({ ...prev, [memberId]: true }));

    try {
      const response = await fetch('hhttps://databankvanguard-b3d326c04ab4.herokuapp.com/col/rating/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        alert(`✅ Rating submitted successfully for ${member.name}!`);
        // Refresh the members by rating status to update both tabs
        await fetchRatingsAndSeparateMembers();
        // Clear the local rating state for this member
        setRatings(prev => {
          const newRatings = { ...prev };
          delete newRatings[memberId];
          return newRatings;
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to submit rating');
      }
    } catch (error) {
      console.error("Failed to submit rating:-----------------------", error);
      alert('Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRatings(prev => ({ ...prev, [memberId]: false }));
    }
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

  const renderUnratedMemberCard = (member, index) => {
    const memberId = member.id; // ONLY use numeric ID
    const memberRating = ratings[memberId] || { rating: '', feedback: '' };
    const isSubmitting = submittingRatings[memberId];

    return (
      <div key={index} className="p-3 hover:bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Compact Member Info */}
          <div className="lg:w-1/3 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                member.role === 'supervisor' ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
              <h4 className="font-medium text-gray-800 text-sm truncate">{member.name}</h4>
              <span className="text-xs text-gray-500">#{member.id}</span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div className="flex gap-3">
                <span><strong>Role:</strong> {member.role === 'data_collector' ? 'Data Collector' : 'Supervisor'}</span>
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

          {/* Rating Section */}
          <div className="lg:w-2/3 flex flex-col sm:flex-row gap-3">
            {/* Number Rating Input */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rating (1-12)
              </label>
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

            {/* Feedback and Submit */}
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
                  ) : (
                    '💾'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRatedMemberCard = (ratingData, index) => {
    const member = ratingData.memberDetails;
    
    return (
      <div key={index} className="p-3 hover:bg-gray-50">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Compact Member Info */}
          <div className="lg:w-1/3 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                member.role === 'supervisor' ? 'bg-green-500' : 'bg-blue-500'
              }`}></div>
              <h4 className="font-medium text-gray-800 text-sm truncate">{member.name}</h4>
              <span className="text-xs text-gray-500">#{member.id}</span>
              <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                ✓ Rated
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div className="flex gap-3">
                <span><strong>Role:</strong> {member.role === 'data_collector' ? 'Data Collector' : 'Supervisor'}</span>
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

          {/* Rating Display */}
          <div className="lg:w-2/3 flex flex-col sm:flex-row gap-3">
            {/* Rating Display */}
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Rating
              </label>
              <div className="w-20 p-2 bg-gray-100 border border-gray-300 rounded text-xs text-center font-medium">
                {ratingData.rating || 'N/A'}
              </div>
            </div>

            {/* Feedback Display */}
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
          <button 
            onClick={onBack}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
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
          <button 
            onClick={onBack}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow max-w-full">
      {/* Compact Header */}
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
            <p className="text-xs text-gray-600">{project.memberCount} members • {project.durationDays} days</p>
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded capitalize ${formatStatus(project.status)}`}>
          {project.status}
        </span>
      </div>

      {/* Compact Project Info */}
      <div className="bg-gray-50 p-3 rounded-lg mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div><span className="font-medium">Scrum Master:</span> {project.scrumMaster}</div>
          <div><span className="font-medium">Progress:</span> {((project.totalCollectors + project.totalSupervisors) / (project.numCollectorsNeeded + project.numSupervisorsNeeded) * 100).toFixed(0)}% staffed</div>
          <div><span className="font-medium">Data Collectors:</span> {project.totalCollectors}/{project.numCollectorsNeeded}</div>
          <div><span className="font-medium">Supervisors:</span> {project.totalSupervisors}/{project.numSupervisorsNeeded}</div>
        </div>
      </div>

      {/* Tab Navigation */}
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

      {/* Compact Summary */}
      {teamMembers.length > 0 && !tabLoading && (
        <div className="mt-4 bg-blue-50 p-3 rounded-lg">
          <div className="flex justify-between items-center text-xs text-blue-700">
            <span>Progress: {ratedMembers.length} / {teamMembers.length} rated ({teamMembers.length > 0 ? ((ratedMembers.length / teamMembers.length) * 100).toFixed(0) : 0}%)</span>
            <span>DC: {teamMembers.filter(m => m.role === 'data_collector').length} | SUP: {teamMembers.filter(m => m.role === 'supervisor').length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailPage;