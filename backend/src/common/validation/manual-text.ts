import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';

/** Normalize human-entered text before DTO length/required checks. Never use on passwords. */
export function ManualText(): PropertyDecorator {
  return (target, property) => {
    Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)(target, property);
    Matches(/^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]*$/, {
      message: '$property contains unsupported control characters',
    })(target, property);
  };
}
