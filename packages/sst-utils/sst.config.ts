export default $config({
  app() {
    return {
      name: 'sst-utils',
      home: 'aws',
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: function (): Promise<Record<string, any>> {
    throw new Error('Function not implemented.');
  },
});
