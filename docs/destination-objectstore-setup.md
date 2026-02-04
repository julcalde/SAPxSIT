# SAP BTP Object Store Destination Configuration

**Step 13 of 28** – Configure Object Store S3-compatible destination  
**Purpose**: Enable CAP services to access Object Store for presigned URL generation  
**Prerequisites**: Step 12 completed (Object Store service instance created)

---

## Overview

This guide configures a BTP destination to connect the CAP application to the Object Store (S3-compatible) service for generating presigned URLs for file upload/download operations.

**Architecture Flow:**
```
CAP Service (Node.js) 
  → BTP Destination Service 
    → Object Store S3 Endpoint 
      → Bucket: onboarding-documents
```

**Security:**
- Credentials stored in destination configuration (not in code)
- AWS Signature Version 4 authentication
- Access key/secret key from service binding
- Presigned URLs with time-limited access (15 min upload, 5 min download)

---

## Step 1: Extract Object Store Credentials

### 1.1 Get Service Key Credentials

If you haven't created a service key yet (from Step 12), create one:

```bash
# Create service key
cf create-service-key supplier-onboarding-objectstore objectstore-key

# View credentials
cf service-key supplier-onboarding-objectstore objectstore-key
```

**Expected Output:**
```json
{
  "access_key_id": "AKIA...",
  "bucket": "onboarding-documents-dev",
  "host": "s3.eu-central-1.amazonaws.com",
  "region": "eu-central-1",
  "secret_access_key": "wJalr...",
  "uri": "s3://onboarding-documents-dev"
}
```

### 1.2 Note the Following Values

You'll need these for destination configuration:

| Parameter | Example Value | Description |
|-----------|---------------|-------------|
| **host** | `s3.eu-central-1.amazonaws.com` | S3 endpoint URL |
| **region** | `eu-central-1` | AWS region |
| **access_key_id** | `AKIA...` | AWS access key |
| **secret_access_key** | `wJalr...` | AWS secret key (keep secure!) |
| **bucket** | `onboarding-documents-dev` | Bucket name |

⚠️ **Security Note**: Never commit credentials to git. Use BTP Destination Service to manage them securely.

---

## Step 2: Create Destination in BTP Cockpit

### 2.1 Navigate to Destinations

1. Open **SAP BTP Cockpit**: https://cockpit.btp.cloud.sap/
2. Navigate to your **Subaccount**
3. In left menu, select **Connectivity** → **Destinations**
4. Click **New Destination**

### 2.2 Configure Destination Properties

Enter the following configuration:

#### Basic Configuration

