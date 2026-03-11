import { readFileSync, writeFileSync } from 'fs';

const files = [
  'tests/integration/external-services.test.ts',
  'tests/integration/external-services-fixed.test.ts'
];

for (const file of files) {
  let c = readFileSync(file, 'utf8');

  // 1. Add supertest/server imports if not present
  if (!c.includes('import request from')) {
    c = c.replace(
      "import { describe, it, expect, beforeAll } from 'vitest';",
      `import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { AppraisalManagementAPIServer } from '../../src/api/api-server';
import type { Application } from 'express';`
    );
  }

  // 2. Remove API_BASE_URL line
  c = c.replace(/const API_BASE_URL = .*\n/, '');

  // 3. Replace the entire 'beforeAll' block that checks connectivity
  c = c.replace(
    /  beforeAll\(async \(\) => \{[\s\S]*?}, TEST_TIMEOUT\);/,
    `  let serverInstance: AppraisalManagementAPIServer;
  let app: Application;

  beforeAll(async () => {
    serverInstance = new AppraisalManagementAPIServer(0);
    app = serverInstance.getExpressApp();
    // No initDb() needed — property intelligence does not use the DB
  }, 60_000);`
  );

  // 4. Transform multiline POST fetch calls
  // Match: const response = await fetch(`${API_BASE_URL}/path`, {\n  method: 'POST',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify(varName)\n});
  c = c.replace(
    /const response = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\((\w+)\)\s*\}\);/g,
    (_, path, bodyVar) => `const response = await request(app)\n        .post('${path}')\n        .send(${bodyVar});`
  );

  // 5. Transform simple GET fetch calls
  c = c.replace(
    /const response = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`\);/g,
    (_, path) => `const response = await request(app)\n        .get('${path}');`
  );

  // 6. Remove "const result = await response.json();" lines
  c = c.replace(/\s*const result = await response\.json\(\);\n/g, '\n');

  // 7. Replace all "result." references with "response.body."
  c = c.replace(/\bresult\./g, 'response.body.');

  writeFileSync(file, c);
  console.log(`✅ Done: ${file}`);
}
