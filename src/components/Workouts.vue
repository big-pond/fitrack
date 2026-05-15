<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabaseClient';
import { workoutSevice } from '../services/workoutService';
import Auth from './Auth.vue'

const workouts = ref([])
const user = ref(null)
const errorMessage = ref(null)

const selectedYear = ref(null)
const availableYears = ref([])

//  Форма добавления
const newWorkout = ref({
  date: new Date().toISOString().slice(0,10),
  type: 'бег',
  duration: null,
  distance: 1.0,
  notes: null
})

// Загрузка тренировок за выбранный год
const loadWorkouts = async () => {
  if (!user.value || selectedYear.value) return
  try {
    workouts.value = await workoutSevice.getByYear(selectedYear.value)
  } catch (error) {
    errorMessage.value = `Код: ${error.code}\nСообщение: ${error.message}\nДетали: ${error.details || 'нет'}`
    console.error('Ошибка загрузки тренировок:', error)
  }
}

// Добавление тренировки
const addWorkout = async () => {
  await workoutSevice.add(newWorkout.value)
  await loadWorkouts()
  newWorkout.value = {
    date: new Date().toISOString().slice(0,10),
    type: 'бег',
    duration: null,
    distance: 1.0,
    notes: null
  }
}

// Удаление
const deleteWorkout = async (id) => {
  if (confirm('Удалить тренировку?')) {
    await workoutSevice.delete(id)
    await loadWorkouts()
  }
}

// Выход
const logout = async () => {
  await supabase.auth.signOut()
  user.value = null
}

// Генерация списка лет
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const years = []
  for(let y = currentYear; y >= 1982; y--) {
    years.push(y)
  }
  return years
}

onMounted( async () => {
  const { data } = await supabase.auth.getUser()
  user.value = data.user
  if (user.value) {
    availableYears.value = generateYearOptions()
    const currentYear = new Date().getFullYear()
    selectedYear.value = currentYear
    await loadWorkouts()
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    user.value = session?.user ?? null
    if (user.value) {
      availableYears.value = generateYearOptions()
      const currentYear = new Date().getFullYear()
      selectedYear.value = currentYear
      await loadWorkouts()
    } else {
      workouts.value = []
    }
  })
})
</script>

<template>
  <div v-if="!user">
    <Auth />
  </div>
  <div v-else>
    <h2> Тренировки пользователя: {{ user.email }}</h2>
    <button @click="logout">Выйти</button>

    <hr />

    <!-- Фильтр по году (календарный) -->
    <div> 
      <label>Год: </label>
      <select v-model="selectedYear" @change="onYearChange">
        <option v-for="year in availableYears" :key="year" :value="year">
          {{ year }} {{ year === new Date().getFullYear() ? '(текущий)' : year === new Date().getFullYear()-1 ? '(прошлый)' : '' }}
        </option>"
      </select>
    </div>

    <hr />

    <h3>Добавить тренировку</h3>
    <form @submit.prevent="addWorkout">
      <input type="date" v-model="newWorkout.date" required />
      <select v-model="newWorkout.type">
        <option>бег</option>
        <option>ходьба</option>
        <option>велосипед</option>
        <option>велотренажер</option>
        <option>плавание</option>
        <option>лыжи</option>
      </select>
      <input type="number" step="0.1" v-model="newWorkout.distance" placeholder="Дистанция (км)" required />
      <input type="number" step="0.01" v-model="newWorkout.duration" placeholder="Длительность (мин)" />
      <textarea v-model="newWorkout.notes" placeholder="Примечание"></textarea>
      <button type="submit">Добавить</button>
    </form>

    <hr />
    <!-- Временный блок для отображения ошибок -->
    <div v-if="errorMessage" style="padding: 15px; margin-bottom: 20px; background-color: #ffdddd; color: #aabb00; border: 1px solid #ffcccc; border-radius: 4px;">
      <strong>Ошибка загрузки данных:</strong>
      <pre style="margin: 5px 0 0 0; white-space: pre-wrap;">{{ errorMessage }}</pre>
    </div>

    <div v-if="workouts.length === 0">Нет тренировок</div>
    <table border="1" cellpadding="10" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr><th>Дата</th><th>Тип</th><th>Дистанция,км</th><th>Длительность,мин</th><th>Примечания</th><th>Del</th></tr>
      </thead>
      <tbody>
        <!-- Цикл v-for для перебора записей -->
        <tr v-for="workout in workouts" :key="workout.id">
          <td>{{ workout.date }}</td>
          <td>{{ workout.type }}</td>
          <td>{{ workout.distance }}</td>
          <td>{{ workout.duration || '-' }}</td>
          <td>{{ workout.notes || '-' }}</td>
          <td><button @click="deleteWorkout(workout.id)">&#10062;</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
