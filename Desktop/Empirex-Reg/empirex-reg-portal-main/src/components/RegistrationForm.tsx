import { motion } from "framer-motion";

const GOOGLE_FORM_URL = "https://forms.google.com/your-form-link-here";

const RegistrationForm = () => {
  return (
    <section id="register" className="py-20 px-4">
      <div className="container mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <h2 className="section-heading">Register Now</h2>
          <p className="text-center text-muted-foreground font-body text-lg mb-12">
            Secure your spot — ₹150 per person
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="glass-card p-8 md:p-10 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">📝</span>
          </div>
          <h3 className="font-display text-xl font-bold text-foreground">
            Register via Google Form
          </h3>
          <p className="text-muted-foreground font-body text-sm max-w-md mx-auto">
            Fill out the registration form and complete your payment of ₹150 via UPI (PhonePe / GPay / Paytm). 
            You'll receive a confirmation email after successful registration.
          </p>
          <div className="space-y-3">
            <a
              href={GOOGLE_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full py-3 bg-primary text-primary-foreground font-display font-bold text-sm md:text-base rounded-lg hover:opacity-90 transition-opacity animate-glow-pulse"
            >
              Open Registration Form — ₹150
            </a>
            <p className="text-xs text-muted-foreground font-body">
              Payment via UPI (PhonePe / GPay / Paytm) • Confirmation sent to your email
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default RegistrationForm;
