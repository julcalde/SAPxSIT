# SAP BTP Object Store Setup Guide

**Purpose**: Configure S3-compatible Object Store for secure supplier document storage  
**Service**: SAP BTP Object Store (AWS S3-compatible)  
**Prerequisites**: Cloud Foundry CLI, BTP subaccount with Object Store entitlement  
**Estimated Time**: 10-15 minutes  

---

## Overview

The Object Store provides S3-compatible cloud storage for supplier onboarding documents (PDFs, images, certificates). Files are uploaded directly from the Build Apps frontend using presigned URLs, bypassing the CAP backend for optimal performance.

### Architecture

```
Build Apps (Supplier UI)
    │
    ├─→ CAP Service: GET /presignedUploadUrl
    │                 Returns: presigned PUT URL (15 min expiry)
    │
    └─→ Object Store: PUT file directly to presigned URL
                      (No credentials in frontend)
    
CAP Service
    │
    └─→ Object Store: Generate presigned GET URLs for downloads
                      (5 min expiry)
```

### Key Features

✅ **Presigned URLs** - No long-lived credentials on client  
✅ **90-day lifecycle policy** - Automatic deletion after retention period  
✅ **CORS enabled** - Allows Build Apps domain to upload files  
✅ **Bucket per environment** - `onboarding-documents-dev`, `onboarding-documents-prod`  
✅ **Object key structure** - `{invitationId}/{timestamp}_{filename}`  

---

## Step 1: Provision Object Store Service Instance

### Via Cloud Foundry CLI

```bash
# Login to Cloud Foundry
cf login -a https://api.cf.eu10.hana.ondemand.com

# Target your space
cf target -o <your-org> -s <your-space>

# Create Object Store service instance (S3-standard plan)
cf create-service objectstore s3-standard supplier-onboarding-objectstore \
  -c '{"instance_name": "supplier-onboarding-storage"}'

# Verify service creation
cf service supplier-onboarding-objectstore

# Expected output:
# name:              supplier-onboarding-objectstore
# service:           objectstore
# plan:              s3-standard
# last operation:    create succeeded
```

### Via BTP Cockpit (Alternative)

1. Navigate to: **BTP Cockpit** → **Subaccount** → **Services** → **Service Marketplace**
2. Search for: **Object Store**
3. Click **Create**
4. Configure:
   - **Service**: Object Store
   - **Plan**: s3-standard
   - **Runtime Environment**: Cloud Foundry
   - **Space**: `<your-space>`
   - **Instance Name**: `supplier-onboarding-objectstore`
5. Click **Create**

---

## Step 2: Create Service Key (Extract Credentials)

Service keys provide access credentials (endpoint, access key, secret key) needed for bucket operations and presigned URL generation.

```bash
# Create service key
cf create-service-key supplier-onboarding-objectstore supplier-onboarding-key

# Retrieve credentials
cf service-key supplier-onboarding-objectstore supplier-onboarding-key

# Expected output (JSON format):
# {
#   "access_key_id": "AKIAIOSFODNN7EXAMPLE",
#   "bucket": "",
#   "credentials_type": "aws-service-key",
#   "host": "objectstore.cfapps.eu10.hana.ondemand.com",
#   "region": "eu-central-1",
#   "secret_access_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
#   "uri": "https://objectstore.cfapps.eu10.hana.ondemand.com"
# }
```

**⚠️ Security Note:** Store credentials securely in environment variables or BTP destination, never commit to git.

### Save Credentials for Later Use

```bash
# Export credentials as environment variables
export AWS_ACCESS_KEY_ID="<access_key_id from service key>"
export AWS_SECRET_ACCESS_KEY="<secret_access_key from service key>"
export AWS_S3_ENDPOINT="<host from service key>"
export AWS_REGION="<region from service key>"
```

---

## Step 3: Create S3 Bucket

### Using AWS CLI

```bash
# Install AWS CLI if not already installed
# macOS:
brew install awscli

# Linux:
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI with Object Store credentials
aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY
aws configure set region $AWS_REGION

# Create bucket
aws s3api create-bucket \
  --bucket onboarding-documents \
  --endpoint-url https://$AWS_S3_ENDPOINT \
  --region $AWS_REGION

# Verify bucket creation
aws s3 ls --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# 2026-02-04 10:30:15 onboarding-documents
```

### Using Automation Script

See `scripts/setup-objectstore.sh` for automated bucket creation with lifecycle and CORS configuration.

---

