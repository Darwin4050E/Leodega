import React from 'react';

interface SidebarItemProps {
    icon?: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full px-6 py-3.5 text-left flex items-center gap-3 transition-colors text-[15px] ${
        active
            ? 'bg-[#FFB84D] text-white font-medium'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
    >
        {icon && <span className={active ? 'text-white' : 'text-gray-600'}>{icon}</span>}
        <span>{label}</span>
    </button>
);