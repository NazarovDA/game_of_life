<script setup lang="ts">
import { ref, watch, reactive, onUnmounted } from 'vue';
import { parsePacket, _generateWorldPacketFromServer } from '../utils';

// TODO: fix mouse move handler and listen on window directly
// TODO: props: add more props
// TODO: emit: more click info (left/right/middle button, alt/ctrl/shift)
// TODO: re-render on resize

export type WorldState = Omit<Extract<ReturnType<typeof parsePacket>, { type: 'ServerWorldState' }>, 'type'>;

const defaultInitialZoom = 4;
const props = withDefaults(defineProps<{
  /** world width */
  width: number;
  /** world height */
  height: number;
  /** world state */
  world: WorldState;
  /** zoom-in/out factor (0..1, default `0.9`) */
  zoomFactor?: number;
  initialZoom?: number;
  initialAutoFit?: boolean;
  showDebugInfo?: boolean;
  /**
   * Automatic render mode.
   * * `raf` - use `requestAnimationFrame(render)`
   * * `timer` - use `setInterval(render, 1000 / targetFPS)`
   * * `manual` - do not render
   * 
   * @default "raf"
   * */
  renderMode?: 'raf' | 'timer' | 'manual';
  /** Target fps for `timer` render mode @default 60 */
  timerRenderTargetFps?: number;
}>(), {
  zoomFactor: 0.9,
  renderMode: 'raf',
  timerRenderTargetFps: 60,
});

const emit = defineEmits<{
  click: [pos: [x: number, y: number], event: MouseEvent];
}>();

const canvasRef = ref<HTMLCanvasElement>();

watch(canvasRef, () => {
  if (canvasRef.value) {
    inferCanvasSize();
    resizeCanvas();
    initCanvasEvents();
    if (props.initialAutoFit) {
      autoFit();
    }
  }
});

watch([() => props.timerRenderTargetFps, () => props.renderMode], () => {
  initRender();
});

const state = reactive({
  view: {
    // simulation coordinates/size
    x: 0,
    y: 0,
    /** real:simulated */
    zoom: props.initialZoom || defaultInitialZoom,
    w: window.innerWidth / (props.initialZoom || defaultInitialZoom) * window.devicePixelRatio,
    h: window.innerHeight / (props.initialZoom || defaultInitialZoom) * window.devicePixelRatio,
    // aspect ratio
    ar: window.innerWidth / window.innerHeight,
    // real (canvas) sizes
    cw: window.innerWidth * window.devicePixelRatio,
    ch: window.innerHeight * window.devicePixelRatio,
  },
  mouse: {
    hold: false,
    alt: false,
    // real coordinates
    // mousedown start
    sx: 0,
    sy: 0,
    // last move position
    lx: 0,
    ly: 0,
    // current
    x: 0,
    y: 0,
    // game
    gx: 0,
    gy: 0,
  },
});

function onScreenResize() {
  inferCanvasSize();
  state.view.ar = state.view.cw / state.view.ch;
  resizeCanvas();
}

function inferCanvasSize() {
  if (!canvasRef.value) return;
  const realSize = canvasRef.value.getBoundingClientRect();
  state.view.cw = (realSize.width || window.innerWidth) * window.devicePixelRatio;
  state.view.ch = (realSize.height || window.innerHeight) * window.devicePixelRatio;
}

function autoFit() {
  const newZoom = Math.min(
    state.view.cw / props.width,
    state.view.ch / props.height,
  ) * props.zoomFactor;

  state.view.zoom = newZoom;
  state.view.w = state.view.cw / state.view.zoom;
  state.view.h = state.view.ch / state.view.zoom;
  state.view.x = -(props.width - state.view.w) / 2;
  state.view.y = -(props.height - state.view.h) / 2;
}

window.addEventListener('resize', onScreenResize);
onUnmounted(() => {
  window.removeEventListener('resize', onScreenResize);
  detachCanvasEvents();
});

function resizeCanvas() {
  if (canvasRef.value) {
    canvasRef.value.width = state.view.cw;
    canvasRef.value.height = state.view.ch;
    state.view.w = state.view.cw / state.view.zoom;
    state.view.h = state.view.ch / state.view.zoom;
  }
}

