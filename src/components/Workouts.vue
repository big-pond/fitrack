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

// Состояние редактирования
const isEditing = ref(false)
const editingId = ref(null)

// Начальное состояние формы
const initialFormState = () => ({
  date: new Date().toISOString().slice(0,10),
  type: 'бег',
  duration: null,
  distance: 1.0,
  notes: null
})

const newWorkout = ref(initialFormState())

// Загрузка тренировок за выбранный год
const loadWorkouts = async () => {
  if (!user.value || !selectedYear.value) return
  try {
    workouts.value = await workoutSevice.getByYear(selectedYear.value)
    errorMessage.value = null // Сбрасываем ошибку при успешной загрузке
  } catch (error) {
    errorMessage.value = `Код: ${error.code}\nСообщение: ${error.message}\nДетали: ${error.details || 'нет'}`
    console.error('Ошибка загрузки тренировок:', error)
  }
}

// Сохранение (Добавление или Обновление)
const handleSubmit = async () => {
  try {
    // Подготовка данных: заменяем пустые строки на null
    const payload = {
      date: newWorkout.value.date,
      type: newWorkout.value.type,
      duration: newWorkout.value.duration || null,
      distance: newWorkout.value.distance,
      notes: newWorkout.value.notes?.trim() || null
    }

    if (isEditing.value) {
      await workoutSevice.update(editingId.value, payload)
      cancelEdit()
    } else {
      await workoutSevice.add(payload)
      newWorkout.value = initialFormState()
    }
    
    await loadWorkouts()
  } catch (error) {
    errorMessage.value = `Ошибка сохранения: ${error.message}`
  }
}

// Включение режима редактирования
const startEdit = (workout) => {
  isEditing.value = true
  editingId.value = workout.id
  // Копируем данные в форму
  newWorkout.value = { ...workout }
}

// Отмена редактирования
const cancelEdit = () => {
  isEditing.value = false
  editingId.value = null
  newWorkout.value = initialFormState()
}

// Удаление
const deleteWorkout = async (id) => {
  if (confirm('Удалить тренировку?')) {
    try {
      await workoutSevice.delete(id)
      if (isEditing.value && editingId.value === id) cancelEdit()
      await loadWorkouts()
    } catch (error) {
      errorMessage.value = `Ошибка удаления: ${error.message}`
    }
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
      <select v-model="selectedYear" @change="loadWorkouts">
        <option v-for="year in availableYears" :key="year" :value="year">
          {{ year }} {{ year === new Date().getFullYear() ? '(текущий)' : year === new Date().getFullYear()-1 ? '(прошлый)' : '' }}
        </option>
      </select>
    </div>

    <hr />

    <!-- Динамический заголовок формы -->
    <h3>{{ isEditing ? 'Редактировать тренировка' : 'Добавить тренировку' }}</h3>
    <form @submit.prevent="handleSubmit">
      <input type="date" v-model="newWorkout.date" required />
      <select v-model="newWorkout.type">
        <option>бег</option>
        <option>ходьба</option>
        <option>велосипед</option>
        <option>велотренажер</option>
        <option>плавание</option>
        <option>лыжи</option>
      </select>

      <!-- Модификатор .number гарантирует отправку чисел, а не строк -->
      <input type="number" step="0.1" v-model.number="newWorkout.distance" placeholder="Дистанция (км)" required />
      <input type="number" step="0.01" v-model.number="newWorkout.duration" placeholder="Длительность (мин)" />
      <textarea v-model="newWorkout.notes" placeholder="Примечание"></textarea>
      
        <!-- Кнопки управления формой -->
      <button type="submit">{{ isEditing ? 'Сохранить' : 'Добавить' }}</button>
      <button type="button" v-if="isEditing" @click="cancelEdit">Отмена</button>
    </form>

    <hr />
    <!-- Временный блок для отображения ошибок -->
    <div v-if="errorMessage" style="padding: 15px; margin-bottom: 20px; background-color: #ffdddd; color: #aabb00; border: 1px solid #ffcccc; border-radius: 4px;">
      <strong>Ошибка:</strong>
      <pre style="margin: 5px 0 0 0; white-space: pre-wrap;">{{ errorMessage }}</pre>
    </div>

    <div v-if="workouts.length === 0">Нет тренировок</div>

    <table border="1" cellpadding="10" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr><th>Дата</th><th>Тип</th><th>Дистанция,км</th><th>Длительность,мин</th><th>Примечания</th><th>Действия</th></tr>
      </thead>
      <tbody>
        <!-- Цикл v-for для перебора записей -->
        <tr v-for="workout in workouts" :key="workout.id" :style="editingId === workout.id ? 'background-color: #f0f7ff;' : ''">
          <td>{{ workout.date }}</td>
          <td>{{ workout.type }}</td>
          <td>{{ workout.distance }}</td>
          <td>{{ workout.duration || '-' }}</td>
          <td>{{ workout.notes || '-' }}</td>
          <td>
            <button @click="startEdit(workout)" title="Редактировать">&#9999;</button>
            <button @click="deleteWorkout(workout.id)" title="Удалить">&#10062;</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
