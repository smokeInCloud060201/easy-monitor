import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { loginApi } from '../lib/api';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { token } = await loginApi(username, password);
      login(token);
      const redirect = searchParams.get('redirect') || '/';
      navigate(redirect, { replace: true });
    } catch {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background font-sans">
      <div className="w-full max-w-[400px] p-10 bg-surface rounded-xl border border-border shadow-2xl">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 inline-flex items-center justify-center mb-4 text-2xl">
            📊
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-1">
            Easy Monitor
          </h1>
          <p className="text-sm text-text-muted m-0">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Username */}
          <div className="mb-5">
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
              className="w-full px-3.5 py-2.5 bg-surface-light border border-border rounded-lg text-text-primary text-sm outline-none transition-colors focus:border-blue-500 box-border"
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="block text-[13px] font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-3.5 py-2.5 bg-surface-light border border-border rounded-lg text-text-primary text-sm outline-none transition-colors focus:border-blue-500 box-border"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3.5 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[13px] mb-5">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading || !username || !password}
            className={`w-full p-2.5 rounded-lg text-text-primary text-sm font-semibold transition-all duration-150 ${
              loading || !username || !password
                ? 'bg-surface-light cursor-not-allowed opacity-70'
                : 'bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 cursor-pointer'
            }`}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
export default Login;
