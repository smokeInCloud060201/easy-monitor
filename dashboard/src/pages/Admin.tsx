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

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '6px',
    color: '#f9fafb',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#9ca3af',
    marginBottom: '4px',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f9fafb', margin: 0 }}>
            User Management
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '4px 0 0 0' }}>
            Manage users and their roles
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          color: '#ef4444',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Add user form */}
      {showForm && (
        <div style={{
          padding: '20px',
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Username</label>
              <input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="username"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="password"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="Observer">Observer</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={formLoading || !newUsername || !newPassword}
            style={{
              padding: '8px 20px',
              backgroundColor: formLoading ? '#374151' : '#10b981',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: formLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {formLoading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      )}

      {/* Users table */}
      {loading ? (
        <div style={{ color: '#6b7280', fontSize: '14px', padding: '40px 0', textAlign: 'center' }}>
          Loading users...
        </div>
      ) : (
        <div style={{
          backgroundColor: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1f2937' }}>
                {['Username', 'Role', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#f9fafb', fontWeight: 500 }}>
                    {u.username}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      backgroundColor: u.role === 'Admin'
                        ? 'rgba(168, 85, 247, 0.15)'
                        : 'rgba(59, 130, 246, 0.15)',
                      color: u.role === 'Admin' ? '#a855f7' : '#3b82f6',
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#9ca3af' }}>
                    {new Date(u.created_at * 1000).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.username !== currentUser?.sub && (
                      <button
                        onClick={() => handleDelete(u.username)}
                        style={{
                          padding: '4px 10px',
                          backgroundColor: 'transparent',
                          border: '1px solid #374151',
                          borderRadius: '4px',
                          color: '#ef4444',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                          (e.currentTarget as HTMLElement).style.borderColor = '#ef4444';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.borderColor = '#374151';
                        }}
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