## Step 4: Configure Bucket Lifecycle Policy (90-Day Retention)

Automatically delete documents after 90 days to comply with data retention policies.

### Create Lifecycle Policy JSON

Create file: `config/lifecycle-policy.json`

```json
{
  "Rules": [
    {
      "Id": "DeleteAfter90Days",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Expiration": {
        "Days": 90
      }
    },
    {
      "Id": "DeleteIncompleteUploadsAfter1Day",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 1
      }
    }
  ]
}
```

### Apply Lifecycle Policy

```bash
# Apply lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket onboarding-documents \
  --lifecycle-configuration file://config/lifecycle-policy.json \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Verify lifecycle policy
aws s3api get-bucket-lifecycle-configuration \
  --bucket onboarding-documents \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# {
#   "Rules": [
#     {
#       "Id": "DeleteAfter90Days",
#       "Status": "Enabled",
#       "Expiration": { "Days": 90 },
#       ...
#     }
#   ]
# }
```

---

## Step 5: Configure CORS for Build Apps

Allow Build Apps frontend to upload files directly to Object Store using presigned URLs.

### Create CORS Configuration JSON

Create file: `config/cors-policy.json`

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": [
        "https://*.eu10.build.cloud.sap",
        "https://*.build.apps.cloud.sap",
        "http://localhost:4004"
      ],
      "AllowedMethods": [
        "GET",
        "PUT",
        "POST",
        "DELETE",
        "HEAD"
      ],
      "AllowedHeaders": [
        "*"
      ],
      "ExposeHeaders": [
        "ETag",
        "x-amz-request-id",
        "x-amz-id-2"
      ],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

**Note:** Update `AllowedOrigins` with your actual Build Apps domain after deployment.

### Apply CORS Policy

```bash
# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket onboarding-documents \
  --cors-configuration file://config/cors-policy.json \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Verify CORS policy
aws s3api get-bucket-cors \
  --bucket onboarding-documents \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# {
#   "CORSRules": [
#     {
#       "AllowedOrigins": ["https://*.eu10.build.cloud.sap", ...],
#       "AllowedMethods": ["GET", "PUT", ...],
#       ...
#     }
#   ]
# }
```

---

## Step 6: Set Bucket Versioning (Optional but Recommended)

Enable versioning to protect against accidental deletions.

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket onboarding-documents \
  --versioning-configuration Status=Enabled \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Verify versioning
aws s3api get-bucket-versioning \
  --bucket onboarding-documents \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# {
#   "Status": "Enabled"
# }
```

---

## Step 7: Test Bucket Access

### Upload Test File

```bash
# Create test file
echo "Test document for supplier onboarding" > test-upload.txt

# Upload file
aws s3 cp test-upload.txt \
  s3://onboarding-documents/test/test-upload.txt \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# upload: ./test-upload.txt to s3://onboarding-documents/test/test-upload.txt

# List bucket contents
aws s3 ls s3://onboarding-documents/test/ \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# 2026-02-04 10:45:30        38 test-upload.txt
```

### Download Test File

```bash
# Download file
aws s3 cp \
  s3://onboarding-documents/test/test-upload.txt \
  downloaded-test.txt \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Verify content
cat downloaded-test.txt

# Expected output:
# Test document for supplier onboarding
```

### Delete Test File

```bash
# Delete test file
aws s3 rm s3://onboarding-documents/test/test-upload.txt \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Verify deletion
aws s3 ls s3://onboarding-documents/test/ \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output: (empty - no files)
```

---

## Object Key Naming Convention

To organize documents by invitation and prevent collisions:

```
onboarding-documents/
  ├── {invitationId}/
  │     ├── {timestamp}_{originalFileName}
  │     ├── 1738847521000_business-license.pdf
  │     ├── 1738847523000_tax-certificate.pdf
  │     └── 1738847525000_bank-statement.pdf
  └── test/
        └── test-upload.txt
```

**Example:**
```
Invitation ID: 550e8400-e29b-41d4-a716-446655440000
Original filename: Company Registration.pdf
Object key: 550e8400-e29b-41d4-a716-446655440000/1738847521000_Company_Registration.pdf
```

**Benefits:**
- Easy deletion of all documents for one invitation
- No filename collisions
- Timestamp for ordering/auditing
- Supports S3 prefix-based queries

---

## Environment Variables for CAP Service

Add these to `env/.env.template` and `mta.yaml`:

```bash
# Object Store configuration
AWS_ACCESS_KEY_ID=<from service key>
AWS_SECRET_ACCESS_KEY=<from service key>
AWS_S3_ENDPOINT=objectstore.cfapps.eu10.hana.ondemand.com
AWS_REGION=eu-central-1
S3_BUCKET_NAME=onboarding-documents

