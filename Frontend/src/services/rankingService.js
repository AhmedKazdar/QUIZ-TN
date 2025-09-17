import api from './api';

export const getLeaderboard = async (page = 1, limit = 10) => {
  try {
    const response = await api.get('/scores/leaderboard', {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

export const getUserRank = async (userId) => {
  try {
    const response = await api.get(`/scores/rank/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching user rank:', error);
    throw error;
  }
};

export const getTopScores = async (limit = 10) => {
  try {
    const response = await api.get('/scores/top', {
      params: { limit }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching top scores:', error);
    throw error;
  }
};
