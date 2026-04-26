<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient';
import { workoutSevice } from '../services/workoutService';

const workouts = ref([])
const user = ref(null)

const newWorkout = ref({
  date: new Date().toISOString().slice(0,10),
  type: 'бег',
  duration: null,
  distance: 1.0,
  notes: null
})

</script>

<template>
    
</template>
