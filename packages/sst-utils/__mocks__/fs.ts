import { fs } from 'memfs';
import mockRequire from 'mock-require';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
mockRequire('fs', fs);

export default fs;
