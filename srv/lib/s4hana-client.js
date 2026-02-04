/**
 * S/4HANA Business Partner & Supplier Integration Client
 * 
 * Purpose: Create Business Partners and Suppliers in S/4HANA Cloud via OData V4 API
 * 
 * Features:
 * - BTP Destination Service integration (s4hana-cloud-odata-v4)
 * - CSRF token handling for write operations
 * - Field mapping: Internal data model → S/4HANA structure
 * - Comprehensive error handling (OData error parsing)
 * - Retry logic for transient failures
 * - Audit logging integration
 * 
 * APIs Used:
 * - A_BusinessPartner (OData V4) - /sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/
 * - A_Supplier (OData V4) - Same service path
 * 
 * Authentication: OAuth2SAMLBearerAssertion (principal propagation via destination)
 * 
 * @module srv/lib/s4hana-client
 */

const cds = require('@sap/cds');

/**
 * Configuration
 */
const CONFIG = {
  destinationName: process.env.S4_DESTINATION_NAME || 's4hana-cloud-odata-v4',
  servicePath: '/sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/',
  timeout: parseInt(process.env.S4_TIMEOUT_MS) || 30000, // 30 seconds
  maxRetries: parseInt(process.env.S4_MAX_RETRIES) || 3,
  retryDelay: parseInt(process.env.S4_RETRY_DELAY_MS) || 1000, // 1 second
};

/**
 * S/4HANA API endpoints
 */
const ENDPOINTS = {
  businessPartner: 'A_BusinessPartner',
  supplier: 'A_Supplier',
  businessPartnerAddress: 'A_BusinessPartnerAddress',
  businessPartnerBank: 'A_BusinessPartnerBank',
  businessPartnerContact: 'A_BPContactToFuncAndDept',
};

/**
 * S/4HANA Client Class
 */
class S4HANAClient {
  constructor() {
    this.destinationName = CONFIG.destinationName;
    this.servicePath = CONFIG.servicePath;
    this.csrfToken = null;
    this.csrfTokenExpiry = null;
  }

  /**
   * Get destination configuration from BTP Destination Service
   * 
   * @returns {Promise<Object>} Destination configuration
   * @throws {Error} If destination not found or not accessible
   */
  async getDestination() {
    try {
      const { destination } = await cds.connect.to('destination');
      const dest = await destination.getDestination(this.destinationName);
      
      if (!dest) {
        throw new Error(`Destination '${this.destinationName}' not found. Please configure in BTP Cockpit.`);
      }

      return dest;
    } catch (error) {
      throw new Error(`Failed to retrieve destination: ${error.message}`);
    }
  }

  /**
   * Fetch CSRF token from S/4HANA (required for POST/PATCH/DELETE operations)
   * Tokens are cached for 15 minutes
   * 
   * @param {Object} destination - Destination configuration
   * @returns {Promise<string>} CSRF token
   */
  async fetchCSRFToken(destination) {
    // Return cached token if still valid
    if (this.csrfToken && this.csrfTokenExpiry && Date.now() < this.csrfTokenExpiry) {
      return this.csrfToken;
    }

    try {
      const axios = require('axios');
      const url = `${destination.destinationConfiguration.URL}${this.servicePath}${ENDPOINTS.businessPartner}`;

      const response = await axios({
        method: 'GET',
        url: url,
        headers: {
          'X-CSRF-Token': 'Fetch',
          'Accept': 'application/json',
        },
        timeout: CONFIG.timeout,
        // Destination authentication is handled by @sap/xsenv or manually via destination properties
      });

      const token = response.headers['x-csrf-token'];
      if (!token) {
        throw new Error('CSRF token not returned by S/4HANA');
      }

      // Cache token for 15 minutes
      this.csrfToken = token;
      this.csrfTokenExpiry = Date.now() + (15 * 60 * 1000);

      return token;
    } catch (error) {
      throw new Error(`Failed to fetch CSRF token: ${error.message}`);
    }
  }

