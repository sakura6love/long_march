<script setup>
/**
 * App —— 只做三件事：装地球、装面板、把"选中了谁"这件事在两者之间传话。
 * 地球和面板互不认识，未来接后端、换数据源都只改这一层。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EarthGlobe from './components/EarthGlobe.vue'
import DetailPanel from './components/DetailPanel.vue'
import longMarchNodes from './data.js'

const globeRef = ref(null)
// -1 表示"没有选中任何节点"，面板随之收起
const activeIndex = ref(-1)

const activeNode = computed(() =>
  activeIndex.value >= 0 ? longMarchNodes[activeIndex.value] : null,
)

/** 地球把点中的节点抛上来，这里换算成序号。 */
function handleSelect(node) {
  const index = longMarchNodes.findIndex((item) => item.id === node.id)
  if (index >= 0) activeIndex.value = index
}

function closePanel() {
  activeIndex.value = -1
}

/** 面板里的 ← → ：按时间顺序在路线上一站一站走。 */
function navigate(step) {
  if (activeIndex.value < 0) return
  const next = (activeIndex.value + step + longMarchNodes.length) % longMarchNodes.length
  globeRef.value?.focusNode(longMarchNodes[next])
}

function handleKeydown(event) {
  if (event.key === 'Escape') closePanel()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <div class="main-container">
    <!-- 这里就是把造好的地球仪放进网页 -->
    <EarthGlobe ref="globeRef" @select="handleSelect" />

    <DetailPanel
      :node="activeNode"
      :order="activeIndex + 1"
      :total="longMarchNodes.length"
      @close="closePanel"
      @navigate="navigate"
    />
  </div>
</template>

<style>
/* 这一步极其致命！必须强制网页占满全屏，否则地球高度是0，就会看不见 */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #0b0f19; /* 深空背景色 */
  overflow: hidden;
}

.main-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}
</style>
