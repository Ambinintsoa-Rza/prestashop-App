<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { loginAdmin } from "../services/adminAuth";

const router = useRouter();

const adminBaseUrl = ref(import.meta.env.VITE_PS_ADMIN_BASE_URL || "/ps-admin");
const form = ref({
  email: "",
  password: "",
  stayLoggedIn: true,
});

const loading = ref(false);
const errors = ref([]);
const success = ref("");
const redirectUrl = ref("");

const canSubmit = computed(() =>
  !!form.value.email && !!form.value.password && !loading.value
);

const submit = async () => {
  errors.value = [];
  success.value = "";
  redirectUrl.value = "";

  if (!canSubmit.value) {
    errors.value = ["Email et mot de passe requis."];
    return;
  }

  loading.value = true;
  try {
    const result = await loginAdmin(adminBaseUrl.value, {
      email: form.value.email,
      password: form.value.password,
      stayLoggedIn: form.value.stayLoggedIn,
      redirect: "AdminDashboard",
    });

    if (!result.ok) {
      errors.value = result.errors?.length ? result.errors : ["Login invalide."];
      return;
    }

    success.value = "Login OK. Redirection...";
    redirectUrl.value = result.redirect || "";
    await router.push("/dashboard");
  } catch (err) {
    errors.value = [err instanceof Error ? err.message : "Erreur inconnue."];
  } finally {
    loading.value = false;
  }
};

const goToApp = () => {
  router.push("/dashboard");
};

const openBackoffice = () => {
  if (!redirectUrl.value) return;
  window.open(redirectUrl.value, "_blank", "noopener");
};
</script>

<template>
  <div class="page">
    <header class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Backoffice</p>
        <h1>Login</h1>
        <p class="lead">Connexion via AdminLogin du backoffice.</p>
        <div class="meta">
          <span>Base admin: {{ adminBaseUrl }}</span>
          <span>Mode: ajax=1</span>
        </div>
      </div>

      <div class="panel">
        <h2>Connexion</h2>
        <p class="hint">Utilise le formulaire officiel AdminLogin.</p>

        <div v-if="errors.length" class="error">
          <ul class="error-list">
            <li v-for="(item, index) in errors" :key="index">{{ item }}</li>
          </ul>
        </div>
        <p v-else-if="success" class="success">{{ success }}</p>

        <form class="form-grid" @submit.prevent="submit">
          <div class="field">
            <label for="email">Email</label>
            <input id="email" v-model="form.email" type="email" autocomplete="username" />
          </div>

          <div class="field">
            <label for="password">Mot de passe</label>
            <input
              id="password"
              v-model="form.password"
              type="password"
              autocomplete="current-password"
            />
          </div>

          <div class="field checkbox">
            <label for="stayLoggedIn">Rester connecte</label>
            <input id="stayLoggedIn" v-model="form.stayLoggedIn" type="checkbox" />
          </div>

          <div class="actions">
            <button type="submit" :disabled="!canSubmit">
              {{ loading ? "Connexion..." : "Se connecter" }}
            </button>
            <button type="button" class="ghost" @click="goToApp">
              Retour app
            </button>
          </div>

          <div v-if="success" class="actions">
            <button type="button" class="ghost" :disabled="!redirectUrl" @click="openBackoffice">
              Ouvrir backoffice
            </button>
          </div>
        </form>
      </div>
    </header>
  </div>
</template>
