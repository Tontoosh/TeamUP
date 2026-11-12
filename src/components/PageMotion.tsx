import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function PageMotion() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('has-entered');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06 });
    const nodes = document.querySelectorAll('.landing-section, .landing-cta');
    nodes.forEach(node => { node.classList.add('reveal-section'); observer.observe(node); });
    return () => { observer.disconnect(); nodes.forEach(node => node.classList.remove('reveal-section')); };
  }, [pathname]);
  return null;
}
