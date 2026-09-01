import googlePlay from '../img/google_play.png';
import appStore from '../img/appstore.png';
import warehouseFront from '../img/bodega.png';
import backgroundShapes from "../img/LOGO_LEODEGAISO.png";



const Hero = () => {
  return (
    <section className="relative flex flex-col lg:flex-row items-center justify-between px-10 lg:px-28 py-20 overflow-hidden bg-white">
      
      {/* Fondo geométrico con opacidad baja */}
      <img
        src={backgroundShapes}
        alt="background shapes"
        className="absolute right-0 top-0 w-[30%] opacity-15 pointer-events-none select-none"
      />

      {/* Contenido principal */}
      <div className="relative z-10 flex-1 max-w-xl">
        <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Encuentra, bodegas y <br />
          rentalas{" "}
          <span className="text-blue-600 relative inline-block">
            Fácilmente
            <span className="absolute bottom-0 left-0 w-full h-[7px] bg-blue-300 rounded-full -z-10"></span>
          </span>
        </h1>

        <p className="text-gray-600 mb-8 text-lg">
          Accede a una bodega donde y cuando la necesites desde tu dispositivo
          iOS o Android.
        </p>

        {/* Botones de descarga */}
        <div className="flex gap-5">
          <img src={googlePlay} alt="Google Play" className="w-40 cursor-pointer" />
          <img src={appStore} alt="App Store" className="w-40 cursor-pointer" />
        </div>
      </div>

      {/* Imagen de la bodega */}
      <div className="relative z-10 flex-1 mt-16 lg:mt-0 flex justify-center">
        <img
          src={warehouseFront}
          alt="Warehouse"
          className="w-[90%] max-w-[700px] drop-shadow-2xl"
        />
      </div>
    </section>
  );
};

export default Hero;