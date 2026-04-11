<template>
  <aside class="right-panel">

    <!-- Rack detail overrides tabs when a rack is selected -->
    <RackPanel
      v-if="selectedRackCell"
      :cell="selectedRackCell"
      :gameState="gameState"
      :mode="mode"
      @close="$emit('close-rack')"
      @install-server="$emit('install-server', $event)"
      @move-client="$emit('move-client', $event)"
      @open-terminal="$emit('open-terminal', $event)"
      @repair-server="$emit('repair-server', $event)"
      @restart-server="$emit('restart-server', $event)"
    />

    <template v-else>
      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab-btn"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          {{ t.label }}
          <span
            v-if="t.id === 'clients' && gameState.clientQueue.length > 0"
            class="badge-dot orange"
          ></span>
          <span
            v-if="t.id === 'missions' && pendingMissions > 0"
            class="badge-dot orange"
          ></span>
        </button>
      </div>

      <!-- Tab content -->
      <ClientsPanel
        v-if="activeTab === 'clients'"
        :gameState="gameState"
        :sendAction="sendAction"
      />
      <ServicesPanel
        v-else-if="activeTab === 'services'"
        :gameState="gameState"
        :sendAction="sendAction"
      />
      <MissionsPanel
        v-else-if="activeTab === 'missions'"
        :gameState="gameState"
        @connect-mission="$emit('connect-mission', $event)"
      />
    </template>

  </aside>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import RackPanel     from './RackPanel.vue'
import ClientsPanel  from './ClientsPanel.vue'
import ServicesPanel from './ServicesPanel.vue'
import MissionsPanel from './MissionsPanel.vue'

const props = defineProps({
  gameState:        { type: Object,   required: true },
  mode:             { type: String,   default: 'default' },
  selectedRackCell: { type: Object,   default: null },
  forceTab:         { type: String,   default: null },
  sendAction:       { type: Function, default: null },
})

const emit = defineEmits([
  'close-rack', 'install-server', 'move-client',
  'open-terminal', 'repair-server', 'restart-server',
  'tab-changed', 'connect-mission',
])

const activeTab = ref('clients')

watch(() => props.forceTab, (val) => {
  if (val) {
    activeTab.value = val
    emit('tab-changed')
  }
})

const tabs = [
  { id: 'clients',  label: 'Clients' },
  { id: 'services', label: 'Services' },
  { id: 'missions',  label: '🎯' },
]

const pendingMissions = computed(() =>
  (props.gameState.missions ?? []).length
)
</script>

<style scoped>
.right-panel {
  width: clamp(220px, 20vw, 300px);
  flex-shrink: 0;
  background: #161b22;
  border-left: 1px solid #21262d;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #21262d;
  flex-shrink: 0;
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #8b949e;
  font-family: monospace;
  font-size: 10px;
  padding: 7px 2px;
  cursor: pointer;
  position: relative;
  transition: color 0.1s;
}

.tab-btn:hover { color: #e6edf3; }

.tab-btn.active {
  color: #58a6ff;
  border-bottom-color: #58a6ff;
}

.badge-dot {
  position: absolute;
  top: 5px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.badge-dot.orange { background: #d29922; right: 12px; }
.badge-dot.red    { background: #f85149; }
</style>
