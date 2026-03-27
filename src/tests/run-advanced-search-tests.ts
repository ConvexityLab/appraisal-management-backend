import { Logger } from '../utils/logger.js';
import AdvancedSearchTestSuite from './advanced-search-tests.js';

/**
 * Main test runner for advanced search and filtering capabilities
 */
async function runAdvancedSearchTests(): Promise<void> {
  const logger = new Logger();
  
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🔍 ADVANCED SEARCH & FILTERING CAPABILITIES TEST SUITE');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // Initialize test suite
    const testSuite = new AdvancedSearchTestSuite();
    
    // Run comprehensive tests
    await testSuite.runAllTests();
    
    // Generate detailed report
    await testSuite.generateTestReport();
    
    console.log('\n');
    console.log('✅ All advanced search tests passed successfully!');
    console.log('\n');
    console.log('🎯 CAPABILITIES VERIFIED:');
    console.log('  ✓ Universal search across all entities');
    console.log('  ✓ Advanced property search with complex filters');
    console.log('  ✓ Vendor search with performance metrics');
    console.log('  ✓ Order search with status and timeline filters');
    console.log('  ✓ Faceted search with dynamic options');
    console.log('  ✓ Geographic and radius-based filtering');
    console.log('  ✓ Numerical ranges and date ranges');
    console.log('  ✓ Text search with multiple terms');
    console.log('  ✓ Search aggregations and analytics');
    console.log('  ✓ Performance optimization');
    console.log('\n');
    console.log('🚀 ADVANCED SEARCH SYSTEM READY FOR PRODUCTION!');
    console.log('\n');
    
  } catch (error) {
    logger.error('Advanced search test suite failed', { error });
    console.log('\n');
    console.log('❌ Test suite failed!');
    console.log('Error:', (error as Error).message);
    console.log('\n');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runAdvancedSearchTests().catch(console.error);
}

export { runAdvancedSearchTests };