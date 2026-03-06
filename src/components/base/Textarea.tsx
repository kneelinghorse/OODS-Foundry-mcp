import * as React from 'react';
import type { TextareaHTMLAttributes } from 'react';
import {
  resolveFieldMetadata,
  type FieldDensity,
  type FieldValidation,
} from './fieldUtils.js';

type TextareaInputProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id' | 'children' | 'className' | 'style'
>;

const DEFAULT_REQUIRED_INDICATOR = (
  <span className="form-field__required-indicator" aria-hidden="true">
    *
  </span>
);

export interface TextareaProps extends TextareaInputProps {
  readonly id: string;
  readonly label: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly validation?: FieldValidation;
  readonly density?: FieldDensity;
  readonly requiredIndicator?: React.ReactNode;
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly textareaClassName?: string;
  readonly textareaStyle?: React.CSSProperties;
}

type TextareaElement = React.ElementRef<'textarea'>;

export const Textarea = React.forwardRef<TextareaElement, TextareaProps>(
  (
    {
      id,
      label,
      description,
      validation,
      density = 'comfortable',
      requiredIndicator,
      className,
      style,
      textareaClassName,
      textareaStyle,
      rows = 4,
      ...rest
    },
    forwardedRef
  ) => {
    const { required, ...textareaProps } = rest;

    const metadata = resolveFieldMetadata(id, {
      hasDescription: Boolean(description),
      validation,
    });

    const containerClassName = ['form-field', className].filter(Boolean).join(' ');
    const containerStyle = metadata.variables
      ? style
        ? ({ ...metadata.variables, ...style } as React.CSSProperties)
        : metadata.variables
      : style;

    const mergedTextareaClassName = ['form-field__input', 'form-field__textarea', textareaClassName]
      .filter(Boolean)
      .join(' ');

    const indicator =
      required && requiredIndicator !== null
        ? requiredIndicator ?? DEFAULT_REQUIRED_INDICATOR
        : null;

    return (
      <div
        className={containerClassName}
        style={containerStyle}
        data-density={density}
        data-validation-state={metadata.dataValidationState}
      >
        <label className="form-field__label" htmlFor={id}>
          <span>{label}</span>
          {indicator}
        </label>
        <div className="form-field__control">
          <textarea
            ref={forwardedRef}
            id={id}
            className={mergedTextareaClassName}
            style={textareaStyle}
            aria-describedby={metadata.describedBy}
            aria-invalid={metadata.ariaInvalid}
            data-validation-state={metadata.dataValidationState}
            required={required}
            rows={rows}
            {...textareaProps}
          />
        </div>
        {description ? (
          <p id={metadata.descriptionId} className="form-field__description">
            {description}
          </p>
        ) : null}
        {validation?.message ? (
          <p
            id={metadata.validationId}
            className="form-field__validation"
            role={validation.state === 'error' ? 'alert' : 'status'}
            aria-live={validation.state === 'error' ? 'assertive' : 'polite'}
            data-state={validation.state}
          >
            {validation.message}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'OODS.Textarea';
