
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, Loader2 } from 'lucide-react';
import BfpLogo from '../components/BfpLogo';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('admin@bfp.gov');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState('');
    const { login, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to login. Please check your credentials.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] p-4">
             <div className="absolute inset-0 z-0 opacity-10">
                <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-red-500/20 blur-3xl filter"></div>
            </div>
            <div className="relative z-10 w-full max-w-md">
                <div className="bg-[#1A1A1A]/50 backdrop-blur-sm border border-[#3A3A3A] rounded-2xl shadow-2xl p-8">
                     <div className="flex flex-col items-center mb-8">
                        <div className="flex items-center gap-3">
                            <BfpLogo size="lg" showText={false} />
                            <h1 className="text-3xl font-bold text-white">Sign In</h1>
                        </div>
                        <p className="mt-3 text-gray-400">BFP Command Center Access</p>
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg flex items-center">
                            <AlertCircle className="h-5 w-5 mr-2"/>
                            <span>{error}</span>
                        </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full px-4 py-3 bg-[#2A2A2A] border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password"  className="block text-sm font-medium text-gray-300">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 block w-full px-4 py-3 bg-[#2A2A2A] border border-gray-600 rounded-md shadow-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E53935] focus:border-[#E53935] transition"
                                placeholder="••••••••"
                            />
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#E53935] hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0F0F0F] focus:ring-red-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin h-5 w-5" />
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
