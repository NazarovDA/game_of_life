<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import GameWorld, { type WorldState } from '../components/GameWorld.vue';
import { _generateWorldPacketFromServer, parsePacket } from '../utils';
import { WebSocketAPI } from '../api/wsAPI';
import { useRoute } from 'vue-router';

const route = useRoute();

const state = reactive({
  w: 1,
  h: 1,
  id: '_',
  wsEndpoint: '',
  paused: false,
  waitingForPauseChange: false,
});

const api = ref<WebSocketAPI>();

function init() {
  state.w = Number(route.query.w);
  state.h = Number(route.query.h);
  state.id = route.query.id as string;
  state.wsEndpoint = route.query.ws as string;
  if (api.value) {
    api.value.disconnect();
  }
  initNetworking();
}

function initNetworking() {
  api.value = new WebSocketAPI(state.wsEndpoint);
  api.value.connect(state.id);

  api.value.on('sWorldStop', () => {
    state.paused = true;
    if (state.waitingForPauseChange) state.waitingForPauseChange = false;
  });

  api.value.on('sWorldStart', () => {
    state.paused = false;
    if (state.waitingForPauseChange) state.waitingForPauseChange = false;
  });

  api.value.on('sWorldChange', (worldState) => {
    world.value = worldState;
  });
}

watch(() => route.query, init);
init();

const world = ref<WorldState>(parsePacket(_generateWorldPacketFromServer(0, state.w, state.h, 0n)) as WorldState);

function playPause() {
  if (!api.value) return;
  state.waitingForPauseChange = true;
  if (state.paused) {
    api.value.sendMessage('cWorldStart', undefined);
  } else {
    api.value.sendMessage('cWorldStop', undefined);
  }
}

function onWorldClick(pos: [x: number, y: number], ev: MouseEvent) {
  if (!state.paused) return;
  // toggle
  let idx = -1;
  for (let i=0; i<world.value.points.length; i++) {
    if (world.value.points[i][0] === pos[0] && world.value.points[i][1] === pos[1]) {
      idx = i;
      break;
    }
  }
  if (idx >= 0) {
    // delete
    world.value.points.splice(idx, 1);
  } else {
    // add
    world.value.points.push(pos);
  }
}

function onSave() {
  if (!state.paused || !api.value) return;
  api.value.sendMessage('cWorldChange', world.value);
}
</script>

<template>
  <div class="world-view">
    <GameWorld
      :width="state.w"
      :height="state.h"
      :world="world"
      initial-auto-fit
      @click="onWorldClick"
    />
  </div>
  
  <div class="controls semi-transparent">
    Epoch: {{ world.epoch }}
    <br>
    Alive: {{ world.points.length }}
    <br>
    <button @click="playPause" :disabled="state.waitingForPauseChange">
      {{ state.paused ? 'Play' : 'Pause' }}
    </button>
    <br>
    <button @click="onSave" :disabled="!state.paused">Save changes</button>
  </div>
</template>

<style scoped>
.world-view {
  position: relative;
  width: 100%;
  height: 100%;
}

.semi-transparent {
  border-radius: 4px;
  box-shadow: #000 0 0 2px;
  background-color: #0002;
  color: #000;
  text-shadow: #fff 1px 1px 1px;
}
.controls {
  position: absolute;
  margin: auto auto;
  top: 0;
  right: 0;
  width: fit-content;
}
</style>