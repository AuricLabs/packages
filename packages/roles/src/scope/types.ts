export type ScopeStringArray = Readonly<
  | []
  | ['system']
  | ['org']
  | ['org', string]
  | ['app', string, ...string[]]
  | ['org', string, 'app', string, ...string[]]
  | ['app', string]
>;

export type ScopeString =
  | ''
  | 'system'
  | `org`
  | `org:${string}`
  | `app:${string}`
  | `org:${string}:app:${string}`
  | `app:${string}:${string}`
  | `app:${string}:${string}:${string}`;

export interface ScopeSubject {
  type: string;
  id?: string;
}

export type ScopeSubjectArray = readonly ScopeSubject[];

export type Scope = ScopeStringArray | ScopeString | ScopeSubjectArray;
