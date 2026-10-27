import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ActiveContextProvider } from './context/ActiveContextProvider'
import Protected from './routes/Protected'
import TenantOnly from './routes/TenantOnly'
import LoginScreen from './screens/LoginScreen'
import RoleHome from './routes/RoleHome'
import PublishStoreRoomScreen from './screens/PublishStoreRoom/PublishStoreRoomScreen'
import MyStoreRoomsScreen from './screens/MyStoreRooms/MyStoreRoomsScreen'
import StoreRoomCatalogScreen from './screens/StoreRoomCatalog/StoreRoomCatalogScreen'
import StoreRoomDetailScreen from './screens/StoreRoomDetail/StoreRoomDetailScreen'
import ProfileScreen from './screens/Profile/ProfileScreen'
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
              <Route path="/bodegas" element={<StoreRoomCatalogScreen />} />
              <Route path="/bodegas/:id" element={<StoreRoomDetailScreen />} />
              <Route element={<TenantOnly />}>
                <Route path="/empresa" element={<SelectCompanyScreen />} />
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
