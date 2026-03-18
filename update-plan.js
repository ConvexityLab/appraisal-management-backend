const fs = require('fs');
let text = fs.readFileSync('C:/source/appraisal-management-backend/PLATFORM_GAP_CLOSURE_PLAN.md', 'utf8');

text = text.replace('### 1.2 — WebPubSub — Full 30+ Event Catalog\n**Status:** ?? In Progress', '### 1.2 — WebPubSub — Full 30+ Event Catalog\n**Status:** ? Completed');

text = text.replace('- [ ] Add missing event interfaces to src/types/events.ts\n- [ ] Add missing EventCategory enum values', '- [x] Add missing event interfaces to src/types/events.ts\n- [x] Add missing EventCategory enum values');

text = text.replace('- [ ] Update subscriber.subscribe() calls in communication-event-handler.service.ts to handle each new event type\n- [ ] Add roadcastNotification() calls at each relevant service action point (payment service, ROV service, delivery service, etc.)\n- [ ] Update Service Bus topic subscriptions if needed', '- [x] Update subscriber.subscribe() calls in communication-event-handler.service.ts to handle each new event type\n- [x] Add roadcastNotification() calls at each relevant service action point (payment service, ROV service, delivery service, etc.)\n- [x] Update Service Bus topic subscriptions if needed');

text = text.replace('- [ ] 1.2 Missing event types in events.ts\n- [ ] 1.2 WebPubSub event subscriptions\n- [ ] 1.2 Broadcast calls at service action points', '- [x] 1.2 Missing event types in events.ts\n- [x] 1.2 WebPubSub event subscriptions\n- [x] 1.2 Broadcast calls at service action points');

fs.writeFileSync('C:/source/appraisal-management-backend/PLATFORM_GAP_CLOSURE_PLAN.md', text);
