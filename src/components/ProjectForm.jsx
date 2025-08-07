import React, { useState } from 'react';

const initialFormState = {
  name: '',
  projectName: '',
  num_data_collectors: '',
  num_supervisors: '',
  num_backcheckers: '',
  startDate: '',
  endDate: '',
  status: 'active',
};

const ProjectForm = ({ onSuccess }) => {
  const [form, setForm] = useState(initialFormState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const isFormValid = () => {
    return (
      form.name &&
      form.projectName &&
      form.num_data_collectors &&
      form.num_supervisors &&
      form.num_backcheckers &&
      form.startDate &&
      form.endDate
    );
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setMessage('❗ Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const projectData = {
        ...form,
        num_data_collectors: parseInt(form.num_data_collectors),
        num_supervisors: parseInt(form.num_supervisors),
        num_backcheckers: parseInt(form.num_backcheckers),
        status: 'active',
      };

      const response = await fetch('https://databankvanguard-b3d326c04ab4.herokuapp.com/col/assign-project/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("API response:", result);
        setMessage('✅ Project assigned successfully!');
        setForm(initialFormState);
        if (onSuccess) onSuccess();
      } else {
        const errorData = await response.json();
        console.error('API error:', errorData);
        setMessage('❌ Failed to assign project.');
      }
    } catch (err) {
      console.error('Request failed:', err);
      setMessage('❌ Error connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow mb-8">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">New Project Assignment</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Scrum Master Name', id: 'name', type: 'text' },
          { label: 'Project Name', id: 'projectName', type: 'text' },
          { label: 'Data Collectors Needed', id: 'num_data_collectors', type: 'number' },
          { label: 'Supervisors Needed', id: 'num_supervisors', type: 'number' },
          { label: 'Backcheckers Needed', id: 'num_backcheckers', type: 'number' },
          { label: 'Fieldwork Start Date', id: 'startDate', type: 'date' },
          { label: 'Fieldwork End Date', id: 'endDate', type: 'date' },
        ].map(({ label, id, type }) => (
          <div className="flex flex-col" key={id}>
            <label htmlFor={id} className="text-sm font-medium text-gray-700 mb-1">
              {label}
            </label>
            <input
              type={type}
              id={id}
              value={form[id]}
              onChange={handleChange}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>

      <button
        className={`px-6 py-2 rounded font-semibold ${
          loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
        }`}
        onClick={handleSubmit}
        disabled={loading}
      >
        {loading ? 'Submitting...' : 'Assign Project'}
      </button>

      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
};

export default ProjectForm;