# Presigned URL expiry times
PRESIGNED_UPLOAD_URL_EXPIRY=900     # 15 minutes in seconds
PRESIGNED_DOWNLOAD_URL_EXPIRY=300   # 5 minutes in seconds
```

---

## Bind Object Store to CAP Service (mta.yaml)

Add Object Store service to `mta.yaml`:

```yaml
modules:
  - name: supplier-onboarding-srv
    type: nodejs
    path: gen/srv
    requires:
      - name: supplier-onboarding-xsuaa
      - name: supplier-onboarding-destination
      - name: supplier-onboarding-objectstore  # Add this
      - name: supplier-onboarding-hana

resources:
  # Add Object Store resource
  - name: supplier-onboarding-objectstore
    type: org.cloudfoundry.managed-service
    parameters:
      service: objectstore
      service-plan: s3-standard
      service-name: supplier-onboarding-objectstore
```

---

## Security Best Practices

✅ **Never expose credentials** - Use service bindings or destinations  
✅ **Use presigned URLs** - Short-lived (15 min upload, 5 min download)  
✅ **CORS whitelist** - Only allow known Build Apps domains  
✅ **Lifecycle policy** - Auto-delete after 90 days (GDPR compliance)  
✅ **Enable versioning** - Protect against accidental deletions  
✅ **Audit logging** - Track all upload/download operations  
✅ **File validation** - Check MIME type, size limits before presigned URL generation  

---

## Troubleshooting

### Issue: "Unable to locate credentials"

**Symptoms:**
```
Unable to locate credentials. You can configure credentials by running "aws configure".
```

**Solution:**
```bash
# Ensure environment variables are set
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY

# Or configure AWS CLI profile
aws configure --profile objectstore
```

---

### Issue: "The bucket you are attempting to access must be addressed using the specified endpoint"

**Symptoms:**
```
An error occurred (PermanentRedirect) when calling the CreateBucket operation
```

**Solution:**
Always include `--endpoint-url` parameter:
```bash
aws s3api create-bucket \
  --bucket onboarding-documents \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

---

### Issue: CORS error in browser

**Symptoms:**
```
Access to XMLHttpRequest at 'https://objectstore...' from origin 'https://buildapps...' 
has been blocked by CORS policy
```

**Solution:**
1. Verify CORS policy includes Build Apps domain
2. Update `AllowedOrigins` in `cors-policy.json`
3. Reapply CORS configuration
4. Clear browser cache

---

### Issue: Lifecycle policy not working

**Symptoms:**
Files not deleted after 90 days

**Solution:**
1. Verify policy applied:
   ```bash
   aws s3api get-bucket-lifecycle-configuration \
     --bucket onboarding-documents \
     --endpoint-url https://$AWS_S3_ENDPOINT
   ```
2. Check object timestamps (lifecycle runs daily)
3. Verify no bucket versioning conflicts

---

## Monitoring & Maintenance

### Check Bucket Size

```bash
# Get total size of bucket
aws s3 ls s3://onboarding-documents --recursive --summarize \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Expected output:
# Total Objects: 150
# Total Size: 45678912
```

### List Objects by Invitation

```bash
# List all documents for specific invitation
aws s3 ls s3://onboarding-documents/550e8400-e29b-41d4-a716-446655440000/ \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

### Bulk Delete (Admin Operation)

```bash
# Delete all objects for a specific invitation
aws s3 rm s3://onboarding-documents/550e8400-e29b-41d4-a716-446655440000/ \
  --recursive \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

---

## Next Steps

After completing Object Store setup:

✅ **Step 13:** Configure Object Store destination in BTP Cockpit  
✅ **Step 14:** Implement presigned URL generation in CAP service (`srv/lib/objectstore-client.js`)  
✅ **Step 22:** Integrate file upload in Build Apps (Page 5 - Attachments)  

---

## Automated Setup Script

See `scripts/setup-objectstore.sh` for complete automated provisioning.

```bash
# Run automated setup
./scripts/setup-objectstore.sh

# Creates:
# - Object Store service instance
# - Service key
# - S3 bucket
# - Lifecycle policy
# - CORS configuration
# - Test file upload/download
```

---

**End of Object Store Setup Guide**
