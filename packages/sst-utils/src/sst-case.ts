import { camelCase } from 'lodash-es';

export const sstCase = (str: string) => {
  return camelCase(str).replace(/^[a-z]/, (char) => char.toUpperCase());
};
