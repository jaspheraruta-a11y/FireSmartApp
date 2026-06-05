
import React, { useEffect, useState } from 'react';
import BfpLogo from '../../components/BfpLogo';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { Loader2, Save, KeyRound } from 'lucide-react';

const Settings: React.FC = () => {
    const { user, refreshUser } = useAuth();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');

    const [profileSaving, setProfileSaving] = useState(false);
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    useEffect(() => {
        if (user) {
            setFullName(user.fullName ?? '');
            setEmail(user.email ?? '');
        }
    }, [user]);

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');

        if (!user) {
            setProfileError('No user loaded.');
            return;
        }

        setProfileSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName.trim() })
                .eq('id', user.id);

            if (error) {
                throw new Error(error.message);
            }

            await refreshUser();
            setProfileSuccess('Profile updated successfully.');
        } catch (err: any) {
            setProfileError(err.message ?? 'Failed to update profile.');
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordSuccess('');

        if (!newPassword || !confirmPassword) {
            setPasswordError('Please fill in all password fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('New password and confirmation do not match.');
            return;
        }

        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters long.');
            return;
        }

        setPasswordSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                throw new Error(error.message);
            }

            setPasswordSuccess('Password updated successfully.');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: any) {
            setPasswordError(err.message ?? 'Failed to update password.');
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <BfpLogo size="lg" showText={false} />
                <h1 className="text-3xl font-bold text-white">Settings</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">Account Information</h2>
                        <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-600/40">
                            Admin Only
                        </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                        Update your display name and review your login email and role.
                    </p>

                    <form onSubmit={handleProfileSubmit} className="space-y-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="mt-1 block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                placeholder="Your full name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Email (login)
                            </label>
                            <input
                                type="email"
                                value={email}
                                disabled
                                className="mt-1 block w-full px-4 py-2.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-sm text-gray-400 cursor-not-allowed"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Email changes can be managed from the Supabase dashboard if needed.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Role
                            </label>
                            <input
                                type="text"
                                value={user?.role.replace('_', ' ').toUpperCase() ?? ''}
                                disabled
                                className="mt-1 block w-full px-4 py-2.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-sm text-gray-400 cursor-not-allowed"
                            />
                        </div>

                        {profileError && (
                            <div className="text-sm text-red-400 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
                                {profileError}
                            </div>
                        )}
                        {profileSuccess && (
                            <div className="text-sm text-emerald-300 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2">
                                {profileSuccess}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={profileSaving}
                            className="inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-[#E53935] text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {profileSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </form>
                </section>

                <section className="bg-[#2A2A2A] rounded-lg border border-gray-700 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">Change Password</h2>
                        <KeyRound className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-sm">
                        Update your admin password. Make sure to store it securely and share it only with
                        authorized personnel.
                    </p>

                    <form onSubmit={handlePasswordSubmit} className="space-y-4 mt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                New Password
                            </label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                placeholder="Enter a strong password"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">
                                Confirm New Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full px-4 py-2.5 bg-[#1F1F1F] border border-gray-700 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                placeholder="Re-enter new password"
                            />
                        </div>

                        {passwordError && (
                            <div className="text-sm text-red-400 bg-red-900/40 border border-red-700 rounded-md px-3 py-2">
                                {passwordError}
                            </div>
                        )}
                        {passwordSuccess && (
                            <div className="text-sm text-emerald-300 bg-emerald-900/40 border border-emerald-700 rounded-md px-3 py-2">
                                {passwordSuccess}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={passwordSaving}
                            className="inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-[#E53935] text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {passwordSaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Update Password
                                </>
                            )}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default Settings;
