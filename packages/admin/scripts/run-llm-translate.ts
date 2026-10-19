#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultLocale } from '@languages';
import { runCli } from '@core-utils/llm/cli.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default to the admin posts directory in the default locale
const defaultPostsDir = path.resolve(__dirname, '..', 'src', 'content', defaultLocale, 'posts');

// Delegate execution to the unified core translation CLI
runCli(process.argv, { defaultInputDir: defaultPostsDir });