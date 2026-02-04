# Object Store Quick Reference

## Quick Commands

### Setup (Automated)
```bash
# Full setup for development environment
./scripts/setup-objectstore.sh dev

# Production setup
./scripts/setup-objectstore.sh prod
```

### Manual Commands

#### List Buckets
```bash
aws s3 ls --endpoint-url https://$AWS_S3_ENDPOINT
```

#### List Objects in Bucket
```bash
aws s3 ls s3://onboarding-documents-dev/ --recursive \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

#### Upload File
```bash
aws s3 cp document.pdf \
  s3://onboarding-documents-dev/test/document.pdf \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

#### Download File
```bash
aws s3 cp \
  s3://onboarding-documents-dev/test/document.pdf \
  downloaded-document.pdf \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

#### Delete File
```bash
aws s3 rm s3://onboarding-documents-dev/test/document.pdf \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

#### Get Bucket Lifecycle
```bash
aws s3api get-bucket-lifecycle-configuration \
  --bucket onboarding-documents-dev \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

#### Get CORS Configuration
```bash
aws s3api get-bucket-cors \
  --bucket onboarding-documents-dev \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

---

## Object Key Convention

```
{bucket-name}/
  └── {invitationId}/
        ├── {timestamp}_{sanitizedFileName}
        ├── 1738847521000_business_license.pdf
        ├── 1738847523000_tax_certificate.pdf
        └── 1738847525000_company_registration.pdf
```

**Example:**
- Invitation: `550e8400-e29b-41d4-a716-446655440000`
- File: `Company Registration.pdf`
- Key: `550e8400-e29b-41d4-a716-446655440000/1738847521000_Company_Registration.pdf`

---

## Troubleshooting

### Get Service Credentials
```bash
cf service-key supplier-onboarding-objectstore-dev supplier-onboarding-key-dev
```

### Test Connectivity
```bash
# Create test file
echo "Test" > test.txt

# Upload
aws s3 cp test.txt s3://onboarding-documents-dev/test/ \
  --endpoint-url https://$AWS_S3_ENDPOINT

# List
aws s3 ls s3://onboarding-documents-dev/test/ \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Download
aws s3 cp s3://onboarding-documents-dev/test/test.txt downloaded.txt \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Cleanup
aws s3 rm s3://onboarding-documents-dev/test/test.txt \
  --endpoint-url https://$AWS_S3_ENDPOINT
rm test.txt downloaded.txt
```

### Delete All Objects (DANGER)
```bash
# Delete all objects in bucket
aws s3 rm s3://onboarding-documents-dev/ --recursive \
  --endpoint-url https://$AWS_S3_ENDPOINT

# Delete bucket
aws s3api delete-bucket \
  --bucket onboarding-documents-dev \
  --endpoint-url https://$AWS_S3_ENDPOINT
```

---

## Environment Variables

Add to `.env.local`:

```bash
AWS_ACCESS_KEY_ID=<from service key>
AWS_SECRET_ACCESS_KEY=<from service key>
AWS_S3_ENDPOINT=objectstore.cfapps.eu10.hana.ondemand.com
AWS_REGION=eu-central-1
S3_BUCKET_NAME=onboarding-documents-dev
PRESIGNED_UPLOAD_URL_EXPIRY=900
PRESIGNED_DOWNLOAD_URL_EXPIRY=300
```

---

## Integration Example (Step 14)

```javascript
const { generatePresignedUploadUrl } = require('./srv/lib/objectstore-client');

// Generate presigned URL for file upload
const { url, objectKey } = await generatePresignedUploadUrl(
  'business-license.pdf',
  'application/pdf',
  '550e8400-e29b-41d4-a716-446655440000'
);

// Return to frontend
return {
  uploadUrl: url,
  objectKey: objectKey,
  expiresIn: 900  // 15 minutes
};
```

Frontend uploads directly:
```javascript
// In Build Apps
const response = await fetch(uploadUrl, {
  method: 'PUT',
  body: fileBlob,
  headers: {
    'Content-Type': 'application/pdf'
  }
});
```
