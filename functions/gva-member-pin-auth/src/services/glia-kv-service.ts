import { FunctionConfig, KvStoreFactory, KvStoreInterface, LoggerInterface } from '../types';

export class GliaKVService {
  private kvStore: KvStoreInterface;
  constructor(
    private config: FunctionConfig,
    private logger: LoggerInterface,
    kvStoreFactory: KvStoreFactory,
  ) {
    this.kvStore = kvStoreFactory.initializeKvStore(this.config.dataDog.customer);
  }

  getValue(key: string) {
    return this.kvStore.get(key);
  }

  setValue(key: string, value: string): Promise<void> {
    return this.kvStore.set({ key, value });
  }
}
