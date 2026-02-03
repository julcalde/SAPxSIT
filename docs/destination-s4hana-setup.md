# S/4HANA OData Destination Setup Guide

**Purpose**: Configure BTP destination for S/4HANA Cloud Business Partner API integration  
**Step**: 10 of 28  
**Prerequisites**: SAP BTP subaccount with Cloud Foundry environment, S/4HANA Cloud tenant with API access  
**Estimated Time**: 15-20 minutes  

---

## Overview

This destination enables the supplier onboarding application to create and manage Business Partners and Suppliers in S/4HANA Cloud using the released OData V4 APIs.

### Integration Flow

```
Supplier Onboarding App (CAP)
    ↓
BTP Destination Service
    ↓
S/4HANA Cloud OData V4 API
    ↓
Business Partner & Supplier Creation
```

### APIs Used

- **A_BusinessPartner** - Business Partner OData V4 API
- **A_Supplier** - Supplier OData V4 API
- **Service Path**: `/sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/`

---

## Destination Configuration

### Basic Properties

| Property | Value | Description |
|----------|-------|-------------|
| **Name** | `s4hana-cloud-odata-v4` | Unique destination identifier |
| **Type** | `HTTP` | Connection type |
| **URL** | `https://<your-tenant>.s4hana.cloud.sap` | S/4HANA Cloud base URL |
| **Proxy Type** | `Internet` | Direct internet connection |
| **Authentication** | `OAuth2SAMLBearerAssertion` | Principal propagation with OAuth2 |

### Authentication Configuration

| Property | Value | Description |
|----------|-------|-------------|
| **Audience** | `https://<your-tenant>.s4hana.cloud.sap` | OAuth2 audience (same as URL) |
| **AuthnContextClassRef** | `urn:oasis:names:tc:SAML:2.0:ac:classes:X509` | SAML authentication context |
| **Client Key** | `<from S/4HANA Communication Arrangement>` | OAuth2 client ID |
| **Token Service URL** | `https://<your-tenant>.s4hana.cloud.sap/sap/bc/sec/oauth2/token` | OAuth2 token endpoint |
| **Token Service User** | `<from S/4HANA Communication Arrangement>` | Token service username (Client ID) |
| **Token Service Password** | `<from S/4HANA Communication Arrangement>` | Token service password (Client Secret) |

### Additional Properties

Add these as **Additional Properties** (key-value pairs):

| Name | Value | Purpose |
|------|-------|---------|
| `sap-client` | `100` | S/4HANA client number (adjust as needed) |
| `HTML5.DynamicDestination` | `true` | Enable dynamic destination |
| `WebIDEEnabled` | `true` | Enable in SAP Web IDE |
| `WebIDEUsage` | `odata_gen` | Web IDE usage type |
| `sap-platform` | `S/4HANA Cloud` | Platform identifier |
| `TrustAll` | `true` | **Only for development/testing** - Accept all SSL certificates |

**Production Note**: Remove `TrustAll` and configure proper SSL certificate trust for production.

---

## Step-by-Step Setup in BTP Cockpit

### Part 1: S/4HANA Communication Arrangement Setup

Before creating the BTP destination, you need to set up a Communication Arrangement in S/4HANA Cloud to obtain OAuth2 credentials.

#### 1.1 Create Communication System (S/4HANA)

1. Log in to **S/4HANA Cloud** (Fiori Launchpad)
2. Navigate to **Communication Management** → **Communication Systems**
3. Click **New**
4. Enter:
   - **System ID**: `BTP_SUPPLIER_ONBOARDING`
   - **System Name**: `SAP BTP Supplier Onboarding System`
5. Click **Create**
6. In **Technical Data** section:
   - **Host Name**: `<your-btp-subdomain>.authentication.<region>.hana.ondemand.com`
   - Example: `mysubaccount.authentication.eu10.hana.ondemand.com`
7. **Inbound Communication**:
   - Click **+** to add inbound user
   - Select **OAuth 2.0 Client Credentials**
   - Click **New User**
   - System generates **Client ID** and **Client Secret** → **SAVE THESE**
8. Click **Save**

#### 1.2 Create Communication Arrangement (S/4HANA)

