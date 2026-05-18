<script setup>
import Workouts from './components/Workouts.vue';
</script>

<template>
  <div id="app">
    <h1>Дневник тренировок</h1>
    <Workouts />
  </div>
</template>
 <style scoped>
#app {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}
h1 {
  text-align: center;
  color: #2c3e50;
}
</style>
