import React, { useEffect, useRef } from 'react';
import type { LoginWebFrameProps } from './LoginWebFrame';

// Scoped to the web login preview; shared authentication and native styles stay independent.
export default function LoginWebFrame({ brand, footer, children }: LoginWebFrameProps) {
  const identity = useRef<HTMLElement>(null);
  useEffect(() => {
    const panel = identity.current;
    if (!panel) return;
    const interactive = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => {
      frame = 0;
      panel.style.setProperty('--pointer-x', `${x}px`);
      panel.style.setProperty('--pointer-y', `${y}px`);
    };
    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; x = 0; y = 0; paint();
    };
    const move = (event: PointerEvent) => {
      if (!interactive.matches || event.pointerType !== 'mouse') return;
      const bounds = panel.getBoundingClientRect();
      x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 48;
      y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 48;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    panel.addEventListener('pointermove', move, { passive: true });
    panel.addEventListener('pointerleave', reset);
    interactive.addEventListener('change', reset);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      panel.removeEventListener('pointermove', move);
      panel.removeEventListener('pointerleave', reset);
      interactive.removeEventListener('change', reset);
    };
  }, []);
  return <main className="branchsuite-web-login">
    <style>{css}</style>
    <section ref={identity} className="login-identity">
      <div className="login-ambient" aria-hidden="true">
        <div className="login-orbit login-orbit-large" />
        <div className="login-orbit login-orbit-small" />
        <div className="login-ring login-ring-large" />
        <div className="login-ring login-ring-small" />
        <div className="login-light" />
      </div>
      <div className="login-identity-content">
        <div className="login-brand">{brand}</div>
        <div className="login-message">{footer}</div>
      </div>
    </section>
    <section className="login-form">{children}</section>
  </main>;
}

