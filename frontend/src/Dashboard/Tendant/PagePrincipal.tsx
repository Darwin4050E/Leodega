import Footer from '../../Components/Footer'
import Testimonial from '../../Components/Testimonial'
import PopularStorage from '../../Components/PopularStorage'
import Choose from '../../Components/Choose'
import Work from '../../Components/Work'
import Hero from '../../Components/Hero'
import HeaderTendant from '../../Components/HeaderTendant'

function PagePrincipal() {
    return (
        <div>
            <HeaderTendant />
            <Hero />
            <Work />
            <Choose />
            <PopularStorage />
            <Testimonial />
            <Footer />
        </div>
    )
}

export default PagePrincipal;
