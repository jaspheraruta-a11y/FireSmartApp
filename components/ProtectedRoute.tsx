
import React, { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
    children: ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-[#0F0F0F]">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-dashed border-[#E53935]"></div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
