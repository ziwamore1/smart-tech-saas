/**
 * Smart Tech SaaS System - API Test Script
 * Tests all major endpoints including Model Locks and Subscription Plans
 */

const API_BASE = 'http://localhost:3001/api/v1';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(type, message, data = null) {
  const prefix = {
    success: `${colors.green}✓${colors.reset}`,
    error: `${colors.red}✗${colors.reset}`,
    info: `${colors.blue}ℹ${colors.reset}`,
    warn: `${colors.yellow}⚠${colors.reset}`,
    test: `${colors.cyan}→${colors.reset}`,
  };
  console.log(`${prefix[type] || '•'} ${message}`);
  if (data && type === 'error') {
    console.log(`  ${colors.red}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { error: error.message };
  }
}

async function testHealthCheck() {
  console.log(`\n${colors.bold}🏥 Health Check${colors.reset}`);
  console.log('─'.repeat(50));
  
  const result = await fetchAPI('/health');
  if (result.status === 200 || result.data) {
    log('success', 'Backend is running');
    return true;
  } else {
    log('error', 'Backend is not responding');
    return false;
  }
}

async function testFeatureLocks() {
  console.log(`\n${colors.bold}🔐 Feature Locks Tests${colors.reset}`);
  console.log('─'.repeat(50));

  // Test 1: Get all feature locks
  log('test', 'GET /feature-locks - Fetching all feature locks...');
  const allFeatures = await fetchAPI('/feature-locks');
  
  if (allFeatures.data?.data && Array.isArray(allFeatures.data.data)) {
    log('success', `Found ${allFeatures.data.data.length} feature locks`);
    
    // Count by tier
    const byTier = { BASIC: 0, STANDARD: 0, PREMIUM: 0 };
    const byCategory = {};
    
    allFeatures.data.data.forEach(f => {
      byTier[f.minTier] = (byTier[f.minTier] || 0) + 1;
      byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    });
    
    console.log(`\n  ${colors.cyan}Distribution by Tier:${colors.reset}`);
    Object.entries(byTier).forEach(([tier, count]) => {
      console.log(`    ${tier}: ${count} features`);
    });
    
    console.log(`\n  ${colors.cyan}Distribution by Category:${colors.reset}`);
    Object.entries(byCategory).forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count} features`);
    });
  } else {
    log('error', 'Failed to fetch feature locks', allFeatures.error || allFeatures.data);
  }

  // Test 2: Get single feature lock
  log('test', 'GET /feature-locks/:key - Fetching single feature...');
  const singleFeature = await fetchAPI('/feature-locks/timetable.generate');
  
  if (singleFeature.data?.data) {
    const feature = singleFeature.data.data;
    log('success', `Feature: ${feature.name}`);
    log('info', `  Key: ${feature.key}`);
    log('info', `  Min Tier: ${feature.minTier}`);
    log('info', `  Enabled: ${feature.isEnabled}`);
    log('info', `  Locked: ${feature.isLocked}`);
  } else {
    log('error', 'Failed to fetch single feature', singleFeature.error || singleFeature.data);
  }

  // Test 3: Check access for a school
  log('test', 'GET /subscription/check/:schoolId/:featureKey - Checking feature access...');
  const accessCheck = await fetchAPI('/subscription/check/test-school-id/timetable.generate');
  if (accessCheck.data?.hasAccess !== undefined) {
    log('success', `Access check result: ${accessCheck.data.hasAccess}`);
    if (accessCheck.data.reason) {
      log('info', `  Reason: ${accessCheck.data.reason}`);
    }
  } else {
    log('error', 'Access check failed', accessCheck.error || accessCheck.data);
  }
}

async function testSubscriptionPlans() {
  console.log(`\n${colors.bold}💳 Subscription Plans Tests${colors.reset}`);
  console.log('─'.repeat(50));

  // Test 1: Get all plans
  log('test', 'GET /subscription/plans - Fetching all plans...');
  const plans = await fetchAPI('/subscription/plans');
  
  if (plans.data?.data && Array.isArray(plans.data.data)) {
    log('success', `Found ${plans.data.data.length} subscription plans`);
    
    plans.data.data.forEach(plan => {
      console.log(`\n  ${colors.cyan}${plan.displayName} (${plan.name})${colors.reset}`);
      console.log(`    Price: ZMW ${plan.monthlyPrice}/month`);
      console.log(`    Max Students: ${plan.maxStudents === -1 ? 'Unlimited' : plan.maxStudents}`);
      console.log(`    Features: ${Array.isArray(plan.features) ? plan.features.length : 0}`);
      console.log(`    Active: ${plan.isActive}`);
    });
  } else {
    log('error', 'Failed to fetch subscription plans', plans.error || plans.data);
  }
}