| Field | Value |
|-------|-------|
| **Name** | `objectstore-s3-endpoint` |
| **Type** | `HTTP` |
| **Description** | `Object Store S3-compatible endpoint for supplier onboarding documents` |
| **URL** | `https://s3.<region>.amazonaws.com` (e.g., `https://s3.eu-central-1.amazonaws.com`) |
| **Proxy Type** | `Internet` |
| **Authentication** | `NoAuthentication` (we'll use additional properties for AWS auth) |

#### Additional Properties

Click **New Property** for each of the following:

| Property Name | Value | Description |
|--------------|-------|-------------|
| `s3.region` | `eu-central-1` | AWS region from service key |
| `s3.access.key` | `AKIA...` | AWS access key ID from service key |
| `s3.secret.key` | `wJalr...` | AWS secret access key (will be encrypted) |
| `s3.bucket` | `onboarding-documents-dev` | Default bucket name |
| `s3.signature.version` | `4` | AWS Signature Version 4 |
| `WebIDEEnabled` | `true` | Enable for development tools |
| `WebIDEUsage` | `odata_gen` | Usage type |
| `HTML5.DynamicDestination` | `true` | Enable dynamic destination |

**Screenshot Reference:**
```
┌─────────────────────────────────────────────────────┐
│ Destination Configuration                           │
├─────────────────────────────────────────────────────┤
│ Name: objectstore-s3-endpoint                       │
│ Type: HTTP                                          │
│ URL: https://s3.eu-central-1.amazonaws.com          │
│ Proxy Type: Internet                                │
│ Authentication: NoAuthentication                    │
│                                                      │
│ Additional Properties:                              │
│ ┌────────────────────┬──────────────────────────┐  │
│ │ s3.region          │ eu-central-1             │  │
│ │ s3.access.key      │ AKIA...                  │  │
│ │ s3.secret.key      │ ********                 │  │
│ │ s3.bucket          │ onboarding-documents-dev │  │
│ │ s3.signature.version│ 4                       │  │
│ └────────────────────┴──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 2.3 Save Configuration

1. Click **Save**
2. Destination will appear in the list with status **OK**

---

## Step 3: Test Destination Connectivity

### 3.1 Test via BTP Cockpit

1. In the **Destinations** list, find `objectstore-s3-endpoint`
2. Click **Check Connection**

**Expected Result:**
```
✓ Connection successful
  HTTP Status: 200
  Response time: 123ms
```

**Common Issues:**

| Error | Cause | Solution |
|-------|-------|----------|
| `403 Forbidden` | Invalid credentials | Verify `s3.access.key` and `s3.secret.key` |
| `Connection timeout` | Wrong endpoint URL | Check `s3.region` matches service key |
| `UnknownHostException` | Invalid URL format | Ensure URL is `https://s3.<region>.amazonaws.com` |
| `SignatureDoesNotMatch` | Wrong signature version | Verify `s3.signature.version` is `4` |

### 3.2 Test via CAP Service (Node.js)

Create a test script to verify destination access from CAP:

**File: `scripts/test-objectstore-destination.js`**

```javascript
/**
 * Test Object Store Destination Connectivity
 * 
 * Usage: node scripts/test-objectstore-destination.js
 */

const cds = require('@sap/cds');

async function testObjectStoreDestination() {
  console.log('Testing Object Store destination connectivity...\n');
  
  try {
    // Connect to destination service
    const { destination } = await cds.connect.to('destination');
    
    // Get Object Store destination
    const dest = await destination.getDestination('objectstore-s3-endpoint');
    
    if (!dest) {
      console.error('❌ Destination not found: objectstore-s3-endpoint');
      console.error('   Please create the destination in BTP Cockpit first.');
      process.exit(1);
    }
    
    console.log('✓ Destination found');
    console.log('  Name:', dest.Name);
    console.log('  URL:', dest.destinationConfiguration.URL);
    console.log('  Type:', dest.Type);
    
    // Extract S3 configuration
    const s3Config = {
      endpoint: dest.destinationConfiguration.URL,
      region: dest.destinationConfiguration['s3.region'],
      bucket: dest.destinationConfiguration['s3.bucket'],
      accessKeyId: dest.destinationConfiguration['s3.access.key'],
      secretAccessKey: dest.destinationConfiguration['s3.secret.key'],
      signatureVersion: dest.destinationConfiguration['s3.signature.version']
    };
    
    console.log('\n✓ S3 Configuration extracted:');
    console.log('  Region:', s3Config.region);
    console.log('  Bucket:', s3Config.bucket);
    console.log('  Signature Version:', s3Config.signatureVersion);
    console.log('  Access Key:', s3Config.accessKeyId ? '***' + s3Config.accessKeyId.slice(-4) : 'NOT SET');
    
    // Test S3 connection (list buckets)
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
      signatureVersion: s3Config.signatureVersion,
      s3ForcePathStyle: true
    });
    
    console.log('\n⏳ Testing S3 connectivity...');
    
    // List objects in bucket (limit 1 to test connectivity)
    const response = await s3.listObjectsV2({
      Bucket: s3Config.bucket,
      MaxKeys: 1
    }).promise();
    
    console.log('✓ S3 connection successful');
    console.log('  Objects in bucket:', response.KeyCount);
    console.log('  Bucket accessible:', s3Config.bucket);
    
    console.log('\n✅ All tests passed! Destination is properly configured.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.code === 'NoSuchBucket') {
      console.error('\n   Bucket not found. Please create it using:');
      console.error('   cf run-script setup-objectstore.sh');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.error('\n   Invalid access key. Check s3.access.key in destination.');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n   Signature mismatch. Check s3.secret.key in destination.');
    } else {
      console.error('\n   Full error:', error);
    }
    
    process.exit(1);
  }
}

// Run test
testObjectStoreDestination().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
```

**Run the test:**

```bash
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
cd /Users/Guest/Desktop/sapxsit
node scripts/test-objectstore-destination.js
```

**Expected Output:**
```
Testing Object Store destination connectivity...

✓ Destination found
  Name: objectstore-s3-endpoint
  URL: https://s3.eu-central-1.amazonaws.com
  Type: HTTP

✓ S3 Configuration extracted:
  Region: eu-central-1
  Bucket: onboarding-documents-dev
  Signature Version: 4
  Access Key: ***A1B2

⏳ Testing S3 connectivity...
✓ S3 connection successful
  Objects in bucket: 0
  Bucket accessible: onboarding-documents-dev

✅ All tests passed! Destination is properly configured.
```

---

## Step 4: Update Environment Configuration

### 4.1 Add Destination Name to .env Template

Update `env/.env.template` to reference the destination:

```bash
# Object Store Configuration (via BTP Destination)
OBJECTSTORE_DESTINATION_NAME=objectstore-s3-endpoint
OBJECTSTORE_BUCKET=onboarding-documents-dev
OBJECTSTORE_REGION=eu-central-1

# Presigned URL Configuration
PRESIGNED_UPLOAD_URL_EXPIRY=900        # 15 minutes in seconds
PRESIGNED_DOWNLOAD_URL_EXPIRY=300      # 5 minutes in seconds
MAX_FILE_SIZE_MB=5                     # Max file size per upload
MAX_FILES_PER_INVITATION=10            # Max attachments per supplier
```

### 4.2 Create Local .env File

```bash
cp env/.env.template .env
```

Edit `.env` and update with your actual values if testing locally.

**Note:** For production, destination credentials are managed by BTP Destination Service. No `.env` file needed.

---

## Step 5: Configure package.json for Destination Service

Ensure your `package.json` includes the destination service configuration:

```json
{
  "cds": {
    "requires": {
      "destination": {
        "kind": "destination-service"
      },
      "db": {
        "kind": "sql"
      }
    }
  }
}
```

---

## Integration with CAP Service

### Usage in srv/lib/objectstore-client.js (Step 14)

The destination will be consumed like this:

```javascript
const cds = require('@sap/cds');
const AWS = require('aws-sdk');

async function getS3Client() {
  // Get destination via CAP framework
  const { destination } = await cds.connect.to('destination');
  const dest = await destination.getDestination('objectstore-s3-endpoint');
  
  // Extract S3 configuration
  const s3Config = {
    endpoint: dest.destinationConfiguration.URL,
    region: dest.destinationConfiguration['s3.region'],
    accessKeyId: dest.destinationConfiguration['s3.access.key'],
    secretAccessKey: dest.destinationConfiguration['s3.secret.key'],
    signatureVersion: dest.destinationConfiguration['s3.signature.version']
  };
  
  // Create S3 client
  return new AWS.S3({
    endpoint: s3Config.endpoint,
    region: s3Config.region,
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
    signatureVersion: s3Config.signatureVersion,
    s3ForcePathStyle: true // Required for S3-compatible services
  });
}
```

---

## Security Best Practices

### ✅ DO:
- Store credentials in BTP Destination Service (encrypted at rest)
- Use AWS Signature Version 4 for authentication
- Rotate access keys regularly (every 90 days)
- Use separate destinations for dev/test/prod
- Enable audit logging for destination access
- Use presigned URLs with minimal expiry times

### ❌ DON'T:
- Never commit credentials to Git
- Don't hardcode access keys in application code
- Don't use long-lived presigned URLs (max 15 min for uploads)
- Don't expose raw S3 credentials to frontend
- Don't use the same credentials for multiple environments

---

## Troubleshooting

### Issue: "Destination not found"

**Symptoms:**
```
Error: Destination 'objectstore-s3-endpoint' not found
```

**Solution:**
1. Verify destination exists in BTP Cockpit
2. Check destination name matches exactly (case-sensitive)
3. Ensure CAP app is bound to Destination Service
4. Restart application after creating destination

---

### Issue: "403 Forbidden" when accessing S3

**Symptoms:**
```
AccessDenied: Access Denied
Status Code: 403
```

**Solution:**
1. Verify `s3.access.key` is correct
2. Verify `s3.secret.key` is correct
3. Check IAM permissions on access key (needs S3 read/write)
4. Verify bucket name matches service binding

---

### Issue: "SignatureDoesNotMatch"

**Symptoms:**
```
SignatureDoesNotMatch: The request signature we calculated does not match the signature you provided.
```

**Solution:**
1. Ensure `s3.signature.version` is set to `4`
2. Verify `s3.region` matches the actual bucket region
3. Check for trailing spaces in access key or secret key
4. Re-create destination with fresh credentials

---

### Issue: "Connection timeout"

**Symptoms:**
```
Error: connect ETIMEDOUT
```

**Solution:**
1. Check internet proxy settings in destination
2. Verify URL format: `https://s3.<region>.amazonaws.com`
3. Test network connectivity from Cloud Foundry app
4. Check corporate firewall rules

---

## Validation Checklist

Before proceeding to Step 14, verify:

- [ ] Destination `objectstore-s3-endpoint` created in BTP Cockpit
- [ ] All additional properties configured (s3.region, s3.access.key, etc.)
- [ ] "Check Connection" succeeds in BTP Cockpit
- [ ] Test script `test-objectstore-destination.js` runs successfully
- [ ] S3 bucket is accessible via destination
- [ ] Environment variables documented in `.env.template`
- [ ] Security best practices followed (no credentials in code)
- [ ] Destination name documented for team reference

---

## Next Steps

Once destination is configured and tested:

✅ **Step 13 Complete** → Proceed to **Step 14: Implement Object Store presigned URL generation**

In Step 14, you will:
- Create `srv/lib/objectstore-client.js`
- Implement `generatePresignedUploadUrl()` function
- Implement `generatePresignedDownloadUrl()` function
- Add object key naming conventions
- Test presigned URL generation and expiry

---

## Additional Resources

- [SAP BTP Destination Service Documentation](https://help.sap.com/docs/CP_CONNECTIVITY/cca91383641e40ffbe03bdc78f00f681/e4f1d97cbb571014a247d10f9f9a685d.html)
- [AWS S3 Signature Version 4](https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html)
- [SAP Object Store Service](https://help.sap.com/docs/OBJECTSTORE)
- [AWS SDK for JavaScript (S3)](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/s3-example-creating-buckets.html)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-04  
**Author**: SAP BTP Solution Architect  
**Status**: Ready for Implementation
