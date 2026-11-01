import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { User, Business } from '../types';

interface AuthContextType {
  user: User | null;
  business: Business | null;
  token: string | null;
  loading: boolean;
  login: (data: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateBusinessState: (biz: Business) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('paypilot_token'));
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    try {
      if (!token) {
        setLoading(false);
        return;
      }
      const res = await authAPI.me();
      setUser(res.data.user);
      setBusiness(res.data.business);
    } catch (err) {
      console.error('Failed to load user session', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, [token]);

  const login = async (credentials: any) => {
    const res = await authAPI.login(credentials);
    const { access_token, user_id, business_id, business_name, currency, full_name, email } = res.data;
    localStorage.setItem('paypilot_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, full_name, is_active: true, created_at: new Date().toISOString() });
    setBusiness({ id: business_id, name: business_name, currency, owner_id: user_id, role: 'owner' });
  };

  const register = async (regData: any) => {
    const res = await authAPI.register(regData);
    const { access_token, user_id, business_id, business_name, currency, full_name, email } = res.data;
    localStorage.setItem('paypilot_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, full_name, is_active: true, created_at: new Date().toISOString() });
    setBusiness({ id: business_id, name: business_name, currency, owner_id: user_id, role: 'owner' });
  };

  const logout = () => {
    localStorage.removeItem('paypilot_token');
    setToken(null);
    setUser(null);
    setBusiness(null);
  };

  const updateBusinessState = (biz: Business) => {
    setBusiness(biz);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        business,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser: fetchCurrentUser,
        updateBusinessState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
