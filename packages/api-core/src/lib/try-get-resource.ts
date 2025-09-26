import { get } from 'lodash-es';
import { Resource } from 'sst';

/**
 * Gets the resource using dot notation on the resource object.
 * @param resource - The resource to get.
 * @returns The resource or undefined if the resource is not found.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const tryGetResource = <T = unknown>(resource: string): T | undefined => {
  try {
    // Use lodash.get to support dot notation (e.g., "MySecret.value")
    return get(Resource, resource) as T;
  } catch {
    return undefined;
  }
};
