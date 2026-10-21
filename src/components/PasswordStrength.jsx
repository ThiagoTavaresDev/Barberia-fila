import React from "react";
import { Check, Circle, AlertCircle } from "lucide-react";

const BAR_COLORS = ["", "bg-red-500", "bg-orange-500", "bg-green-500", "bg-green-600"];

// Medidor de força + lista de regras da senha (marca cada regra conforme é cumprida).
// `evaluation` é o resultado de evaluatePassword().
export default function PasswordStrength({ evaluation, hasValue }) {
    const { checks, problems, score, label } = evaluation;

    return (
        <div className="space-y-3" aria-live="polite">
            {hasValue && (
                <div>
                    <div className="flex gap-1.5" aria-hidden="true">
                        {[1, 2, 3, 4].map((level) => (
                            <span
                                key={level}
                                className={`h-1.5 flex-1 rounded-full transition-colors ${score >= level ? BAR_COLORS[score] : "bg-gray-600"}`}
                            />
                        ))}
                    </div>
                    <p className="text-sm text-ink mt-1">
                        Força da senha: <strong>{label}</strong>
                    </p>
                </div>
            )}

            <ul className="space-y-1.5">
                {checks.map((check) => (
                    <li key={check.id} className={`flex items-center gap-2 text-sm ${check.ok ? "text-ink" : "text-ink/80"}`}>
                        {check.ok
                            ? <Check className="w-4 h-4 text-green-500 shrink-0" aria-label="Cumprido" />
                            : <Circle className="w-4 h-4 text-gray-500 shrink-0" aria-label="Falta cumprir" />}
                        <span className={check.ok ? "font-medium" : ""}>{check.label}</span>
                    </li>
                ))}
            </ul>

            {problems.length > 0 && (
                <ul className="space-y-1.5" role="alert">
                    {problems.map((problem) => (
                        <li key={problem} className="flex items-start gap-2 text-sm text-ink">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <span>{problem}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
