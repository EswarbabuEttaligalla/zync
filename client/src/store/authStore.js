import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,

      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      },

      login: async (email, password) => {
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, accessToken, refreshToken } = response.data;

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Login failed',
          };
        }
      },

      register: async (userData) => {
        try {
          const response = await api.post('/auth/register', userData);
          const { user, accessToken, refreshToken } = response.data;

          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
          });

          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.response?.data?.error || 'Registration failed',
          };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });

        delete api.defaults.headers.common['Authorization'];
      },

      checkAuth: async () => {
        const { accessToken } = get();

        if (!accessToken) {
          set({ isLoading: false });
          return;
        }

        try {
          api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
          const response = await api.get('/users/me');

          set({
            user: response.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          const { refreshToken } = get();
          if (refreshToken) {
            try {
              const refreshResponse = await api.post('/auth/refresh', { refreshToken });
              const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;

              set({ accessToken: newAccessToken, refreshToken: newRefreshToken });
              api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

              const userResponse = await api.get('/users/me');
              set({
                user: userResponse.data.user,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            } catch (refreshError) {
              // Refresh failed, will fall through to logout
            }
          }

          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData },
        }));
      },
    }),
    {
      name: 'zync-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
