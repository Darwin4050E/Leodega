import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import Protected from './routes/Protected'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import PublishStoreRoomScreen from './screens/PublishStoreRoom/PublishStoreRoomScreen'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route element={<Protected />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/publicar" element={<PublishStoreRoomScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
