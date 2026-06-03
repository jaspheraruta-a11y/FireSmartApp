
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Map, Siren, Smartphone, BarChart2, Settings } from 'lucide-react';
import BfpLogo from './BfpLogo';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/overview' },
    { name: 'Live Map', icon: Map, path: '/dashboard/map' },
    { name: 'Alerts', icon: Siren, path: '/dashboard/alerts' },
    { name: 'Devices', icon: Smartphone, path: '/dashboard/devices' },
    { name: 'Reports', icon: BarChart2, path: '/dashboard/reports' },
    { name: 'Settings', icon: Settings, path: '/dashboard/settings' },
];

const Sidebar: React.FC = () => {
    return (
        <aside className="w-64 bg-[#2A2A2A] flex-shrink-0 p-4 flex flex-col border-r border-gray-700">
            <div className="mb-10 px-2">
                <BfpLogo size="sm" />
            </div>
            <nav className="flex-1">
                <ul>
                    {navItems.map((item) => (
                        <li key={item.name}>
                            <NavLink
                                to={item.path}
                                className={({ isActive }) => 
                                    `flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${
                                    isActive 
                                        ? 'bg-[#E53935] text-white shadow-lg' 
                                        : 'text-gray-300 hover:bg-[#3A3A3A] hover:text-white'
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5 mr-3" />
                                <span className="font-medium">{item.name}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
        </aside>
    );
};

export default Sidebar;
