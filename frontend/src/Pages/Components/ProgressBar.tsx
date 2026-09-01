type ProgressBarProps = {
    totalSteps?: number;
    activeIndex?: number;
    className?: string;
    };

    const ProgressBar = ({ totalSteps = 7, activeIndex = 0, className = "" }: ProgressBarProps) => {
    const steps = Array.from({ length: totalSteps }, (_, i) => `step-${i + 1}`);
    return (
        <div
            className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-4 ${className}`}
            aria-hidden={false}
        >
            <div className="flex justify-center gap-2">
                {steps.map((step, i) => (
                    <div
                        key={step}
                        className={`h-2 rounded-full transition-all duration-300 ${
                            i === activeIndex ? 'w-28 bg-purple-500' : 'w-28 bg-gray-200'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default ProgressBar;
