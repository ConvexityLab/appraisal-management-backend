/**
 * API Integration Demo
 * Demonstrates the comprehensive API functionality including property intelligence
 */

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

class APIDemo {
  private authToken: string = '';

  async runDemo(): Promise<void> {
    console.log('\n🚀 Appraisal Management API Integration Demo');
    console.log('==============================================\n');

    try {
      // Step 1: Authentication
      await this.authenticateUser();

      // Step 2: Property Intelligence Demo
      await this.demonstratePropertyIntelligence();

      // Step 3: Order Management Demo
      await this.demonstrateOrderManagement();

      // Step 4: Dynamic Code Execution Demo
      await this.demonstrateDynamicCodeExecution();

      // Step 5: Analytics Demo
      await this.demonstrateAnalytics();

      console.log('\n✅ All API demonstrations completed successfully!');

    } catch (error: any) {
      console.error('\n❌ Demo failed:', error.message || error);
    }
  }

  private async authenticateUser(): Promise<void> {
    console.log('🔐 Step 1: User Authentication');
    console.log('------------------------------');

    try {
      // Register a demo user
      const registerResponse = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        email: 'demo@example.com',
        password: 'DemoPassword123',
        firstName: 'Demo',
        lastName: 'User',
        role: 'admin'
      });

      console.log('✅ User registered successfully');

