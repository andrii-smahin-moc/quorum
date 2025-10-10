export type KvStoreFactory = {
  initializeKvStore: (repositoryName: string) => KvStoreInterface;
};

export interface KvStoreInterface {
  get(key: string): Promise<{ value: string }>;
  set(parameters: { key: string; value: string }): Promise<void>;
}
