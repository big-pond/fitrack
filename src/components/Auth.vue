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
  else allert('Проверте почту для подтверждения (если требуется)')
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
  <div>
    <input v-model="email" type="email" placeholder="Email" />      
    <input v-model="password" type="password" placeholder="Пароль" />      
    <button :disabled="loading" @click="signIn">Войти</button>
    <!-- <button :disabled="loading" @click="signUp">Регистрация</button> -->
    <button @click="signUp" disabled>Регистрация</button>
  </div>
</template>
