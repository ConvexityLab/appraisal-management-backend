import type { AppEvent } from '../types/events.js';

type EventListener = (event: AppEvent) => Promise<void> | void;

class InMemoryEventBus {
  private listeners: Map<string, Set<EventListener>> = new Map();

  subscribe(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType)!.add(listener);

    return () => {
      const bucket = this.listeners.get(eventType);
      if (!bucket) {
        return;
      }
      bucket.delete(listener);
      if (bucket.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  async publish(event: AppEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (!listeners || listeners.size === 0) {
      return;
    }

    await Promise.all(Array.from(listeners).map((listener) => Promise.resolve(listener(event))));
  }
}

export const inMemoryEventBus = new InMemoryEventBus();
