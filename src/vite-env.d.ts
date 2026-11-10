/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOCAL_TEST_LOGIN?: string;
  readonly VITE_ADMIN_APP_URL?: string;
}

declare namespace JSX {
  interface Element {}
}
