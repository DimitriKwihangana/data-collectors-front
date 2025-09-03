import React, { useEffect, useState } from 'react';
import { getTeamMembers } from './api/api';

import Dashboard from './components/Dashboard';
import CollectorTable from './components/CollectorTable';
import ProjectForm from './components/ProjectForm';

import ActiveProjects from './components/ActiveProjects';
import ProjectsManager from './components/ProjectsManager';
import TeamMembersManager from './components/TeamMembersManager';

function App() {
  const [collectors, setCollectors] = useState([]);
  const [projects, setProjects] = useState([]); // you can populate if you like
  const [currentProject, setCurrentProject] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'projects' | 'members'

  const fetchCollectors = async () => {
    try {
      const res = await getTeamMembers();
      setCollectors(res.data.data);
    } catch (err) {
      console.error('❌ Failed to fetch team members:', err);
    }
  };

  useEffect(() => {
    fetchCollectors();
  }, []);

  const handleProjectAssigned = (projectName) => {
    setCurrentProject(projectName);
    fetchCollectors();
  };

  const TabButton = ({ id, label, icon }) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={[
          'px-4 py-2 text-sm font-medium rounded-t-md border',
          isActive
            ? 'bg-white text-gray-900 border-gray-300 border-b-transparent'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-transparent'
        ].join(' ')}
      >
        <span className="mr-2">{icon}</span>{label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-300">
      <div className=" bg-white shadow-xl overflow-hidden">
        <div className="bg-gray-800 text-white text-center py-8 px-4">
          <h1 className="text-3xl font-bold mb-2">Data Collector Managing System</h1>
        </div>

        <div className="p-6 space-y-6">
          <Dashboard collectors={collectors} />

          {/* Tabs */}
          <div className="mt-2">
            <div className="flex gap-2 border-b border-gray-300">
              <TabButton id="overview" label="Overview" icon="📋" />
              <TabButton id="projects" label="Project Management" icon="🏗️" />
              <TabButton id="members" label="Team Members" icon="👥" />
            </div>

            <div className="border border-t-0 border-gray-300 rounded-b-md bg-white p-4">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <ProjectForm onSuccess={() => handleProjectAssigned('Latest Project')} />
                  <ActiveProjects projects={projects} />
                  <CollectorTable
                    collectors={collectors}
                    refresh={fetchCollectors}
                    currentProject={currentProject}
                  />
                </div>
              )}

              {activeTab === 'projects' && (
                <ProjectsManager />
              )}

              {activeTab === 'members' && (
                <TeamMembersManager />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