      // Login to get token
      const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: 'demo@example.com',
        password: 'DemoPassword123'
      });

      this.authToken = loginResponse.data.token;
      console.log('✅ User authenticated successfully');
      console.log(`   Token: ${this.authToken.substring(0, 20)}...`);

    } catch (error: any) {
      if (error.response?.status === 409) {
        // User already exists, try to login
        const loginResponse = await axios.post(`${API_BASE_URL}/api/auth/login`, {
          email: 'demo@example.com',
          password: 'DemoPassword123'
        });
        this.authToken = loginResponse.data.token;
        console.log('✅ Existing user authenticated successfully');
      } else {
        throw error;
      }
    }
  }

  private async demonstratePropertyIntelligence(): Promise<void> {
    console.log('\n🏠 Step 2: Property Intelligence APIs');
    console.log('------------------------------------');

    const headers = { Authorization: `Bearer ${this.authToken}` };

    // Address Geocoding
    console.log('📍 Testing address geocoding...');
    const geocodeResponse = await axios.post(
      `${API_BASE_URL}/api/property-intelligence/address/geocode`,
      { address: '1600 Amphitheatre Parkway, Mountain View, CA' },
      { headers }
    );
    console.log(`   ✅ Geocoded to: ${geocodeResponse.data.data[0]?.latitude}, ${geocodeResponse.data.data[0]?.longitude}`);

    // Address Validation
    console.log('✅ Testing address validation...');
    const validateResponse = await axios.post(
      `${API_BASE_URL}/api/property-intelligence/address/validate`,
      { address: '1600 Amphitheatre Parkway, Mountain View, CA 94043' },
      { headers }
    );
    console.log(`   ✅ Address validation: ${validateResponse.data.success ? 'Valid' : 'Invalid'}`);

    // Comprehensive Property Analysis
    console.log('🔍 Testing comprehensive property analysis...');
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/property-intelligence/analyze/comprehensive`,
      {
        latitude: 37.4224764,
        longitude: -122.0842499,
        strategy: 'quality_first'
      },
      { headers }
    );
    console.log(`   ✅ Analysis completed with ${Object.keys(analysisResponse.data.data || {}).length} data points`);

    // Creative Features Analysis
    console.log('🎨 Testing creative features analysis...');
    const creativeResponse = await axios.post(
      `${API_BASE_URL}/api/property-intelligence/analyze/creative`,
      {
        latitude: 37.4224764,
        longitude: -122.0842499,
        features: ['coffee_accessibility', 'instagrammability']
      },
      { headers }
    );
    console.log(`   ✅ Creative analysis: ${creativeResponse.data.success ? 'Completed' : 'Failed'}`);

    // Census Data
    console.log('📊 Testing census data endpoints...');
    const censusResponse = await axios.get(
      `${API_BASE_URL}/api/property-intelligence/census/demographics?latitude=37.4224764&longitude=-122.0842499`,
      { headers }
    );
    console.log(`   ✅ Census demographics: ${censusResponse.data.success ? 'Retrieved' : 'Failed'}`);
  }

  private async demonstrateOrderManagement(): Promise<void> {
    console.log('\n📋 Step 3: Order Management APIs');
    console.log('--------------------------------');

    const headers = { Authorization: `Bearer ${this.authToken}` };

    // Create Order
    console.log('📝 Creating new appraisal order...');
    const orderResponse = await axios.post(
      `${API_BASE_URL}/api/orders`,
      {
        propertyAddress: '1600 Amphitheatre Parkway, Mountain View, CA 94043',
        clientId: '123e4567-e89b-12d3-a456-426614174000',
        orderType: 'purchase',
        priority: 'standard',
        dueDate: '2024-12-31T23:59:59.000Z'
      },
      { headers }
    );
    const orderId = orderResponse.data.orderId;
    console.log(`   ✅ Order created: ${orderId}`);

    // Get Orders
    console.log('📖 Retrieving orders list...');
    const ordersResponse = await axios.get(
      `${API_BASE_URL}/api/orders?limit=5`,
      { headers }
    );
    console.log(`   ✅ Retrieved ${ordersResponse.data.orders?.length || 0} orders`);

    // Update Order Status
    console.log('🔄 Updating order status...');
    const updateResponse = await axios.put(
      `${API_BASE_URL}/api/orders/${orderId}/status`,
      {
        status: 'assigned',
        notes: 'Order assigned via API demo'
      },
      { headers }
    );
    console.log(`   ✅ Order status updated to: ${updateResponse.data.status}`);
  }

  private async demonstrateDynamicCodeExecution(): Promise<void> {
    console.log('\n⚡ Step 4: Dynamic Code Execution APIs');
    console.log('-------------------------------------');

    const headers = { Authorization: `Bearer ${this.authToken}` };

    // Simple calculation
    console.log('🧮 Testing simple calculation...');
    const calcResponse = await axios.post(
      `${API_BASE_URL}/api/code/execute`,
      {
        code: 'return { result: 2 + 2, message: "Math works!" };',
        timeout: 5000
      },
      { headers }
    );
    console.log(`   ✅ Calculation result: ${calcResponse.data.result?.result}`);

    // Complex business logic
    console.log('💼 Testing business logic execution...');
    const businessLogicResponse = await axios.post(
      `${API_BASE_URL}/api/code/execute`,
      {
        code: `
          const propertyValue = context.propertyValue || 500000;
          const loanAmount = context.loanAmount || 400000;
          const ltvRatio = (loanAmount / propertyValue) * 100;
          
          return {
            propertyValue,
            loanAmount,
            ltvRatio: Math.round(ltvRatio * 100) / 100,
            riskLevel: ltvRatio > 80 ? 'high' : ltvRatio > 70 ? 'medium' : 'low',
            recommendation: ltvRatio > 80 ? 'Requires additional review' : 'Standard processing'
          };
        `,
        context: {
          context: {
            propertyValue: 750000,
            loanAmount: 600000
          }
        },
        timeout: 5000
      },
      { headers }
    );
    console.log(`   ✅ LTV Ratio: ${businessLogicResponse.data.result?.ltvRatio}%`);
    console.log(`   ✅ Risk Level: ${businessLogicResponse.data.result?.riskLevel}`);
    console.log(`   ✅ Recommendation: ${businessLogicResponse.data.result?.recommendation}`);
  }

  private async demonstrateAnalytics(): Promise<void> {
    console.log('\n📈 Step 5: Analytics APIs');
    console.log('-------------------------');

    const headers = { Authorization: `Bearer ${this.authToken}` };

    try {
      // Analytics Overview
      console.log('📊 Testing analytics overview...');
      const analyticsResponse = await axios.get(
        `${API_BASE_URL}/api/analytics/overview`,
        { headers }
      );
      console.log('   ✅ Analytics overview retrieved');

      // Performance Analytics
      console.log('⚡ Testing performance analytics...');
      const performanceResponse = await axios.get(
        `${API_BASE_URL}/api/analytics/performance?groupBy=day`,
        { headers }
      );
      console.log('   ✅ Performance analytics retrieved');

    } catch (error: any) {
      if (error.response?.status === 403) {
        console.log('   ⚠️  Analytics access restricted (permission required)');
      } else {
        throw error;
      }
    }
  }

  async healthCheck(): Promise<void> {
    console.log('\n❤️  Health Check');
    console.log('----------------');

    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log(`   ✅ Server Status: ${healthResponse.data.status}`);
    console.log(`   ✅ Database: ${healthResponse.data.services?.database || 'Unknown'}`);
    console.log(`   ✅ Timestamp: ${healthResponse.data.timestamp}`);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  const demo = new APIDemo();
  
  // Start with health check
  demo.healthCheck()
    .then(() => demo.runDemo())
    .catch((error: any) => {
      console.error('\n💥 Demo execution failed:', error.message || error);
      if (error.response?.data) {
        console.error('   Response data:', JSON.stringify(error.response.data, null, 2));
      }
    });
}

export default APIDemo;