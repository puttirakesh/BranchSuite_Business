export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;
