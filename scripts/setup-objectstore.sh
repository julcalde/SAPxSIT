#!/bin/bash

################################################################################
# Object Store Provisioning and Configuration Script
#
# Purpose: Automate SAP BTP Object Store setup for supplier onboarding
# 
# Actions:
# 1. Create Object Store service instance (if not exists)
# 2. Create service key and extract credentials
# 3. Create S3 bucket with naming convention
# 4. Apply lifecycle policy (90-day retention)
# 5. Configure CORS for Build Apps access
# 6. Enable versioning
# 7. Run connectivity tests
#
# Usage:
#   ./scripts/setup-objectstore.sh [environment]
#
# Environment: dev | test | prod (default: dev)
#
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="${1:-dev}"
SERVICE_NAME="supplier-onboarding-objectstore-${ENVIRONMENT}"
SERVICE_KEY_NAME="supplier-onboarding-key-${ENVIRONMENT}"
BUCKET_NAME="onboarding-documents-${ENVIRONMENT}"
CONFIG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SAP BTP Object Store Setup                          ║${NC}"
echo -e "${BLUE}║   Environment: ${ENVIRONMENT}                                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# Function: Check prerequisites
################################################################################
check_prerequisites() {
  echo -e "${YELLOW}→ Checking prerequisites...${NC}"
  
  # Check cf CLI
  if ! command -v cf &> /dev/null; then
    echo -e "${RED}✗ Cloud Foundry CLI not found. Please install: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Cloud Foundry CLI installed${NC}"
  
  # Check AWS CLI
  if ! command -v aws &> /dev/null; then
    echo -e "${RED}✗ AWS CLI not found. Please install: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ AWS CLI installed${NC}"
  
  # Check logged in to CF
  if ! cf target &> /dev/null; then
    echo -e "${RED}✗ Not logged in to Cloud Foundry. Please run: cf login${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Logged in to Cloud Foundry${NC}"
  
  # Display current CF target
  CURRENT_ORG=$(cf target | grep org: | awk '{print $2}')
  CURRENT_SPACE=$(cf target | grep space: | awk '{print $2}')
  echo -e "${BLUE}  Org: ${CURRENT_ORG}${NC}"
  echo -e "${BLUE}  Space: ${CURRENT_SPACE}${NC}"
  echo ""
}

################################################################################
# Function: Create Object Store service instance
################################################################################
create_service_instance() {
  echo -e "${YELLOW}→ Creating Object Store service instance...${NC}"
  
  # Check if service already exists
  if cf service "${SERVICE_NAME}" &> /dev/null; then
    echo -e "${YELLOW}  Service '${SERVICE_NAME}' already exists, skipping creation${NC}"
    return 0
  fi
  
  # Create service
  cf create-service objectstore s3-standard "${SERVICE_NAME}" -c "{\"instance_name\": \"${SERVICE_NAME}\"}"
  
  # Wait for service creation
  echo -e "${YELLOW}  Waiting for service creation (this may take 1-2 minutes)...${NC}"
  while true; do
    STATUS=$(cf service "${SERVICE_NAME}" | grep "status:" | awk '{print $2}')
    if [ "$STATUS" == "create" ] && [ "$(cf service "${SERVICE_NAME}" | grep "status:" | awk '{print $3}')" == "succeeded" ]; then
      echo -e "${GREEN}✓ Service created successfully${NC}"
      break
    elif [ "$STATUS" == "create" ] && [ "$(cf service "${SERVICE_NAME}" | grep "status:" | awk '{print $3}')" == "failed" ]; then
      echo -e "${RED}✗ Service creation failed${NC}"
      exit 1
    fi
    sleep 5
  done
  echo ""
}

