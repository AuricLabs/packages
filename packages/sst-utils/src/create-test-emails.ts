export interface CreateTestEmailsOptions {
  totalTestEmails?: number;
  prefix?: string;
}

/**
 * Creates test emails for the given base email address. It will append a +1, +2, +3, etc. to the base email address. depending on the totalTestEmails.
 *
 * @param emails - The base email addresses to create test emails for.
 * @param options - The options for creating test emails.
 * @param options.totalTestEmails - The total number of test emails to create. Defaults to 10.
 * @param options.prefix - The prefix to append to the base email address. Defaults to 'test'. Example: 'email+test1@email.com'.
 * @returns An array of test email addresses
 */
export const createTestEmails = (
  emails: string[],
  {
    totalTestEmails = 10,
    prefix = `test-${$app.name}-${$app.stage}-`,
  }: CreateTestEmailsOptions = {},
) => {
  return emails.flatMap((email) => {
    const [emailName, domain] = email.split('@');
    const emails = [];
    for (let i = 0; i < totalTestEmails; i++) {
      emails.push(`${emailName}+${prefix}${(i + 1).toString()}@${domain}`);
    }
    return emails;
  });
};
