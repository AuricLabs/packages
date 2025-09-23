import { camelCase } from 'lodash';

export const scopeKeyId = <T extends string>(key: T): `${T}Id` =>
  camelCase(key + '_id') as `${T}Id`;
