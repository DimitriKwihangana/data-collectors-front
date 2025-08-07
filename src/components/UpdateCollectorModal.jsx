import React, { useState, useEffect } from 'react';

const STATUS_OPTIONS = ['available', 'deployed'];
const EXPERIENCE_OPTIONS = [
  'Supervisor',
  'Moderator',
  'Regular',
  'Backchecker',
  'Mobilizer',
  'New Enumerator',
];

const UpdateCollectorModal = ({ isOpen, onClose, collector, refresh }) => {
  const [formData, setFormData] = useState({ ...collector });

  useEffect(() => {
    if (collector) setFormData({ ...collector });
  }, [collector]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ['projects_count', 'performance_score', 'rotation_rank'];

    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name) ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.id) {
      alert("Missing ID for update.");
      return;
    }

    try {
      const response = await fetch(`https://databankvanguard-b3d326c04ab4.herokuapp.com/col/teammembers/${formData.id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('✅ Member updated successfully!');
        refresh(); // Refresh the table
        onClose();
      } else {
        const error = await response.json();
        console.error("Update failed:", error);
        alert('❌ Failed to update member.');
      }
    } catch (err) {
      console.error('API error:', err);
      alert('❌ Network error occurred.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6">Update Team Member</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* Text fields */}
          {['ve_code', 'name', 'role', 'current_project'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field.replace('_', ' ')}</label>
              <input
                type="text"
                name={field}
                value={formData[field] || ''}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          ))}

          {/* Numeric fields */}
          {['projects_count', 'performance_score', 'rotation_rank'].map((field) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1 capitalize">{field.replace('_', ' ')}</label>
              <input
                type="number"
                name={field}
                value={formData[field] ?? 0}
                onChange={handleChange}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          ))}

          {/* Experience Level */}
          <div>
            <label className="block text-sm font-medium mb-1">Experience Level</label>
            <select
              name="experience_level"
              value={formData.experience_level || ''}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">Select...</option>
              {EXPERIENCE_OPTIONS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              value={formData.status || ''}
              onChange={handleChange}
              className="w-full border px-3 py-2 rounded"
            >
              <option value="">Select...</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded">
            Cancel
          </button>
          <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded">
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateCollectorModal;
