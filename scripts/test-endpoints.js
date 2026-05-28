#!/usr/bin/env node
/**
 * TeleVerse Automated API Verification Tool
 * 
 * A zero-dependency validation script designed for QA testers to instantly verify 
 * functional baseline endpoints (Phase 1) across local or production environments.
 * 
 * Usage:
 *   node scripts/test-endpoints.js                         # Tests Hugging Face live URL
 *   TARGET_URL=http://localhost:4000 node test-endpoints.js  # Tests local API Gateway
 */

const TARGET_URL = process.env.TARGET_URL || 'https://talpadeavi20-televerse.hf.space';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

console.log(`${BLUE}==================================================${RESET}`);
console.log(`📡 TeleVerse Automated Endpoint Tester`);
console.log(`Target Host: ${YELLOW}${TARGET_URL}${RESET}`);
console.log(`${BLUE}==================================================${RESET}\n`);

async function runTest(name, path, options = {}) {
  const url = `${TARGET_URL.replace(/\/$/, '')}${path}`;
  const method = options.method || 'GET';
  
  process.stdout.write(`🧪 [TEST] ${name} (${method} ${path})... `);
  
  try {
    const res = await fetch(url, {
      method,
      headers: options.headers || {},
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    
    const bodyText = await res.text();
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (e) {
      // Not JSON, that's fine
    }

    const passed = options.validate(res.status, parsedBody, bodyText);

    if (passed) {
      console.log(`${GREEN}PASSED (HTTP ${res.status})${RESET}`);
      return true;
    } else {
      console.log(`${RED}FAILED (HTTP ${res.status})${RESET}`);
      console.log(`   Expected criteria not met.`);
      console.log(`   Response Body: ${bodyText.slice(0, 200)}...`);
      return false;
    }
  } catch (error) {
    console.log(`${RED}CRITICAL ERROR${RESET}`);
    console.error(`   Error during request:`, error.message);
    return false;
  }
}

async function runAllTests() {
  let allPassed = true;

  // 1. Health API Validation
  const t1 = await runTest(
    'Verify Gateway Health Indicator',
    '/health',
    {
      validate: (status, body) => status === 200 && body && body.status === 'ok'
    }
  );
  if (!t1) allPassed = false;

  // 2. REST API Documentation Page
  const t2 = await runTest(
    'Verify Interactive Swagger UI Loads',
    '/docs',
    {
      validate: (status, body, rawText) => status === 200 && rawText.includes('html') && rawText.includes('swagger')
    }
  );
  if (!t2) allPassed = false;

  // 3. Protected Resource Router Guards
  const t3 = await runTest(
    'Verify File Endpoint Auth Guard (JWT)',
    '/v1/files',
    {
      validate: (status) => status === 401
    }
  );
  if (!t3) allPassed = false;

  // 4. Registration Endpoint Signature
  const t4 = await runTest(
    'Verify Authentication Sign-Up Handler API Structure',
    '/v1/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'invalid-email', password: '123' }, // Triggering validation response
      validate: (status, body) => status === 400 // Should reject bad email with 400 Bad Request
    }
  );
  if (!t4) allPassed = false;

  console.log(`\n${BLUE}==================================================${RESET}`);
  if (allPassed) {
    console.log(`${GREEN}🎉 SUCCESS: All Phase 1 baseline checks passed!${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}❌ FAILURE: Some core tests failed to validate.${RESET}`);
    process.exit(1);
  }
}

runAllTests();
