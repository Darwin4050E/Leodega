import { Mail, Phone, MapPin, Facebook, Instagram, Youtube } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[#1E293B] text-gray-300 py-10 px-6 md:px-16">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 border-b border-gray-600 pb-8">
        {/* Logo & Contact Info */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-white rounded-md p-2">
              {/* Puedes reemplazar este texto por el logo real */}
              <span className="text-[#1E293B] font-bold">leodega</span>
            </div>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <MapPin size={16} className="mt-1" />
              25668 Hc 1, Glenallen, Alaska, 99588, USA
            </li>
            <li className="flex items-center gap-2">
              <Phone size={16} /> +603 4784 273 12
            </li>
            <li className="flex items-center gap-2">
              <Mail size={16} /> rentcars@gmail.com
            </li>
          </ul>
        </div>

        {/* Our Product */}
        <div>
          <h3 className="font-semibold text-white mb-3">Our Product</h3>
          <ul className="space-y-2 text-sm">
            <li>Career</li>
            <li>Car</li>
            <li>Packages</li>
            <li>Features</li>
            <li>Priceline</li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <h3 className="font-semibold text-white mb-3">Resources</h3>
          <ul className="space-y-2 text-sm">
            <li>Download</li>
            <li>Help Centre</li>
            <li>Guides</li>
            <li>Partner Network</li>
            <li>Cruises</li>
            <li>Developer</li>
          </ul>
        </div>

        {/* About + Social */}
        <div>
          <h3 className="font-semibold text-white mb-3">About Rentcars</h3>
          <ul className="space-y-2 text-sm mb-4">
            <li>Why choose us</li>
            <li>Our Story</li>
            <li>Investor Relations</li>
            <li>Press Center</li>
            <li>Advertise</li>
          </ul>

          <h3 className="font-semibold text-white mb-2">Follow Us</h3>
          <div className="flex gap-3">
            <a href="#" className="hover:text-white">
              <Facebook size={18} />
            </a>
            <a href="#" className="hover:text-white">
              <Instagram size={18} />
            </a>
            <a href="#" className="hover:text-white">
              <Youtube size={18} />
            </a>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="text-center text-xs text-gray-400 mt-6">
        Copyright © 2023 • Rentcars, All Rights Reserved
      </div>
    </footer>
  );
}

export default Footer;