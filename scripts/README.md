# Scripts & Tests

This directory contains utility scripts and tests for the SportSense platform.

---

## Quick Reference

| Script | Purpose | Command |
|--------|---------|---------|
| `prompt-comparison-test.ts` | Compare old vs new prompt sizes | `npx tsx scripts/prompt-comparison-test.ts` |
| `test-prompt-length.ts` | Debug what prompt is being sent | `npx tsx scripts/test-prompt-length.ts` |
| `seed.ts` | Seed database with initial data | `npx tsx scripts/seed.ts` |
| `sync.ts` | Sync NBA data from ESPN | `npx tsx scripts/sync.ts` |
| `gemini_smoketest.ts` | Test Gemini API connection | `npx tsx scripts/gemini_smoketest.ts` |
| `test-player-parsing.ts` | Test player data parsing | `npx tsx scripts/test-player-parsing.ts` |

---

## Detailed Documentation

### Prompt Comparison Test

**File:** `prompt-comparison-test.ts`

Compares the old vs new AI prompt sizes to measure the impact of latency optimizations.

```bash
npx tsx scripts/prompt-comparison-test.ts
```

**What it measures:**
- Character count reduction
- Estimated token savings
- Time-to-first-token (TTFT) improvement
- Cost savings at scale

**Sample output:**
```
📊 SIZE COMPARISON:
│ Characters      │           12,892 │            1,398 │
│ Est. Tokens     │            3,223 │              350 │

📉 REDUCTION:
   Size reduction:     89.2%
   Tokens saved:       ~2,873 per request
```

---

### Database Seed

**File:** `seed.ts`

Seeds the database with initial team and player data.

```bash
npx tsx scripts/seed.ts
```

---

### NBA Data Sync

**File:** `sync.ts`

Syncs live NBA data from the ESPN API.

```bash
npx tsx scripts/sync.ts
```

---

### Gemini Smoke Test

**File:** `gemini_smoketest.ts`

Tests that the Gemini API connection is working.

```bash
npx tsx scripts/gemini_smoketest.ts
```

**Prerequisites:**
- `GEMINI_API_KEY` environment variable must be set

---

### Player Parsing Test

**File:** `test-player-parsing.ts`

Tests the player data parsing logic from ESPN API responses.

```bash
npx tsx scripts/test-player-parsing.ts
```

---

## Adding New Tests

When adding a new test script:

1. Create the file in this directory
2. Add an entry to the Quick Reference table above
3. Add detailed documentation section below

**Template:**

```markdown
### Your Test Name

**File:** `your-test.ts`

Brief description of what the test does.

\`\`\`bash
npx tsx scripts/your-test.ts
\`\`\`

**What it tests:**
- Item 1
- Item 2

**Prerequisites:**
- Any required env vars or setup
```

---

## Notes

- All scripts use `tsx` for TypeScript execution (faster than `ts-node`)
- Make sure you have dependencies installed: `npm install`
- Some scripts require environment variables - see `env.template` in project root
