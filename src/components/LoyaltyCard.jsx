import React, { forwardRef } from 'react';

const LoyaltyCard = forwardRef(({ client, profile, showLevel = true }, ref) => {
    const totalVisits = parseInt(profile?.totalVisits || client.totalVisits) || 0;
    const currentCycleVisits = totalVisits % 10;
    const visitsInCycle = currentCycleVisits === 0 && totalVisits > 0 ? 10 : currentCycleVisits;
    const level = Math.floor((totalVisits + 9) / 10);
    const phoneSuffix = String(profile?.phone || client.phone || "").slice(-4);

    return (
        <div
            ref={ref}
            className="bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6 rounded-xl border border-amber-500/30 shadow-2xl relative overflow-hidden group w-full max-w-sm mx-auto"
            style={{ minHeight: '220px' }} // Ensure consistent height for screenshots
        >
            {/* Efeito de brilho no fundo */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-500 p-2 rounded-full shadow-lg shadow-amber-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black">
                            <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div>
                        <span className="text-amber-500 font-bold uppercase tracking-wider text-sm block leading-none mb-1">Barber Club</span>
                        {showLevel && (
                            <span className="text-xs text-gray-400 font-mono bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-700">
                                Nível {level}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="text-white font-bold text-sm">{String(client.name).split(" ")[0]}</h3>
                    <span className="text-xs text-gray-500 font-mono">#{phoneSuffix}</span>
                </div>
            </div>

            {/* Grid de Carimbos */}
            <div className="grid grid-cols-5 gap-3 relative z-10 mb-5">
                {Array.from({ length: 10 }).map((_, index) => {
                    const isStamped = index < visitsInCycle;

                    return (
                        <div
                            key={index}
                            className={`
                                aspect-square rounded-full flex items-center justify-center border-2 transition-all duration-500 relative
                                ${isStamped
                                    ? "border-amber-500 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-105"
                                    : "border-gray-700 bg-gray-800/50"}
                            `}
                        >
                            {isStamped ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black drop-shadow-sm">
                                    <path d="M5.223 2.25c-.497 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 7.5 9.75c0 2.292.545 4.4 1.503 6.313l-2.158 3.106 3.728 3.729 3.106-2.158c1.912.958 4.021 1.503 6.313 1.503a3.75 3.75 0 0 0 3.75-3.75v-2.098c0-.497-.199-.973-.55-1.325l-1.299-1.3a3.748 3.748 0 0 0-3.748-3.748H12.25v-3h.75a3.75 3.75 0 0 0 3.75-3.75V2.25h-11.5Z" />
                                </svg>
                            ) : (
                                <span className="text-[10px] text-gray-600 font-bold">{index + 1}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between items-center text-xs relative z-10 border-t border-gray-800 pt-3">
                <span className="text-gray-400 font-medium">Complete 10 e suba de nível!</span>
                <div className="flex gap-1" title={`Nível Atual: ${level}`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < level ? "bg-amber-500" : "bg-gray-700"}`}></div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default LoyaltyCard;
