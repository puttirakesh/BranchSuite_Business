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

/** Business names such as "3M Traders" or "24x7 Mart" may begin with a letter or a digit. */
export function ManualBusinessName(): PropertyDecorator {
  return (target, property) => {
    ManualText()(target, property);
    Matches(/^(?:[\p{L}\d][\s\S]*)?$/u, { message: '$property must start with a letter or digit' })(target, property);
  };
}

/** Names may contain word spaces and punctuation, but must begin with a letter. */
export function ManualName(): PropertyDecorator {
  return (target, property) => {
    ManualText()(target, property);
    Matches(/^(?:\p{L}[\s\S]*)?$/u, { message: '$property must start with a letter' })(target, property);
  };
}