################################################################################
# Function: Create service key and extract credentials
################################################################################
create_service_key() {
  echo -e "${YELLOW}→ Creating service key and extracting credentials...${NC}"
  
  # Delete existing key if present
  if cf service-key "${SERVICE_NAME}" "${SERVICE_KEY_NAME}" &> /dev/null; then
    echo -e "${YELLOW}  Deleting existing service key...${NC}"
    cf delete-service-key "${SERVICE_NAME}" "${SERVICE_KEY_NAME}" -f
  fi
  
  # Create new service key
  cf create-service-key "${SERVICE_NAME}" "${SERVICE_KEY_NAME}"
  
  # Extract credentials
  CREDENTIALS=$(cf service-key "${SERVICE_NAME}" "${SERVICE_KEY_NAME}" | tail -n +3)
  
  export AWS_ACCESS_KEY_ID=$(echo "$CREDENTIALS" | grep -o '"access_key_id": "[^"]*' | cut -d'"' -f4)
  export AWS_SECRET_ACCESS_KEY=$(echo "$CREDENTIALS" | grep -o '"secret_access_key": "[^"]*' | cut -d'"' -f4)
  export AWS_S3_ENDPOINT=$(echo "$CREDENTIALS" | grep -o '"host": "[^"]*' | cut -d'"' -f4)
  export AWS_REGION=$(echo "$CREDENTIALS" | grep -o '"region": "[^"]*' | cut -d'"' -f4)
  
  if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$AWS_S3_ENDPOINT" ]; then
    echo -e "${RED}✗ Failed to extract credentials from service key${NC}"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Service key created${NC}"
  echo -e "${BLUE}  Endpoint: https://${AWS_S3_ENDPOINT}${NC}"
  echo -e "${BLUE}  Region: ${AWS_REGION}${NC}"
  echo ""
}

################################################################################
# Function: Create S3 bucket
################################################################################
create_bucket() {
  echo -e "${YELLOW}→ Creating S3 bucket: ${BUCKET_NAME}...${NC}"
  
  # Check if bucket exists
  if aws s3 ls "s3://${BUCKET_NAME}" --endpoint-url "https://${AWS_S3_ENDPOINT}" &> /dev/null; then
    echo -e "${YELLOW}  Bucket '${BUCKET_NAME}' already exists, skipping creation${NC}"
  else
    # Create bucket
    aws s3api create-bucket \
      --bucket "${BUCKET_NAME}" \
      --endpoint-url "https://${AWS_S3_ENDPOINT}" \
      --region "${AWS_REGION}"
    
    echo -e "${GREEN}✓ Bucket created successfully${NC}"
  fi
  echo ""
}

################################################################################
# Function: Apply lifecycle policy
################################################################################
apply_lifecycle_policy() {
  echo -e "${YELLOW}→ Applying lifecycle policy (90-day retention)...${NC}"
  
  if [ ! -f "${CONFIG_DIR}/lifecycle-policy.json" ]; then
    echo -e "${RED}✗ Lifecycle policy file not found: ${CONFIG_DIR}/lifecycle-policy.json${NC}"
    exit 1
  fi
  
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "${BUCKET_NAME}" \
    --lifecycle-configuration "file://${CONFIG_DIR}/lifecycle-policy.json" \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  echo -e "${GREEN}✓ Lifecycle policy applied${NC}"
  echo -e "${BLUE}  Documents will be automatically deleted after 90 days${NC}"
  echo ""
}

################################################################################
# Function: Apply CORS configuration
################################################################################
apply_cors_policy() {
  echo -e "${YELLOW}→ Applying CORS configuration...${NC}"
  
  if [ ! -f "${CONFIG_DIR}/cors-policy.json" ]; then
    echo -e "${RED}✗ CORS policy file not found: ${CONFIG_DIR}/cors-policy.json${NC}"
    exit 1
  fi
  
  aws s3api put-bucket-cors \
    --bucket "${BUCKET_NAME}" \
    --cors-configuration "file://${CONFIG_DIR}/cors-policy.json" \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  echo -e "${GREEN}✓ CORS configuration applied${NC}"
  echo -e "${BLUE}  Build Apps can now upload files directly${NC}"
  echo ""
}

################################################################################
# Function: Enable bucket versioning
################################################################################
enable_versioning() {
  echo -e "${YELLOW}→ Enabling bucket versioning...${NC}"
  
  aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  echo -e "${GREEN}✓ Versioning enabled${NC}"
  echo -e "${BLUE}  Protects against accidental deletions${NC}"
  echo ""
}