1. Navigate to **Communication Management** → **Communication Arrangements**
2. Click **New**
3. Select **Scenario**: `SAP_COM_0008` (Business Partner, Customer and Supplier Integration)
4. Enter **Arrangement Name**: `BTP_SUPPLIER_ONBOARDING_BP`
5. Select **Communication System**: `BTP_SUPPLIER_ONBOARDING` (created above)
6. Click **Create**
7. In **Outbound Services** section:
   - Enable **Business Partner** service
   - Enable **Supplier** service
8. Click **Save**
9. **Copy the Service URL** - you'll need this for the destination

### Part 2: BTP Destination Configuration

#### 2.1 Access BTP Cockpit

1. Log in to **SAP BTP Cockpit**: https://cockpit.btp.cloud.sap/
2. Navigate to your **Global Account** → **Subaccount**
3. Go to **Connectivity** → **Destinations**

#### 2.2 Create New Destination

1. Click **New Destination**
2. Enter the basic properties:

```
Name:                   s4hana-cloud-odata-v4
Type:                   HTTP
Description:            S/4HANA Cloud Business Partner OData V4 API
URL:                    https://<your-tenant>.s4hana.cloud.sap
Proxy Type:             Internet
Authentication:         OAuth2SAMLBearerAssertion
```

3. Click **New Property** for each additional property:

```
Audience:                    https://<your-tenant>.s4hana.cloud.sap
AuthnContextClassRef:        urn:oasis:names:tc:SAML:2.0:ac:classes:X509
Client Key:                  <OAuth2 Client ID from S/4HANA>
Token Service URL:           https://<your-tenant>.s4hana.cloud.sap/sap/bc/sec/oauth2/token
Token Service User:          <OAuth2 Client ID from S/4HANA>
Token Service Password:      <OAuth2 Client Secret from S/4HANA>
```

4. Add **Additional Properties**:

```
sap-client:                  100
HTML5.DynamicDestination:    true
WebIDEEnabled:               true
WebIDEUsage:                 odata_gen
sap-platform:                S/4HANA Cloud
TrustAll:                    true
```

5. Click **Save**

#### 2.3 Example Screenshot Values

For a sample S/4HANA tenant `my-s4hana-tenant.s4hana.cloud.sap`:

```
URL:                    https://my-s4hana-tenant.s4hana.cloud.sap
Audience:               https://my-s4hana-tenant.s4hana.cloud.sap
Token Service URL:      https://my-s4hana-tenant.s4hana.cloud.sap/sap/bc/sec/oauth2/token
```

---

## Testing and Verification

### Test 1: Check Connection

1. In BTP Cockpit, open the destination `s4hana-cloud-odata-v4`
2. Click **Check Connection** button
3. **Expected Result**: 
   - ✅ `Connection to "https://<tenant>.s4hana.cloud.sap" established`
   - ✅ Status: 200 or 302 (redirect to login is OK)

**If Failed**:
- ❌ 401 Unauthorized → Check Client ID/Secret
- ❌ 404 Not Found → Check URL
- ❌ 500 Internal Server Error → Check S/4HANA Communication Arrangement
- ❌ SSL/Certificate errors → Check `TrustAll` property or certificate configuration

### Test 2: OAuth2 Token Acquisition

Use this cURL command to test token retrieval:

```bash
curl -X POST "https://<your-tenant>.s4hana.cloud.sap/sap/bc/sec/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -u "<Client-ID>:<Client-Secret>" \
  -d "grant_type=client_credentials"
```

**Expected Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**If Failed**:
- Check Client ID and Client Secret
- Verify Communication Arrangement is active
- Check user has OAuth2 permissions in S/4HANA

### Test 3: OData Service Access

Test Business Partner API access:

```bash
curl -X GET "https://<your-tenant>.s4hana.cloud.sap/sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/\$metadata" \
  -H "Authorization: Bearer <access_token_from_test2>" \
  -H "sap-client: 100"
```

**Expected Response**:
- XML metadata document starting with `<?xml version="1.0" encoding="utf-8"?>`
- Contains `<edmx:Edmx>` root element

**If Failed**:
- ❌ 401 → Token invalid or expired
- ❌ 403 → Insufficient permissions (check Communication Arrangement)
- ❌ 404 → Incorrect service path

