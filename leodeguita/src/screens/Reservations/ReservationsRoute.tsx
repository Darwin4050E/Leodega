import { useAuth } from '../../auth/useAuth'
import LandlordReservationsScreen from './LandlordReservationsScreen'
import ReservationsScreen from './ReservationsScreen'

/** `/reservas` shows each role its own list: rentals for a tenant, received bookings for a gestor. */
export default function ReservationsRoute() {
  const { user } = useAuth()
  return user?.role === 'landlord' ? <LandlordReservationsScreen /> : <ReservationsScreen />
}
