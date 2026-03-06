import * as React from 'react';
import { TextField, type TextFieldProps } from './TextField.js';

export interface DatePickerProps extends Omit<TextFieldProps, 'type'> {
  readonly pickerClassName?: string;
  readonly pickerStyle?: React.CSSProperties;
}

type DatePickerElement = React.ElementRef<'input'>;

export const DatePicker = React.forwardRef<DatePickerElement, DatePickerProps>(
  (
    {
      pickerClassName,
      pickerStyle,
      inputClassName,
      inputStyle,
      ...rest
    },
    forwardedRef
  ) => {
    const mergedInputClassName = ['form-field__date-picker', inputClassName, pickerClassName]
      .filter(Boolean)
      .join(' ');
    const mergedInputStyle = pickerStyle
      ? { ...inputStyle, ...pickerStyle }
      : inputStyle;

    return (
      <TextField
        ref={forwardedRef}
        {...rest}
        type="date"
        inputClassName={mergedInputClassName}
        inputStyle={mergedInputStyle}
      />
    );
  }
);

DatePicker.displayName = 'OODS.DatePicker';
