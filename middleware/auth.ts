export default defineNuxtRouteMiddleware(() => {
  // Auth state is hydrated on the client by plugins/auth.client.ts (which awaits
  // authStore.init()), so this guard runs client-side only — SSR has no session in the store.
  if (import.meta.server)
    return;

  const authStore = useAuthStore();
  if (!authStore.user)
    return navigateTo("/");
});
