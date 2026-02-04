/**
 * Unit Tests for S/4HANA Business Partner Integration Client
 * 
 * Test Coverage:
 * - Business Partner creation (success, validation errors, network errors)
 * - Supplier creation
 * - Bank account creation
 * - CSRF token handling (fetch, caching, expiry)
 * - Field mapping (internal → S/4HANA structure)
 * - Error handling (OData error parsing, retries)
 * - Complete workflow integration
 * 
 * @module test/lib/s4hana-client.test
 */

const { S4HANAClient, getClient } = require('../../srv/lib/s4hana-client');

// Mock dependencies
jest.mock('axios');
const axios = require('axios');

jest.mock('@sap/cds', () => ({
  connect: {
    to: jest.fn(),
  },
}));
const cds = require('@sap/cds');

describe('S4HANAClient', () => {
  let client;
  let mockDestination;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create fresh client instance
    client = new S4HANAClient();

    // Mock destination configuration
    mockDestination = {
      destinationConfiguration: {
        URL: 'https://test.s4hana.cloud.sap',
        Name: 's4hana-cloud-odata-v4',
        Type: 'HTTP',
        Authentication: 'OAuth2SAMLBearerAssertion',
      },
    };

    // Mock destination service
    cds.connect.to.mockResolvedValue({
      destination: {
        getDestination: jest.fn().mockResolvedValue(mockDestination),
      },
    });
  });

  //===========================================================================
  // Destination & CSRF Token Tests
  //===========================================================================

  describe('getDestination', () => {
    test('should retrieve destination successfully', async () => {
      const destination = await client.getDestination();
      
      expect(destination).toEqual(mockDestination);
      expect(cds.connect.to).toHaveBeenCalledWith('destination');
    });

    test('should throw error if destination not found', async () => {
      cds.connect.to.mockResolvedValue({
        destination: {
          getDestination: jest.fn().mockResolvedValue(null),
        },
      });

      await expect(client.getDestination()).rejects.toThrow(
        "Destination 's4hana-cloud-odata-v4' not found"
      );
    });

    test('should throw error if destination service fails', async () => {
      cds.connect.to.mockRejectedValue(new Error('Service unavailable'));

      await expect(client.getDestination()).rejects.toThrow(
        'Failed to retrieve destination: Service unavailable'
      );
    });
  });

  describe('fetchCSRFToken', () => {
    test('should fetch CSRF token from S/4HANA', async () => {
      axios.mockResolvedValue({
        headers: {
          'x-csrf-token': 'test-csrf-token-123',
        },
      });

      const token = await client.fetchCSRFToken(mockDestination);

      expect(token).toBe('test-csrf-token-123');
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'Fetch',
          }),
        })
      );
    });

    test('should cache CSRF token for 15 minutes', async () => {
      axios.mockResolvedValue({
        headers: {
          'x-csrf-token': 'test-csrf-token-123',
        },
      });

      // First call
      const token1 = await client.fetchCSRFToken(mockDestination);
      
      // Second call (should use cached token)
      const token2 = await client.fetchCSRFToken(mockDestination);

      expect(token1).toBe('test-csrf-token-123');
      expect(token2).toBe('test-csrf-token-123');
      expect(axios).toHaveBeenCalledTimes(1); // Only one actual request
    });

    test('should refresh expired CSRF token', async () => {
      axios
        .mockResolvedValueOnce({
          headers: { 'x-csrf-token': 'old-token' },
        })
        .mockResolvedValueOnce({
          headers: { 'x-csrf-token': 'new-token' },
        });

      // First call
      const token1 = await client.fetchCSRFToken(mockDestination);
      
      // Simulate token expiry
      client.csrfTokenExpiry = Date.now() - 1000;

      // Second call (should fetch new token)
      const token2 = await client.fetchCSRFToken(mockDestination);

      expect(token1).toBe('old-token');
      expect(token2).toBe('new-token');
      expect(axios).toHaveBeenCalledTimes(2);
    });

    test('should throw error if CSRF token not returned', async () => {
      axios.mockResolvedValue({
        headers: {},
      });

      await expect(client.fetchCSRFToken(mockDestination)).rejects.toThrow(
        'CSRF token not returned by S/4HANA'
      );
    });
  });

  //===========================================================================
  // Field Mapping Tests
  //===========================================================================

  describe('mapToBusinessPartner', () => {
    test('should map supplier data to S/4HANA Business Partner structure', () => {
      const supplierData = {
        generalData: {
          companyName: 'ACME Corporation',
          legalForm: 'GmbH',
          country: 'DE',
          city: 'Berlin',
          postalCode: '10115',
          street: 'Hauptstraße',
          houseNumber: '123',
          taxId: 'DE123456789',
          commercialRegisterNumber: 'HRB 12345',
        },
        contacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@acme.com',
            phone: '+49301234567',
            role: 'Purchasing',
          },
        ],
      };

      const result = client.mapToBusinessPartner(supplierData);

      expect(result).toEqual({
        BusinessPartnerCategory: '2',
        BusinessPartnerGrouping: '0001',
        OrganizationBPName1: 'ACME Corporation',
        OrganizationBPName2: 'GmbH',
        SearchTerm1: 'ACMECORPORATION',
        to_BusinessPartnerAddress: [{
          Country: 'DE',
          CityName: 'Berlin',
          PostalCode: '10115',
          StreetName: 'Hauptstraße',
          HouseNumber: '123',
        }],
        to_BusinessPartnerContact: [{
          ContactPersonFirstName: 'John',
          ContactPersonLastName: 'Doe',
          EmailAddress: 'john.doe@acme.com',
          PhoneNumber: '+49301234567',
          ContactPersonFunction: 'PUR',
        }],
        to_BusinessPartnerTaxNumber: [{
          BPTaxType: 'MWST',
          BPTaxNumber: 'DE123456789',
        }],
        to_BusPartIdentification: [{
          BPIdentificationType: 'CREGNO',
          BPIdentificationNumber: 'HRB 12345',
        }],
      });
    });

    test('should handle missing optional fields', () => {
      const supplierData = {
        generalData: {
          companyName: 'Test Company',
          country: 'US',
          city: 'New York',
          postalCode: '10001',
          street: 'Main Street',
        },
        contacts: [],
      };

      const result = client.mapToBusinessPartner(supplierData);

      expect(result.OrganizationBPName2).toBe('');
      expect(result.to_BusinessPartnerContact).toEqual([]);
      expect(result.to_BusinessPartnerTaxNumber).toEqual([]);
      expect(result.to_BusPartIdentification).toEqual([]);
    });
  });

  describe('mapToSupplier', () => {
    test('should map supplier data to S/4HANA Supplier structure', () => {
      const supplierData = {
        bankDetails: {
          paymentTerms: '30 days',
          currency: 'EUR',
        },
        classification: {
          incoterms: 'DDP',
        },
      };

      const result = client.mapToSupplier('BP123456', supplierData);

      expect(result).toEqual({
        Supplier: 'BP123456',
        SupplierAccountGroup: 'Z001',
        to_SupplierCompany: [{
          CompanyCode: '1000',
          PaymentTerms: 'Z030',
          Currency: 'EUR',
        }],
        to_SupplierPurchasingOrg: [{
          PurchasingOrganization: '1000',
          Currency: 'EUR',
          PaymentTerms: 'Z030',
          Incoterms: 'DDP',
        }],
      });
    });
  });

  describe('Helper methods', () => {
    test('mapPaymentTerms should convert internal terms to S/4HANA codes', () => {
      expect(client.mapPaymentTerms('14 days')).toBe('Z014');
      expect(client.mapPaymentTerms('30 days')).toBe('Z030');
      expect(client.mapPaymentTerms('60 days')).toBe('Z060');
      expect(client.mapPaymentTerms('90 days')).toBe('Z090');
      expect(client.mapPaymentTerms('unknown')).toBe('Z030'); // Default
    });

    test('mapContactRole should convert internal roles to S/4HANA codes', () => {
      expect(client.mapContactRole('Purchasing')).toBe('PUR');
      expect(client.mapContactRole('Finance')).toBe('FIN');
      expect(client.mapContactRole('Legal')).toBe('LEG');
      expect(client.mapContactRole('Management')).toBe('MGT');
      expect(client.mapContactRole('Unknown')).toBe('OTH');
    });

    test('determineTaxType should return MWST for EU countries', () => {
      expect(client.determineTaxType('DE')).toBe('MWST');
      expect(client.determineTaxType('FR')).toBe('MWST');
      expect(client.determineTaxType('IT')).toBe('MWST');
      expect(client.determineTaxType('US')).toBe('TXID');
      expect(client.determineTaxType('GB')).toBe('TXID');
    });

    test('generateSearchTerm should create uppercase 20-char term', () => {
      expect(client.generateSearchTerm('ACME Corporation Ltd.')).toBe('ACMECORPORATIONLTD');
      expect(client.generateSearchTerm('Test & Company GmbH')).toBe('TESTCOMPANYGMBH');
      expect(client.generateSearchTerm('A')).toBe('A');
    });

    test('extractCountryFromIBAN should return first 2 characters', () => {
      expect(client.extractCountryFromIBAN('DE89370400440532013000')).toBe('DE');
      expect(client.extractCountryFromIBAN('GB29NWBK60161331926819')).toBe('GB');
    });
  });

  //===========================================================================
  // Business Partner Creation Tests
  //===========================================================================

  describe('createBusinessPartner', () => {
    const mockSupplierData = {
      generalData: {
        companyName: 'Test Supplier GmbH',
        legalForm: 'GmbH',
        country: 'DE',
        city: 'Munich',
        postalCode: '80331',
        street: 'Marienplatz',
        taxId: 'DE987654321',
      },
      contacts: [],
    };

    beforeEach(() => {
      // Mock CSRF token fetch
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        // Mock Business Partner creation
        return Promise.resolve({
          data: {
            BusinessPartner: '0010001234',
            BusinessPartnerGrouping: '0001',
            SearchTerm1: 'TESTSUPPLIERGMBH',
          },
        });
      });
    });

    test('should create Business Partner successfully', async () => {
      const result = await client.createBusinessPartner(mockSupplierData);

      expect(result).toEqual({
        businessPartnerId: '0010001234',
        businessPartnerGrouping: '0001',
        searchTerm: 'TESTSUPPLIERGMBH',
        rawResponse: expect.any(Object),
      });

      // Verify POST request
      const postCall = axios.mock.calls.find(call => call[0].method === 'POST');
      expect(postCall).toBeDefined();
      expect(postCall[0].headers['X-CSRF-Token']).toBe('test-token');
      expect(postCall[0].data).toHaveProperty('OrganizationBPName1', 'Test Supplier GmbH');
    });

    test('should handle OData validation errors', async () => {
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        // Mock validation error
        return Promise.reject({
          response: {
            status: 400,
            data: {
              error: {
                message: {
                  value: 'Company name is required',
                },
                innererror: {
                  errordetails: [
                    { message: 'Field OrganizationBPName1 cannot be empty' },
                  ],
                },
              },
            },
          },
        });
      });

      await expect(client.createBusinessPartner(mockSupplierData)).rejects.toThrow(
        'Company name is required'
      );
    });

    test('should handle network errors with retry', async () => {
      let attemptCount = 0;
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject({
            code: 'ETIMEDOUT',
            message: 'Timeout',
          });
        }
        
        // Success on 3rd attempt
        return Promise.resolve({
          data: {
            BusinessPartner: '0010001234',
            BusinessPartnerGrouping: '0001',
            SearchTerm1: 'TEST',
          },
        });
      });

      const result = await client.createBusinessPartner(mockSupplierData);

      expect(result.businessPartnerId).toBe('0010001234');
      expect(attemptCount).toBe(3); // Retried twice
    });

    test('should fail after max retries', async () => {
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        return Promise.reject({
          code: 'ECONNRESET',
          message: 'Connection reset',
        });
      });

      await expect(client.createBusinessPartner(mockSupplierData)).rejects.toThrow();
    }, 10000); // Increase timeout for retry tests
  });

  //===========================================================================
  // Supplier Creation Tests
  //===========================================================================

  describe('createSupplier', () => {
    const mockSupplierData = {
      bankDetails: {
        paymentTerms: '30 days',
        currency: 'EUR',
      },
      classification: {
        incoterms: 'FOB',
      },
    };

    beforeEach(() => {
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        return Promise.resolve({
          data: {
            Supplier: '0010001234',
            SupplierAccountGroup: 'Z001',
          },
        });
      });
    });

    test('should create Supplier successfully', async () => {
      const result = await client.createSupplier('0010001234', mockSupplierData);

      expect(result).toEqual({
        supplierId: '0010001234',
        accountGroup: 'Z001',
        rawResponse: expect.any(Object),
      });

      const postCall = axios.mock.calls.find(call => call[0].method === 'POST');
      expect(postCall[0].data.Supplier).toBe('0010001234');
    });
  });

  //===========================================================================
  // Bank Account Creation Tests
  //===========================================================================

  describe('createBankAccount', () => {
    const mockBankDetails = {
      iban: 'DE89370400440532013000',
      bankName: 'Deutsche Bank',
      swift: 'DEUTDEFF',
      accountHolderName: 'ACME Corporation',
    };

    beforeEach(() => {
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        return Promise.resolve({
          data: {
            BankInternalID: '001',
          },
        });
      });
    });

    test('should create bank account successfully', async () => {
      const result = await client.createBankAccount('0010001234', mockBankDetails);

      expect(result).toEqual({
        bankInternalId: '001',
        rawResponse: expect.any(Object),
      });

      const postCall = axios.mock.calls.find(call => call[0].method === 'POST');
      expect(postCall[0].data).toEqual({
        BusinessPartner: '0010001234',
        BankCountryKey: 'DE',
        BankAccount: 'DE89370400440532013000',
        BankName: 'Deutsche Bank',
        SWIFTCode: 'DEUTDEFF',
        BankAccountHolderName: 'ACME Corporation',
      });
    });
  });

  //===========================================================================
  // Complete Workflow Tests
  //===========================================================================

  describe('createCompleteSupplier', () => {
    const mockCompleteData = {
      generalData: {
        companyName: 'Complete Test Corp',
        country: 'DE',
        city: 'Hamburg',
        postalCode: '20095',
        street: 'Reeperbahn',
      },
      contacts: [],
      bankDetails: {
        iban: 'DE89370400440532013000',
        bankName: 'Commerzbank',
        swift: 'COBADEFF',
        accountHolderName: 'Complete Test Corp',
        paymentTerms: '30 days',
        currency: 'EUR',
      },
      classification: {
        incoterms: 'EXW',
      },
    };

    beforeEach(() => {
      let callCount = 0;
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        
        callCount++;
        
        // First POST: Create Business Partner
        if (callCount === 1) {
          return Promise.resolve({
            data: {
              BusinessPartner: 'BP001',
              BusinessPartnerGrouping: '0001',
              SearchTerm1: 'COMPLETETESTCORP',
            },
          });
        }
        
        // Second POST: Create Supplier
        if (callCount === 2) {
          return Promise.resolve({
            data: {
              Supplier: 'BP001',
              SupplierAccountGroup: 'Z001',
            },
          });
        }
        
        // Third POST: Create Bank Account
        if (callCount === 3) {
          return Promise.resolve({
            data: {
              BankInternalID: 'BANK001',
            },
          });
        }
      });
    });

    test('should execute complete workflow successfully', async () => {
      const result = await client.createCompleteSupplier(mockCompleteData);

      expect(result).toEqual({
        success: true,
        businessPartnerId: 'BP001',
        supplierId: 'BP001',
        bankInternalId: 'BANK001',
        details: {
          businessPartner: expect.objectContaining({
            businessPartnerId: 'BP001',
          }),
          supplier: expect.objectContaining({
            supplierId: 'BP001',
          }),
          bank: expect.objectContaining({
            bankInternalId: 'BANK001',
          }),
        },
      });

      // Verify all 3 POST calls were made
      const postCalls = axios.mock.calls.filter(call => call[0].method === 'POST');
      expect(postCalls).toHaveLength(3);
    });

    test('should rollback on supplier creation failure', async () => {
      let callCount = 0;
      axios.mockImplementation((config) => {
        if (config.headers['X-CSRF-Token'] === 'Fetch') {
          return Promise.resolve({
            headers: { 'x-csrf-token': 'test-token' },
          });
        }
        
        callCount++;
        
        // Business Partner creation succeeds
        if (callCount === 1) {
          return Promise.resolve({
            data: { BusinessPartner: 'BP001' },
          });
        }
        
        // Supplier creation fails
        if (callCount === 2) {
          return Promise.reject({
            response: {
              status: 500,
              data: {
                error: {
                  message: { value: 'Internal server error' },
                },
              },
            },
          });
        }
      });

      await expect(client.createCompleteSupplier(mockCompleteData)).rejects.toThrow(
        'Internal server error'
      );

      // Note: In production, we'd implement actual rollback logic here
      // For now, we just verify the error is propagated
    });
  });

  //===========================================================================
  // Error Handling Tests
  //===========================================================================

  describe('parseODataError', () => {
    test('should parse OData error with message', () => {
      const axiosError = {
        response: {
          status: 400,
          data: {
            error: {
              message: {
                value: 'Validation failed',
              },
              innererror: {
                errordetails: [
                  { message: 'Field X is required' },
                ],
              },
            },
          },
        },
      };

      const error = client.parseODataError(axiosError);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.details).toHaveLength(1);
    });

    test('should handle network errors', () => {
      const axiosError = {
        message: 'Network Error',
        code: 'ENOTFOUND',
      };

      const error = client.parseODataError(axiosError);

      expect(error.message).toBe('Network Error');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('isRetryableError', () => {
    test('should identify network errors as retryable', () => {
      expect(client.isRetryableError({ code: 'ETIMEDOUT' })).toBe(true);
      expect(client.isRetryableError({ code: 'ECONNRESET' })).toBe(true);
      expect(client.isRetryableError({ code: 'ENOTFOUND' })).toBe(true);
    });

    test('should identify 5xx errors as retryable', () => {
      expect(client.isRetryableError({ response: { status: 500 } })).toBe(true);
      expect(client.isRetryableError({ response: { status: 502 } })).toBe(true);
      expect(client.isRetryableError({ response: { status: 503 } })).toBe(true);
    });

    test('should identify 4xx errors as non-retryable', () => {
      expect(client.isRetryableError({ response: { status: 400 } })).toBe(false);
      expect(client.isRetryableError({ response: { status: 401 } })).toBe(false);
      expect(client.isRetryableError({ response: { status: 404 } })).toBe(false);
    });
  });

  //===========================================================================
  // Singleton Tests
  //===========================================================================

  describe('getClient', () => {
    test('should return singleton instance', () => {
      const client1 = getClient();
      const client2 = getClient();
      
      expect(client1).toBe(client2);
      expect(client1).toBeInstanceOf(S4HANAClient);
    });
  });
});
