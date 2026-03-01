import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import EventsSection from "@/components/EventsSection";
import PrizesSection from "@/components/PrizesSection";
import RegistrationForm from "@/components/RegistrationForm";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <AboutSection />
    <EventsSection />
    <PrizesSection />
    <RegistrationForm />
    <ContactSection />
    <Footer />
  </div>
);

export default Index;
