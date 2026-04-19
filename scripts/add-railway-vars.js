#!/usr/bin/env node

const http = require('https');

const RAILWAY_TOKEN = '9a2b4b19-dff2-4dc3-83a7-9092c2c2bef4';
const PROJECT_ID = 'aea6fa7b-8f8e-4a2d-8e5f-8a2c2b3c4d5e'; // You may need to update this
const ENVIRONMENT_NAME = 'production';
const SERVICE_NAME = 'alexbet-sharp-bot'; // or 'Bot' based on the screenshot

// Variables to add
const VARIABLES = {
  SUPABASE_URL: 'https://nzhkfmepfcamrfioqwcr.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56aGtmbWVwZmNhbXJmaW9xd2NyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MTQyNjMzMCwiZXhwIjoxOTk5OTk5OTk5fQ.MqK6r_jXKGPtU7n8j1f5v6x8y9z0a1b2c3d4e5f6g7h8ThMA',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || ''
};

async function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.railway.app',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `Bearer ${RAILWAY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function addVariables() {
  console.log('🔄 Adding variables to Railway...\n');

  for (const [key, value] of Object.entries(VARIABLES)) {
    if (!value) {
      console.log(`⏭️  Skipping ${key} (value not set)`);
      continue;
    }

    try {
      // Railway API endpoint to add a variable
      const response = await makeRequest('POST', '/graphql', {
        query: `
          mutation {
            variableCreate(
              input: {
                projectId: "${PROJECT_ID}"
                environmentId: "${ENVIRONMENT_NAME}"
                serviceId: "${SERVICE_NAME}"
                name: "${key}"
                value: "${value}"
              }
            ) {
              variable {
                id
                name
              }
            }
          }
        `
      });

      if (response.status === 200) {
        console.log(`✅ ${key} added`);
      } else {
        console.log(`⚠️  ${key}: ${response.status}`);
      }
    } catch (err) {
      console.error(`❌ Error adding ${key}:`, err.message);
    }
  }

  console.log('\n✨ Done!');
}

addVariables();
