import { Link } from 'react-router-dom';
import { Menu, X } from "lucide-react";
import { useState } from "react";
import logo from '../img/LOGO_H_1.png';

const Header = () => {
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    const toggleNabbar = () => {
        setMobileDrawerOpen(!mobileDrawerOpen);
    }

    const navItems = [
        { label: "Conviértete en inquilino", href: "#inquilino" },
        { label: "Bodegas populares", href: "#bodegas" },
        { label: "Cómo trabajamos", href: "#trabajamos" },
        { label: "Por qué escogernos", href: "#escogernos" },
    ];


  return (
    <nav className="sticky top-0 z-50 py-5 px-12 backdrop-blur-lg border-b border-neutral-300 bg-white">
      <div className="container px-4 mx-auto relative text-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center flex-shrink-0">
            <img className="h-10 w-50 mr-2" src={logo} alt="logo" />
          </div>
          <ul className='hidden lg:flex ml-14 space-x-12'>
            {navItems.map((item, index)=>(
                <li key={index}>
                    <a href={item.href}>{item.label}</a>
                </li>
            ))}
          </ul>

          <div className="hidden lg:flex justify-center space-x-6 items-center">
            <Link to="/login" className="py-2 px-3 border rounded-md w-35 text-center">
              Iniciar Sesión
            </Link>
            <Link
              to="/register"
              className="py-2 px-3 rounded-md text-white bg-leodega_p w-40 text-center"
            >
              Registrarse
            </Link>
          </div>


          <div className="lg:hidden md:flex-col justify-end">
            <button onClick={toggleNabbar}>
                {mobileDrawerOpen ? <X color='black' /> : <Menu color='black' />}
            </button>
          </div>
        </div>
        {mobileDrawerOpen && (
            <div className="fixed right-0 z-20 bg-white w-full flex flex-col justify-center items-center space-y-6 lg:hidden">
                <ul className="flex flex-col items-center space-y-6">
                    {navItems.map((items, index) => (
                        <li key={index} className='py-4'>
                            <a href={items.href}>{items.label}</a>
                        </li>
                    ))}
                </ul>
        <div className="flex space-x-6">
          <Link to="/login" onClick={() => setMobileDrawerOpen(false)} className='py-2 px-3 border rounded-md'>
            Iniciar Sesión
          </Link>
          <Link to="/register" onClick={() => setMobileDrawerOpen(false)} className="py-2 px-3 rounded-md text-white bg-leodega_p">
            Registrarse
          </Link>
        </div>
            </div>
        )}
      </div>
    </nav>
  );
};

export default Header;