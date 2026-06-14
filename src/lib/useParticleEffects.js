import { useCallback } from 'react';

export function useParticleEffects() {
  const spawnFloatingText = useCallback((text, x, y, color = 'text-orange-500', isCrit = false) => {
    const el = document.createElement('div');
    el.textContent = text;
    el.className = `fixed pointer-events-none z-50 font-black text-2xl ${color} animate-float-up ${isCrit ? 'text-4xl drop-shadow-[0_0_15px_rgba(234,88,12,0.8)] animate-shake' : ''}`;
    
    // Slight randomization of start position
    const offsetX = (Math.random() - 0.5) * 40;
    const offsetY = (Math.random() - 0.5) * 20;
    
    el.style.left = `${x + offsetX}px`;
    el.style.top = `${y + offsetY}px`;
    
    document.body.appendChild(el);
    
    // Cleanup after animation finishes (1s)
    setTimeout(() => {
      if (document.body.contains(el)) {
        document.body.removeChild(el);
      }
    }, 1000);
  }, []);

  const triggerScreenShake = useCallback(() => {
    const root = document.getElementById('root');
    if (root) {
      root.classList.remove('animate-shake');
      // trigger reflow
      void root.offsetWidth;
      root.classList.add('animate-shake');
      
      setTimeout(() => {
        root.classList.remove('animate-shake');
      }, 400);
    }
  }, []);

  const spawnSparks = useCallback((x, y) => {
    const colors = ['bg-yellow-400', 'bg-red-500', 'bg-blue-500', 'bg-purple-500', 'bg-green-400'];
    for (let i = 0; i < 15; i++) {
      const el = document.createElement('div');
      const color = colors[Math.floor(Math.random() * colors.length)];
      el.className = `fixed w-2 h-2 rounded-full pointer-events-none z-50 ${color}`;
      
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      
      // Random velocity
      const vx = (Math.random() - 0.5) * 200;
      const vy = (Math.random() - 0.5) * 200;
      
      el.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
      ], {
        duration: 600 + Math.random() * 400,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
      });
      
      document.body.appendChild(el);
      
      setTimeout(() => {
        if (document.body.contains(el)) document.body.removeChild(el);
      }, 1000);
    }
  }, []);

  return { spawnFloatingText, triggerScreenShake, spawnSparks };
}
