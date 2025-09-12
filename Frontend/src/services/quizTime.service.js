import axios from 'axios';

const API_URL = 'http://localhost:3001/api/quiz-times';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const quizTimeService = {
  async getQuizTimes(activeOnly = true) {
    try {
      const response = await axios.get(
        `${API_URL}?activeOnly=${activeOnly}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz times:', error);
      throw error;
    }
  },

  async addQuizTime(time) {
    try {
      const response = await axios.post(
        API_URL,
        { time },
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error adding quiz time:', error);
      throw error;
    }
  },

  async updateQuizTime(id, updateData) {
    try {
      const response = await axios.put(
        `${API_URL}/${id}`,
        updateData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error updating quiz time:', error);
      throw error;
    }
  },

  async deleteQuizTime(id) {
    try {
      const response = await axios.delete(
        `${API_URL}/${id}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error deleting quiz time:', error);
      throw error;
    }
  },
};

export default quizTimeService;
