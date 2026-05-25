export default defineNuxtPlugin({
  name: "auth",
  async setup() {
    const authStore = useAuthStore();
    await authStore.init();
  },
});
