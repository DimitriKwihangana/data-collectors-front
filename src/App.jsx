import React, { useEffect, useState } from 'react';
import { getTeamMembers } from './api/api';

import Dashboard from './components/Dashboard';
import CollectorTable from './components/CollectorTable';
import ProjectForm from './components/ProjectForm';

import ActiveProjects from './components/ActiveProjects';

function App() {
  const [collectors, setCollectors] = useState([]);
  const [projects, setProjects] = useState([]); 
  const [currentProject, setCurrentProject] = useState('');

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

  return (
    <div className="min-h-screen bg-gradient-to-br p-4 from-gray-100 to-gray-300">
      <div className="max-w-8xl mx-auto bg-white rounded-xl shadow-xl overflow-hidden">
        
        <div className="bg-gray-800 text-white text-center py-8 px-4">
          <h1 className="text-3xl font-bold mb-2">Data Collector Managing System</h1>
          {/* <p className="text-sm opacity-80">Intelligent project assignment and performance tracking</p> */}
        </div>

        <div className="p-6 space-y-8">
          <Dashboard collectors={collectors} />
          <ProjectForm onSuccess={() => handleProjectAssigned('Latest Project')} />
          <ActiveProjects projects={projects} />
          <CollectorTable
            collectors={collectors}
            refresh={fetchCollectors}
            currentProject={currentProject}
          />
         
        </div>
      </div>
    </div>
  );
}

export default App;
