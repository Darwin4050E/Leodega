import React from 'react';

type FooterNavProps = {
    onBack: () => void;
    onNext: () => void;
    backDisabled?: boolean;
    nextDisabled?: boolean;
    backLabel?: string;
    nextLabel?: string;
    };

    const FooterNav: React.FC<FooterNavProps> = ({
    onBack,
    onNext,
    backDisabled = false,
    nextDisabled = false,
    backLabel = 'Atrás',
    nextLabel = 'Siguiente',
    }) => {
    return (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4">
            <div className="flex justify-between items-center gap-4">
                <button onClick={onBack} disabled={backDisabled} className={`rounded-lg font-medium px-6 py-3 shadow-md transition-all text-[15px] w-[170px] ${ backDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed'  : 'bg-purple-500 hover:bg-purple-600 text-white' }`}>
                    {backLabel}
                </button>
                <div className="flex-1" />
                <button onClick={onNext} disabled={nextDisabled} className={`rounded-lg font-medium px-6 py-3 shadow-md transition-all text-[15px] w-[170px] ${ nextDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-purple-500 hover:bg-purple-600 text-white' }`} >
                    {nextLabel}
                </button>
            </div>
        </div>
    );
};

export default FooterNav;
