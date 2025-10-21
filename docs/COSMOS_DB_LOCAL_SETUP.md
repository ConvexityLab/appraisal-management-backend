# Cosmos DB Local Setup and Testing Guide

## Quick Start - Testing Local Cosmos DB

This guide helps you validate that your Cosmos DB setup is working correctly for local development.

## Step 1: Install Cosmos DB Emulator

✅ **Status**: Already installed at `C:\Program Files\Azure Cosmos DB Emulator\`

## Step 2: Start the Cosmos DB Emulator

You have several options to start the emulator:

### Option A: GUI Method (Recommended)
1. Press Windows key + R
2. Type: `CosmosDB.Emulator.exe`
3. Press Enter
4. Wait for the emulator to start (usually takes 1-2 minutes)
5. A browser window should open showing the emulator dashboard

### Option B: Command Line Method
Open PowerShell as Administrator and run:
```powershell
& "C:\Program Files\Azure Cosmos DB Emulator\CosmosDB.Emulator.exe"
```

### Option C: Service Method
The emulator can also be started as a Windows service.

## Step 3: Verify Emulator is Running

Once started, the emulator should be accessible at:
- **Endpoint**: https://localhost:8081
- **Data Explorer**: https://localhost:8081/_explorer/index.html

## Step 4: Test the Connection

Run the test script to validate connectivity:

```bash
# Quick connectivity test
node cosmos-test.js

# Full integration test (once TypeScript is compiled)
npm run test:cosmos
```

## Expected Test Output

When working correctly, you should see:
```
🚀 Testing Cosmos DB Emulator Connection...

1️⃣ Creating Cosmos DB client...
✅ Client created successfully

2️⃣ Testing connection...
✅ Connection successful! Found X databases:
   - [existing databases]

3️⃣ Checking for appraisal-management database...
⚠️  Database 'appraisal-management' does not exist yet
   This is normal for first run - database will be created automatically

🎉 Cosmos DB Emulator test completed successfully!
```

## Troubleshooting

### Issue: Connection Refused or Timeout
**Symptoms**: `❌ Cosmos DB connection test failed!`

**Solutions**:
1. **Check if emulator is running**:
   - Look for "Azure Cosmos DB Emulator" in Task Manager
   - Check if https://localhost:8081 opens in browser

2. **Restart the emulator**:
   - Close any running emulator processes
   - Start emulator as Administrator
   - Wait 2-3 minutes for full startup

3. **Port conflicts**:
   - Ensure port 8081 is not used by other applications
   - Try restarting your computer if other services conflict

4. **Windows Firewall**:
   - Start emulator with `/NoFirewall` flag
   - Or add exception for CosmosDB.Emulator.exe

### Issue: SSL Certificate Errors
**Symptoms**: Certificate validation errors

**Solutions**:
1. **Install emulator certificate**:
   - Run emulator with admin privileges first time
   - Certificate should auto-install

2. **Manual certificate import**:
   - Export certificate from https://localhost:8081
   - Import to Trusted Root Certificate Authorities

### Issue: Performance Issues
**Symptoms**: Slow startup or operation

**Solutions**:
1. **System requirements**:
   - Ensure 2GB+ RAM available
   - Run on SSD if possible

2. **Emulator settings**:
   - Start with `/NoUI` for better performance
   - Use `/NoFirewall` to avoid network delays

## Manual Verification Steps

If automated tests fail, try these manual steps:

### 1. Check Emulator Process
```powershell
Get-Process -Name "*Cosmos*" -ErrorAction SilentlyContinue
```

### 2. Test Endpoint Manually
Open browser and navigate to: https://localhost:8081

### 3. Check Emulator Logs
Logs are typically in: `%LOCALAPPDATA%\CosmosDBEmulator\logs`

### 4. Reset Emulator Data
If needed, reset emulator:
```powershell
& "C:\Program Files\Azure Cosmos DB Emulator\CosmosDB.Emulator.exe" /DataPath=Reset
```

## Environment Variables

For production deployment, set these environment variables:

```bash
# Local Development (Emulator)
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==

# Production (Azure Cosmos DB)
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your-primary-key-here
```

## Next Steps

Once the emulator is running and tests pass:

1. **Database Initialization**: The application will automatically create required databases and containers
2. **Integration Testing**: Run full test suite with `npm test`
3. **API Testing**: Start the API server with `npm run dev`
4. **Development**: Begin development with full Cosmos DB persistence

## Support

- **Emulator Documentation**: https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator
- **Troubleshooting Guide**: https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator-release-notes
- **Azure Cosmos DB**: https://docs.microsoft.com/en-us/azure/cosmos-db/