const css = `
.branchsuite-web-login {
  display: flex; flex: 1; min-height: 100vh; min-height: 100dvh; width: 100%;
  background: #f7f9fc; color: #171e2e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.branchsuite-web-login, .branchsuite-web-login * { box-sizing: border-box; }
.branchsuite-web-login .login-identity {
  position: relative; isolation: isolate; overflow: hidden; width: 46%; min-width: 0;
  padding: clamp(32px, 4vw, 72px); display: flex; flex-direction: column; justify-content: space-between;
  background: linear-gradient(150deg, #08162e 0%, #102653 56%, #1a3f9b 100%);
}
.branchsuite-web-login .login-ambient {
  position: absolute; inset: -32px; z-index: -1; pointer-events: none;
  transform: translate3d(var(--pointer-x, 0px), var(--pointer-y, 0px), 0);
  transition: transform 600ms cubic-bezier(.22, 1, .36, 1);
}
.branchsuite-web-login .login-light {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 65% 38%, rgba(65, 119, 255, .16), transparent 64%);
}
.branchsuite-web-login .login-ring {
  position: absolute; border: 1px solid rgba(168, 193, 255, .12); border-radius: 50%;
}
.branchsuite-web-login .login-ring-large {
  width: 680px; height: 680px; right: -380px; top: -240px;
  box-shadow: 0 0 0 36px rgba(168, 193, 255, .025), 0 0 0 108px rgba(168, 193, 255, .018);
}
.branchsuite-web-login .login-ring-small {
  width: 430px; height: 430px; bottom: -220px; left: -240px;
  box-shadow: 0 0 0 48px rgba(168, 193, 255, .025);
}
.branchsuite-web-login .login-identity-content {
  position: relative; z-index: 1; margin: auto; width: 100%; max-width: 490px;
  display: flex; flex-direction: column; align-items: flex-start; gap: 24px;
}
.branchsuite-web-login .login-brand {
  max-width: 100%; animation: branchsuite-brand-reveal 700ms cubic-bezier(.22, 1, .36, 1) both;
}
.branchsuite-web-login .login-message {
  width: 100%; max-width: 490px;
  animation: branchsuite-brand-reveal 800ms cubic-bezier(.22, 1, .36, 1) 160ms both;
}
.branchsuite-web-login .login-message > div { text-align: left; }
.branchsuite-web-login .login-message::before {
  content: ''; display: block; width: 40px; height: 3px; border-radius: 3px;
  margin-bottom: 18px; background: linear-gradient(90deg, #f4a45c, rgba(244, 164, 92, .25));
}
.branchsuite-web-login .login-orbit { position: absolute; z-index: -1; border-radius: 50%; pointer-events: none; }
.branchsuite-web-login .login-orbit-large {
  width: 560px; height: 560px; right: -310px; top: -180px;
  background: radial-gradient(circle at 55% 45%, rgba(52, 104, 247, .38), rgba(38, 90, 238, .06) 65%, transparent 72%);
  animation: branchsuite-orbit-drift 18s ease-in-out infinite alternate;
}
.branchsuite-web-login .login-orbit-small {
  width: 420px; height: 420px; right: -190px; bottom: -160px;
  background: radial-gradient(circle, rgba(102, 122, 247, .26), transparent 70%);
  animation: branchsuite-orbit-drift 22s ease-in-out -8s infinite alternate-reverse;
}
@keyframes branchsuite-brand-reveal {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes branchsuite-orbit-drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-24px, 20px, 0) scale(1.06); }
}
.branchsuite-web-login .login-form {
  width: 54%; min-width: 0; padding: 48px clamp(24px, 4vw, 72px);
  display: flex; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, #eff4fc 0%, #f8fafc 72%);
}
.branchsuite-web-login .login-form > div { max-width: 480px; }
.branchsuite-web-login #web-login-card {
  position: relative; transition: box-shadow 180ms;
  border: 2px solid transparent !important;
  background: linear-gradient(#fff, #fff) padding-box,
    linear-gradient(135deg, #94aff7, #c9d3e6 50%, #e8b995) border-box !important;
}
.branchsuite-web-login #web-login-card:focus-within {
  box-shadow: 0 20px 56px rgba(16, 38, 83, .08), 0 2px 6px rgba(16, 38, 83, .02) !important;
}
.branchsuite-web-login .login-form input { font-size: 15px !important; color: #0f172a !important; }
.branchsuite-web-login #web-login-fields > div { margin-bottom: 0 !important; }
.branchsuite-web-login #web-login-fields div:has(> input) {
  --field-outline: #cbd5e1;
  border: 1px solid #cbd5e1 !important; border-radius: 12px !important;
  border-top-color: transparent !important;
  background-color: #fff !important; min-height: 52px !important;
  transition: border-color 160ms, box-shadow 160ms, background-color 160ms;
}
/* Keep the shared outline notch so floating labels need no painted backdrop. */
.branchsuite-web-login #web-login-fields div:has(> input) > div:nth-child(-n+2) {
  height: 12px; border-color: var(--field-outline) !important;
}
.branchsuite-web-login #web-login-fields div:has(> input) > div:first-child { border-top-left-radius: 12px; }
.branchsuite-web-login #web-login-fields div:has(> input) > div:nth-child(2) { border-top-right-radius: 12px; }
.branchsuite-web-login #web-login-fields div:has(> input) > div:nth-child(3) {
  background-color: transparent !important; color: #475569 !important;
}
.branchsuite-web-login #web-login-fields input { min-height: 50px !important; padding-left: 14px !important; }
.branchsuite-web-login #web-login-fields > div:last-child { margin-bottom: 0 !important; }
.branchsuite-web-login #web-login-fields div:has(> input):hover {
  --field-outline: #94a3b8;
  border-color: #94a3b8 !important; border-top-color: transparent !important;
}
.branchsuite-web-login #web-login-fields div:has(> input):focus-within {
  --field-outline: #2563eb;
  background-color: #fff !important; border-color: #2563eb !important;
  border-top-color: transparent !important;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, .1) !important;
}
.branchsuite-web-login #web-login-fields div:has(> input):focus-within > div:nth-child(3) { color: #1d4ed8 !important; }
.branchsuite-web-login #web-login-fields div:has(> input[aria-invalid="true"]) > div:nth-child(3) {
  color: #b94d61 !important;
}
.branchsuite-web-login #web-login-fields div:has(> input[aria-invalid="true"]) {
  --field-outline: #b94d61;
  border-color: #b94d61 !important; box-shadow: 0 0 0 3px rgba(185, 77, 97, .08) !important;
  border-top-color: transparent !important;
}
.branchsuite-web-login .login-form input:focus-visible { outline: none; }
.branchsuite-web-login button { transition: background-color 160ms, border-color 160ms, box-shadow 160ms, transform 160ms; }
.branchsuite-web-login button:focus-visible {
  outline: 3px solid #93c5fd; outline-offset: 3px;
}
.branchsuite-web-login button[aria-busy="true"] { cursor: wait; }
.branchsuite-web-login button:not(:disabled):hover { filter: brightness(.97); }
.branchsuite-web-login #web-login-card > button[aria-busy] {
  background-color: #2563eb !important;
  position: relative;
}
.branchsuite-web-login #web-login-card > button[aria-busy] > * { color: #fff !important; }
.branchsuite-web-login #web-login-plans button > * { color: #fff !important; }
.branchsuite-web-login #web-login-fields button,
.branchsuite-web-login #web-login-card > button[aria-label="Forgot password"] {
  background-color: transparent; border-radius: 8px;
}
.branchsuite-web-login #web-login-fields button > * { color: #1d4ed8 !important; }
.branchsuite-web-login #web-login-fields button:not(:disabled):hover,
.branchsuite-web-login #web-login-card > button[aria-label="Forgot password"]:not(:disabled):hover {
  background-color: transparent; box-shadow: none; filter: none;
}
.branchsuite-web-login #web-login-card > button[aria-label="Forgot password"]:disabled { opacity: .5; }
.branchsuite-web-login #web-login-card > button[aria-busy]:not(:disabled):hover {
  background-color: #1d4ed8 !important; box-shadow: 0 6px 14px rgba(37, 99, 235, .2) !important;
  transform: translateY(-1px);
}
.branchsuite-web-login #web-login-card > button[aria-busy]:not(:disabled):active { transform: translateY(0); }
.branchsuite-web-login #web-login-plans button:not(:disabled):hover {
  border-color: #1d4ed8 !important; background-color: #1d4ed8 !important;
}
.branchsuite-web-login button[role="tab"][aria-selected="false"]:not(:disabled):hover { background-color: #e2e8f0 !important; }
@media (max-width: 1000px) {
  .branchsuite-web-login #web-login-brand-name { font-size: 32px !important; line-height: 40px !important; }
  .branchsuite-web-login .login-message > div { font-size: 24px !important; line-height: 34px !important; }
  .branchsuite-web-login .login-form { padding: 32px 24px; }
}
@media (max-width: 767px) {
  .branchsuite-web-login { flex-direction: column; }
  .branchsuite-web-login .login-identity { width: 100%; padding: 24px 24px 52px; }
  .branchsuite-web-login .login-identity-content { gap: 20px; }
  .branchsuite-web-login .login-message { max-width: 400px; }
  .branchsuite-web-login .login-message > div { font-size: 22px !important; line-height: 30px !important; letter-spacing: -0.4px !important; }
  .branchsuite-web-login .login-form { width: 100%; padding: 0 16px 32px; margin-top: -28px; position: relative; z-index: 1; }
  .branchsuite-web-login .login-form > div { padding: 26px 24px 22px !important; border-radius: 22px !important; }
  .branchsuite-web-login .login-orbit-large { width: 360px; height: 360px; right: -170px; top: -200px; }
  .branchsuite-web-login .login-orbit-small { width: 180px; height: 180px; right: -90px; bottom: -60px; }
  .branchsuite-web-login .login-message::before { margin-bottom: 14px; }
  .branchsuite-web-login .login-ring-large { width: 430px; height: 430px; right: -260px; top: -300px; }
  .branchsuite-web-login .login-ring-small { display: none; }
}
@media (max-width: 359px) {
  .branchsuite-web-login .login-identity { padding-left: 20px; padding-right: 20px; }
  .branchsuite-web-login .login-form { padding-left: 12px; padding-right: 12px; }
  .branchsuite-web-login .login-form > div { padding-left: 20px !important; padding-right: 20px !important; }
}
@media (max-height: 500px) and (min-width: 768px) {
  .branchsuite-web-login .login-identity { padding: 24px; }
  .branchsuite-web-login .login-identity-content { gap: 24px; }
  .branchsuite-web-login .login-form { padding-top: 24px; padding-bottom: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .branchsuite-web-login .login-ambient { transform: none; transition: none; }
  .branchsuite-web-login .login-brand,
  .branchsuite-web-login .login-message,
  .branchsuite-web-login .login-orbit { animation: none; }
  .branchsuite-web-login button,
  .branchsuite-web-login #web-login-card,
  .branchsuite-web-login #web-login-fields div:has(> input) { transition: none; }
  .branchsuite-web-login #web-login-card > button[aria-busy]:not(:disabled):hover { transform: none; }
}
`;
