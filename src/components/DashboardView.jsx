import React, { useEffect, useState, useCallback } from "react";
import { DollarSign, TrendingUp, Calendar, BarChart3 } from "lucide-react"; // Removed 'Users' unused import
import { getDashboardStats } from "../services/queueService";
import GoalConfigModal from "./modals/GoalConfigModal";

export default function DashboardView({ userId, user }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showGoalModal, setShowGoalModal] = useState(false);

    const loadStats = useCallback(async () => {
        setLoading(true);
        const data = await getDashboardStats(userId);
        setStats(data);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        if (userId) loadStats();
    }, [userId, loadStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="text-center text-gray-400 py-10">
                Erro ao carregar estatísticas.
            </div>
        );
    }

    // Calcular Ticket Médio (Mensal)
    const avgTicket = stats.month.clients > 0
        ? stats.month.revenue / stats.month.clients
        : 0;

    // Calcular Crescimento (vs Mês Anterior)
    const revenueGrowth = stats.lastMonth.revenue > 0
        ? ((stats.month.revenue - stats.lastMonth.revenue) / stats.lastMonth.revenue) * 100
        : 0;

    const isPositiveGrowth = revenueGrowth >= 0;

    // Ordenar serviços por receita
    const topServices = Object.entries(stats.services)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 5);

    // Encontrar maior receita diária para escalar o gráfico
    const maxDailyRevenue = Math.max(...Object.values(stats.dailyRevenue), 1);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-amber-500" />
                    Dashboard Financeiro
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowGoalModal(true)}
                        className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                    >
                        <TrendingUp className="w-4 h-4" /> Metas
                    </button>
                    <button
                        onClick={loadStats}
                        className="text-sm text-gray-400 hover:text-white transition-colors px-2"
                    >
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Cards Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 30 Dias + Comparativo */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-500" />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${isPositiveGrowth ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {isPositiveGrowth ? '+' : ''}{revenueGrowth.toFixed(0)}%
                        </span>
                    </div>
                    <div className="relative z-10">
                        <span className="text-xs font-medium text-gray-400 block mb-1">Faturamento (30d)</span>
                        <h3 className="text-3xl font-bold text-white mb-1">
                            R$ {stats.month.revenue.toFixed(2)}
                        </h3>
                        <p className="text-xs text-gray-500 mb-1">
                            vs R$ {stats.lastMonth.revenue.toFixed(2)} anterior
                        </p>
                        <p className="text-xs text-gray-400">
                            {stats.month.clients} atendimentos
                        </p>
                    </div>
                </div>

                {/* Meta Diária */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Meta Diária
                        </span>
                    </div>
                    {user?.dailyGoal ? (
                        <>
                            <div className="flex items-end gap-2 mb-2">
                                <h3 className="text-2xl font-bold text-white">
                                    {Math.min(100, ((stats.today.revenue / parseFloat(user.dailyGoal)) * 100)).toFixed(0)}%
                                </h3>
                                <span className="text-xs text-gray-400 mb-1">
                                    de {parseFloat(user.dailyGoal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min(100, (stats.today.revenue / parseFloat(user.dailyGoal)) * 100)}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-gray-400 mt-2">
                                Hoje: R$ {stats.today.revenue.toFixed(2)}
                            </p>
                        </>
                    ) : (
                        <div className="text-center py-2 h-full flex flex-col justify-center">
                            <p className="text-gray-400 text-xs">Defina uma meta diária!</p>
                        </div>
                    )}
                </div>

                {/* Ticket Médio (Mensal) */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-500/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Ticket Médio
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1 truncate" title={`R$ ${avgTicket.toFixed(2)}`}>
                        R$ {avgTicket.toFixed(2)}
                    </h3>
                    <p className="text-sm text-gray-400">
                        por cliente
                    </p>
                </div>

                {/* Meta Mensal */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-purple-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Meta Mensal
                        </span>
                    </div>
                    {user?.monthlyGoal ? (
                        <>
                            <div className="flex items-end gap-2 mb-2">
                                <h3 className="text-2xl font-bold text-white">
                                    {Math.min(100, ((stats.month.revenue / parseFloat(user.monthlyGoal)) * 100)).toFixed(0)}%
                                </h3>
                                <span className="text-xs text-gray-400 mb-1">
                                    de {parseFloat(user.monthlyGoal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                    className="bg-purple-500 h-2 rounded-full transition-all duration-1000"
                                    style={{ width: `${Math.min(100, (stats.month.revenue / parseFloat(user.monthlyGoal)) * 100)}%` }}
                                ></div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-2 h-full flex flex-col justify-center">
                            <p className="text-gray-400 text-xs">Defina uma meta mensal!</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Fidelidade (Novos vs Recorrentes) - Mover para cá para caber os 4 cards de topo */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Fidelidade (Mês)
                        </span>
                    </div>
                    <div className="flex items-end gap-3">
                        <div>
                            <p className="text-xs text-gray-400">Novos</p>
                            <h3 className="text-xl font-bold text-white">{stats.loyalty.new}</h3>
                        </div>
                        <div className="h-8 w-px bg-gray-700"></div>
                        <div>
                            <p className="text-xs text-gray-400">Retorno</p>
                            <h3 className="text-xl font-bold text-white">{stats.loyalty.recurring}</h3>
                        </div>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 mt-3 flex overflow-hidden">
                        <div className="bg-blue-500 h-full" style={{ width: `${(stats.loyalty.new / (stats.loyalty.new + stats.loyalty.recurring || 1)) * 100}%` }}></div>
                        <div className="bg-amber-500 h-full" style={{ width: `${(stats.loyalty.recurring / (stats.loyalty.new + stats.loyalty.recurring || 1)) * 100}%` }}></div>
                    </div>
                </div>

                {/* Métodos de Pagamento */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-6">Métodos de Pagamento</h3>
                    {stats.paymentMethods && Object.keys(stats.paymentMethods).length > 0 ? (
                        <div className="flex items-center gap-6">
                            {/* Gráfico de Pizza CSS Simplificado */}
                            <div className="relative w-32 h-32 rounded-full flex-shrink-0"
                                style={{
                                    background: `conic-gradient(
                                        #10B981 0% ${(stats.paymentMethods.pix || 0) / stats.month.clients * 100}%,
                                        #3B82F6 ${(stats.paymentMethods.pix || 0) / stats.month.clients * 100}% ${(stats.paymentMethods.pix || 0) / stats.month.clients * 100 + (stats.paymentMethods.money || 0) / stats.month.clients * 100}%,
                                        #F59E0B ${(stats.paymentMethods.pix || 0) / stats.month.clients * 100 + (stats.paymentMethods.money || 0) / stats.month.clients * 100}% 100%
                                    )`
                                }}
                            >
                                <div className="absolute inset-4 bg-gray-800 rounded-full"></div>
                            </div>

                            <div className="space-y-3 flex-1">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                        <span className="text-gray-300">Pix</span>
                                    </div>
                                    <span className="text-white font-bold">{stats.paymentMethods.pix || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                        <span className="text-gray-300">Dinheiro</span>
                                    </div>
                                    <span className="text-white font-bold">{stats.paymentMethods.money || 0}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                        <span className="text-gray-300">Cartão</span>
                                    </div>
                                    <span className="text-white font-bold">{stats.paymentMethods.card || 0}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-6">Sem dados de pagamento ainda.</p>
                    )}
                </div>
            </div>

            {/* Gráfico de Receita (CSS Puro) - Mover para baixo para ter uma linha completa */}
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 mt-6">
                <h3 className="text-lg font-bold text-white mb-6">Faturamento (Últimos 7 dias)</h3>
                <div className="flex justify-between h-48 gap-2">
                    {Object.entries(stats.dailyRevenue).map(([date, value]) => {
                        const heightPercentage = (value / maxDailyRevenue) * 100;
                        const day = date.split('/')[0]; // Pegar apenas o dia
                        return (
                            <div
                                key={date}
                                className="flex flex-col items-center gap-2 flex-1 h-full group cursor-pointer outline-none"
                                tabIndex={0}
                                role="button"
                                aria-label={`Faturamento do dia ${day}: R$ ${value.toFixed(2)}`}
                            >
                                <div className="w-full bg-gray-700/50 rounded-t-lg relative flex-1 flex items-end">
                                    <div
                                        className="w-full bg-amber-500 rounded-t-lg transition-all duration-500 group-hover:bg-amber-400"
                                        style={{ height: `${heightPercentage}%` }}
                                    ></div>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 border border-gray-700 shadow-xl">
                                        R$ {value.toFixed(2)}
                                        {/* Seta do tooltip */}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-400">{day}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <GoalConfigModal
                show={showGoalModal}
                onClose={() => setShowGoalModal(false)}
            />
        </div>
    );
}
