declare module "*.csv?raw" {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_AI_COMMENTARY_ENDPOINT?: string;
  readonly VITE_DEEPSEEK_API_KEY?: string;
  readonly VITE_DEEPSEEK_BASE_URL?: string;
  readonly VITE_DEEPSEEK_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
