import { createAuthClient } from "better-auth/vue";
import { defineStore } from "pinia";

const authClient = createAuthClient();

type AuthSession = Awaited<ReturnType<typeof authClient.useSession>>;
type AuthUser = {
  email?: string | null;
  id?: number | string;
  image?: string | null;
  name?: string | null;
  role?: "user" | "admin";
};

export const useAuthStore = defineStore("authStore", () => {
  const session = ref<AuthSession | null>(null);
  const persistedRole = ref<"user" | "admin" | null>(null);

  async function init() {
    const data = await authClient.useSession(useFetch);
    session.value = data;
    await refreshProfileRole();
  }

  const user = computed(() => {
    const sessionUser = session.value?.data?.user as AuthUser | undefined;
    if (!sessionUser)
      return undefined;

    return {
      ...sessionUser,
      role: persistedRole.value ?? sessionUser.role,
    };
  });
  const loading = computed(() => session.value?.isPending);

  async function refreshProfileRole() {
    if (!session.value?.data?.user) {
      persistedRole.value = null;
      return;
    }

    try {
      const profile = await $fetch<{ role: "user" | "admin" }>("/api/auth/profile");
      persistedRole.value = profile.role;
    }
    catch {
      persistedRole.value = null;
    }
  }

  async function signInWithGithub() {
    const { csrf } = useCsrf();
    const headers = new Headers();
    headers.append("csrf-token", csrf);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
      errorCallbackURL: "/error",
      fetchOptions: {
        headers,
      },
    });
  }

  async function signInWithGoogle() {
    const { csrf } = useCsrf();
    const headers = new Headers();
    headers.append("csrf-token", csrf);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/error",
      fetchOptions: {
        headers,
      },
    });
  }

  async function signIn() {
    await signInWithGithub();
  }

  async function signOut() {
    const { csrf } = useCsrf();
    const headers = new Headers();
    headers.append("csrf-token", csrf);
    await authClient.signOut({
      fetchOptions: {
        headers,
      },
    });
    navigateTo("/");
  }

  return {
    loading,
    signIn,
    signInWithGithub,
    signInWithGoogle,
    signOut,
    user,
    init,
  };
});
