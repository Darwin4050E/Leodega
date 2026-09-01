import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import './App.css'
import Header from './Components/Header'
import Hero from './Components/Hero'
import Work from './Components/Work'
import Choose from './Components/Choose'
import PopularStorage from './Components/PopularStorage'
import Testimonial from './Components/Testimonial'
import Footer from './Components/Footer'
import Login from './Components/login'
import Register from './Components/Register'
import PreguntaInicio2 from './Pages/Components/PreguntaInicio2'
import PreguntaInicio3 from './Pages/Components/PreguntaInicio3'
import NewPassword from "./Pages/NewPassword";

import PreguntaInicio4 from './Pages/Components/PreguntaInicio4'
import PreguntaInicio5 from './Pages/Components/PreguntaInicio5'
import PreguntaInicio6 from './Pages/Components/PreguntaInicio6'
import PreguntaInicio7 from './Pages/Components/PreguntaInicio7'
import VerifyCode from './Components/VerifyCode'
import ResetPassword from './Pages/ResetPassword'
import Decision from './Components/Decision'
import BodegasAdmin from "./Dashboard/BodegasAdmin";
import BodegasArrendador from "./Dashboard/BodegasArrendador";
import Layout from './Dashboard/Layout';
import Mensajes from './Dashboard/Mensajes'
import Solicitudes from './Dashboard/Solicitudes'
import Calendario from './Dashboard/Calendario'
import Settings from './Dashboard/Settings'
import PreguntaInicio1 from './Pages/Components/PreguntaInicio1'
import Cancellation from './Components/Cancellation'
import LeodegaUI from './Components/LeodegaUI'
import Report from './Components/Report'
import Storage from './Dashboard/Tendant/Storage'
import Status from './Components/Status'
import Resolution from './Components/Resolution'
import Consulta from './Components/Consulta'
import Detalles from './Dashboard/Detalles'
import Reportes from './Dashboard/Reportes'
import SolicitudesL from './Dashboard/SolicitudesL'
import Protected from './Routes/Protected'
import Role from './Routes/Role'
import PagePrincipal from './Dashboard/Tendant/PagePrincipal'
import CalendarioTendant from './Dashboard/Tendant/CalendarioTendant'

function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/verifyCode" element={<VerifyCode />} />
        <Route path="/login" element={<Login />} />
        <Route path="/preguntainicio1" element={<PreguntaInicio1 />} />
        <Route path="/preguntainicio2" element={<PreguntaInicio2 />} />
        <Route path="/preguntainicio3" element={<PreguntaInicio3 />} />
        <Route path="/decision" element={<Decision />} />
        <Route path="/resetpassword" element={<ResetPassword />} />
        <Route path="/reset-password" element={<NewPassword />} />
        <Route path="/preguntainicio4" element={<PreguntaInicio4 />} />
        <Route path="/preguntainicio5" element={<PreguntaInicio5 />} />
        <Route path="/preguntainicio6" element={<PreguntaInicio6 />} />
        <Route path="/preguntainicio7" element={<PreguntaInicio7 />} />
        <Route element={<Protected />}>
          <Route element={<Layout />}>
            {/* ROLES PROTEGIDOS */}
            <Route element={<Role allowed={["landlord"]} />}>
              <Route path="/arrendador/bodegas" element={<BodegasArrendador />} />
              <Route path="/arrendador/leodega/:id" element={<LeodegaUI />}
              />
            </Route>
            <Route element={<Role allowed={["admin"]} />}>
              <Route path="/admin/bodegas" element={<BodegasAdmin />} />
              <Route path="/admin/solicitudes" element={<Solicitudes />} />
              
            </Route>

            <Route element={<Role allowed={["admin", "landlord"]} />}>
              
              <Route path="/admin/mensajes" element={<Mensajes />} />
              <Route path="/admin/settings" element={<Settings />} />
              <Route path="/admin/calendario" element={<Calendario />} />
              
              <Route path="/arrendador/mensajes" element={<Mensajes />} />
              <Route path="/arrendador/solicitudes" element={<SolicitudesL />} />
              <Route path="/arrendador/settings" element={<Settings />} />
              <Route path="/arrendador/calendario" element={<Calendario />} />
            </Route>


          </Route>
        </Route>

        <Route path="/leodega/:id" element={<LeodegaUI />} />
        <Route path="/reportIncident/:id" element={<Report />} />
        <Route path="/cancellation" element={<Cancellation />} />
        <Route path="/storage" element={<Storage />} />
        <Route path="/  " element={<Status />} />
        <Route path="/resolution" element={<Resolution />} />
        <Route path="/consulta" element={<Consulta />} />
        <Route path="/detalles/:id" element={<Detalles />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/" element={
          <>
            <Header />
            <Hero />
            <Work />
            <Choose />
            <PopularStorage />
            <Testimonial />
            <Footer />
          </>
        } />
        <Route path="/arrendatario/dashboard" element={<PagePrincipal />} />
        <Route path="/arrendatario/mensajes" element={<Mensajes />} />
        <Route path="/arrendatario/calendario" element={<CalendarioTendant />} />
      </Routes>
    </Router>
    </AuthProvider>
  )
}

export default App
