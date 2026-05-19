<script setup>
import { ref, onMounted, computed } from 'vue'
import { supabase } from '../lib/supabaseClient';
import { workoutSevice } from '../services/workoutService';
import Auth from './Auth.vue'

const workouts = ref([])
const user = ref(null)
const errorMessage = ref(null)

// Фильтры периода
const selectedYear = ref(null)
const availableYears = ref([])
const selectedMonth = ref('') // Пустая строка означает "Все месяцы"

const monthsList = [
  { value: 1, name: 'Январь' },
  { value: 2, name: 'Февраль' },
  { value: 3, name: 'Март' },
  { value: 4, name: 'Апрель' },
  { value: 5, name: 'Май' },
  { value: 6, name: 'Июнь' },
  { value: 7, name: 'Июль' },
  { value: 8, name: 'Август' },
  { value: 9, name: 'Сентябрь' },
  { value: 10, name: 'Октябрь' },
  { value: 11, name: 'Ноябрь' },
  { value: 12, name: 'Декабрь' }
]

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
const durationInputString = ref('00:00:00')

const handleFocus = () => {
  if (durationInputString.value === '00:00:00') {
    durationInputString.value = ''
  }
}

const handleBlur = () => {
  if (durationInputString.value === '') {
    durationInputString.value = '00:00:00'
  }
}

// Функция автоматической подстановки двоеточий при наборе текста
const handleDurationInput = (event) => {
  // Получаем только цифры из того, что ввел пользователь
  let value = event.target.value.replace(/\D/g, '')
  
  // Ограничиваем ввод максимум 6 цифрами (ЧЧММСС)
  if (value.length > 6) {
    value = value.slice(0, 6)
  }

  // Наращиваем маску в зависимости от количества введенных цифр
  let formatted = ''
  if (value.length > 0) {
    // Часы
    formatted += value.slice(0, 2)
  }
  if (value.length > 2) {
    // Минуты
    formatted += ':' + value.slice(2, 4)
  }
  if (value.length > 4) {
    // Секунды
    formatted += ':' + value.slice(4, 6)
  }

  // Обновляем значение в инпуте
  durationInputString.value = formatted
}

// При очистке формы сбрасываем и текстовое поле времени
const resetForm = () => {
  newWorkout.value = initialFormState()
  durationInputString.value = '00:00:00'
}

