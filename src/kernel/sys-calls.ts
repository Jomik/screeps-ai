export type SysCalls = ReturnType<typeof sleep>;

export const sleep = () => ({
  type: 'sleep' as const,
});
