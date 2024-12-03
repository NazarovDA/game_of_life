<script setup lang="ts">
import { reactive, ref } from 'vue';
import GameWorld, { type WorldState } from '../components/GameWorld.vue';
import { _generateWorldPacketFromServer, parsePacket } from '../utils';
import { api, GetWorlds, CreateWorld } from '../api';
import { useRouter } from 'vue-router';

const router = useRouter();

type GetWorldsResponse = Extract<GetWorlds['response']['body'], { ok: true }>;
type World = GetWorldsResponse['items'][number];
type NewWorld = CreateWorld['request']['body'];

const mockWorldWH = 100;
const world = ref<WorldState>(getDemoWorldState());

function getDemoWorldState() {
  return parsePacket(_generateWorldPacketFromServer(500, mockWorldWH, mockWorldWH, 0n)) as WorldState;
}

let demoInterval = setInterval(() => {
  world.value = getDemoWorldState();
}, 1000);
// const renderMode = ref<'timer' | 'raf'>('timer');

const state = reactive({
  endpoint: 'http://localhost:8080',
  wsEndpoint: 'ws://localhost:8080/ws',
  endpointsLocked: false,
  isLoading: false,
  createToggled: false,
  worlds: [] as GetWorldsResponse['items'],
  newWorld: {
    name: '',
    x: 100,
    y: 100,
    start: false,
  } satisfies NewWorld,
});

async function toggleEndpointsLock() {
  if (state.isLoading) return;
  state.endpointsLocked = !state.endpointsLocked;
  if (!state.endpointsLocked) {
    state.worlds = [];
  } else {
    state.isLoading = true;
    api.setServerEndpoint(state.endpoint);
    const result = await api.getWorlds().catch((e: Error) => e);
    if ('body' in result && result.body.ok) {
      state.worlds = result.body.items;
    } else {
      console.log(result);
      state.worlds = [];
    }
    state.isLoading = false;
  }
}

function toggleNewWorldEditor() {
  state.createToggled = true;
}

async function connectToWorld(world: { id: string | number; x: number; y: number }) {
  router.push({
    name: 'world',
    query: {
      id: world.id,
      w: world.x,
      h: world.y,
      ws: state.wsEndpoint,
    },
  });
}

async function createAndConnectToWorld() {
  state.isLoading = true;
  const result = await api.createWorld(state.newWorld).catch((e: Error) => e);
  if ('body' in result && result.body.ok) {
    await connectToWorld({
      id: result.body.id,
      x: state.newWorld.x,
      y: state.newWorld.y,
    });
  } else {
    console.log(result);
    state.createToggled = false;
  }
  state.isLoading = false;
}
</script>

<template>
  <div class="world-view">
    <GameWorld
      :width="mockWorldWH"
      :height="mockWorldWH"
      :world="world"
      initial-auto-fit
      render-mode="timer"
      :timer-render-target-fps="1"
    />
  </div>
  <div class="worlds semi-transparent">
    <table>
      <tr>
        <td>Server Endpoint (HTTP)</td>
        <td>Games Endpoint (WS)</td>
        <td></td>
      </tr>
      <tr>
        <td><input v-model="state.endpoint" :disabled="state.endpointsLocked" /></td>
        <td><input v-model="state.wsEndpoint" :disabled="state.endpointsLocked" /></td>
        <td>
          <button
            @click="toggleEndpointsLock"
            :disabled="state.isLoading"
          >
            {{ state.endpointsLocked ? 'Reset' : 'Set and Lock' }}
          </button>
        </td>
      </tr>
    </table>

    <template v-if="state.endpointsLocked">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Run</th>
            <th>Epoch</th>
            <th>Dimensions</th>
          </tr>
        </thead>
        <tr v-if="state.worlds.length === 0">
          <td :colspan="4" style="text-align: center;">Empty</td>
        </tr>
        <tr v-for="world in state.worlds" :key="world.id">
          <td>{{ world.name }}</td>
          <td>{{ world.isRunning }}</td>
          <td>{{ world.epoch }}</td>
          <td>{{ world.x }}/{{ world.y }}</td>
          <td><button @click="connectToWorld(world)" :disabled="state.createToggled">Connect</button></td>
        </tr>
        <tr v-if="state.createToggled">
          <td><input v-model="state.newWorld.name" :disabled="state.isLoading"></td>
          <td><input v-model="state.newWorld.start" type="checkbox" :disabled="state.isLoading"></td>
          <td>0</td>
          <td>
            <input v-model="state.newWorld.x" :disabled="state.isLoading" type="number" min="0" step="1" style="width: 64px">
            /
            <input v-model="state.newWorld.y" :disabled="state.isLoading" type="number" min="0" step="1" style="width: 64px">
          </td>
          <td><button @click="createAndConnectToWorld" :disabled="state.isLoading">Create and Connect</button></td>
        </tr>
      </table>

      <button @click="toggleNewWorldEditor" :disabled="state.createToggled">New</button>
      <button @click="connectToWorld({ id: 1, x: 100, y: 100 })" :disabled="state.createToggled">_CONN</button>
    </template>

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
.worlds {
  position: absolute;
  margin: auto auto;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: fit-content;
  height: 85vh;
  min-width: 600px;
}
</style>