#!/usr/bin/env node
/**
 * Build-time helper. Run by hand before a marketing deploy:
 *
 *   node scripts/build-marketing-blurb.mjs > content/whats-new.txt
 *
 * Reads content/changelog.md (our own public release notes) and asks OpenAI to
 * compress it into two sentences. Never touches the database and never reads
 * user notes.
 */
import { summarizeChangelog } from '../lib/summarize-internal.ts';

const blurb = await summarizeChangelog();
process.stdout.write(blurb + '\n');
