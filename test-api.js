const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

// Test configuration
const testUser = {
  mobile_number: '+1234567890',
  name: 'Test User',
  email: 'test@example.com',
  password: 'password123'
};

let authToken = null;

// Helper function to make API requests
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error in ${method} ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
}

// Test functions
async function testHealthCheck() {
  console.log('\n🔍 Testing health check...');
  const response = await makeRequest('GET', '/health');
  console.log('Health check response:', response);
}

async function testSendOTP() {
  console.log('\n📱 Testing OTP sending...');
  const response = await makeRequest('POST', '/auth/send-otp', {
    mobile_number: testUser.mobile_number
  });
  console.log('OTP response:', response);
  return response?.otp;
}

async function testSignup(otp) {
  console.log('\n👤 Testing user signup...');
  const response = await makeRequest('POST', '/auth/signup', {
    ...testUser,
    otp
  });
  console.log('Signup response:', response);
  return response?.token;
}

async function testLogin(otp) {
  console.log('\n🔐 Testing user login...');
  const response = await makeRequest('POST', '/auth/verify-otp', {
    mobile_number: testUser.mobile_number,
    otp
  });
  console.log('Login response:', response);
  return response?.token;
}

async function testUserProfile(token) {
  console.log('\n👤 Testing user profile...');
  const response = await makeRequest('GET', '/user/me', null, {
    'Authorization': `Bearer ${token}`
  });
  console.log('Profile response:', response);
}

async function testCreateChatroom(token) {
  console.log('\n💬 Testing chatroom creation...');
  const response = await makeRequest('POST', '/chatroom', {
    name: 'Test Chatroom',
    description: 'A test chatroom for API testing'
  }, {
    'Authorization': `Bearer ${token}`
  });
  console.log('Chatroom creation response:', response);
  return response?.chatroom?.id;
}

async function testSendMessage(token, chatroomId) {
  console.log('\n💭 Testing message sending...');
  const response = await makeRequest('POST', `/chatroom/${chatroomId}/message`, {
    content: 'Hello, AI! This is a test message.'
  }, {
    'Authorization': `Bearer ${token}`
  });
  console.log('Message sending response:', response);
  return response?.message?.id;
}

async function testGetChatrooms(token) {
  console.log('\n📋 Testing chatroom listing...');
  const response = await makeRequest('GET', '/chatroom', null, {
    'Authorization': `Bearer ${token}`
  });
  console.log('Chatrooms response:', response);
}

async function testSubscriptionPlans(token) {
  console.log('\n💳 Testing subscription plans...');
  const response = await makeRequest('GET', '/subscription/plans', null, {
    'Authorization': `Bearer ${token}`
  });
  console.log('Subscription plans response:', response);
}

async function testUserStats(token) {
  console.log('\n📊 Testing user statistics...');
  const response = await makeRequest('GET', '/user/stats', null, {
    'Authorization': `Bearer ${token}`
  });
  console.log('User stats response:', response);
}

// Main test function
async function runTests() {
  console.log('🚀 Starting API tests...\n');

  // Test health check
  await testHealthCheck();

  // Test OTP sending
  const otp = await testSendOTP();
  if (!otp) {
    console.log('❌ Failed to get OTP, stopping tests');
    return;
  }

  // Test signup
  const signupToken = await testSignup(otp);
  if (signupToken) {
    authToken = signupToken;
  } else {
    // Try login if signup failed (user might already exist)
    const loginToken = await testLogin(otp);
    if (loginToken) {
      authToken = loginToken;
    } else {
      console.log('❌ Failed to authenticate, stopping tests');
      return;
    }
  }

  // Test authenticated endpoints
  await testUserProfile(authToken);
  await testUserStats(authToken);
  await testSubscriptionPlans(authToken);

  const chatroomId = await testCreateChatroom(authToken);
  if (chatroomId) {
    await testGetChatrooms(authToken);
    await testSendMessage(authToken, chatroomId);
  }

  console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  makeRequest,
  testHealthCheck,
  testSendOTP,
  testSignup,
  testLogin,
  testUserProfile,
  testCreateChatroom,
  testSendMessage,
  testGetChatrooms,
  testSubscriptionPlans,
  testUserStats
}; 