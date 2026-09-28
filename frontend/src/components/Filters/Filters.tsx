import { SlidersOutlined } from '@ant-design/icons';
import { Badge, Button, Form, Grid, Modal, Select, Tag } from 'antd';
import type { SelectProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import styles from './Filters.module.scss';

const DEFAULT_MOBILE_VISIBLE_TAGS_COUNT = 3;

type FilterFieldName<T> = Extract<keyof T, string>;

type BaseFilterField<T> = {
  name: FilterFieldName<T>;
  label: string;
  primary?: boolean;
  isActive?: (value: unknown) => boolean;
};

export type SelectFilterField<T> = BaseFilterField<T> & {
  type: 'select';
  placeholder?: string;
  options: SelectProps['options'];
  selectProps?: Omit<SelectProps, 'options' | 'placeholder'>;
};

export type CustomFilterField<T> = BaseFilterField<T> & {
  type: 'custom';
  render: () => ReactNode;
};

export type FilterField<T> = SelectFilterField<T> | CustomFilterField<T>;

type SelectedFilter<T> = {
  key: string;
  name: FilterFieldName<T>;
  value: string | number;
  label: ReactNode;
};

type FiltersProps<T extends Record<string, unknown>> = {
  fields: FilterField<T>[];
  initialValues: T;
  resetValues: T;
  onApply: (values: T) => void;
  onReset?: () => void;
  applyButtonText?: string;
  resetButtonText?: string;
  mobileVisibleTagsCount?: number;
  mobileModalTitle?: string;
};

const getOptionLabel = (options: SelectProps['options'], value: string | number): ReactNode => {
  if (!options) {
    return String(value);
  }

  for (const option of options) {
    if ('options' in option && Array.isArray(option.options)) {
      const nestedLabel = getOptionLabel(option.options, value);

      if (nestedLabel !== String(value)) {
        return nestedLabel;
      }
    }

    if ('value' in option && option.value === value) {
      return option.label ?? String(value);
    }
  }

  return String(value);
};

const Filters = <T extends Record<string, unknown>>({
  fields,
  initialValues,
  resetValues,
  onApply,
  onReset,
  applyButtonText = 'Применить',
  resetButtonText = 'Сбросить',
  mobileVisibleTagsCount = DEFAULT_MOBILE_VISIBLE_TAGS_COUNT,
  mobileModalTitle = 'Фильтры',
}: FiltersProps<T>) => {
  const [form] = Form.useForm<T>();
  const screens = Grid.useBreakpoint();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const modalInitialValuesRef = useRef<T | null>(null);

  const watchedValues = Form.useWatch([], form) as T | undefined;

  const currentValues = watchedValues ?? initialValues;

  useEffect(() => {
    form.setFieldsValue(initialValues);
    modalInitialValuesRef.current = null;
  }, [form, initialValues]);

  const isMobile = screens.md === false;

  const filtersClassName = [styles.form__filters, fields.length > 6 && styles.form__filters_twoRows]
    .filter(Boolean)
    .join(' ');

  const handleApply = () => {
    const values = form.getFieldsValue(true) as T;

    modalInitialValuesRef.current = null;
    setIsModalOpen(false);

    onApply(values);
  };

  const handleReset = () => {
    form.setFieldsValue(resetValues);

    modalInitialValuesRef.current = null;

    if (onReset) {
      onReset();
      return;
    }

    onApply(resetValues);
  };

  const handleOpenModal = () => {
    modalInitialValuesRef.current = form.getFieldsValue(true) as T;

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (modalInitialValuesRef.current) {
      form.setFieldsValue(modalInitialValuesRef.current);
    }

    modalInitialValuesRef.current = null;
    setIsModalOpen(false);
  };

  const handleRemoveFilter = (name: FilterFieldName<T>, value: string | number) => {
    const values = currentValues[name];

    if (!Array.isArray(values)) {
      return;
    }

    const nextValues = {
      ...currentValues,
      [name]: values.filter((item) => item !== value),
    } as T;

    form.setFieldsValue(nextValues);

    onApply(nextValues);
  };

  const selectedFilters = fields.flatMap<SelectedFilter<T>>((field) => {
    if (field.type !== 'select') {
      return [];
    }

    const values = currentValues[field.name];

    if (!Array.isArray(values)) {
      return [];
    }

    return values
      .filter(
        (value): value is string | number => typeof value === 'string' || typeof value === 'number',
      )
      .map((value) => ({
        key: `${field.name}-${value}`,
        name: field.name,
        value,
        label: getOptionLabel(field.options, value),
      }));
  });

  const visibleFilters = selectedFilters.slice(0, mobileVisibleTagsCount);

  const hiddenFiltersCount = Math.max(selectedFilters.length - mobileVisibleTagsCount, 0);

  const activeFiltersCount = fields.reduce((count, field) => {
    const value = currentValues[field.name];

    if (field.isActive) {
      return field.isActive(value) ? count + 1 : count;
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? count + 1 : count;
    }

    return value ? count + 1 : count;
  }, 0);

  const renderFields = () =>
    fields.map((field) => {
      const className = [styles.filters__item, field.primary && styles.filters__item_primary]
        .filter(Boolean)
        .join(' ');

      return (
        <Form.Item<Record<string, unknown>>
          key={field.name}
          name={field.name}
          label={field.label}
          className={className}
        >
          {field.type === 'custom' ? (
            field.render()
          ) : (
            <Select
              mode="multiple"
              allowClear
              showSearch={{
                optionFilterProp: 'label',
              }}
              maxTagCount={2}
              maxTagTextLength={10}
              maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
              notFoundContent="Ничего не найдено"
              {...field.selectProps}
              placeholder={field.placeholder}
              options={field.options}
            />
          )}
        </Form.Item>
      );
    });

  const gridStyle = {
    '--filters-columns-count': Math.max(fields.length - 1, 1),
  } as CSSProperties;

  const actions = (
    <>
      <Button onClick={handleReset}>{resetButtonText}</Button>

      <Button type="primary" onClick={handleApply}>
        {applyButtonText}
      </Button>
    </>
  );

  return (
    <Form<T>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      preserve
      className={styles.form}
    >
      {isMobile ? (
        <>
          <div className={styles.mobileFilters}>
            <Badge count={activeFiltersCount} size="small" showZero={false}>
              <Button
                icon={<SlidersOutlined />}
                aria-label="Открыть фильтры"
                onClick={handleOpenModal}
                className={styles.mobileFilters__button}
              />
            </Badge>

            <div className={styles.mobileFilters__selected}>
              {visibleFilters.map(({ key, name, value, label }) => (
                <Tag
                  key={key}
                  closable
                  className={styles.mobileFilters__tag}
                  onClose={(event) => {
                    event.preventDefault();
                    handleRemoveFilter(name, value);
                  }}
                >
                  {label}
                </Tag>
              ))}

              {hiddenFiltersCount > 0 && (
                <Tag className={styles.mobileFilters__tag}>+{hiddenFiltersCount}</Tag>
              )}
            </div>
          </div>

          <Modal
            open={isModalOpen}
            title={mobileModalTitle}
            footer={null}
            onCancel={handleCloseModal}
            destroyOnHidden
            width={420}
            className={styles.mobileModal}
          >
            <div className={styles.mobileModal__filters}>{renderFields()}</div>

            <div className={styles.mobileModal__actions}>{actions}</div>
          </Modal>
        </>
      ) : (
        <>
          <div className={filtersClassName} style={gridStyle}>
            {renderFields()}
          </div>

          <div className={styles.form__actions}>{actions}</div>
        </>
      )}
    </Form>
  );
};

export default Filters;
