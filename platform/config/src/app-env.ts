/**
 * APP_ENV ki allowed values.
 *
 * `enum` ki jagah `as const` array use kiya hai, kyunki ADR 0016 me sirf "erasable" TS syntax allowed hai
 * (Node types hata kar code chalata hai, aur `enum` ek runtime object banata hai jise wo strip nahi kar sakta).
 */
export const APP_ENVS = ["development", "test", "production"] as const;

/** "development" | "test" | "production": upar wale array se khud bana hua type. */
export type AppEnv = (typeof APP_ENVS)[number];
