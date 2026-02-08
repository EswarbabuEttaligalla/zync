import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem('zync-auth');
      if (stored) {
        const { state } = JSON.parse(stored);
        if (state?.accessToken) {
          config.headers.Authorization = `Bearer ${state.accessToken}`;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('zync-auth')
          ? JSON.parse(localStorage.getItem('zync-auth')).state.refreshToken
          : null;
          
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          
          // Update stored tokens
          const stored = JSON.parse(localStorage.getItem('zync-auth') || '{}');
          stored.state = {
            ...stored.state,
            accessToken,
            refreshToken: newRefreshToken,
          };
          localStorage.setItem('zync-auth', JSON.stringify(stored));
          
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
          
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Clear auth and redirect to login
        localStorage.removeItem('zync-auth');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

// API Service Functions
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const userAPI = {
  getMe: () => api.get('/users/me'),
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  updateSettings: (data) => api.put('/users/me/settings', data),
  changePassword: (data) => api.put('/users/me/password', data),
  getStats: () => api.get('/users/me/stats'),
  getDashboard: () => api.get('/users/me/dashboard'),
  getUser: (userId) => api.get(`/users/${userId}`),
};

export const roomAPI = {
  getRooms: (params) => api.get('/rooms', { params }),
  getMyRooms: () => api.get('/rooms/my-rooms'),
  getJoinedRooms: () => api.get('/rooms/joined'),
  getRoom: (roomId) => api.get(`/rooms/${roomId}`),
  createRoom: (data) => api.post('/rooms', data),
  updateRoom: (roomId, data) => api.put(`/rooms/${roomId}`, data),
  deleteRoom: (roomId) => api.delete(`/rooms/${roomId}`),
  joinRoom: (roomId) => api.post(`/rooms/${roomId}/join`),
  leaveRoom: (roomId) => api.post(`/rooms/${roomId}/leave`),
  requestJoin: (roomId) => api.post(`/rooms/${roomId}/request-join`),
  handleJoinRequest: (roomId, requestId, action) => 
    api.post(`/rooms/${roomId}/requests/${requestId}`, { action }),
  getJoinRequests: (roomId) => api.get(`/rooms/${roomId}/requests`),
  getMessages: (roomId, params) => api.get(`/messages/${roomId}`, { params }),
  muteUser: (roomId, userId) => api.post(`/rooms/${roomId}/mute/${userId}`),
  unmuteUser: (roomId, userId) => api.post(`/rooms/${roomId}/unmute/${userId}`),
  kickUser: (roomId, userId) => api.post(`/rooms/${roomId}/kick/${userId}`),
};

export const messageAPI = {
  getMessages: (roomId, params) => api.get(`/messages/${roomId}`, { params }),
  searchMessages: (roomId, query) => api.get(`/messages/${roomId}/search`, { params: { query } }),
  getFlaggedMessages: (roomId) => api.get(`/messages/${roomId}/flagged`),
  deleteMessage: (messageId) => api.delete(`/messages/${messageId}`),
  editMessage: (messageId, content) => api.put(`/messages/${messageId}`, { content }),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserStatus: (userId, data) => api.put(`/admin/users/${userId}/status`, data),
  updateUserRole: (userId, role) => api.put(`/admin/users/${userId}/role`, { role }),
  banUser: (userId) => api.put(`/admin/users/${userId}/ban`),
  unbanUser: (userId) => api.put(`/admin/users/${userId}/unban`),
  getRooms: (params) => api.get('/admin/rooms', { params }),
  archiveRoom: (roomId, reason) => api.delete(`/admin/rooms/${roomId}`, { data: { reason } }),
  getModeration: () => api.get('/admin/moderation'),
  getFlaggedMessages: () => api.get('/admin/messages/flagged'),
  approveMessage: (messageId) => api.put(`/admin/messages/${messageId}/approve`),
  deleteMessage: (messageId) => api.delete(`/admin/messages/${messageId}`),
  reviewMessage: (messageId, data) => api.put(`/admin/messages/${messageId}/review`, data),
  getAnalytics: () => api.get('/admin/analytics'),
};