### Test 4: CAP Service Integration Test

Once the destination is configured, test from your CAP application:

```javascript
// Test file: test/s4hana-connection.test.js
const cds = require('@sap/cds');

describe('S/4HANA Connection Test', () => {
  test('should connect to S/4HANA via destination', async () => {
    const s4 = await cds.connect.to('s4hana-cloud-odata-v4');
    
    // Query Business Partner metadata
    const metadata = await s4.send({
      query: SELECT.from('A_BusinessPartner').limit(1)
    });
    
    expect(metadata).toBeDefined();
  });
});
```

Run test:
```bash
npm test test/s4hana-connection.test.js
```

---

## Security Considerations

### Production Checklist

Before deploying to production:

- [ ] Remove `TrustAll: true` property
- [ ] Configure SSL certificate trust chain
- [ ] Use dedicated Communication User (not developer user)
- [ ] Enable audit logging for all API calls
- [ ] Rotate OAuth2 credentials regularly (every 90 days recommended)
- [ ] Restrict IP ranges in S/4HANA Communication System (if applicable)
- [ ] Enable principal propagation for user context
- [ ] Configure timeout values appropriately
- [ ] Set up monitoring/alerting for failed API calls

### OAuth2 Credential Management

**Best Practices**:
1. Store Client Secret in **BTP Credential Store** (not directly in destination)
2. Use **Destination Service** environment variables for sensitive data
3. Implement credential rotation automation
4. Never commit credentials to git repositories
5. Use separate credentials for dev/test/prod environments

### Principal Propagation

The `OAuth2SAMLBearerAssertion` authentication enables user context propagation from BTP to S/4HANA:

1. User authenticates to CAP service (XSUAA)
2. CAP service calls S/4HANA destination
3. BTP exchanges SAML assertion for S/4HANA OAuth2 token
4. S/4HANA receives user context (for authorization and audit)

**Verify Principal Propagation**:
- Check audit logs in S/4HANA - should show BTP user, not technical user
- Test with different BTP users - should see different contexts in S/4HANA

---

## Troubleshooting Guide

### Issue: "Destination not found"

**Symptoms**: CAP service throws error "Destination 's4hana-cloud-odata-v4' not found"

**Solutions**:
1. Check destination name matches exactly in code
2. Verify destination is in same subaccount as CAP app
3. Check BTP Destination Service is bound to CAP application
4. Restart CAP application after creating destination

**Verify**:
```bash
cf env <app-name> | grep VCAP_SERVICES
# Should show destination service binding
```

### Issue: "401 Unauthorized" from S/4HANA

**Symptoms**: Connection test passes, but API calls return 401

**Solutions**:
1. Verify OAuth2 token is being requested
2. Check token expiry (3600s = 1 hour)
3. Verify Communication Arrangement includes required services
4. Check user permissions in S/4HANA

**Debug**:
```javascript
// Enable debug logging in CAP
process.env.DEBUG = 'destination';
```

### Issue: "SSL Certificate Error"

**Symptoms**: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" or similar SSL errors

**Solutions**:
1. **Development**: Add `TrustAll: true` to destination
2. **Production**: Import S/4HANA SSL certificate to BTP trust store

**Import Certificate**:
1. Download certificate from S/4HANA (browser → View Certificate → Export)
2. BTP Cockpit → Security → Trust Configuration
3. Upload certificate
4. Remove `TrustAll` property from destination

### Issue: "CSRF Token Required"

**Symptoms**: POST/PUT/DELETE requests fail with "CSRF token validation failed"

**Solutions**:
1. Add CSRF token fetch before modifying requests
2. Use `@sap-cloud-sdk/http-client` which handles CSRF automatically

**Manual CSRF Handling**:
```javascript
// Fetch CSRF token
const csrfResponse = await fetch(url, {
  method: 'GET',
  headers: {
    'x-csrf-token': 'Fetch'
  }
});

const csrfToken = csrfResponse.headers.get('x-csrf-token');

// Use token in POST request
await fetch(url, {
  method: 'POST',
  headers: {
    'x-csrf-token': csrfToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(data)
});
```

