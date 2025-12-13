import React, { forwardRef } from 'react';
import { Trophy, Crown, Medal, Star } from 'lucide-react';

const LoyaltyCard = forwardRef(({ client, profile, showLevel = true }, ref) => {
    const totalVisits = parseInt(profile?.totalVisits || client.totalVisits) || 0;
    const currentCycleVisits = totalVisits % 10;
    const visitsInCycle = currentCycleVisits === 0 && totalVisits > 0 ? 10 : currentCycleVisits;
    const level = Math.floor((totalVisits + 9) / 10);
    const phoneSuffix = String(profile?.phone || client.phone || "").slice(-4);

    // 🏆 TIER LOGIC
    let tierConfig = {
        name: "Bronze",
        gradient: "from-orange-900 via-amber-900 to-black",
        border: "border-amber-700/50",
        text: "text-amber-500",
        bgIcon: "bg-amber-900/20",
        glow: "bg-amber-600/10",
        icon: <Medal className="w-5 h-5 text-amber-500" />
    };

    if (level >= 3 && level < 5) {
        tierConfig = {
            name: "Silver",
            gradient: "from-gray-600 via-gray-800 to-black",
            border: "border-gray-400/50",
            text: "text-gray-300",
            bgIcon: "bg-gray-700/30",
            glow: "bg-gray-400/10",
            icon: <Star className="w-5 h-5 text-gray-300" />
        };
    } else if (level >= 5 && level < 10) {
        tierConfig = {
            name: "Gold",
            gradient: "from-yellow-600 via-yellow-800 to-black",
            border: "border-yellow-500/50",
            text: "text-yellow-400",
            bgIcon: "bg-yellow-900/20",
            glow: "bg-yellow-500/20",
            icon: <Trophy className="w-5 h-5 text-yellow-400" />
        };
    } else if (level >= 10) {
        tierConfig = {
            name: "Diamond",
            gradient: "from-cyan-900 via-blue-900 to-black",
            border: "border-cyan-500/50",
            text: "text-cyan-400",
            bgIcon: "bg-cyan-900/20",
            glow: "bg-cyan-500/20",
            icon: <Crown className="w-5 h-5 text-cyan-400" />
        };
    }

    return (
        <div
            ref={ref}
            // FIXED WIDTH enforced for consistent "print" output
            className={`bg-gradient-to-br ${tierConfig.gradient} p-6 rounded-xl border ${tierConfig.border} shadow-2xl relative overflow-hidden group mx-auto`}
            style={{
                width: '400px',
                height: '240px',
                minWidth: '400px', // Prevent shrinking
                minHeight: '240px'
            }}
        >
            {/* Efeito de brilho no fundo */}
            <div className={`absolute top-0 right-0 w-48 h-48 ${tierConfig.glow} rounded-full blur-3xl -mr-10 -mt-10`}></div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full shadow-lg ${tierConfig.bgIcon} backdrop-blur-sm`}>
                        {tierConfig.icon}
                    </div>
                    <div className="flex flex-col items-start gap-2">
                        <span className={`${tierConfig.text} font-bold uppercase tracking-wider text-xs sm:text-sm leading-none`}>
                            Cartão Fidelidade • {tierConfig.name}
                        </span>
                        {showLevel && (
                            <span className="text-[10px] text-white/60 font-medium bg-white/5 px-2 py-0.5 rounded-full border border-white/5 tracking-wider">
                                NÍVEL {level}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right">
                    <h3 className="text-white font-bold text-base tracking-wide">{String(client.name).split(" ")[0]}</h3>
                    <span className="text-xs text-white/40 font-mono">#{phoneSuffix}</span>
                </div>
            </div>

            {/* Grid de Carimbos */}
            <div className="grid grid-cols-5 gap-4 relative z-10 mb-5 px-2">
                {Array.from({ length: 10 }).map((_, index) => {
                    const isStamped = index < visitsInCycle;

                    return (
                        <div
                            key={index}
                            className={`
                                aspect-square rounded-full flex items-center justify-center border-2 transition-all duration-500 relative
                                ${isStamped
                                    ? `${tierConfig.border} ${tierConfig.bgIcon} shadow-[0_0_10px_rgba(255,255,255,0.1)] scale-105`
                                    : "border-white/10 bg-black/20"}
                            `}
                        >
                            {isStamped ? (
                                tierConfig.icon // Repeats the tier icon as the stamp
                            ) : (
                                <span className="text-[10px] text-white/30 font-bold">{index + 1}</span>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-between items-center text-xs relative z-10 border-t border-white/10 pt-3 mt-auto">
                <span className="text-white/40 font-medium">
                    {level >= 10 ? "Você é uma lenda!" : "Complete 10 e suba de nível!"}
                </span>
                <div className="flex gap-1" title={`Nível Atual: ${level}`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < (level > 5 ? 5 : level) ? tierConfig.text.replace('text-', 'bg-') : "bg-gray-800"}`}></div>
                    ))}
                </div>
            </div>
        </div>
    );
});

export default LoyaltyCard;
