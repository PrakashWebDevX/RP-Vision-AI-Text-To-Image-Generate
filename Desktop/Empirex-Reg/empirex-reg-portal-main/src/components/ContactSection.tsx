import { motion } from "framer-motion";
import { Phone, Mail, MapPin } from "lucide-react";

const coordinators = [
  { name: "Arun Kumar", role: "Student Coordinator", phone: "+91 98765 43210", email: "arun@rvstech.edu" },
  { name: "Priya Sharma", role: "Student Coordinator", phone: "+91 98765 43211", email: "priya@rvstech.edu" },
  { name: "Karthik Raja", role: "Event Head", phone: "+91 98765 43212", email: "karthik@rvstech.edu" },
];

const ContactSection = () => (
  <section id="contact" className="py-20 px-4">
    <div className="container mx-auto max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
        <h2 className="section-heading">Contact Us</h2>
        <p className="text-center text-muted-foreground font-body text-lg mb-12">Reach out to our coordinators</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {coordinators.map((c, i) => (
          <motion.div
            key={c.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="glass-card-hover p-6 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-primary font-display font-bold text-lg">{c.name[0]}</span>
            </div>
            <h3 className="font-display text-base font-bold text-foreground">{c.name}</h3>
            <p className="text-primary text-xs font-body mb-3">{c.role}</p>
            <div className="space-y-1 text-sm text-muted-foreground font-body">
              <div className="flex items-center justify-center gap-2"><Phone className="w-3 h-3" />{c.phone}</div>
              <div className="flex items-center justify-center gap-2"><Mail className="w-3 h-3" />{c.email}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="glass-card p-6 text-center"
      >
        <MapPin className="w-6 h-6 text-primary mx-auto mb-2" />
        <p className="text-foreground font-body font-semibold">RVS Technical Campus</p>
        <p className="text-muted-foreground text-sm font-body">Coimbatore, Tamil Nadu, India</p>
        <p className="text-muted-foreground text-sm font-body">Room No 222 – Seminar Hall</p>
      </motion.div>
    </div>
  </section>
);

export default ContactSection;
