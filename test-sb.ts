import { ServiceBusClient } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';
import { setLogLevel } from '@azure/logger';

// Enable SDK debug logging to see which credential is used
setLogLevel('info');

async function test() {
  const cred = new DefaultAzureCredential();
  const client = new ServiceBusClient('appraisal-mgmt-staging-servicebus.servicebus.windows.net', cred);
  const receiver = client.createReceiver('appraisal-events', 'notification-service');
  receiver.subscribe({
    processMessage: async (msg) => console.log('MSG:', msg.body),
    processError: async (args) => console.error('ERR:', args.error.code, args.error.message?.substring(0, 80))
  });
  await new Promise(r => setTimeout(r, 5000));
  await receiver.close();
  await client.close();
  console.log('Done');
  process.exit(0);
}
test();
