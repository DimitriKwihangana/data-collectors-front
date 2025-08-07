import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [collectors, setCollectors] = useState([]);
  const [activeProjects, setActiveProjects] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamResponse = await axios.get('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/teammembers/');
        const teamData = teamResponse.data.data || teamResponse.data || [];
        setCollectors(teamData);
        const projectsResponse = await axios.get('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/get-project/');
        setActiveProjects(projectsResponse.data.active_projects || {}); 
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error.message);
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

  const totalCollectors = collectors.filter(c => 
    c.role === 'data_collector' || c.role === 'Data Collector'
  ).length;
  
  const totalSupervisors = collectors.filter(c => 
    c.role === 'supervisor' || c.role === 'Supervisor'
  ).length;
  
  const available = collectors.filter(c => c.status === 'available').length;
  const deployed = collectors.filter(c => c.status === 'deployed').length;

  const availableWithProjects = collectors
    .filter(c => c.status === 'available' && c.current_project)
    .map(c => ({ name: c.name, project: c.current_project }));

  const deployedWithProjects = collectors
    .filter(c => c.status === 'deployed' && c.current_project)
    .map(c => ({ name: c.name, project: c.current_project }));

  const activeProjectCount = Object.keys(activeProjects).length;

  const statCard = (label, value, color = 'indigo') => (
    <div className={`bg-white rounded-xl p-6 shadow border-t-4 border-${color}-500 text-center`}>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-sm font-medium text-gray-500 mt-1">{label}</div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-gray-100 p-6 rounded-xl items-center">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6  gap-4  ">
          {statCard('Data Collectors', collectors.length, 'blue')}
          {statCard('Supervisors', totalSupervisors, 'green')}
          {statCard('Available', available, 'yellow')}
          {statCard('Deployed', deployed, 'red')}
          {statCard('Active Projects', activeProjectCount, 'purple')}
        </div>
      </div>

      {availableWithProjects.length > 0 && (
        <div className="bg-green-50 p-6 rounded-xl border border-green-200">
          <h3 className="text-lg font-semibold text-green-800 mb-4">
            Available Members with Assigned Projects ({availableWithProjects.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableWithProjects.map((member, index) => (
              <div key={index} className="bg-white p-3 rounded-lg shadow-sm border border-green-100">
                <div className="font-medium text-gray-800">{member.name}</div>
                <div className="text-sm text-green-600">Project: {member.project}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    
      {Object.keys(activeProjects).length === 0 && (
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-600">No Active Projects</h3>
          <p className="text-sm text-gray-500 mt-1">Projects will appear here when team members are assigned</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;