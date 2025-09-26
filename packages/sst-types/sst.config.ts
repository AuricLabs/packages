// @ts-ignore
export default $config({
  app() {
    return {
      name: 'sst-utils',
      home: 'aws',
      providers: { 'aws-native': '1.26.0' },
    };
  },
  run() {
    throw new Error('Function not implemented.');
  },
});
