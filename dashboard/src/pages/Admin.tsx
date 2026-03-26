import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchUsers, createUserApi, deleteUserApi, type UserInfo } from '../lib/api';

export function Admin() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('Observer');
  const [error, setError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadUsers = async () => {
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return;
    setFormLoading(true);
    setError('');
    try {
      await createUserApi(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('Observer');
      setShowForm(false);
      await loadUsers();
    } catch {
      setError('Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (username === currentUser?.sub) return;
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await deleteUserApi(username);
      await loadUsers();
    } catch {
      setError('Failed to delete user');
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary m-0">
            User Management
          </h1>
          <p className="text-[13px] text-text-muted mt-1 mb-0">
            Manage users and their roles
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-gradient-to-br from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-text-primary text-[13px] font-semibold rounded-md transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-3.5 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Add user form */}
      {showForm && (
        <div className="p-5 bg-surface border border-border rounded-lg mb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Username</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="username"
                className="w-full px-3 py-2 bg-surface-light border border-border rounded-md text-text-primary text-[13px] outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="password"
                className="w-full px-3 py-2 bg-surface-light border border-border rounded-md text-text-primary text-[13px] outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                className="w-full px-3 py-2 bg-surface-light border border-border rounded-md text-text-primary text-[13px] outline-none focus:border-blue-500 cursor-pointer transition-colors"
              >
                <option value="Observer">Observer</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={formLoading || !newUsername || !newPassword}
            className={`px-5 py-2 rounded-md text-text-primary text-[13px] font-semibold transition-colors ${
              formLoading || !newUsername || !newPassword ? 'bg-surface-light cursor-not-allowed opacity-70' : 'bg-emerald-500 hover:bg-emerald-600'
            }`}
          >
            {formLoading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div className="text-text-muted text-sm py-10 text-center">
          Loading users...
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {['Username', 'Role', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surface-light transition-colors">
                  <td className="px-4 py-3 text-[13px] text-text-primary font-medium">
                    {u.username}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                      u.role === 'Admin' ? 'bg-purple-500/15 text-purple-400' : 'bg-blue-500/15 text-blue-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-secondary">
                    {new Date(u.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.username !== currentUser?.sub && (
                      <button
                        onClick={() => handleDelete(u.username)}
                        className="px-2.5 py-1 bg-transparent border border-border hover:border-red-500 hover:bg-red-500/10 rounded text-red-500 text-xs transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default Admin;
