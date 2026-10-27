import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ActiveContextProvider } from './context/ActiveContextProvider'
import Protected from './routes/Protected'
import RolesOnly from './routes/RolesOnly'
import TenantOnly from './routes/TenantOnly'
import LoginScreen from './screens/LoginScreen'
import RoleHome from './routes/RoleHome'
import PublishStoreRoomScreen from './screens/PublishStoreRoom/PublishStoreRoomScreen'
import MyStoreRoomsScreen from './screens/MyStoreRooms/MyStoreRoomsScreen'
import MyStoreRoomDetailScreen from './screens/MyStoreRooms/MyStoreRoomDetailScreen'
import StoreRoomCatalogScreen from './screens/StoreRoomCatalog/StoreRoomCatalogScreen'
import StoreRoomDetailScreen from './screens/StoreRoomDetail/StoreRoomDetailScreen'
import ProfileScreen from './screens/Profile/ProfileScreen'
import ReservationsRoute from './screens/Reservations/ReservationsRoute'
import SelectCompanyScreen from './screens/SelectCompany/SelectCompanyScreen'

export default function App() {
  return (
    <AuthProvider>
      <ActiveContextProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route element={<Protected />}>
              <Route path="/" element={<RoleHome />} />
              <Route path="/publicar" element={<PublishStoreRoomScreen />} />
              <Route path="/mis-bodegas" element={<MyStoreRoomsScreen />} />
              <Route element={<RolesOnly roles={['landlord']} />}>
                <Route path="/mis-bodegas/:id" element={<MyStoreRoomDetailScreen />} />
              </Route>
              <Route element={<TenantOnly />}>
                <Route path="/bodegas" element={<StoreRoomCatalogScreen />} />
                <Route path="/bodegas/:id" element={<StoreRoomDetailScreen />} />
                <Route path="/empresa" element={<SelectCompanyScreen />} />
              </Route>
              <Route element={<RolesOnly roles={['tenant', 'landlord']} />}>
                <Route path="/reservas" element={<ReservationsRoute />} />
                <Route path="/perfil" element={<ProfileScreen />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ActiveContextProvider>
    </AuthProvider>
  )
}
