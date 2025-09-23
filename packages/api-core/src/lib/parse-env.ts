import z from 'zod';

export const parseEnv = <T extends z.ZodRawShape>(schema: T): z.infer<z.ZodObject<T>> => {
  const EnvSchema = z.object(schema);

  const parsedEnv = EnvSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    throw new Error(
      `Invalid env provided.
The following variables are missing or invalid:
${Object.entries(z.treeifyError(parsedEnv.error).errors)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}x
`,
    );
  }

  return parsedEnv.data;
};
