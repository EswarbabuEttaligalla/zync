import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const getErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;
  const details = Array.isArray(responseData?.details)
    ? responseData.details.map((item) => (typeof item === 'string' ? item : item?.message)).filter(Boolean).join(', ')
    : typeof responseData?.details === 'string'
      ? responseData.details
      : '';

  return responseData?.error || responseData?.message || details || error?.message || fallbackMessage;
};

const logAuthError = (action, error, payload) => {
  console.error(`[auth] ${action} failed`, {
    status: error?.response?.status,
    data: error?.response?.data,
    url: error?.config?.url,
    payload,
  });
};

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
        const loginIdentifier = String(email).trim();

        try {
          const response = await api.post('/auth/login', { email: loginIdentifier, password });
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
          logAuthError('login', error, { email: loginIdentifier });
          return {
            success: false,
            error: getErrorMessage(error, 'Login failed'),
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
          logAuthError('register', error, {
            username: userData?.username,
            email: userData?.email,
          });
          return {
            success: false,
            error: getErrorMessage(error, 'Registration failed'),
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
              console.error('[auth] refresh during checkAuth failed', {
                status: refreshError?.response?.status,
                data: refreshError?.response?.data,
                url: refreshError?.config?.url,
              });
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
