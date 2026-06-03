import React from 'react';
import bfpLogo from '../BFP-Logo.png';

type BfpLogoSize = 'sm' | 'md' | 'lg';

const imageSizes: Record<BfpLogoSize, number> = {
    sm: 32,
    md: 48,
    lg: 64,
};

const textClasses: Record<BfpLogoSize, string> = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
};

interface BfpLogoProps {
    size?: BfpLogoSize;
    showText?: boolean;
    stacked?: boolean;
    className?: string;
}

const BfpLogo: React.FC<BfpLogoProps> = ({
    size = 'md',
    showText = true,
    stacked = false,
    className = '',
}) => {
    const px = imageSizes[size];

    return (
        <div
            className={
                stacked
                    ? `flex flex-col items-center gap-3 ${className}`
                    : `flex items-center gap-3 ${className}`
            }
        >
            <img
                src={bfpLogo}
                alt="Bureau of Fire Protection"
                width={px}
                height={px}
                className="object-contain shrink-0"
            />
            {showText && (
                <span className={`font-bold tracking-wider text-white ${textClasses[size]}`}>
                    FIRE SMART
                </span>
            )}
        </div>
    );
};

export default BfpLogo;