### Issue: "Rate Limit Exceeded"

**Symptoms**: "429 Too Many Requests" from S/4HANA

**Solutions**:
1. Implement exponential backoff retry logic
2. Batch API calls where possible
3. Cache frequently accessed data
4. Contact S/4HANA administrator to increase rate limits

---

## API Endpoints Reference

### Business Partner API

**Base Path**: `/sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/`

| Operation | Method | Path | Description |
|-----------|--------|------|-------------|
| Get Metadata | GET | `/$metadata` | Service metadata |
| List Partners | GET | `/A_BusinessPartner` | List all business partners |
| Get Partner | GET | `/A_BusinessPartner('<id>')` | Get specific business partner |
| Create Partner | POST | `/A_BusinessPartner` | Create new business partner |
| Update Partner | PATCH | `/A_BusinessPartner('<id>')` | Update business partner |

### Supplier API

**Base Path**: Same as Business Partner

| Operation | Method | Path | Description |
|-----------|--------|------|-------------|
| List Suppliers | GET | `/A_Supplier` | List all suppliers |
| Get Supplier | GET | `/A_Supplier('<id>')` | Get specific supplier |
| Create Supplier | POST | `/A_Supplier` | Create new supplier |
| Update Supplier | PATCH | `/A_Supplier('<id>')` | Update supplier |

### Sample Requests

**Create Business Partner**:
```json
POST /sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/A_BusinessPartner
Content-Type: application/json

{
  "BusinessPartnerCategory": "2",
  "BusinessPartnerGrouping": "0001",
  "OrganizationBPName1": "Test Supplier GmbH",
  "BusinessPartnerIsBlocked": false
}
```

**Create Supplier from Business Partner**:
```json
POST /sap/opu/odata4/sap/api_business_partner/srvd_a2x/sap/businesspartner/0001/A_Supplier
Content-Type: application/json

{
  "Supplier": "0010001234",
  "SupplierAccountGroup": "Z001",
  "SupplierName": "Test Supplier GmbH",
  "PurchasingOrganization": "1000",
  "CompanyCode": "1000",
  "PaymentTerms": "0001"
}
```

---

## Environment-Specific Configuration

### Development Environment

```properties
Name:                   s4hana-cloud-odata-v4-dev
URL:                    https://dev-tenant.s4hana.cloud.sap
sap-client:             100
TrustAll:               true
```

### Quality/Test Environment

```properties
Name:                   s4hana-cloud-odata-v4-test
URL:                    https://test-tenant.s4hana.cloud.sap
sap-client:             100
TrustAll:               false
```

### Production Environment

```properties
Name:                   s4hana-cloud-odata-v4-prod
URL:                    https://prod-tenant.s4hana.cloud.sap
sap-client:             100
TrustAll:               false
WebIDEEnabled:          false
```

**Note**: Use different OAuth2 credentials for each environment.

---

## Next Steps

After successfully configuring and testing this destination:

1. **Step 11**: Implement S/4HANA Business Partner integration in CAP service
2. **Step 12**: Configure Object Store for attachment storage
3. **Step 13**: Implement Object Store destination
4. **Step 14**: Create presigned URL generation for file uploads

---

## References

- [SAP Help: Communication Management in S/4HANA Cloud](https://help.sap.com/docs/SAP_S4HANA_CLOUD/0f69f8fb28ac4bf48d2b57b9637e81fa/1decd8b8747443b1aa2b0c6e1b3b8962.html)
- [SAP Help: BTP Destinations](https://help.sap.com/docs/CP_CONNECTIVITY/cca91383641e40ffbe03bdc78f00f681/e4f1d97cbb571014a247d10f9f9a685d.html)
- [SAP API Business Hub: Business Partner API](https://api.sap.com/api/API_BUSINESS_PARTNER/overview)
- [OAuth2SAMLBearerAssertion Flow](https://help.sap.com/docs/CP_CONNECTIVITY/cca91383641e40ffbe03bdc78f00f681/e4f1d97cbb571014a247d10f9f9a685d.html)

---

**Document Version**: 1.0  
**Last Updated**: February 3, 2026  
**Author**: SAP BTP Supplier Onboarding Team  
**Status**: Ready for Implementation
