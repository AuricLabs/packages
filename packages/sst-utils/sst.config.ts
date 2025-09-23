// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path=".sst/platform/config.d.ts" />

export default $config({
  app() {
    return {
      name: 'sst-utils',
      home: 'aws',
      providers: { 'aws-native': '1.26.0' },
    };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  run: function (): Promise<Record<string, any>> {
    throw new Error('Function not implemented.');
  },
});