function toGameXY(x=0, y=0, scale=true) {
  return [
    x * (scale ? window.devicePixelRatio : 1) / state.view.cw * state.view.w,
    y * (scale ? window.devicePixelRatio : 1) / state.view.ch * state.view.h,
  ];
}
function toCanvasXY(x=0, y=0, scale=false) {
  return [
    x * state.view.cw / (scale ? window.devicePixelRatio : 1) / state.view.w,
    y * state.view.ch / (scale ? window.devicePixelRatio : 1) / state.view.h,
  ];
}
function inBounds(x=0, y=0, bounds: { x0: number, y0: number, x1: number; y1: number }) {
  return x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1;
}

function onMouseWheel(event: WheelEvent) {
  // mouse coordinates into world coordinates
  const [gx, gy] = toGameXY(event.offsetX, event.offsetY);
  // const cx = state.view.x + gx;
  // const cy = state.view.y + gy;

  
  // `1` - up, `-1` - down
  const zoomFactor = props.zoomFactor ** (event.deltaY > 0 ? 1 : -1);
  const newZoom = state.view.zoom * zoomFactor;
  // let newHalfWidth = state.view.w * zoomFactor / 2;
  // let newHalfHeight = state.view.h * zoomFactor / 2;
  let newHalfWidth = state.view.cw / newZoom / 2;
  let newHalfHeight = state.view.ch / newZoom / 2;
  const newGx = gx / state.view.w * (newHalfWidth * 2);
  const newGy = gy / state.view.h * (newHalfHeight * 2);

  // TODO: fix bounds

  state.view.x -= gx - newGx;
  state.view.y -= gy - newGy;
  state.mouse.gx = newGx;
  state.mouse.gy = newGy;

  state.view.w = newHalfWidth * 2;
  state.view.h = newHalfHeight * 2;
  state.view.zoom = newZoom;
}

function onMouseDown(event: MouseEvent) {
  state.mouse.hold = true;
  state.mouse.sx = event.offsetX * window.devicePixelRatio;
  state.mouse.sy = event.offsetY * window.devicePixelRatio;
}
function onMouseUp(event: MouseEvent) {
  state.mouse.hold = false;
  if (state.mouse.x === state.mouse.sx && state.mouse.y === state.mouse.sy) {
    emitWorldClick(event);
  }
}
function onMouseMove(event: MouseEvent) {
  state.mouse.lx = state.mouse.x;
  state.mouse.ly = state.mouse.y;
  state.mouse.x = event.offsetX * window.devicePixelRatio;
  state.mouse.y = event.offsetY * window.devicePixelRatio;
  state.mouse.alt = event.altKey;
  
  const [gx, gy] = toGameXY(state.mouse.x, state.mouse.y, false);
  state.mouse.gx = gx;
  state.mouse.gy = gy;

  if (!state.mouse.hold) return;
  const [dx, dy] = toGameXY(
    state.mouse.x - state.mouse.lx,
    state.mouse.y - state.mouse.ly,
    false,
  );
  state.view.x += dx;
  state.view.y += dy;
}

function initCanvasEvents() {
  if (!canvasRef.value) return;
  canvasRef.value.addEventListener('mousedown', onMouseDown, false);
  canvasRef.value.addEventListener('mouseup', onMouseUp, false);
  canvasRef.value.addEventListener('mousemove', onMouseMove, false);
  canvasRef.value.addEventListener('wheel', onMouseWheel, false);
  initRender();
}
function detachCanvasEvents() {
  if (!canvasRef.value) return;
  canvasRef.value.removeEventListener('mousedown', onMouseDown, false);
  canvasRef.value.removeEventListener('mouseup', onMouseUp, false);
  canvasRef.value.removeEventListener('mousemove', onMouseMove, false);
  canvasRef.value.removeEventListener('wheel', onMouseWheel, false);
}

let intervalId: number | undefined;

function initRender() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
  }
  if (props.renderMode === 'raf') {
    function renderWrapper() {
      requestAnimationFrame(renderWrapper);
      render();
    }
    requestAnimationFrame(renderWrapper);
  } else if (props.renderMode === 'timer') {
    intervalId = setInterval(render, Math.max(1000 / props.timerRenderTargetFps, 1000 / 60));
  }
}

