<template>
  <div class="main-container">
    <!-- 这里就是把造好的地球仪放进网页 -->
    <EarthGlobe />
  </div>
</template>

<script setup>
// 引入你刚才造好的零件
import EarthGlobe from './components/EarthGlobe.vue'
</script>

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