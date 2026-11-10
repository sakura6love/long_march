<script setup>
/** 事件场景：纸色档案阅读面与历史示意图并置，窄屏切换为上下布局。 */
defineProps({
  event: { type: Object, default: null },
  dimmed: { type: Boolean, default: false },
})

</script>

<template>
  <Transition name="scene">
    <div v-if="event" class="event-scene" :class="{ 'is-dimmed': dimmed }">
      <section
        :key="event.id"
        class="event-copy"
        tabindex="0"
        :aria-label="event.title"
        @pointerdown.stop
        @pointerup.stop
        @click.stop
        @wheel.stop
      >
        <div class="event-article">
          <header class="event-head">
            <p class="event-kicker">长征纪事</p>
            <p class="event-date">{{ event.date }}</p>
            <h2 class="event-title">{{ event.title }}</h2>
            <span class="event-rule" aria-hidden="true" />
          </header>
          <p class="event-text">{{ event.text }}</p>

          <ul v-if="event.points && event.points.length" class="event-points">
            <li v-for="(pt, i) in event.points" :key="i">{{ pt }}</li>
          </ul>

          <svg v-if="event.diagram" class="event-diagram" viewBox="0 0 320 104" aria-hidden="true">
            <defs>
              <marker id="event-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0 0 L6 3 L0 6 z" fill="currentColor" />
              </marker>
            </defs>
            <g fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3">
              <path d="M18 78 C 60 78, 62 26, 104 26" marker-end="url(#event-arrow)" />
              <path d="M104 26 C 146 26, 148 78, 190 78" marker-end="url(#event-arrow)" />
              <path d="M190 78 C 232 78, 234 40, 276 40" marker-end="url(#event-arrow)" />
              <path d="M276 40 C 300 40, 300 16, 312 16" marker-end="url(#event-arrow)" />
            </g>
            <g fill="currentColor" font-size="11">
              <text x="22" y="98">① 土城</text>
              <text x="108" y="18">② 太平渡</text>
              <text x="194" y="98">③ 茅台</text>
              <text x="250" y="34">④ 二郎滩</text>
            </g>
          </svg>

          <p class="event-credit">{{ event.credit }}</p>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.event-scene {
  position: fixed;
  inset: 0;
  z-index: 7;
  font-family: var(--font-body);
  pointer-events: none;
}

.event-copy {
  --focus-color: var(--accent-red, #ac4233);
  color-scheme: light;
  position: absolute;
  inset: 0 auto 0 0;
  display: flex;
  flex-direction: column;
  width: 38%;
  padding: 96px clamp(32px, 4vw, 78px) 76px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  border-right: 1px solid rgba(41, 41, 35, 0.16);
  background: var(--paper, #eae2d1);
  color: var(--ink, #292923);
  scrollbar-width: thin;
  scrollbar-color: #aaa18e transparent;
  pointer-events: auto;
  transition: opacity 250ms ease;
}

.event-article {
  flex: 0 0 auto;
  width: 100%;
  max-width: 580px;
  margin-block: auto;
}

.event-kicker {
  margin: 0 0 28px;
  color: var(--accent-red, #ac4233);
  font-size: 12px;
  line-height: 1.6;
  letter-spacing: 0.3em;
}

.event-date {
  margin: 0 0 16px;
  color: var(--paper-muted, #686255);
  font-size: 13px;
  line-height: 1.8;
  letter-spacing: 0.09em;
  font-variant-numeric: tabular-nums;
}

.event-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(36px, 3vw, 58px);
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0.04em;
}

.event-rule {
  display: block;
  width: 42px;
  height: 2px;
  margin: 28px 0;
  background: var(--accent-red, #ac4233);
}

.event-text {
  margin: 0;
  font-size: 17px;
  line-height: 2;
  overflow-wrap: anywhere;
}

.event-points {
  margin: 30px 0 0;
  padding: 20px 0 0;
  border-top: 1px solid rgba(41, 41, 35, 0.18);
  list-style: none;
}

.event-points li {
  position: relative;
  padding-left: 18px;
  font-size: 14px;
  line-height: 1.9;
  color: #514c43;
}

.event-points li + li {
  margin-top: 9px;
}

.event-points li::before {
  position: absolute;
  top: 12px;
  left: 0;
  width: 5px;
  height: 5px;
  background: var(--accent-red, #ac4233);
  content: '';
}

.event-diagram {
  display: block;
  width: min(100%, 380px);
  height: auto;
  margin-top: 26px;
  color: #8b4a38;
  font-family: var(--font-body);
}

.event-credit {
  margin: 30px 0 0;
  padding-top: 16px;
  border-top: 1px solid rgba(41, 41, 35, 0.12);
  color: var(--paper-muted, #686255);
  font-size: 11px;
  line-height: 1.9;
}

.event-copy:focus-visible {
  outline: 2px solid var(--accent-red, #ac4233);
  outline-offset: -6px;
}

.event-scene.is-dimmed .event-copy {
  opacity: 0;
  pointer-events: none;
}

.scene-enter-active,
.scene-leave-active {
  transition: opacity 400ms ease;
}

.scene-enter-active .event-article {
  transition: transform 500ms cubic-bezier(0.25, 1, 0.5, 1);
}

.scene-enter-from,
.scene-leave-to {
  opacity: 0;
}

.scene-enter-from .event-article {
  transform: translateY(14px);
}

@media (max-width: 1100px) and (min-width: 721px) {
  .event-copy {
    width: 42%;
    padding-right: 32px;
    padding-left: 32px;
  }

  .event-title {
    font-size: 36px;
  }
}

@media (max-width: 720px) {
  .event-copy {
    top: auto;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 56dvh;
    max-height: 56dvh;
    padding: 28px clamp(24px, 5vw, 40px) calc(28px + env(safe-area-inset-bottom, 0px));
    border-top: 2px solid var(--accent-red, #ac4233);
    border-right: 0;
  }

  .event-article {
    max-width: 620px;
    margin-inline: auto;
  }

  .event-kicker {
    margin-bottom: 16px;
    font-size: 11px;
  }

  .event-date {
    margin-bottom: 12px;
    font-size: 12px;
  }

  .event-title {
    font-size: 34px;
  }

  .event-rule {
    margin: 20px 0;
  }

  .event-text {
    line-height: 1.95;
  }

  .event-points {
    margin-top: 24px;
  }

  .event-credit {
    margin-top: 24px;
  }
}

@media (max-height: 600px) and (orientation: landscape) {
  .event-copy {
    inset: 0 auto 0 0;
    width: 46%;
    height: auto;
    max-height: 100dvh;
    padding: 28px 30px 32px;
    border-top: 0;
    border-right: 1px solid rgba(41, 41, 35, 0.16);
  }

  .event-kicker {
    margin-bottom: 14px;
  }

  .event-title {
    font-size: 30px;
  }

  .event-rule {
    margin: 18px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .event-copy,
  .scene-enter-active,
  .scene-leave-active,
  .scene-enter-active .event-article {
    transition: none;
  }
}

html.reduce-motion .event-copy,
html.reduce-motion .scene-enter-active,
html.reduce-motion .scene-leave-active,
html.reduce-motion .scene-enter-active .event-article {
  transition: none;
}
</style>
