import {supabase} from '../lib/supabaseClient';

export const workoutSevice = {
  async getAll() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('date', {ascending: false});
    if (error) throw error;
    return data;
  },

  // async getByYear(year) {
  //   const startDate = `${year}-01-01`
  //   const endDate = `${year}-12-31`
  //   const { data, error } = await supabase
  //     .from('workouts')
  //     .select('*')
  //     .gte('date', startDate)
  //     .lte('date', endDate)
  //     .order('date', {ascending: false});
  //   if (error) throw error;
  //   return data;
  // },
  async getByPeriod(year, month = null) {
    let startDate, endDate;

    if (month === null || month === '') {
      // Если месяц не выбран — берем весь год
      startDate = `${year}-01-01`
      endDate = `${year}-12-31`
    } else {
      // Форматируем месяц в двузначную строку (например, 5 -> '05')
      const formattedMonth = String(month).padStart(2, '0');
      startDate = `${year}-${formattedMonth}-01`
      
      // Находим последний день выбранного месяца
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${formattedMonth}-${lastDay}`
    }

    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  },  


  // Добавить тренировку (user_id подставляется автоматически через RLS)
  async add(workout) {
    const { data, error } = await supabase
      .from('workouts')
      .insert([{
        date: workout.date,
        type: workout.type,
        duration: workout.duration || null,
        distance: workout.distance,
        notes: workout.notes || null
      }])
      .select()
    if (error) throw error
    return data[0]
  },
  async update(id, updates) {
    const { data, error } = await supabase
      .from('workouts')
      .update(updates)
      .eq('id', id)
      .select()
    if (error) throw error
    return data[0]
  },

  async delete(id) {
    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }
};
