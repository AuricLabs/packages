import { Permission } from '../permissions';

export const flattenActionSubjects = (permission: Permission): Permission[] => {
  const actions = Array.isArray(permission.action) ? permission.action : [permission.action];
  const subjects = Array.isArray(permission.subject) ? permission.subject : [permission.subject];
  return subjects.flatMap((subject) =>
    actions.map((action) => ({ ...permission, action, subject })),
  );
};
