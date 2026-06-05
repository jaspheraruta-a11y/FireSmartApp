
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, Wifi } from 'lucide-react';
import BfpLogo from '../components/BfpLogo';

const LandingPage: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#0F0F0F] text-[#CFCFCF] overflow-x-hidden">
            <div className="absolute inset-0 z-0 opacity-10">
                <div className="absolute top-0 left-0 h-96 w-96 rounded-full bg-red-500/20 blur-3xl filter"></div>
                <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-500/20 blur-3xl filter"></div>
            </div>
            
            <main className="relative z-10">
                {/* Hero Section */}
                <section className="flex flex-col items-center justify-center h-screen text-center px-4">
                    <div className="flex items-center gap-3 justify-center">
                        <BfpLogo size="lg" showText={false} />
                        <h1 className="text-3xl font-bold text-white tracking-wider">FIRE SMART</h1>
                    </div>
                    <p className="mt-6 text-4xl md:text-6xl font-extrabold text-white tracking-tight">
                        IoT-Driven Fire Detection for Faster Emergency Response
                    </p>
                    <p className="mt-4 max-w-2xl text-lg text-gray-400">
                        A revolutionary platform connecting smart IoT devices directly to the Bureau of Fire Protection for proactive safety and immediate action.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                        <Link to="/login" className="px-8 py-3 bg-[#E53935] text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-105 glow-red">
                            Login to Dashboard
                        </Link>
                        <a href="#features" className="px-8 py-3 bg-[#2A2A2A] text-white font-semibold rounded-lg shadow-lg hover:bg-gray-700 transition-all duration-300 transform hover:scale-105">
                            View System Overview
                        </a>
                    </div>
                </section>

                {/* Features Section */}
                <section id="features" className="py-20 px-4 bg-[#121212]">
                    <div className="container mx-auto">
                        <h2 className="text-4xl font-bold text-center text-white mb-12">System Core Features</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <FeatureCard 
                                icon={<Wifi className="h-10 w-10 text-[#FB8C00]" />}
                                title="Real-time Fire Detection"
                                description="Smart sensors detect fire, smoke, and gas in seconds, transmitting data instantly to our secure cloud platform."
                            />
                            <FeatureCard 
                                icon={<MapPin className="h-10 w-10 text-[#43A047]" />}
                                title="Automatic Location Mapping"
                                description="GPS-enabled devices automatically pinpoint the exact incident location on a live map for immediate dispatcher awareness."
                            />
                            <FeatureCard 
                                icon={<ShieldCheck className="h-10 w-10 text-[#E53935]" />}
                                title="Direct BFP Integration"
                                description="Alerts are streamed directly to the BFP Admin Dashboard, eliminating delays and enabling faster unit dispatch."
                            />
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => (
    <div className="bg-[#2A2A2A] p-8 rounded-xl border border-gray-700 hover:border-[#E53935] transition-colors duration-300 flex flex-col items-center text-center">
        <div className="mb-4">{icon}</div>
        <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400">{description}</p>
    </div>
);

export default LandingPage;
