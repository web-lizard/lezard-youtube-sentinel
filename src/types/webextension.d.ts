declare namespace WebExt {
  interface MessageSender { tab?: { id?: number }; }
  interface BrowserApi {
    runtime: {
      sendMessage<T = unknown>(message: unknown): Promise<T>;
      onMessage: { addListener(listener: (message: unknown, sender: MessageSender) => unknown): void };
      openOptionsPage(): Promise<void>;
      getURL(path: string): string;
    };
    storage: {
      local: {
        get(keys?: string | string[] | Record<string, unknown>): Promise<Record<string, unknown>>;
        set(values: Record<string, unknown>): Promise<void>;
        remove(keys: string | string[]): Promise<void>;
      };
    };
    tabs: {
      query(query: Record<string, unknown>): Promise<Array<{ id?: number; url?: string }>>;
      sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
    };
    alarms: {
      create(name: string, info: { periodInMinutes: number }): Promise<void> | void;
      clear(name: string): Promise<boolean>;
      onAlarm: { addListener(listener: (alarm: { name: string }) => void): void };
    };
    permissions: {
      request(permissions: { origins?: string[]; data_collection?: string[] }): Promise<boolean>;
    };
  }
}

declare const browser: WebExt.BrowserApi;
