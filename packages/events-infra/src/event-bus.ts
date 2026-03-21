export function createEventBus(name: string) {
  return new sst.aws.Bus(name);
}
