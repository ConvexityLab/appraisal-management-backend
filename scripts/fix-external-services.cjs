const { readFileSync, writeFileSync } = require('fs');

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
      "import { describe, it, expect, beforeAll } from 'vitest';\nimport request from 'supertest';\nimport { AppraisalManagementAPIServer } from '../../src/api/api-server';\nimport type { Application } from 'express';"
    );
  }

  // 2. Remove API_BASE_URL line
  c = c.replace(/const API_BASE_URL = .*\n/, '');

  // 3. Replace the beforeAll connectivity check with in-process server setup
  c = c.replace(
    /  beforeAll\(async \(\) => \{[\s\S]*?\}, TEST_TIMEOUT\);/,
    '  let serverInstance;\n  let app;\n\n  beforeAll(async () => {\n    serverInstance = new AppraisalManagementAPIServer(0);\n    app = serverInstance.getExpressApp();\n    // No initDb() needed — property intelligence does not use the DB\n  }, 60_000);'
  );

  // 4. Transform multiline POST fetch calls
  c = c.replace(
    /const response = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`, \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\((\w+)\)\s*\}\);/g,
    function(_, path, bodyVar) {
      return "const response = await request(app)\n        .post('" + path + "')\n        .send(" + bodyVar + ");";
    }
  );

  // 5. Transform simple GET fetch calls
  c = c.replace(
    /const response = await fetch\(`\$\{API_BASE_URL\}(\/[^`]+)`\);/g,
    function(_, path) {
      return "const response = await request(app)\n        .get('" + path + "');";
    }
  );

  // 6. Remove "const result = await response.json();" lines
  c = c.replace(/[ \t]*const result = await response\.json\(\);\n/g, '');

  // 7. Replace all "result." references with "response.body."
  c = c.replace(/\bresult\./g, 'response.body.');

  writeFileSync(file, c);
  console.log('Done: ' + file);
}
