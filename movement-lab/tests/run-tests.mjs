#!/usr/bin/env node
/** Entry point: rebuild the core module from index.html, then run the suite. */
import { buildCore } from './extract-core.mjs';
const core = await buildCore();
process.env.MOVEMENT_LAB_CORE = core;
await import('./synthetic-movements.mjs');
