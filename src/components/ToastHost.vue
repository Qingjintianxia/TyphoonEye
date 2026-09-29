<template>
  <div class="toast-host" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast-item"
        :class="`toast-${t.type}`"
        @click="dismiss(t.id)"
      >
        <span class="toast-icon" v-html="icon(t.type)"></span>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { toasts, dismiss } from '../utils/toast'

const ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
}

function icon(type) {
  return ICONS[type] || ICONS.info
}
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 240px;
  max-width: 380px;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  background: rgba(21, 34, 48, 0.96);
  border: 1px solid var(--border-active);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(12px);
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
}

.toast-icon {
  display: flex;
  flex-shrink: 0;
}

.toast-msg {
  line-height: 1.5;
  word-break: break-word;
}

.toast-success { border-left: 3px solid var(--green); }
.toast-success .toast-icon { color: var(--green); }
.toast-error { border-left: 3px solid var(--red); }
.toast-error .toast-icon { color: var(--red); }
.toast-warning { border-left: 3px solid var(--orange); }
.toast-warning .toast-icon { color: var(--orange); }
.toast-info { border-left: 3px solid var(--blue); }
.toast-info .toast-icon { color: var(--blue); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: opacity 0.15s linear;
  }
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}

@media (max-width: 640px) {
  .toast-host {
    top: 12px;
    left: 12px;
    right: 12px;
  }
  .toast-item {
    min-width: 0;
    max-width: none;
  }
}
</style>
