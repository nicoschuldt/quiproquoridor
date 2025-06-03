import 'dotenv/config';
import axios from 'axios';
import { config } from './config';

// Test configuration
const BASE_URL = `http://localhost:${config.port}`;
const API_URL = `${BASE_URL}/api`;

// Test user credentials (from seed data)
const TEST_USER = {
  username: 'alice',
  password: 'password123'
};

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

class ShopAPITester {
  private token: string = '';
  private results: TestResult[] = [];

  private logTest(test: string, passed: boolean, error?: string, data?: any) {
    this.results.push({ test, passed, error, data });
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${test}`);
    if (error) console.log(`   Error: ${error}`);
    if (data && passed) console.log(`   Data:`, JSON.stringify(data, null, 2));
  }

  async login(): Promise<boolean> {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, TEST_USER);
      const data = response.data as any;
      
      if (data.success && data.data.token) {
        this.token = data.data.token;
        this.logTest('Login', true, undefined, { username: data.data.user.username });
        return true;
      } else {
        this.logTest('Login', false, 'Invalid response format');
        return false;
      }
    } catch (error: any) {
      this.logTest('Login', false, error.message);
      return false;
    }
  }

  async testGetShopData(): Promise<boolean> {
    try {
      const response = await axios.get(`${API_URL}/shop/data`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const data = response.data as any;
      if (data.success) {
        const { available, owned, selected, coinBalance } = data.data;
        
        const isValid = Array.isArray(available) && 
                       Array.isArray(owned) && 
                       typeof selected === 'object' &&
                       typeof coinBalance === 'number';

        this.logTest('Get Shop Data', isValid, undefined, {
          availableCount: available.length,
          ownedCount: owned.length,
          coinBalance,
          selectedThemes: selected
        });
        return isValid;
      } else {
        this.logTest('Get Shop Data', false, 'API returned success: false');
        return false;
      }
    } catch (error: any) {
      this.logTest('Get Shop Data', false, error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  async testPurchaseTheme(): Promise<boolean> {
    try {
      // First get available themes
      const shopResponse = await axios.get(`${API_URL}/shop/data`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const available = (shopResponse.data as any).data.available;
      if (available.length === 0) {
        this.logTest('Purchase Theme', false, 'No available themes to purchase');
        return false;
      }

      // Try to purchase the first available theme
      const themeToPurchase = available[0];
      const purchaseResponse = await axios.post(`${API_URL}/shop/purchase`, {
        shopItemId: themeToPurchase.id
      }, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const purchaseData = purchaseResponse.data as any;
      if (purchaseData.success) {
        this.logTest('Purchase Theme', true, undefined, {
          purchasedTheme: themeToPurchase.name,
          newBalance: purchaseData.data.newBalance
        });
        return true;
      } else {
        this.logTest('Purchase Theme', false, 'Purchase API returned success: false');
        return false;
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      // Check if this is an expected error (insufficient funds, already owned)
      if (errorMessage.includes('Insufficient coins') || errorMessage.includes('already own')) {
        this.logTest('Purchase Theme (Expected Error)', true, undefined, { expectedError: errorMessage });
        return true;
      }
      
      this.logTest('Purchase Theme', false, errorMessage);
      return false;
    }
  }

  async testSelectTheme(): Promise<boolean> {
    try {
      // First get owned themes
      const shopResponse = await axios.get(`${API_URL}/shop/data`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      const owned = (shopResponse.data as any).data.owned;
      
      // Test selecting default theme (should always work)
      const defaultResponse = await axios.post(`${API_URL}/shop/select-theme`, {
        themeType: 'board',
        cssClass: 'default'
      }, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (!(defaultResponse.data as any).success) {
        this.logTest('Select Default Theme', false, 'Failed to select default theme');
        return false;
      }

      this.logTest('Select Default Theme', true);

      // Test selecting owned theme (if any)
      if (owned.length > 0) {
        const ownedTheme = owned[0];
        const selectResponse = await axios.post(`${API_URL}/shop/select-theme`, {
          themeType: ownedTheme.type,
          cssClass: ownedTheme.cssClass
        }, {
          headers: { Authorization: `Bearer ${this.token}` }
        });

        if ((selectResponse.data as any).success) {
          this.logTest('Select Owned Theme', true, undefined, {
            selectedTheme: ownedTheme.name,
            type: ownedTheme.type
          });
        } else {
          this.logTest('Select Owned Theme', false, 'Failed to select owned theme');
          return false;
        }
      }

      return true;
    } catch (error: any) {
      this.logTest('Select Theme', false, error.response?.data?.error?.message || error.message);
      return false;
    }
  }

  async testUnauthorizedAccess(): Promise<boolean> {
    try {
      // Test without token
      await axios.get(`${API_URL}/shop/data`);
      this.logTest('Unauthorized Access Protection', false, 'API allowed access without token');
      return false;
    } catch (error: any) {
      if (error.response?.status === 401) {
        this.logTest('Unauthorized Access Protection', true);
        return true;
      } else {
        this.logTest('Unauthorized Access Protection', false, `Expected 401, got ${error.response?.status}`);
        return false;
      }
    }
  }

  async testInvalidRequests(): Promise<boolean> {
    try {
      // Test purchasing non-existent theme
      const invalidPurchaseResponse = await axios.post(`${API_URL}/shop/purchase`, {
        shopItemId: 'non-existent-theme'
      }, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      this.logTest('Invalid Purchase Protection', false, 'API allowed purchasing non-existent theme');
      return false;
    } catch (error: any) {
      if (error.response?.status === 404) {
        this.logTest('Invalid Purchase Protection', true);
        return true;
      } else {
        this.logTest('Invalid Purchase Protection', false, `Expected 404, got ${error.response?.status}`);
        return false;
      }
    }
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting Shop API Tests...\n');

    // Test authentication
    if (!(await this.login())) {
      console.log('❌ Authentication failed, stopping tests');
      return;
    }

    // Run all API tests
    await this.testUnauthorizedAccess();
    await this.testGetShopData();
    await this.testPurchaseTheme();
    await this.testSelectTheme();
    await this.testInvalidRequests();

    // Summary
    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('🎉 All shop API tests passed!');
    } else {
      console.log('❌ Some tests failed. Review the errors above.');
      process.exit(1);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ShopAPITester();
  
  // Wait a bit for server to be ready
  setTimeout(() => {
    tester.runAllTests()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Test suite failed:', error);
        process.exit(1);
      });
  }, 1000);
}

export { ShopAPITester }; 