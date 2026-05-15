import jwt from 'jsonwebtoken';
const secret = process.argv[2];
const token = jwt.sign({
  sub: 'axiom-live-fire-user', name: 'Axiom Live Fire', email: 'axiom-live-fire@test.local',
  role: 'admin', tenantId: '885097ba-35ea-48db-be7a-a0aa7ff451bd', clientId: 'client-001',
  iss: 'appraisal-management-test', aud: 'appraisal-management-api', isTestToken: true,
}, secret, { expiresIn: '1h' });
console.log(token);
