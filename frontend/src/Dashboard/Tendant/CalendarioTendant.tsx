import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import HeaderTendant from '../../Components/HeaderTendant';
import api from '../../api/axios';

/* =======================
   TIPOS
======================= */
type CalendarEvent = {
    id: string;
    title: string;
    date: Date;
    hour: number;
    color: string;
    allDay?: boolean;
};

type CalendarDay = {
    day: number;
    isCurrentMonth: boolean;
    date: Date;
};

type Reservation = {
    id: number;
    start_date: string;
    end_date: string;
    status: 'confirmed' | 'pending' | 'cancelled';
    storeRooms?: {
        title: string;
    };
};

/* =======================
   COMPONENTE
======================= */
const CalendarioTendant = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<' Día ' | ' Semana ' | ' Mes '>(' Mes ');
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    /* =======================
       CONSTANTES
    ======================= */
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    /* =======================
       API → EVENTOS
    ======================= */
    const reservationsToEvents = (reservations: Reservation[]): CalendarEvent[] => {
        const evts: CalendarEvent[] = [];

        reservations.forEach(res => {
            const start = new Date(res.start_date);
            const end = new Date(res.end_date);

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                evts.push({
                    id: `${res.id}-${d.toISOString()}`,
                    title: res.storeRooms?.title || 'Reserva',
                    date: new Date(d),
                    hour: 9,
                    allDay: true,
                    color:
                        res.status === 'confirmed'
                            ? 'bg-green-200 border-green-500'
                            : res.status === 'pending'
                                ? 'bg-yellow-200 border-yellow-500'
                                : 'bg-red-200 border-red-500'
                });
            }
        });

        return evts;
    };

    useEffect(() => {
        api.get<Reservation[]>('/tenant/reservations')
            .then(res => setEvents(reservationsToEvents(res.data)))
            .catch(err => console.error('Error cargando reservas', err));
    }, []);

    /* =======================
       HELPERS FECHAS
    ======================= */
    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const prevMonthDays = new Date(year, month, 0).getDate();
        const days: CalendarDay[] = [];

        for (let i = startingDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
        }

        while (days.length < 42) {
            const i = days.length - daysInMonth - startingDay + 1;
            days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const getEventsForDate = (date: Date) =>
        events.filter(e =>
            e.date.getDate() === date.getDate() &&
            e.date.getMonth() === date.getMonth() &&
            e.date.getFullYear() === date.getFullYear()
        );

    const getWeekDays = () => {
        const curr = new Date(currentDate);
        const first = curr.getDate() - curr.getDay() + 1;
        return Array.from({ length: 7 }, (_, i) =>
            new Date(curr.getFullYear(), curr.getMonth(), first + i)
        );
    };

    /* =======================
       NAVEGACIÓN
    ======================= */
    const navigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (view === ' Mes ') newDate.setMonth(currentDate.getMonth() + direction);
        if (view === ' Semana ') newDate.setDate(currentDate.getDate() + direction * 7);
        if (view === ' Día ') newDate.setDate(currentDate.getDate() + direction);
        setCurrentDate(newDate);
    };

    const getHeaderText = () => {
        if (view === ' Mes ') return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        if (view === ' Semana ') {
            const [start, ...rest] = getWeekDays();
            const end = rest[rest.length - 1];
            return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${currentDate.getFullYear()}`;
        }
        return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    };

    /* =======================
       VISTAS (MISMO DISEÑO)
    ======================= */
    const DayView = () => {
        const dayIndex = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;

        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
                <div className="bg-gray-50 p-3 border-b text-center">
                    <div className="text-xs text-gray-500">{dayNames[dayIndex]}</div>
                    <div className="text-2xl font-semibold">{currentDate.getDate()}</div>
                </div>
                <div className="overflow-y-auto flex-1">
                    {hours.map(hour => (
                        <div key={hour} className="flex border-b">
                            <div className="w-20 p-2 text-xs text-gray-500 text-right">
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 p-2 min-h-[60px]">
                                {getEventsForDate(currentDate)
                                    .filter(e => e.allDay || e.hour === hour)
                                    .map(event => (
                                        <div key={event.id} className={`text-sm px-3 py-2 rounded border-l-4 ${event.color}`}>
                                            {event.title}
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const WeekView = () => {
        const weekDays = getWeekDays();

        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
                <div className="grid grid-cols-8 border-b">
                    <div className="p-3"></div>
                    {weekDays.map((day, idx) => {
                        const dayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
                        return (
                            <div key={idx} className="p-3 text-center border-l">
                                <div className="text-xs text-gray-500">{dayNames[dayIndex]}</div>
                                <div className="text-lg font-semibold">{day.getDate()}</div>
                            </div>
                        );
                    })}
                </div>
                <div className="overflow-y-auto flex-1">
                    {hours.map(hour => (
                        <div key={hour} className="grid grid-cols-8 border-b">
                            <div className="p-2 text-xs text-gray-500 text-right">
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            {weekDays.map((day, idx) => (
                                <div key={idx} className="p-2 min-h-[60px] border-l">
                                    {getEventsForDate(day)
                                        .filter(e => e.allDay || e.hour === hour)
                                        .map(event => (
                                            <div key={event.id} className={`text-xs px-2 py-1 rounded border-l-4 ${event.color}`}>
                                                {event.title}
                                            </div>
                                        ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const MonthView = () => (
        <div className="border border-gray-200 rounded-lg overflow-hidden h-full flex flex-col">
            <div className="grid grid-cols-7 bg-gray-50">
                {dayNames.map(day => (
                    <div key={day} className="p-3 text-center text-xs font-medium border-b border-r">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 flex-1">
                {getDaysInMonth().map((dayInfo, idx) => (
                    <div key={idx} className="p-2 border-b border-r">
                        <div className="text-sm text-right">{dayInfo.day}</div>
                        {getEventsForDate(dayInfo.date).map(event => (
                            <div key={event.id} className={`text-xs mt-1 px-2 py-1 rounded border-l-4 ${event.color}`}>
                                {event.title}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="w-full h-screen bg-[#f5f6fa] flex flex-col">
            <HeaderTendant />
            <div className="flex-1 p-6">
                <div className="bg-white rounded-lg shadow h-full flex flex-col">
                    <div className="p-6 flex items-center justify-between">
                        <button onClick={() => setCurrentDate(new Date())}>Hoy</button>
                        <div className="flex items-center gap-4">
                            <ChevronLeft onClick={() => navigate(-1)} />
                            <h2>{getHeaderText()}</h2>
                            <ChevronRight onClick={() => navigate(1)} />
                        </div>
                        <div className="flex gap-2">
                            {([' Día ', ' Semana ', ' Mes '] as const).map(v => (
                                <button key={v} onClick={() => setView(v)} className={view === v ? 'bg-blue-500 text-white px-3 py-1 rounded' : ''}>
                                    {v}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-hidden">
                        {view === ' Mes ' && <MonthView />}
                        {view === ' Semana ' && <WeekView />}
                        {view === ' Día ' && <DayView />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarioTendant;
