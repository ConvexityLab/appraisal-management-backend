// Quick test to verify blob upload permissions
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

async function testBlobUpload() {
  try {
    console.log('Testing blob upload with DefaultAzureCredential...');
    
    const storageAccountName = 'apprstaginglqxl5vst';
    const containerName = 'vendor-documents';
    const accountUrl = `https://${storageAccountName}.blob.core.windows.net`;
    
    console.log(`Account URL: ${accountUrl}`);
    console.log(`Container: ${containerName}`);
    
    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(accountUrl, credential);
    
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobName = `test-uploads/test-${Date.now()}.txt`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const testData = Buffer.from('Quick permission test at ' + new Date().toISOString());
    
    console.log(`Uploading test blob: ${blobName}`);
    console.log(`Data size: ${testData.length} bytes`);
    
    await blockBlobClient.upload(testData, testData.length, {
      blobHTTPHeaders: {
        blobContentType: 'text/plain'
      }
    });
    
    console.log('✅ SUCCESS! Blob uploaded successfully');
    console.log(`Blob URL: ${blockBlobClient.url}`);
    
    // Try to read it back
    const downloadResponse = await blockBlobClient.download();
    const downloaded = await streamToBuffer(downloadResponse.readableStreamBody);
    console.log(`✅ Downloaded ${downloaded.length} bytes back`);
    console.log(`Content: ${downloaded.toString()}`);
    
    return true;
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Error code:', error.code);
    console.error('Status code:', error.statusCode);
    if (error.details) {
      console.error('Details:', error.details);
    }
    return false;
  }
}

async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

testBlobUpload().then(success => {
  process.exit(success ? 0 : 1);
});
