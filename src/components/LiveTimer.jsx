import React, { useState, useEffect } from 'react';
import { getWaitingTime } from '../utils/helpers';

const LiveTimer = ({ joinedAt }) => {
    const [time, setTime] = useState(getWaitingTime(joinedAt));

    useEffect(() => {
        // Atualiza imediatamente ao montar
        setTime(getWaitingTime(joinedAt));

        const interval = setInterval(() => {
            setTime(getWaitingTime(joinedAt));
        }, 60000); // Atualiza a cada minuto

        return () => clearInterval(interval);
    }, [joinedAt]);

    return <span>{time}</span>;
};

export default LiveTimer;