async function testSchoolEndpoints() {
  console.log(`\n${colors.bold}🏫 School Endpoints Tests${colors.reset}`);
  console.log('─'.repeat(50));

  // Test 1: Get all schools
  log('test', 'GET /super-admin/schools - Fetching all schools...');
  const schools = await fetchAPI('/super-admin/schools');
  
  if (schools.data?.data && Array.isArray(schools.data.data)) {
    log('success', `Found ${schools.data.data.length} schools`);
    
    if (schools.data.data.length > 0) {
      const school = schools.data.data[0];
      console.log(`\n  ${colors.cyan}First School:${colors.reset}`);
      console.log(`    Name: ${school.name}`);
      console.log(`    Tier: ${school.subscriptionTier || 'N/A'}`);
      console.log(`    Status: ${school.subscriptionStatus || 'N/A'}`);
      console.log(`    Active: ${school.isActive}`);
      
      // Test 2: Get school features
      log('test', `GET /feature-locks/access/${school.id} - Getting school features...`);
      const schoolFeatures = await fetchAPI(`/feature-locks/access/${school.id}`);
      
      if (schoolFeatures.data?.data) {
        const sf = schoolFeatures.data.data;
        log('success', `School has access to ${sf.features?.length || 0} features`);
        log('info', `  Current Tier: ${sf.tier}`);
        log('info', `  Locked Features: ${sf.lockedFeatures?.length || 0}`);
        log('info', `  Disabled Features: ${sf.disabledFeatures?.length || 0}`);
      }
    }
  } else {
    log('error', 'Failed to fetch schools', schools.error || schools.data);
  }
}

async function testTimetableEndpoints() {
  console.log(`\n${colors.bold}📅 Timetable Endpoints Tests${colors.reset}`);
  console.log('─'.repeat(50));

  // Test 1: Get all timetables
  log('test', 'GET /timetable - Fetching all timetables...');
  const timetables = await fetchAPI('/timetable');
  
  if (timetables.status === 200 || timetables.data) {
    log('success', 'Timetable endpoint is accessible');
  } else if (timetables.status === 401) {
    log('warn', 'Timetable endpoint requires authentication (expected)');
  } else {
    log('error', 'Timetable endpoint error', timetables.error || timetables.data);
  }

  // Test 2: Get terms
  log('test', 'GET /terms - Fetching terms...');
  const terms = await fetchAPI('/terms');
  
  if (terms.status === 200 || terms.data) {
    log('success', 'Terms endpoint is accessible');
  } else if (terms.status === 401) {
    log('warn', 'Terms endpoint requires authentication (expected)');
  }
}

async function testOtherEndpoints() {
  console.log(`\n${colors.bold}📚 Other Endpoints Tests${colors.reset}`);
  console.log('─'.repeat(50));

  const endpoints = [
    { path: '/subject', name: 'Subjects' },
    { path: '/class', name: 'Classes' },
    { path: '/student', name: 'Students' },
    { path: '/teacher', name: 'Teachers' },
  ];

  for (const endpoint of endpoints) {
    log('test', `GET ${endpoint.path} - Testing ${endpoint.name}...`);
    const result = await fetchAPI(endpoint.path);
    
    if (result.status === 200) {
      log('success', `${endpoint.name} endpoint accessible`);
    } else if (result.status === 401) {
      log('warn', `${endpoint.name} requires auth`);
    } else if (result.status === 404) {
      log('warn', `${endpoint.name} not found`);
    } else {
      log('error', `${endpoint.name} error`, result.error || result.data);
    }
  }
}

async function runTests() {
  console.log(`${colors.bold}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Smart Tech SaaS System - API Test Suite                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  console.log(`Testing API: ${API_BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Run health check first
  const isBackendRunning = await testHealthCheck();
  
  if (!isBackendRunning) {
    log('error', 'Backend is not running. Please start the backend server:');
    console.log(`\n  cd C:\\Smart_Tech SaaS System\\backend`);
    console.log(`  npm run start:dev\n`);
    return;
  }

  // Run all test suites
  await testFeatureLocks();
  await testSubscriptionPlans();
  await testSchoolEndpoints();
  await testTimetableEndpoints();
  await testOtherEndpoints();

  // Summary
  console.log(`\n${colors.bold}╔════════════════════════════════════════════════════════════╗`);
  console.log('║   Test Summary                                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}`);
  console.log(`✅ Test completed at ${new Date().toISOString()}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Start frontend: npm run dev (in frontend folder)`);
  console.log(`  2. Open browser: http://localhost:3000`);
  console.log(`  3. Login as Super Admin to test Model Locks`);
  console.log(`  4. Navigate to /super-admin/model-locks for feature management`);
  console.log(`  5. Navigate to /super-admin/subscription-plans for plan management\n`);
}

// Run tests
runTests().catch(console.error);
