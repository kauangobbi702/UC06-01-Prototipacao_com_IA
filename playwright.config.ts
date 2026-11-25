import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const env = loadEnv('e2e', process.cwd(), [
  'VITE_',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);
const configuredSupabaseUrl = (env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (
  env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''
).trim();
const testProjectRef = 'hpcitfmbiyyqwyiihcgn';
const testProjectUrl = `https://${testProjectRef}.supabase.co`;
const supabaseUrl = configuredSupabaseUrl === testProjectRef
  ? testProjectUrl
  : configuredSupabaseUrl;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('E2E requer VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente; valores não serão exibidos.');
}

let supabaseEndpoint: URL;
try {
  supabaseEndpoint = new URL(supabaseUrl);
} catch {
  throw new Error('E2E requer uma URL válida para o projeto Supabase de testes.');
}

if (
  supabaseEndpoint.protocol !== 'https:'
  || supabaseEndpoint.hostname !== `${testProjectRef}.supabase.co`
) {
  throw new Error('E2E interrompido: VITE_SUPABASE_URL deve apontar para o projeto Supabase de testes designado.');
}

process.env.VITE_SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_ANON_KEY = supabaseAnonKey;

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'docs/relatorio-playwright', open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
      command: 'npm run dev -- --mode e2e --host 127.0.0.1 --port 5173',
      url: baseURL,
      reuseExistingServer: false,
    },
} satisfies PlaywrightTestConfig);
