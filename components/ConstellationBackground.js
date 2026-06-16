'use client';

import { useEffect, useRef } from 'react';
import styles from './ConstellationBackground.module.css';

function getParticleCount(width) {
  if (width < 480) return 32;
  if (width < 768) return 48;
  if (width < 1024) return 62;
  return 78;
}

export default function ConstellationBackground({ className = '' }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

    const ctx = canvas.getContext('2d');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let isVisible = !document.hidden;

    const mouse = { x: -1000, y: -1000, active: false };
    const POINTER_RADIUS = 150;
    const CONNECT_DISTANCE = 135;
    const MOUSE_CONNECT_DISTANCE = 170;

    class Particle {
      constructor(w, h) {
        this.baseX = Math.random() * w;
        this.baseY = Math.random() * h;
        this.x = this.baseX;
        this.y = this.baseY;
        this.vx = (Math.random() - 0.5) * 0.32;
        this.vy = (Math.random() - 0.5) * 0.32;
        this.radius = Math.random() * 1.3 + 0.7;
        this.alpha = Math.random() * 0.3 + 0.45;
        this.phase = Math.random() * Math.PI * 2;
      }

      update(w, h, mousePos, time) {
        if (reducedMotion) {
          this.x = this.baseX + Math.sin(time * 0.00035 + this.phase) * 10;
          this.y = this.baseY + Math.cos(time * 0.00028 + this.phase) * 10;
          return;
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.x <= 0 || this.x >= w) this.vx *= -1;
        if (this.y <= 0 || this.y >= h) this.vy *= -1;

        this.x += (this.baseX - this.x) * 0.0018;
        this.y += (this.baseY - this.y) * 0.0018;

        if (!mousePos.active) return;

        const dx = mousePos.x - this.x;
        const dy = mousePos.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < POINTER_RADIUS) {
          const force = (1 - dist / POINTER_RADIUS) * 0.038;
          this.x += dx * force;
          this.y += dy * force;
        }
      }

      draw(context) {
        const glow = context.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.radius * 3.5
        );
        glow.addColorStop(0, `rgba(59, 130, 246, ${this.alpha * 0.28})`);
        glow.addColorStop(1, 'rgba(59, 130, 246, 0)');

        context.beginPath();
        context.arc(this.x, this.y, this.radius * 3.5, 0, Math.PI * 2);
        context.fillStyle = glow;
        context.fill();

        context.beginPath();
        context.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(37, 99, 235, ${this.alpha})`;
        context.fill();
      }
    }

    function initParticles() {
      const count = getParticleCount(width);
      particles = Array.from({ length: count }, () => new Particle(width, height));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    }

    function drawConnections() {
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          if (dist > CONNECT_DISTANCE) continue;

          let alpha = (1 - dist / CONNECT_DISTANCE) * 0.14;

          if (mouse.active) {
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const mouseDist = Math.hypot(mouse.x - midX, mouse.y - midY);
            if (mouseDist < MOUSE_CONNECT_DISTANCE) {
              alpha = Math.min(alpha + (1 - mouseDist / MOUSE_CONNECT_DISTANCE) * 0.38, 0.55);
            }
          }

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
          ctx.lineWidth = alpha > 0.34 ? 1.15 : 0.65;
          ctx.stroke();
        }
      }

      if (!mouse.active || reducedMotion) return;

      particles.forEach((particle) => {
        const dist = Math.hypot(mouse.x - particle.x, mouse.y - particle.y);
        if (dist > MOUSE_CONNECT_DISTANCE) return;

        const alpha = (1 - dist / MOUSE_CONNECT_DISTANCE) * 0.42;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(particle.x, particle.y);
        ctx.strokeStyle = `rgba(29, 78, 216, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    function animate(time) {
      animationId = requestAnimationFrame(animate);

      if (!isVisible) return;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        particle.update(width, height, mouse, time);
        particle.draw(ctx);
      });

      drawConnections();
    }

    function setPointer(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      mouse.x = clientX - rect.left;
      mouse.y = clientY - rect.top;
      mouse.active = true;
    }

    function clearPointer() {
      mouse.active = false;
      mouse.x = -1000;
      mouse.y = -1000;
    }

    function handleMouseMove(event) {
      setPointer(event.clientX, event.clientY);
    }

    function handleTouchMove(event) {
      if (!event.touches[0]) return;
      setPointer(event.touches[0].clientX, event.touches[0].clientY);
    }

    function handleVisibilityChange() {
      isVisible = !document.hidden;
    }

    resize();
    animationId = requestAnimationFrame(animate);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', clearPointer);
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', clearPointer);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', clearPointer);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', clearPointer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`.trim()} aria-hidden="true">
      <div className={styles.gradient} />
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
