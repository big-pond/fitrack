import {supabase} from './supabaseClient';
export const workoutSevice = {
  async getAll() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .order('date', {ascending: false});
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
