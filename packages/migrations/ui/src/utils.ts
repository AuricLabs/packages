export const MIGRATION_ID_REGEX = /^(\d{14})_(.+)$/;

export function extractName(id: string): string {
  const match = MIGRATION_ID_REGEX.exec(id);
  return match ? match[2] : id;
}
