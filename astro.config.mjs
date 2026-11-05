// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import agentDiscovery from './integrations/agent-discovery.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://nostaliga.app',
  integrations: [agentDiscovery()],
  vite: {
    plugins: [tailwindcss()]
  }
});
