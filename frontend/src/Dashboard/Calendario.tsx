import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getLandlordReservations, type LandlordReservation } from '../services/reservations';

type CalendarEvent = {
    id: number;
    title: string;
    subtitle?: string;
    date: Date;
    hour: number;
    color: string;
    allDay?: boolean;
};


const Calendario = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month');

    const [events, setEvents] = useState<CalendarEvent[]>([]);


    useEffect(() => {
        const fetchReservations = async () => {
            try {
                const { data } = await getLandlordReservations();

                const calendarEvents: CalendarEvent[] = [];

                data.forEach((reservation: LandlordReservation) => {
                    const start = new Date(reservation.start_date);
                    const end = new Date(reservation.end_date);

                    for (
                        let d = new Date(start);
                        d <= end;
                        d.setDate(d.getDate() + 1)
                    ) {
                        if (reservation.status !== 'confirmed') return;

                        const roomTitle = reservation.storeRooms?.title ?? 'Bodega';
                        const tenantName = reservation.tenants?.user
                            ? `${reservation.tenants.user.name} ${reservation.tenants.user.lastname}`
                            : 'Arrendatario';

                        calendarEvents.push({
                            id: reservation.id,
                            title: roomTitle,
                            subtitle: tenantName,
                            date: new Date(d),
                            hour: 9,
                            allDay: true,
                            color: 'bg-green-200 border-green-400',
                        });
                    }
                });

                setEvents(calendarEvents);
            } catch (error) {
                console.error('Error cargando reservas', error);
            }
        };

        fetchReservations();
    }, []);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const startingDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
        const prevMonthDays = new Date(year, month, 0).getDate();
        const days = [];

        for (let i = startingDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(year, month - 1, prevMonthDays - i) });
        }

        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ day: i, isCurrentMonth: true, date: new Date(year, month, i) });
        }

        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, isCurrentMonth: false, date: new Date(year, month + 1, i) });
        }

        return days;
    };

    const getEventsForDate = (date: Date) => {
        return events.filter(e =>
            e.date.getDate() === date.getDate() &&
            e.date.getMonth() === date.getMonth() &&
            e.date.getFullYear() === date.getFullYear()
        );
    };

    const getWeekDays = () => {
        const curr = new Date(currentDate);
        const first = curr.getDate() - curr.getDay() + 1;
        return Array.from({ length: 7 }, (_, i) => new Date(curr.getFullYear(), curr.getMonth(), first + i));
    };

    const navigate = (direction: number) => {
        const newDate = new Date(currentDate);
        if (view === 'month') {
            newDate.setMonth(currentDate.getMonth() + direction);
        } else if (view === 'week') {
            newDate.setDate(currentDate.getDate() + (7 * direction));
        } else {
            newDate.setDate(currentDate.getDate() + direction);
        }
        setCurrentDate(newDate);
    };
    const changeView = (newView: string) => {
        setView(newView);
        if (newView === 'day' || newView === 'week') {
            setCurrentDate(new Date());
        }
    };
    const getHeaderText = () => {
        if (view === 'month') {
            return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        }
        if (view === 'week') {
            const [start, ...rest] = getWeekDays();
            const end = rest[rest.length - 1];
            return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${currentDate.getFullYear()}`;
        }
        return `${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    };

    const DayView = () => (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 p-3 border-b border-gray-200 text-center">
                <div className="text-xs text-gray-500">{dayNames[currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1]}</div>
                <div className="text-2xl font-semibold">{currentDate.getDate()}</div>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
                {hours.map(hour => (
                    <div key={hour} className="flex border-b border-gray-100">
                        <div className="w-20 p-2 text-xs text-gray-500 text-right">
                            {hour.toString().padStart(2, '0')}:00
                        </div>
                        <div className="flex-1 p-2 min-h-[60px]">
                            {getEventsForDate(currentDate).filter(e => e.allDay || e.hour === hour).map(event => (
                                <div key={event.id} className={`text-sm px-3 py-2 rounded border-l-4 ${event.color} mb-1`}>
                                    <div className="font-medium">{event.title}</div>
                                    {event.subtitle && (
                                        <div className="text-xs text-gray-600">
                                            {event.subtitle}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
    const WeekView = () => {
        const weekDays = getWeekDays();
        return (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-8 border-b border-gray-200">
                    <div className="p-3"></div>
                    {weekDays.map((day, idx) => (
                        <div key={idx} className="p-3 text-center border-l border-gray-200">
                            <div className="text-xs text-gray-500">{dayNames[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                            <div className={`text-lg font-semibold ${day.toDateString() === new Date().toDateString() ? 'bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>
                                {day.getDate()}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="overflow-y-auto max-h-[600px]">
                    {hours.map(hour => (
                        <div key={hour} className="grid grid-cols-8 border-b border-gray-100">
                            <div className="p-2 text-xs text-gray-500 text-right">
                                {hour.toString().padStart(2, '0')}:00
                            </div>
                            {weekDays.map((day, idx) => (
                                <div key={idx} className="p-2 min-h-[60px] border-l border-gray-100">
                                    {getEventsForDate(day).filter(e => e.allDay || e.hour === hour).map(event => (
                                        <div key={event.id} className={`text-xs px-2 py-1 rounded border-l-4 ${event.color} mb-1`}>
                                            <div className="font-medium">{event.title}</div>
                                            {event.subtitle && (
                                                <div className="text-[10px] text-gray-600 leading-tight">
                                                    {event.subtitle}
                                                </div>
                                            )}
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
        <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50">
                {dayNames.map(day => (
                    <div key={day} className="p-3 text-center text-xs font-medium text-gray-600 border-b border-r border-gray-200 last:border-r-0">
                        {day}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7">
                {getDaysInMonth().map((dayInfo, index) => {
                    const isToday = dayInfo.date.toDateString() === new Date().toDateString();
                    return (
                        <div key={index} className={`min-h-[100px] p-2 border-b border-r border-gray-200 last:border-r-0 ${dayInfo.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'}`}
                            style={{ background: dayInfo.isCurrentMonth ? 'white' : 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.02) 5px, rgba(0,0,0,0.02) 10px)' }}>
                            <div className="flex justify-end mb-1">
                                <span className={`text-sm ${dayInfo.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'} ${isToday ? 'bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                                    {dayInfo.day}
                                </span>
                            </div>
                            <div className="space-y-1">
                                {getEventsForDate(dayInfo.date).map(event => (
                                    <div key={event.id} className={`text-xs px-2 py-1 rounded border-l-4 ${event.color}`}>
                                        <div className="font-medium truncate">{event.title}</div>
                                        {event.subtitle && (
                                            <div className="text-[10px] text-gray-500 truncate">
                                                {event.subtitle}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
    return (
        <div className="mb-6 pl-8 pt-10 mt-[-10px] pr-8 bg-[#f5f6fa] min-h-screen">
            <h1 className="text-2xl font-semibold text-gray-900 pb-3">Calendario</h1>
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
                        Today
                    </button>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-md">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-medium min-w-[180px] text-center">{getHeaderText()}</h2>
                        <button onClick={() => navigate(1)} className="p-2 hover:bg-gray-100 rounded-md">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {['day', 'week', 'month'].map(v => (
                            <button key={v} onClick={() => changeView(v)}
                                className={`px-4 py-2 text-sm rounded-md capitalize ${view === v ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'}`}>
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
                {view === 'month' && <MonthView />}
                {view === 'week' && <WeekView />}
                {view === 'day' && <DayView />}
            </div>
        </div>
    );
};
export default Calendario;