const formatPace = (decimalMinutes) => {
  if (!decimalMinutes || isNaN(decimalMinutes) || decimalMinutes === Infinity) return '-'
  const minutes = Math.floor(decimalMinutes)
  const seconds = Math.round((decimalMinutes - minutes) * 60)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds} /км`
}

// Конвертация из "ЧЧ:ММ:СС" в дробные минуты для Supabase
const timeStringToMinutes = (timeStr) => {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  if (parts.length !== 3) return null
  
  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  const seconds = parseInt(parts[2], 10) || 0
  
  const totalSeconds = (hours * 3600) + (minutes * 60) + seconds
  return totalSeconds > 0 ? totalSeconds / 60 : null
}

// Конвертация из минут (числа) в строку "ЧЧ:ММ:СС" для формы и таблицы
const formatDuration = (totalMinutes) => {
  if (!totalMinutes || isNaN(totalMinutes) || totalMinutes <= 0) return '-'
  
  // Переводим все в секунды, чтобы избежать проблем с округлением дробных минут
  const totalSeconds = Math.round(totalMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  // Добавляем ведущие нули, если число меньше 10 (например, "05" вместо "5")
  const pad = (num) => String(num).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

const calculateRowMetrics = (type, distance, duration) => {
  if (!distance || !duration) return { pace: '-', speed: '-' }

  const dist = parseFloat(distance)
  const dur = parseFloat(duration)
  
  if (['велосипед', 'велотренажер'].includes(type)) {
    const speed = (dist / (dur / 60)).toFixed(1)
    return { pace: '-', speed: `${speed} км/ч` }  
  } else {
    const paceDecimal = dur / dist
    return { pace: formatPace(paceDecimal), speed: '-' }
  }
}
// Авторасчет в форме заполнения
const formMetrics = computed(() => {
  const dist = parseFloat(newWorkout.value.distance)
  const dur = timeStringToMinutes(durationInputString.value)
  const type = newWorkout.value.type
  return calculateRowMetrics(type, dist, dur)
})

// ГРУППИРОВКА СТАТИСТИКИ ПО ВИДАМ СПОРТА
const periodStats = computed(() => {
  if (workouts.value.length === 0) return null

  const statsGrouped = {}

  workouts.value.forEach(w => {
    const type = w.type
    const dist = parseFloat(w.distance) || 0
    const dur = parseFloat(w.duration) || 0

    // Если такого вида спорта еще нет в объекте — инициализируем его
    if (!statsGrouped[type]) {
      statsGrouped[type] = {
        type: type,
        count: 0,
        totalDistance: 0,
        totalDuration: 0,
        cardioDistance: 0, // Дистанция для вычисления средних значений
        cardioDuration: 0
      }
    }

    statsGrouped[type].count++
    statsGrouped[type].totalDistance += dist
    statsGrouped[type].totalDuration += dur

    if (dist > 0 && dur > 0) {
      statsGrouped[type].cardioDistance += dist
      statsGrouped[type].cardioDuration += dur
    }
  })

  // Рассчитываем средние показатели для каждого вида спорта
  return Object.values(statsGrouped).map(sport => {
    let avgMetric = '-'
    if (sport.cardioDistance > 0) {
      if (['велосипед', 'велотренажер'].includes(sport.type)) {
        // Для вело — средняя скорость
        avgMetric = `исх. скорость: ${(sport.cardioDistance / (sport.cardioDuration / 60)).toFixed(1)} км/ч`
      } else {
        // Для бега/ходьбы/лыж — средний темп
        avgMetric = `ср. темп: ${formatPace(sport.cardioDuration / sport.cardioDistance)}`
      }
    }
    return {
      type: sport.type,
      count: sport.count,
      totalDistance: sport.totalDistance.toFixed(1),
      totalDuration: sport.totalDuration ? `${Math.floor(sport.totalDuration / 60)}ч ${Math.round(sport.totalDuration % 60)}м` : '0м',
      avgMetric: avgMetric
    }
  })
})

// Название выбранного месяца для заголовка статистики
const selectedMonthName = computed(() => {
  const month = monthsList.find(m => m.value === selectedMonth.value)
  return month ? month.name.toLowerCase() : null
})


// Загрузка тренировок с учетом выбранного года и месяца
const loadWorkouts = async () => {
  if (!user.value || !selectedYear.value) return
  try {
    const monthParam = selectedMonth.value === '' ? null : selectedMonth.value
    workouts.value = await workoutSevice.getByPeriod(selectedYear.value, monthParam)
    errorMessage.value = null
  } catch (error) {
    errorMessage.value = `Код: ${error.code}\nСообщение: ${error.message}`
    console.error('Ошибка загрузки тренировок:', error)
  }
}

// Сохранение (Добавление или Обновление)
const handleSubmit = async () => {
  try {
     // Конвертируем введенное пользователем ЧЧ:ММ:СС в число минут перед отправкой
    const calculatedMinutes = timeStringToMinutes(durationInputString.value)
   // Подготовка данных: заменяем пустые строки на null
    const payload = {
      user_id: user.value.id,
      date: newWorkout.value.date,
      type: newWorkout.value.type,
      duration: calculatedMinutes,
      distance: newWorkout.value.distance,
      notes: newWorkout.value.notes?.trim() || null
    }

    if (isEditing.value) {
      await workoutSevice.update(editingId.value, payload)
      cancelEdit()
    } else {
      await workoutSevice.add(payload)
      resetForm()
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
  // Заполняем поле ЧЧ:ММ:СС текущим временем тренировки
  durationInputString.value = formatDuration(workout.duration)
}

// Отмена редактирования
const cancelEdit = () => {
  isEditing.value = false
  editingId.value = null
  resetForm()
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

    <!-- БЛОК ФИЛЬТРОВ (ГОД И МЕСЯЦ) -->
    <div style="display: flex; gap: 15px; align-items: center;"> 
      <div> 
        <label>Год: </label>
        <select v-model="selectedYear" @change="loadWorkouts">
          <option v-for="year in availableYears" :key="year" :value="year">
            {{ year }} {{ year === new Date().getFullYear() ? '(текущий)' : year === new Date().getFullYear()-1 ? '(прошлый)' : '' }}
          </option>
        </select>
      </div>

      <div>
        <label>Месяц: </label>
        <select v-model="selectedMonth" @change="loadWorkouts">
          <option value="">Все месяцы</option>
          <option v-for="month in monthsList" :key="month.value" :value="month.value">
            {{ month.name }}
          </option>
        </select>
      </div>
    </div>

    <!-- РАЗДЕЛЬНАЯ СТАТИСТИКА ПО ВИДАМ СПОРТА -->
    <div v-if="periodStats" style="margin: 15px 0; padding: 15px; background-color: #f4f4f9; border-radius: 6px; border-left: 5px solid #2196F3;">
      <h4 style="margin-top: 0;">Статистика за {{ selectedMonthName ? selectedMonthName + ' ' : '' }}{{ selectedYear }} года:</h4>
      
      <!-- Сетка карточек по видам спорта -->
      <div style="display: flex; gap: 15px; flex-wrap: wrap;">
        <div v-for="sport in periodStats" :key="sport.type" style="background: #fff; padding: 12px; border-radius: 4px; border: 1px solid #ddd; min-width: 200px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <h5 style="margin: 0 0 8px 0; text-transform: uppercase; color: #333; border-bottom: 2px solid #eee; padding-bottom: 4px;">
            {{ sport.type }}
          </h5>
          <div style="font-size: 0.9em; color: #555; line-height: 1.4;">
            <div>Кол-во: <strong>{{ sport.count }}</strong></div>
            <div>Дистанция: <strong>{{ sport.totalDistance }} км</strong></div>
            <div>Время: <strong>{{ sport.totalDuration }}</strong></div>
            <div style="color: #007BFF; margin-top: 4px;"><strong>{{ sport.avgMetric }}</strong></div>
          </div>
        </div>
      </div>
    </div>


    <hr />

    <!-- Форма добавления/редактирования -->
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
      <!-- <input type="number" step="0.01" v-model.number="newWorkout.duration" placeholder="Длительность (мин)" /> -->
      
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <label style="font-size: 0.85em; color: #666;">Длительность (ЧЧ:ММ:СС):</label>
        <input 
          type="text" 
          :value="durationInputString"
          @input="handleDurationInput"
          @focus="handleFocus"
          @blur="handleBlur"
          placeholder="ЧЧ:ММ:СС" 
          maxlength="8"
          required 
          style="padding: 6px; width: 120px; text-align: center; font-family: monospace; letter-spacing: 1px; font-size: 1.1em;"
        />
      </div>

      <!-- Контекстный авторасчет в форме -->
      <div v-if="newWorkout.duration && newWorkout.distance" style="font-size: 0.9em; color: #555; background: #eef; padding: 5px; border-radius: 4px;">
        <span v-if="['велосипед', 'велотренажер'].includes(newWorkout.type)">
          Расчетная скорость: <strong>{{ formMetrics.speed }}</strong>
        </span>
        <span v-else>
          Расчетный темп: <strong>{{ formMetrics.pace }}</strong>
        </span>
      </div>
    
      <textarea v-model="newWorkout.notes" placeholder="Примечание"></textarea>
      
        <!-- Кнопки управления формой -->
      <div>
        <button type="submit">{{ isEditing ? 'Сохранить' : 'Добавить' }}</button>
        <button type="button" v-if="isEditing" @click="cancelEdit">Отмена</button>
      </div>
    </form>

    <hr />
    <!-- Временный блок для отображения ошибок -->
    <div v-if="errorMessage" style="padding: 15px; margin-bottom: 20px; background-color: #ffdddd; color: #aabb00; border: 1px solid #ffcccc; border-radius: 4px;">
      <strong>Ошибка:</strong>
      <pre style="margin: 5px 0 0 0; white-space: pre-wrap;">{{ errorMessage }}</pre>
    </div>

    <div v-if="workouts.length === 0">Нет тренировок за выбранный период</div>

    <table v-else border="1" cellpadding="10" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr><th>Дата</th><th>Тип</th><th>Дистанция,км</th><th>Длительность</th><th>Скорость</th><th>Примечания</th><th>Действия</th></tr>
      </thead>
      <tbody>
        <!-- Цикл v-for для перебора записей -->
        <tr v-for="workout in workouts" :key="workout.id" :style="editingId === workout.id ? 'background-color: #f0f7ff;' : ''">
          <td>{{ workout.date }}</td>
          <td>{{ workout.type }}</td>
          <td>{{ workout.distance }}</td>
          <td>{{ formatDuration(workout.duration) === '00:00:00' ? '-' : formatDuration(workout.duration) }}</td>
          <!-- Объединенная колонка для удобства чтения разных видов спорта -->
          <td>
            <span v-if="['велосипед', 'велотренажер'].includes(workout.type)">
              {{ calculateRowMetrics(workout.type, workout.distance, workout.duration).speed }}
            </span>
            <span v-else>
              {{ calculateRowMetrics(workout.type, workout.distance, workout.duration).pace }}
            </span>
          </td>


          <td>{{ workout.notes || '-' }}</td>
          <td>
            <button @click="startEdit(workout)" title="Редактировать">✏️</button>
            <button @click="deleteWorkout(workout.id)" title="Удалить">❎</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
