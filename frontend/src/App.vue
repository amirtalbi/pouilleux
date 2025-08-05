<template>
  <div id="app">
    <router-view />
    
    <!-- Error notification -->
    <div v-if="gameStore.error" class="notification">
      <div class="flex items-center space-x-2">
        <span class="text-red-600">⚠️</span>
        <span class="text-gray-800">{{ gameStore.error }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useGameStore } from './stores/game'

const gameStore = useGameStore()

onMounted(() => {
  gameStore.initSocket()
})
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
