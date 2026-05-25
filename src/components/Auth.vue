<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient';

const email = ref('')
const password = ref('')
const loading = ref(false)

const signUp = async () => {
  loading.value = true
  const { error } = await supabase.auth.signUp( {email: email.value, password: password.value })
  if (error) alert(error.message)
  else alert('Проверте почту для подтверждения (если требуется)')
  loading.value = false
}

const signIn = async () => {
  loading.value = true
  const { error } = await supabase.auth.signInWithPassword( {email: email.value, password: password.value })
  if (error) alert(error.message)
  loading.value = false
}
</script>

<template>
  <div class="auth-wrapper">
    <div class="auth-card">
      <h3 class="auth-title">Вход</h3>

      <input v-model="email" type="email" placeholder="Email" required/>      
      <input v-model="password" type="password" placeholder="Пароль" required />      

      <div class="auth-actions">
        <button :disabled="loading" @click="signIn" class="btn-primary">
          {{ loading ? 'Вход...' : 'Войти' }}
        </button>
        <!-- <button :disabled="loading" @click="signUp">Регистрация</button>  -->
        <button @click="signUp" disabled>Регистрация</button>
      </div>
    </div>
  </div>
</template>