################################################################################
# Function: Run connectivity tests
################################################################################
run_tests() {
  echo -e "${YELLOW}→ Running connectivity tests...${NC}"
  
  # Test 1: Upload file
  echo -e "${YELLOW}  Test 1: Upload file${NC}"
  echo "Test document for supplier onboarding - Environment: ${ENVIRONMENT}" > /tmp/test-upload-${ENVIRONMENT}.txt
  
  aws s3 cp /tmp/test-upload-${ENVIRONMENT}.txt \
    "s3://${BUCKET_NAME}/test/test-upload.txt" \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Upload successful${NC}"
  else
    echo -e "${RED}  ✗ Upload failed${NC}"
    exit 1
  fi
  
  # Test 2: List files
  echo -e "${YELLOW}  Test 2: List files${NC}"
  FILES=$(aws s3 ls "s3://${BUCKET_NAME}/test/" --endpoint-url "https://${AWS_S3_ENDPOINT}")
  
  if [ -n "$FILES" ]; then
    echo -e "${GREEN}  ✓ List successful${NC}"
    echo -e "${BLUE}    ${FILES}${NC}"
  else
    echo -e "${RED}  ✗ List failed${NC}"
    exit 1
  fi
  
  # Test 3: Download file
  echo -e "${YELLOW}  Test 3: Download file${NC}"
  aws s3 cp \
    "s3://${BUCKET_NAME}/test/test-upload.txt" \
    /tmp/test-download-${ENVIRONMENT}.txt \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  if [ $? -eq 0 ]; then
    CONTENT=$(cat /tmp/test-download-${ENVIRONMENT}.txt)
    echo -e "${GREEN}  ✓ Download successful${NC}"
    echo -e "${BLUE}    Content: ${CONTENT}${NC}"
  else
    echo -e "${RED}  ✗ Download failed${NC}"
    exit 1
  fi
  
  # Test 4: Delete file
  echo -e "${YELLOW}  Test 4: Delete file${NC}"
  aws s3 rm "s3://${BUCKET_NAME}/test/test-upload.txt" \
    --endpoint-url "https://${AWS_S3_ENDPOINT}"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}  ✓ Delete successful${NC}"
  else
    echo -e "${RED}  ✗ Delete failed${NC}"
    exit 1
  fi
  
  # Cleanup
  rm -f /tmp/test-upload-${ENVIRONMENT}.txt /tmp/test-download-${ENVIRONMENT}.txt
  
  echo -e "${GREEN}✓ All tests passed${NC}"
  echo ""
}

################################################################################
# Function: Display summary
################################################################################
display_summary() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Setup Complete!                                      ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${GREEN}Object Store Configuration:${NC}"
  echo -e "  Service Name:    ${SERVICE_NAME}"
  echo -e "  Service Key:     ${SERVICE_KEY_NAME}"
  echo -e "  Bucket Name:     ${BUCKET_NAME}"
  echo -e "  Endpoint:        https://${AWS_S3_ENDPOINT}"
  echo -e "  Region:          ${AWS_REGION}"
  echo ""
  echo -e "${GREEN}Environment Variables for .env:${NC}"
  echo -e "  AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}"
  echo -e "  AWS_SECRET_ACCESS_KEY=<redacted>"
  echo -e "  AWS_S3_ENDPOINT=${AWS_S3_ENDPOINT}"
  echo -e "  AWS_REGION=${AWS_REGION}"
  echo -e "  S3_BUCKET_NAME=${BUCKET_NAME}"
  echo ""
  echo -e "${YELLOW}Next Steps:${NC}"
  echo -e "  1. Configure Object Store destination (Step 13)"
  echo -e "  2. Implement presigned URL generation (Step 14)"
  echo -e "  3. Integrate file upload in Build Apps (Step 22)"
  echo ""
}

################################################################################
# Main execution
################################################################################
main() {
  check_prerequisites
  create_service_instance
  create_service_key
  create_bucket
  apply_lifecycle_policy
  apply_cors_policy
  enable_versioning
  run_tests
  display_summary
}

# Run main function
main
