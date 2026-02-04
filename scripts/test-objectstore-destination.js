/**
 * Test Object Store Destination Connectivity
 * 
 * This script validates that the BTP destination 'objectstore-s3-endpoint'
 * is properly configured and accessible from the CAP application.
 * 
 * Usage: node scripts/test-objectstore-destination.js
 * 
 * Prerequisites:
 * - Destination 'objectstore-s3-endpoint' created in BTP Cockpit
 * - CAP application bound to Destination Service
 * - npm packages installed (@sap/cds, aws-sdk)
 */

const cds = require('@sap/cds');

async function testObjectStoreDestination() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Object Store Destination Connectivity Test              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  try {
    // Step 1: Connect to destination service
    console.log('⏳ Step 1: Connecting to BTP Destination Service...');
    const { destination } = await cds.connect.to('destination');
    console.log('✓ Connected to Destination Service\n');
    
    // Step 2: Get Object Store destination
    console.log('⏳ Step 2: Retrieving destination "objectstore-s3-endpoint"...');
    const dest = await destination.getDestination('objectstore-s3-endpoint');
    
    if (!dest) {
      console.error('❌ FAILED: Destination not found: objectstore-s3-endpoint');
      console.error('\n📋 Next Steps:');
      console.error('   1. Create the destination in BTP Cockpit');
      console.error('   2. Follow the guide: docs/destination-objectstore-setup.md');
      console.error('   3. Ensure all required properties are set\n');
      process.exit(1);
    }
    
    console.log('✓ Destination found');
    console.log('  Name:', dest.Name);
    console.log('  URL:', dest.destinationConfiguration.URL);
    console.log('  Type:', dest.Type);
    console.log('  Authentication:', dest.Authentication || 'NoAuthentication');
    
    // Step 3: Extract S3 configuration
    console.log('\n⏳ Step 3: Extracting S3 configuration...');
    const s3Config = {
      endpoint: dest.destinationConfiguration.URL,
      region: dest.destinationConfiguration['s3.region'],
      bucket: dest.destinationConfiguration['s3.bucket'],
      accessKeyId: dest.destinationConfiguration['s3.access.key'],
      secretAccessKey: dest.destinationConfiguration['s3.secret.key'],
      signatureVersion: dest.destinationConfiguration['s3.signature.version'] || 'v4'
    };
    
    // Validate configuration
    const missingProperties = [];
    if (!s3Config.region) missingProperties.push('s3.region');
    if (!s3Config.bucket) missingProperties.push('s3.bucket');
    if (!s3Config.accessKeyId) missingProperties.push('s3.access.key');
    if (!s3Config.secretAccessKey) missingProperties.push('s3.secret.key');
    
    if (missingProperties.length > 0) {
      console.error('❌ FAILED: Missing required properties in destination:');
      missingProperties.forEach(prop => console.error(`   - ${prop}`));
      console.error('\n📋 Add these properties in BTP Cockpit destination configuration\n');
      process.exit(1);
    }
    
    console.log('✓ S3 Configuration validated:');
    console.log('  Region:', s3Config.region);
    console.log('  Bucket:', s3Config.bucket);
    console.log('  Signature Version:', s3Config.signatureVersion);
    console.log('  Access Key:', s3Config.accessKeyId ? '***' + s3Config.accessKeyId.slice(-4) : 'NOT SET');
    console.log('  Secret Key:', s3Config.secretAccessKey ? '***' + s3Config.secretAccessKey.slice(-4) : 'NOT SET');
    
    // Step 4: Test S3 connectivity
    console.log('\n⏳ Step 4: Testing S3 connectivity...');
    const AWS = require('aws-sdk');
    const s3 = new AWS.S3({
      endpoint: s3Config.endpoint,
      region: s3Config.region,
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
      signatureVersion: s3Config.signatureVersion,
      s3ForcePathStyle: true, // Required for S3-compatible services
      httpOptions: {
        timeout: 10000 // 10 second timeout
      }
    });
    
    // List objects in bucket (limit 1 to test connectivity)
    const response = await s3.listObjectsV2({
      Bucket: s3Config.bucket,
      MaxKeys: 1
    }).promise();
    
    console.log('✓ S3 connection successful');
    console.log('  Objects in bucket:', response.KeyCount);
    console.log('  Bucket accessible:', s3Config.bucket);
    
    // Step 5: Test presigned URL generation (dry run)
    console.log('\n⏳ Step 5: Testing presigned URL generation...');
    const testKey = `test-connectivity/${Date.now()}-test.txt`;
    
    const uploadUrl = await s3.getSignedUrlPromise('putObject', {
      Bucket: s3Config.bucket,
      Key: testKey,
      Expires: 900, // 15 minutes
      ContentType: 'text/plain'
    });
    
    console.log('✓ Presigned upload URL generated successfully');
    console.log('  URL length:', uploadUrl.length);
    console.log('  Expiry: 15 minutes');
    console.log('  Sample URL:', uploadUrl.substring(0, 80) + '...');
    
    const downloadUrl = await s3.getSignedUrlPromise('getObject', {
      Bucket: s3Config.bucket,
      Key: testKey,
      Expires: 300 // 5 minutes
    });
    
    console.log('✓ Presigned download URL generated successfully');
    console.log('  URL length:', downloadUrl.length);
    console.log('  Expiry: 5 minutes');
    
    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ ALL TESTS PASSED                     ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('\n✓ Destination is properly configured');
    console.log('✓ S3 bucket is accessible');
    console.log('✓ Presigned URL generation works');
    console.log('\n📋 Next Steps:');
    console.log('   ✅ Step 13 Complete - Destination configuration validated');
    console.log('   ➡️  Proceed to Step 14 - Implement objectstore-client.js\n');
    
  } catch (error) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                    ❌ TEST FAILED                          ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');
    console.error('Error:', error.message);
    
    // Provide specific guidance based on error code
    if (error.code === 'NoSuchBucket') {
      console.error('\n📋 Bucket not found. Resolution steps:');
      console.error('   1. Verify bucket name in destination matches service key');
      console.error('   2. Run: scripts/setup-objectstore.sh to create bucket');
      console.error('   3. Check bucket exists in Object Store service dashboard\n');
    } else if (error.code === 'InvalidAccessKeyId') {
      console.error('\n📋 Invalid access key. Resolution steps:');
      console.error('   1. Get fresh credentials: cf service-key supplier-onboarding-objectstore objectstore-key');
      console.error('   2. Update s3.access.key in BTP Cockpit destination');
      console.error('   3. Ensure no trailing spaces in the key\n');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n📋 Signature mismatch. Resolution steps:');
      console.error('   1. Verify s3.secret.key in destination is correct');
      console.error('   2. Ensure s3.signature.version is set to "4"');
      console.error('   3. Check s3.region matches the bucket region\n');
    } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.error('\n📋 Network connectivity issue. Resolution steps:');
      console.error('   1. Verify URL format: https://s3.<region>.amazonaws.com');
      console.error('   2. Check internet proxy settings in destination');
      console.error('   3. Test network from Cloud Foundry: cf ssh <app> -c "curl <url>"\n');
    } else if (error.message.includes('Cannot find module')) {
      console.error('\n📋 Missing dependencies. Resolution steps:');
      console.error('   1. Install aws-sdk: npm install aws-sdk');
      console.error('   2. Install @sap/cds: npm install @sap/cds');
      console.error('   3. Run: npm install\n');
    } else {
      console.error('\n📋 Unexpected error. Debug information:');
      console.error('   Error Code:', error.code || 'N/A');
      console.error('   Error Type:', error.name || 'N/A');
      console.error('   Stack Trace:');
      console.error(error.stack);
      console.error('\n   Review docs/destination-objectstore-setup.md for troubleshooting\n');
    }
    
    process.exit(1);
  }
}

// Run test
testObjectStoreDestination().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