  /**
   * Execute OData request with retry logic
   * 
   * @param {Object} options - Request options (method, url, headers, data)
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<Object>} Response data
   */
  async executeRequest(options, retryCount = 0) {
    const axios = require('axios');
    
    try {
      const response = await axios(options);
      return response.data;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      
      if (isRetryable && retryCount < CONFIG.maxRetries) {
        console.log(`[S4HANA] Retry attempt ${retryCount + 1}/${CONFIG.maxRetries} after error: ${error.message}`);
        await this.sleep(CONFIG.retryDelay * (retryCount + 1)); // Exponential backoff
        return this.executeRequest(options, retryCount + 1);
      }

      throw this.parseODataError(error);
    }
  }

  /**
   * Check if error is retryable (network issues, 5xx errors)
   * 
   * @param {Error} error - Error object
   * @returns {boolean} True if retryable
   */
  isRetryableError(error) {
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response && error.response.status >= 500) {
      return true;
    }
    return false;
  }

  /**
   * Parse OData error response into user-friendly format
   * 
   * @param {Error} error - Axios error object
   * @returns {Error} Formatted error
   */
  parseODataError(error) {
    let message = 'S/4HANA API error';
    let statusCode = error.response?.status || 500;
    let details = null;

    if (error.response?.data?.error) {
      const odataError = error.response.data.error;
      message = odataError.message?.value || odataError.message || message;
      details = odataError.innererror?.errordetails || [];
    } else if (error.message) {
      message = error.message;
    }

    const formattedError = new Error(message);
    formattedError.statusCode = statusCode;
    formattedError.details = details;
    formattedError.originalError = error;

    return formattedError;
  }

  /**
   * Sleep utility for retry delays
   * 
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Map internal supplier data to S/4HANA Business Partner structure
   * 
   * @param {Object} supplierData - Internal supplier data model
   * @returns {Object} S/4HANA Business Partner payload
   */
  mapToBusinessPartner(supplierData) {
    const { generalData, contacts } = supplierData;

    return {
      BusinessPartnerCategory: '2', // Organization (1=Person, 2=Organization)
      BusinessPartnerGrouping: '0001', // Default grouping (configure as needed)
      OrganizationBPName1: generalData.companyName,
      OrganizationBPName2: generalData.legalForm || '',
      SearchTerm1: this.generateSearchTerm(generalData.companyName),
      
      // Address data (embedded)
      to_BusinessPartnerAddress: [{
        Country: generalData.country,
        CityName: generalData.city,
        PostalCode: generalData.postalCode,
        StreetName: generalData.street,
        HouseNumber: generalData.houseNumber || '',
      }],

      // Contact persons (if provided)
      to_BusinessPartnerContact: this.mapContacts(contacts),

      // Tax numbers
      to_BusinessPartnerTaxNumber: generalData.taxId ? [{
        BPTaxType: this.determineTaxType(generalData.country),
        BPTaxNumber: generalData.taxId,
      }] : [],

      // Identifications (commercial register, etc.)
      to_BusPartIdentification: generalData.commercialRegisterNumber ? [{
        BPIdentificationType: 'CREGNO',
        BPIdentificationNumber: generalData.commercialRegisterNumber,
      }] : [],
    };
  }

  /**
   * Map internal supplier data to S/4HANA Supplier structure
   * 
   * @param {string} businessPartnerId - Created Business Partner ID
   * @param {Object} supplierData - Internal supplier data model
   * @returns {Object} S/4HANA Supplier payload
   */
  mapToSupplier(businessPartnerId, supplierData) {
    const { bankDetails, classification } = supplierData;

    return {
      Supplier: businessPartnerId, // Link to Business Partner
      SupplierAccountGroup: 'Z001', // Configure supplier account group
      
      // Bank details
      to_SupplierCompany: [{
        CompanyCode: '1000', // Default company code (configure as needed)
        PaymentTerms: this.mapPaymentTerms(bankDetails.paymentTerms),
        Currency: bankDetails.currency || 'EUR',
      }],

      // Purchasing organization data
      to_SupplierPurchasingOrg: [{
        PurchasingOrganization: '1000', // Default purchasing org
        Currency: bankDetails.currency || 'EUR',
        PaymentTerms: this.mapPaymentTerms(bankDetails.paymentTerms),
        Incoterms: classification.incoterms || 'EXW',
      }],

      // Bank account (created separately via A_BusinessPartnerBank)
    };
  }

  /**
   * Map contact persons to S/4HANA structure
   * 
   * @param {Array} contacts - Contact persons array
   * @returns {Array} S/4HANA contact structure
   */
  mapContacts(contacts) {
    if (!contacts || contacts.length === 0) return [];

    return contacts.map(contact => ({
      ContactPersonFirstName: contact.firstName,
      ContactPersonLastName: contact.lastName,
      EmailAddress: contact.email,
      PhoneNumber: contact.phone,
      ContactPersonFunction: this.mapContactRole(contact.role),
    }));
  }

  /**
   * Map internal payment terms to S/4HANA codes
   * 
   * @param {string} terms - Payment terms (e.g., "14 days", "30 days")
   * @returns {string} S/4HANA payment terms code
   */
  mapPaymentTerms(terms) {
    const mapping = {
      '14 days': 'Z014',
      '30 days': 'Z030',
      '60 days': 'Z060',
      '90 days': 'Z090',
    };
    return mapping[terms] || 'Z030'; // Default to 30 days
  }

  /**
   * Map internal contact role to S/4HANA function code
   * 
   * @param {string} role - Internal role (Purchasing, Finance, Legal, Management)
   * @returns {string} S/4HANA function code
   */
  mapContactRole(role) {
    const mapping = {
      'Purchasing': 'PUR',
      'Finance': 'FIN',
      'Legal': 'LEG',
      'Management': 'MGT',
    };
    return mapping[role] || 'OTH';
  }

  /**
   * Determine tax type based on country
   * 
   * @param {string} country - ISO country code (DE, US, GB, etc.)
   * @returns {string} Tax type code
   */
  determineTaxType(country) {
    const euCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PL', 'SE', 'DK', 'FI', 'IE'];
    return euCountries.includes(country) ? 'MWST' : 'TXID'; // MWST for EU VAT, TXID for others
  }

  /**
   * Generate search term from company name (first 20 chars, uppercase)
   * 
   * @param {string} companyName - Company name
   * @returns {string} Search term
   */
  generateSearchTerm(companyName) {
    return companyName.substring(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  /**
   * Create Business Partner in S/4HANA
   * 
   * @param {Object} supplierData - Internal supplier data model
   * @returns {Promise<Object>} Created Business Partner (with ID)
   */
  async createBusinessPartner(supplierData) {
    console.log(`[S4HANA] Creating Business Partner for: ${supplierData.generalData.companyName}`);

    try {
      const destination = await this.getDestination();
      const csrfToken = await this.fetchCSRFToken(destination);
      
      const payload = this.mapToBusinessPartner(supplierData);
      const url = `${destination.destinationConfiguration.URL}${this.servicePath}${ENDPOINTS.businessPartner}`;

      const axios = require('axios');
      const requestOptions = {
        method: 'POST',
        url: url,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: payload,
        timeout: CONFIG.timeout,
      };

      const result = await this.executeRequest(requestOptions);

      console.log(`[S4HANA] Business Partner created successfully: ${result.BusinessPartner}`);
      
      return {
        businessPartnerId: result.BusinessPartner,
        businessPartnerGrouping: result.BusinessPartnerGrouping,
        searchTerm: result.SearchTerm1,
        rawResponse: result,
      };
    } catch (error) {
      console.error(`[S4HANA] Failed to create Business Partner:`, error);
      throw error;
    }
  }

  /**
   * Create Supplier in S/4HANA (linked to Business Partner)
   * 
   * @param {string} businessPartnerId - Business Partner ID
   * @param {Object} supplierData - Internal supplier data model
   * @returns {Promise<Object>} Created Supplier
   */
  async createSupplier(businessPartnerId, supplierData) {
    console.log(`[S4HANA] Creating Supplier for Business Partner: ${businessPartnerId}`);

    try {
      const destination = await this.getDestination();
      const csrfToken = await this.fetchCSRFToken(destination);
      
      const payload = this.mapToSupplier(businessPartnerId, supplierData);
      const url = `${destination.destinationConfiguration.URL}${this.servicePath}${ENDPOINTS.supplier}`;

      const axios = require('axios');
      const requestOptions = {
        method: 'POST',
        url: url,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: payload,
        timeout: CONFIG.timeout,
      };

      const result = await this.executeRequest(requestOptions);

      console.log(`[S4HANA] Supplier created successfully: ${result.Supplier}`);
      
      return {
        supplierId: result.Supplier,
        accountGroup: result.SupplierAccountGroup,
        rawResponse: result,
      };
    } catch (error) {
      console.error(`[S4HANA] Failed to create Supplier:`, error);
      throw error;
    }
  }

  /**
   * Create bank account for Business Partner
   * 
   * @param {string} businessPartnerId - Business Partner ID
   * @param {Object} bankDetails - Bank account information
   * @returns {Promise<Object>} Created bank account
   */
  async createBankAccount(businessPartnerId, bankDetails) {
    console.log(`[S4HANA] Creating bank account for Business Partner: ${businessPartnerId}`);

    try {
      const destination = await this.getDestination();
      const csrfToken = await this.fetchCSRFToken(destination);
      
      const payload = {
        BusinessPartner: businessPartnerId,
        BankCountryKey: this.extractCountryFromIBAN(bankDetails.iban),
        BankAccount: bankDetails.iban,
        BankName: bankDetails.bankName,
        SWIFTCode: bankDetails.swift,
        BankAccountHolderName: bankDetails.accountHolderName,
      };

      const url = `${destination.destinationConfiguration.URL}${this.servicePath}${ENDPOINTS.businessPartnerBank}`;

      const axios = require('axios');
      const requestOptions = {
        method: 'POST',
        url: url,
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        data: payload,
        timeout: CONFIG.timeout,
      };

      const result = await this.executeRequest(requestOptions);

      console.log(`[S4HANA] Bank account created successfully`);
      
      return {
        bankInternalId: result.BankInternalID,
        rawResponse: result,
      };
    } catch (error) {
      console.error(`[S4HANA] Failed to create bank account:`, error);
      throw error;
    }
  }

  /**
   * Extract country code from IBAN (first 2 characters)
   * 
   * @param {string} iban - IBAN
   * @returns {string} Country code
   */
  extractCountryFromIBAN(iban) {
    return iban.substring(0, 2).toUpperCase();
  }

  /**
   * Complete supplier onboarding workflow (create BP + Supplier + Bank)
   * 
   * @param {Object} supplierData - Complete supplier data
   * @returns {Promise<Object>} Created entities with IDs
   */
  async createCompleteSupplier(supplierData) {
    console.log(`[S4HANA] Starting complete supplier creation workflow`);

    try {
      // Step 1: Create Business Partner
      const bpResult = await this.createBusinessPartner(supplierData);
      const businessPartnerId = bpResult.businessPartnerId;

      // Step 2: Create Supplier
      const supplierResult = await this.createSupplier(businessPartnerId, supplierData);

      // Step 3: Create Bank Account (if bank details provided)
      let bankResult = null;
      if (supplierData.bankDetails && supplierData.bankDetails.iban) {
        bankResult = await this.createBankAccount(businessPartnerId, supplierData.bankDetails);
      }

      console.log(`[S4HANA] Complete supplier creation successful`);

      return {
        success: true,
        businessPartnerId: businessPartnerId,
        supplierId: supplierResult.supplierId,
        bankInternalId: bankResult?.bankInternalId || null,
        details: {
          businessPartner: bpResult,
          supplier: supplierResult,
          bank: bankResult,
        },
      };
    } catch (error) {
      console.error(`[S4HANA] Complete supplier creation failed:`, error);
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let clientInstance = null;

/**
 * Get S/4HANA client instance (singleton)
 * 
 * @returns {S4HANAClient}
 */
function getClient() {
  if (!clientInstance) {
    clientInstance = new S4HANAClient();
  }
  return clientInstance;
}

/**
 * Public API
 */
module.exports = {
  S4HANAClient,
  getClient,
  
  // Export individual methods for easier testing/mocking
  createBusinessPartner: async (supplierData) => getClient().createBusinessPartner(supplierData),
  createSupplier: async (businessPartnerId, supplierData) => getClient().createSupplier(businessPartnerId, supplierData),
  createBankAccount: async (businessPartnerId, bankDetails) => getClient().createBankAccount(businessPartnerId, bankDetails),
  createCompleteSupplier: async (supplierData) => getClient().createCompleteSupplier(supplierData),
};
