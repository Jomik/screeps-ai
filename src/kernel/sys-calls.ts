export type SysCall = ReturnType<typeof sleep>;

export const sleep = (ticks: number = 1) => ({
  type: 'sleep' as const,
  ticks,
});
