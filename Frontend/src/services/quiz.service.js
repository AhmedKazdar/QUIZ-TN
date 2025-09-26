import api from './api';
import { getAuthToken } from '../utils/auth';

const QUIZ_API_URL = '/api/quiz';  // Make sure this matches your backend rout

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${getAuthToken()}` }
});

export const quizService = {
  // Create a new quiz question
  async createQuiz(quizData) {
    try {
      const response = await api.post(QUIZ_API_URL, quizData, getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error creating quiz:', error);
      throw error;
    }
  },

  // Get random quiz questions
  async getRandomQuestions(limit = 10, category, difficulty) {
    try {
      const params = { limit };
      if (category) params.category = category;
      if (difficulty) params.difficulty = difficulty;
      
      const response = await api.get(`${QUIZ_API_URL}/random`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching random questions:', error);
      throw error;
    }
  },

  // Submit quiz response
  async submitResponse(responseData) {
    try {
      const response = await api.post(
        `${QUIZ_API_URL}/submit`,
        responseData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error('Error submitting quiz response:', error);
      throw error;
    }
  },

  // Get quiz statistics
  async getQuizStats() {
    try {
      const response = await api.get(`${QUIZ_API_URL}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching quiz stats:', error);
      throw error;
    }
  },

  // Get a specific quiz by ID
  async getQuizById(id) {
    try {
      const response = await api.get(`${QUIZ_API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching quiz with ID ${id}:`, error);
      throw error;
    }
  },

  // Get all quizzes sorted by creation date (newest first)
  async findAll() {
    try {
      const response = await api.get(QUIZ_API_URL, getAuthHeaders());
      return response.data;
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      throw error;
    }
  },

  // Update an existing quiz
  async updateQuiz(id, quizData) {
    try {
      const response = await api.put(
        `${QUIZ_API_URL}/${id}`,
        quizData,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error(`Error updating quiz with ID ${id}:`, error);
      throw error;
    }
  },

  // Delete a quiz
  async deleteQuiz(id) {
    try {
      const response = await api.delete(
        `${QUIZ_API_URL}/${id}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error) {
      console.error(`Error deleting quiz with ID ${id}:`, error);
      throw error;
    }
  }
};

export default quizService;
