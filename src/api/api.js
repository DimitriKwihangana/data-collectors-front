import axios from 'axios';

const API = axios.create({
  baseURL: 'https://databankvanguard-b3d326c04ab4.herokuapp.com/col',  
});

export const getTeamMembers = () => API.get('teammembers/');
export const createTeamMember = (data) => API.post('teammembers/', data);
export const updateTeamMember = (id, data) => API.put(`teammembers/${id}/`, data);
export const deleteTeamMember = (id) => API.delete(`teammembers/${id}/`);