function render() {
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext('2d');
  if (!ctx) return;
  // requestAnimationFrame(render);

  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  ctx.beginPath();
  ctx.strokeStyle = '#00000040';
  const bounds = {
    x0:  state.view.x < 0 ? Math.floor(-state.view.x) : 0,
    x1: (state.view.x < 0 ? Math.floor(-state.view.x) : 0) + state.view.w,
    y0:  state.view.y < 0 ? Math.floor(-state.view.y) : 0,
    y1: (state.view.y < 0 ? Math.floor(-state.view.y) : 0) + state.view.h,
  };
  const pxw = state.view.cw / state.view.w;
  const pxh = state.view.ch / state.view.h;
  // grid
  const maxX = props.width;
  const maxY = props.height;
  let gridSteps = 10;
  if (pxw >= 32) gridSteps = 100;
  else if (pxw >= 16) gridSteps = 50;
  else if (pxw >= 8) gridSteps = 25;
  else if (pxw >= 4) gridSteps = 20;
  // else if (px >= 2) gridSteps = 15;
  else if (pxw >= 1) gridSteps = 10;
  else if (pxw < 1) gridSteps = 5;
  
  const gridStepX = Math.floor(Math.max(1, maxX / gridSteps));
  const gridStepY = Math.floor(Math.max(1, maxY / gridSteps));
  for (let x=0; x<=maxX; x+=gridStepX) {
    // if (!inBounds(x, state.view.y, bounds)) continue;
    if (x < bounds.x0 || x > bounds.x1) continue;
    const [sx0, sy0] = toCanvasXY(state.view.x + x, state.view.y);
    const [sx1, sy1] = toCanvasXY(state.view.x + x, state.view.y + maxY);
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
  }
  for (let y=0; y<=maxY; y+=gridStepY) {
    // if (!inBounds(state.view.x, y, bounds)) continue;
    if (y < bounds.y0 || y > bounds.y1) continue;
    const [sx0, sy0] = toCanvasXY(state.view.x, state.view.y + y);
    const [sx1, sy1] = toCanvasXY(state.view.x + maxX, state.view.y + y);
    ctx.moveTo(sx0, sy0);
    ctx.lineTo(sx1, sy1);
    // ctx.moveTo(0, y * dh);
    // ctx.lineTo(state.view.cw, y * dh);
  }
  // points
  ctx.fillStyle = 'black';
  for (const [x, y] of props.world.points) {
    if (!inBounds(x, y, bounds)) continue;
    const [sx, sy] = toCanvasXY(state.view.x + x, state.view.y + y);
    ctx.fillRect(sx, sy, pxw, pxh);
  }
  
  // diagonal
  // ctx.fillStyle = '#00000080';
  // for (let i=0; i<Math.max(state.view.cw, state.view.ch); i++) {
  //   if (!inBounds(i, i, bounds)) continue;
  //   const [sx, sy] = toCanvasXY(state.view.x + i, state.view.y + i);
  //   ctx.fillRect(sx, sy, pxw, pxh);
  // }
  ctx.closePath();
  ctx.stroke();

  // cursor
  // ctx.fillRect(state.mouse.x, state.mouse.y, 4, 4);
  ctx.fillStyle = 'red';
  const [gx, gy] = toCanvasXY(
    state.view.x + Math.floor(state.mouse.gx - state.view.x),
    state.view.y + Math.floor(state.mouse.gy - state.view.y),
  );
  ctx.fillRect(gx, gy, pxw, pxh);

  // actual cursor
  if (state.mouse.alt) {
    ctx.fillStyle = 'green';
    const [gx, gy] = toCanvasXY(
      state.view.x + (state.mouse.gx - state.view.x),
      state.view.y + (state.mouse.gy - state.view.y),
    );
    ctx.fillRect(gx, gy, pxw, pxh);
  }
}

function emitWorldClick(event: MouseEvent) {
  const [gx, gy] = [
    Math.floor(state.mouse.gx - state.view.x),
    Math.floor(state.mouse.gy - state.view.y),
  ]
  emit('click', [gx, gy], event);

  // toggle
  // let idx = -1;
  // for (let i=0; i<props.world.points.length; i++) {
  //   if (props.world.points[i][0] === gx && props.world.points[i][1] === gy) {
  //     idx = i;
  //     break;
  //   }
  // }
  // if (idx >= 0) {
  //   // delete
  //   props.world.points.splice(idx, 1);
  // } else {
  //   // add
  //   props.world.points.push([gx, gy]);
  // }
}

defineExpose({
  render,
  autoResize: onScreenResize,
  autoFit,
});
</script>

<template>
  <canvas ref="canvasRef" style="width: 100%; height: 100%;"></canvas>
  <pre v-if="showDebugInfo">{{ state }}<br>{{ world.epoch }}</pre>
</template>

<style scoped>
pre {
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  pointer-events: none;
}
</style>
