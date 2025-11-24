import React, { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Users, Calendar, BarChart3 } from "lucide-react";
import { getDashboardStats } from "../services/queueService";

export default function DashboardView() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        setLoading(true);
        const data = await getDashboardStats();
        setStats(data);
        setLoading(false);
    };

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
                <button
                    onClick={loadStats}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                    Atualizar
                </button>
            </div>

            {/* Cards Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Hoje */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <DollarSign className="w-6 h-6 text-green-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Hoje
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                        R$ {stats.today.revenue.toFixed(2)}
                    </h3>
                    <p className="text-sm text-gray-400">
                        {stats.today.clients} atendimentos
                    </p>
                </div>

                {/* 7 Dias */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg">
                            <Calendar className="w-6 h-6 text-blue-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            7 Dias
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                        R$ {stats.week.revenue.toFixed(2)}
                    </h3>
                    <p className="text-sm text-gray-400">
                        {stats.week.clients} atendimentos
                    </p>
                </div>

                {/* Ticket Médio (Mensal) */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-500/10 rounded-lg">
                            <TrendingUp className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 bg-gray-700 px-2 py-1 rounded">
                            Ticket Médio (30d)
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-1">
                        R$ {avgTicket.toFixed(2)}
                    </h3>
                    <p className="text-sm text-gray-400">
                        Baseado em {stats.month.clients} clientes
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Receita (CSS Puro) */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
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

                {/* Top Serviços */}
                <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                    <h3 className="text-lg font-bold text-white mb-6">Serviços Mais Populares</h3>
                    <div className="space-y-4">
                        {topServices.length === 0 ? (
                            <p className="text-gray-500 text-center">Sem dados suficientes.</p>
                        ) : (
                            topServices.map(([name, data], index) => (
                                <div key={name} className="relative">
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-white font-medium flex items-center gap-2">
                                            <span className="text-gray-500 w-4">{index + 1}.</span> {name}
                                        </span>
                                        <span className="text-gray-400">
                                            {data.count} cortes (R$ {data.revenue})
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2">
                                        <div
                                            className="bg-blue-500 h-2 rounded-full"
                                            style={{ width: `${(data.revenue / stats.month.revenue) * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
