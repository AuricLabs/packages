export type Duration = `${number} ${"second" | "seconds" | "minute" | "minutes" | "hour" | "hours" | "day" | "days"}`;
export type DurationSeconds = `${number} ${"second" | "seconds"}`;
export type DurationMinutes = `${number} ${"second" | "seconds" | "minute" | "minutes"}`;
export type DurationHours = `${number} ${"second" | "seconds" | "minute" | "minutes" | "hour" | "hours"}`;
export type DurationDays = `${number} ${"day" | "days"}`;
export declare function toSeconds(duration: Duration | DurationMinutes | DurationSeconds | DurationDays): number;
export declare function toMilliseconds(duration: Duration | DurationMinutes | DurationSeconds | DurationDays): number;
