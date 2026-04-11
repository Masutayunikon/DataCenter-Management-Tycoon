<template>
  <transition name="notif">
    <div v-if="current" class="event-notif" :class="current.severity" @click="dismiss">
      <div class="notif-header">
        <span class="notif-name">{{ current.name }}</span>
        <span class="notif-duration" v-if="current.duration > 1">{{ current.duration }} jours</span>
        <span class="notif-duration" v-else>Immédiat</span>
        <button class="notif-close" @click.stop="dismiss">✕</button>
      </div>
      <div class="notif-desc">{{ current.description }}</div>
      <div class="notif-progress">
        <div class="notif-bar" :style="{ width: progressPct + '%' }"></div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  event: { type: Object, default: null }, // new event pushed from App
})

const queue   = ref([])
const current = ref(null)
let   timer   = null
let   elapsed = 0
const DISPLAY_MS = 6000

const progressPct = computed(() => Math.max(0, 100 - (elapsed / DISPLAY_MS) * 100))

watch(() => props.event, (ev) => {
  if (!ev) return
  queue.value.push(ev)
  if (!current.value) showNext()
})

function showNext() {
  clearInterval(timer)
  elapsed = 0

  if (queue.value.length === 0) { current.value = null; return }
  current.value = queue.value.shift()

  timer = setInterval(() => {
    elapsed += 100
    if (elapsed >= DISPLAY_MS) dismiss()
  }, 100)
}

function dismiss() {
  clearInterval(timer)
  current.value = null
  if (queue.value.length > 0) setTimeout(showNext, 300)
}

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.event-notif {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: 380px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px 14px 8px;
  box-shadow: 0 4px 20px #0008;
  z-index: 200;
  cursor: pointer;
  border-left: 4px solid #30363d;
}

.event-notif.info     { border-left-color: #58a6ff; }
.event-notif.warning  { border-left-color: #d29922; }
.event-notif.critical { border-left-color: #f85149; }

.notif-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.notif-name {
  font-family: monospace;
  font-size: 13px;
  font-weight: bold;
  color: #e6edf3;
  flex: 1;
}

.notif-duration {
  font-family: monospace;
  font-size: 10px;
  color: #8b949e;
  background: #21262d;
  padding: 1px 6px;
  border-radius: 10px;
}

.notif-close {
  background: transparent;
  border: none;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
}
.notif-close:hover { color: #e6edf3; }

.notif-desc {
  font-family: monospace;
  font-size: 11px;
  color: #8b949e;
  line-height: 1.4;
  margin-bottom: 8px;
}

.notif-progress {
  height: 2px;
  background: #21262d;
  border-radius: 1px;
  overflow: hidden;
}

.notif-bar {
  height: 100%;
  background: #58a6ff;
  border-radius: 1px;
  transition: width 0.1s linear;
}

.event-notif.warning  .notif-bar { background: #d29922; }
.event-notif.critical .notif-bar { background: #f85149; }

/* Vue transition */
.notif-enter-active { transition: all 0.3s ease; }
.notif-leave-active { transition: all 0.25s ease; }
.notif-enter-from   { opacity: 0; transform: translateX(-50%) translateY(20px); }
.notif-leave-to     { opacity: 0; transform: translateX(-50%) translateY(20px); }
</style>
