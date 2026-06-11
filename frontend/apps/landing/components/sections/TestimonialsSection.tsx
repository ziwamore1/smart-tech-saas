'use client';

import SectionHeading from '@/components/ui/SectionHeading';
import TestimonialCard from '@/components/ui/TestimonialCard';

const testimonials = [
  {
    quote: 'SMART_TECH has transformed how we manage our school. The AI Tutor feature alone has improved our students\' performance by 30%. The platform is intuitive and our teachers adopted it immediately.',
    name: 'Dr. Michael Banda',
    role: 'School Director',
    school: 'Lusaka International School',
    initials: 'MB',
    color: '#0F4C81',
  },
  {
    quote: 'The automated report card generation saves us weeks of work every term. Parents love the instant access to their children\'s progress. This is exactly what Zambian schools need.',
    name: 'Sarah Mulenga',
    role: 'Head Teacher',
    school: 'Kitwe Girls Secondary School',
    initials: 'SM',
    color: '#00AEEF',
  },
  {
    quote: 'As a parent, I can now track my child\'s attendance, grades, and communicate with teachers in real-time. The peace of mind this platform provides is invaluable.',
    name: 'John Chisala',
    role: 'Parent',
    school: 'Ndola Private School',
    initials: 'JC',
    color: '#00C896',
  },
];

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-surface">
      <div className="container-main">
        <SectionHeading
          title="Trusted by Educators"
          subtitle="Hear from school leaders, teachers, and parents who use SMART_TECH every day."
        />
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {testimonials.map((t, i) => (
            <TestimonialCard key={i} {...t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
